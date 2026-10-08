import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { ClientSession, Db } from "mongodb";
import { MAX_QUANTITY, type CatalogProduct } from "@/lib/catalog";
import { getMongoClient } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import { marketForShippingCountry } from "@/lib/shipping-market";
import { settlePaymentInventory } from "./inventory";
import type { PaymentOrderQuote } from "./order-pricing";
import type { PaymentProviderId, VerifiedPaymentEvent } from "./providers";

export const PAYMENT_INITIATION_MS = 30 * 60 * 1000;
export const paymentIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PaymentCustomer = Record<"name" | "email" | "phone" | "address" | "district" | "province" | "country" | "postcode" | "notes", string>;
export type PaymentOrderStatus = "pending" | "paid";
export type PaymentAttemptStatus = "creating" | "ready" | "uncertain" | "failed" | "paid";

export type PaymentOrder = {
  _id: string;
  fingerprint: string;
  reference: string;
  locale: Locale;
  customer: PaymentCustomer;
  items: (PaymentOrderQuote["items"][number] & { name: string })[];
  currency: "THB";
  subtotalMinor: number;
  shippingMinor: 0;
  totalMinor: number;
  status: PaymentOrderStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  activeAttemptId?: string;
  lastAttemptId?: string;
  paidAttemptId?: string;
  paidAt?: Date;
  unstartedExpiredAt?: Date;
  fulfilmentRevision?: number;
  secondaryPaidAttemptIds?: string[];
  requiresPaymentReview?: boolean;
};

export type PaymentAttempt = {
  _id: string;
  orderId: string;
  provider: PaymentProviderId;
  status: PaymentAttemptStatus;
  currency: "THB";
  amountMinor: number;
  /** Frozen Stripe request fields: retrying an uncertain create must send
   * exactly the same parameters with the same provider idempotency key. */
  providerExpiresAtUnix: number;
  siteOrigin: string;
  providerPaymentId?: string;
  redirectUrl?: string;
  providerCallLeaseId?: string;
  providerCallLeaseUntil?: Date;
  failureSource?: "provider-create" | "verified";
  lastEventId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentEventRecord = {
  _id: string;
  orderId: string;
  attemptId: string;
  providerPaymentId: string;
  status: VerifiedPaymentEvent["status"];
  processedAt: Date;
};

export class PaymentOrderError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) {
    super(message);
    this.name = "PaymentOrderError";
  }
}

/** Payment and inventory writes must share one durable MongoDB transaction.
 * Never fall back to independent writes when sessions are unavailable. */
export async function withPaymentTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const client = await getMongoClient();
  if (!client) throw new PaymentOrderError("PAYMENT_UNAVAILABLE", 503, "Transactional payment storage is unavailable.");
  const session = client.startSession();
  try {
    return await session.withTransaction(() => work(session), {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      maxCommitTimeMS: 10_000,
    });
  } finally {
    await session.endSession();
  }
}

/** A separate server secret protects retry/fallback operations. The token is
 * never placed in a provider URL, result URL, or database document. */
export function paymentAccessToken(orderId: string): string {
  const secret = process.env.PAYMENT_ACCESS_SECRET;
  if (!secret || secret.length < 32) throw new PaymentOrderError("PAYMENT_UNAVAILABLE", 503, "Online payment is not configured.");
  return createHmac("sha256", secret).update(`vetra-payment-order:${orderId}`).digest("base64url");
}

export function validPaymentAccess(orderId: string, token: string | null): boolean {
  if (!paymentIdPattern.test(orderId) || !token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const expected = Buffer.from(paymentAccessToken(orderId));
  const actual = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function paymentSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured) throw new PaymentOrderError("PAYMENT_UNAVAILABLE", 503, "A public site URL is required for online payment.");
  let url: URL;
  try { url = new URL(configured); }
  catch { throw new PaymentOrderError("PAYMENT_UNAVAILABLE", 503, "The public site URL is invalid."); }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new PaymentOrderError("PAYMENT_UNAVAILABLE", 503, "The public site URL is invalid.");
  }
  return url.origin;
}

export function paymentsConfigured(): boolean {
  const uri = process.env.MONGODB_URI, database = process.env.MONGODB_DB;
  if (process.env.PAYMENTS_ENABLED !== "true" || process.env.CMS_STORAGE !== "mongodb" || !uri || !/^mongodb(?:\+srv)?:\/\/[^/?#]+/i.test(uri) || !database || database !== database.trim()) return false;
  try { paymentAccessToken("configuration-check"); paymentSiteOrigin(); return true; }
  catch { return false; }
}

const limits = { name: 100, email: 254, phone: 30, address: 500, district: 100, province: 100, country: 100, postcode: 5, notes: 1000 } as const;

/** Online payment currently accepts Thai delivery only. International
 * deliveries use THB-priced enquiries with shipping included. */
export function parsePaymentOrderInput(data: Record<string, unknown>) {
  if (data.market !== "TH" || !["th", "en", "ar"].includes(String(data.locale))) throw new PaymentOrderError("SHIPPING_UNAVAILABLE", 409, "Online payment is available only for delivery within Thailand. Please send an enquiry for other destinations.");
  if (data.consent !== true || !data.customer || typeof data.customer !== "object" || Array.isArray(data.customer)) {
    throw new PaymentOrderError("INVALID_CUSTOMER", 400, "Please check your details.");
  }
  const input = data.customer as Record<string, unknown>;
  const customer = {} as PaymentCustomer;
  for (const [field, limit] of Object.entries(limits)) {
    const value = input[field];
    if (typeof value !== "string" || value.length > limit || (field !== "notes" && !value.trim())) {
      throw new PaymentOrderError("INVALID_CUSTOMER", 400, "Please check your details.");
    }
    customer[field as keyof PaymentCustomer] = value.trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) || !/^[+()\d\s.-]{7,30}$/.test(customer.phone) || !/^\d{5}$/.test(customer.postcode) || marketForShippingCountry(customer.country) !== "TH") {
    throw new PaymentOrderError("INVALID_CUSTOMER", 400, "Please check your contact details.");
  }
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > 100) {
    throw new PaymentOrderError("INVALID_BAG", 400, "Please check your bag.");
  }
  const ids = new Set<string>();
  const items: { id: string; quantity: number }[] = [];
  for (const item of data.items) {
    if (!item || typeof item !== "object") throw new PaymentOrderError("INVALID_BAG", 400, "Please check your bag.");
    const line = item as Record<string, unknown>;
    if (typeof line.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(line.id) || line.id.length > 80 || ids.has(line.id) || !Number.isInteger(line.quantity) || Number(line.quantity) < 1 || Number(line.quantity) > MAX_QUANTITY) {
      throw new PaymentOrderError("INVALID_BAG", 400, "Please check your bag.");
    }
    ids.add(line.id);
    items.push({ id: line.id, quantity: line.quantity as number });
  }
  if (!Number.isSafeInteger(data.expectedTotalMinor) || Number(data.expectedTotalMinor) < 1) {
    throw new PaymentOrderError("INVALID_TOTAL", 400, "Please review the displayed total.");
  }
  return { locale: data.locale as Locale, market: "TH" as const, customer, items, expectedTotalMinor: data.expectedTotalMinor as number };
}

export function paymentOrderFingerprint(input: ReturnType<typeof parsePaymentOrderInput>): string {
  return createHash("sha256").update(JSON.stringify({
    locale: input.locale,
    market: input.market,
    customer: input.customer,
    items: [...input.items].sort((a, b) => a.id.localeCompare(b.id)),
    expectedTotalMinor: input.expectedTotalMinor,
  })).digest("hex");
}

export function newPaymentOrder(id: string, fingerprint: string, input: ReturnType<typeof parsePaymentOrderInput>, quote: PaymentOrderQuote, products: readonly CatalogProduct[], now = new Date()): PaymentOrder {
  if (!paymentIdPattern.test(id) || quote.currency !== "THB" || quote.subtotalMinor !== input.expectedTotalMinor || !Number.isSafeInteger(quote.subtotalMinor) || quote.subtotalMinor < 1000) {
    throw new PaymentOrderError("INVALID_TOTAL", 409, "The order total needs review.");
  }
  return {
    _id: id,
    fingerprint,
    reference: `VT-P-${id.replace(/-/g, "").slice(0, 12).toUpperCase()}`,
    locale: input.locale,
    customer: input.customer,
    items: quote.items.map((line) => ({ ...line, name: products.find((product) => product.id === line.id)?.name[input.locale] ?? line.id })),
    currency: "THB",
    subtotalMinor: quote.subtotalMinor,
    shippingMinor: 0,
    totalMinor: quote.subtotalMinor,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + PAYMENT_INITIATION_MS),
  };
}

/** Provider outcomes, the order and the inventory ledger commit together.
 * A later verified success can supersede a failure, and a second charge is
 * retained for review without committing the same order's stock twice. */
export async function applyVerifiedPaymentEvent(db: Db, event: VerifiedPaymentEvent): Promise<void> {
  const orders = db.collection<PaymentOrder>("payment_orders");
  const attempts = db.collection<PaymentAttempt>("payment_attempts");
  const events = db.collection<PaymentEventRecord>("payment_events");
  await withPaymentTransaction(async (session) => {
    // The driver does not support parallel operations on one transaction.
    const order = await orders.findOne({ _id: event.orderId }, { session });
    const attempt = await attempts.findOne({ _id: event.attemptId }, { session });
    if (!order || !attempt || attempt.orderId !== order._id || attempt.provider !== event.provider || order.reference !== event.reference || order.currency !== event.currency || attempt.currency !== event.currency || order.totalMinor !== event.amountMinor || attempt.amountMinor !== event.amountMinor || (attempt.providerPaymentId && attempt.providerPaymentId !== event.providerPaymentId)) {
      throw new PaymentOrderError("PAYMENT_MISMATCH", 409, "Verified payment does not match the saved order.");
    }
    const eventId = `${event.provider}:${event.eventId}`;
    const receipt = await events.findOne({ _id: eventId }, { session });
    if (receipt) {
      if (receipt.orderId !== order._id || receipt.attemptId !== attempt._id || receipt.providerPaymentId !== event.providerPaymentId || receipt.status !== event.status) {
        throw new PaymentOrderError("PAYMENT_MISMATCH", 409, "Verified payment event does not match its saved receipt.");
      }
      return;
    }

    const now = new Date();
    if (event.status === "paid") {
      if (order.status === "pending") {
        const inventory = await settlePaymentInventory(db, order, "paid", session);
        // An older attempt can succeed after its reservation was released and
        // a newer attempt reserved this order again. The newer provider
        // payment may still be payable, so hold fulfilment for staff review.
        const anotherAttemptActive = order.activeAttemptId !== attempt._id;
        const marked = await orders.updateOne({ _id: order._id, status: "pending" }, {
          $set: { status: "paid", paidAttemptId: attempt._id, paidAt: now, updatedAt: now, ...(inventory.requiresReview || anotherAttemptActive ? { requiresPaymentReview: true } : {}) },
        }, { session });
        if (marked.modifiedCount !== 1) throw new PaymentOrderError("PAYMENT_BUSY", 503, "Payment state changed. Retry the verified event.");
      } else if (order.paidAttemptId !== attempt._id) {
        await orders.updateOne({ _id: order._id, status: "paid" }, {
          $set: { requiresPaymentReview: true, updatedAt: now },
          $addToSet: { secondaryPaidAttemptIds: attempt._id },
        }, { session });
      }
      await attempts.updateOne({ _id: attempt._id }, {
        $set: { status: "paid", providerPaymentId: event.providerPaymentId, lastEventId: event.eventId, updatedAt: now },
        $unset: { providerCallLeaseId: "", providerCallLeaseUntil: "" },
      }, { session });
    } else if (event.status === "failed" && attempt.status !== "paid") {
      await attempts.updateOne({ _id: attempt._id, status: { $ne: "paid" } }, {
        $set: { status: "failed", failureSource: "verified", providerPaymentId: event.providerPaymentId, lastEventId: event.eventId, updatedAt: now },
        $unset: { providerCallLeaseId: "", providerCallLeaseUntil: "" },
      }, { session });
      if (order.status === "pending" && order.activeAttemptId === attempt._id) {
        await settlePaymentInventory(db, order, "released", session);
        const cleared = await orders.updateOne({ _id: order._id, status: "pending", activeAttemptId: attempt._id }, {
          $unset: { activeAttemptId: "" }, $set: { updatedAt: now },
        }, { session });
        if (cleared.modifiedCount !== 1) throw new PaymentOrderError("PAYMENT_BUSY", 503, "Payment state changed. Retry the verified event.");
      }
    } else if (event.status === "pending") {
      if (attempt.status === "failed" && attempt.failureSource === "provider-create") {
        // The provider found a payment after its create call appeared to fail.
        // This order must be reconciled before another charge is attempted.
        await attempts.updateOne({ _id: attempt._id, status: "failed", failureSource: "provider-create" }, {
          $set: { status: "uncertain", providerPaymentId: event.providerPaymentId, lastEventId: event.eventId, updatedAt: now },
        }, { session });
        if (order.status === "pending") await orders.updateOne({ _id: order._id, status: "pending" }, { $set: { requiresPaymentReview: true, updatedAt: now } }, { session });
      } else if (!attempt.providerPaymentId) {
        // A pending webhook can identify a Session whose create response was lost.
        await attempts.updateOne({ _id: attempt._id, providerPaymentId: { $exists: false } }, {
          $set: { providerPaymentId: event.providerPaymentId, lastEventId: event.eventId, updatedAt: now },
        }, { session });
      }
    }
    await events.insertOne({ _id: eventId, orderId: order._id, attemptId: attempt._id, providerPaymentId: event.providerPaymentId, status: event.status, processedAt: now }, { session });
  });
}

/** Release an expired order only when no provider attempt was ever claimed.
 * An attempt's local expiry cannot establish that its provider payment failed,
 * so those orders require provider reconciliation instead. */
export async function releaseExpiredUnstartedPaymentOrders(db: Db, limit = 50): Promise<number> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new PaymentOrderError("INVALID_LIMIT", 400, "Choose a valid cleanup limit.");
  const orders = db.collection<PaymentOrder>("payment_orders");
  const candidates = await orders.find({
    status: "pending",
    expiresAt: { $lte: new Date() },
    activeAttemptId: { $exists: false },
    lastAttemptId: { $exists: false },
    unstartedExpiredAt: { $exists: false },
  }).sort({ expiresAt: 1, _id: 1 }).limit(limit).toArray();
  let released = 0;
  for (const candidate of candidates) {
    const changed = await withPaymentTransaction(async (session) => {
      const current = await orders.findOne({ _id: candidate._id }, { session });
      if (!current || current.status !== "pending" || current.activeAttemptId || current.lastAttemptId || current.unstartedExpiredAt || Date.now() < new Date(current.expiresAt).getTime()) return false;
      await settlePaymentInventory(db, current, "released", session);
      const now = new Date();
      const marked = await orders.updateOne({ _id: current._id, status: "pending", activeAttemptId: { $exists: false }, lastAttemptId: { $exists: false }, unstartedExpiredAt: { $exists: false } }, {
        $set: { unstartedExpiredAt: now, updatedAt: now },
      }, { session });
      if (marked.modifiedCount !== 1) throw new PaymentOrderError("PAYMENT_BUSY", 503, "Order state changed during cleanup. Retry later.");
      return true;
    });
    if (changed) released++;
  }
  return released;
}

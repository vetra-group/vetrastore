import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { localizedPath } from "@/lib/i18n";
import { PaymentOrderError, paymentAccessToken, paymentSiteOrigin, type PaymentAttempt, type PaymentOrder } from "./orders";
import { getProvider, PaymentProviderError, type PaymentProviderId } from "./providers";

export type PaymentStartResult = {
  orderId: string;
  reference: string;
  checkoutUrl: string;
  currency: "THB";
  amountMinor: number;
  accessToken: string;
};

function resultUrl(order: PaymentOrder): string {
  const url = new URL(localizedPath(order.locale, "/checkout/result"), paymentSiteOrigin());
  url.searchParams.set("order", order._id);
  return url.toString();
}

function response(order: PaymentOrder, checkoutUrl: string): PaymentStartResult {
  return {
    orderId: order._id,
    reference: order.reference,
    checkoutUrl,
    currency: "THB",
    amountMinor: order.totalMinor,
    accessToken: paymentAccessToken(order._id),
  };
}

/** One active attempt per order. If provider creation is uncertain, retry the
 * SAME attempt and its provider idempotency key; never switch automatically. */
export async function startPaymentAttempt(db: Db, orderId: string, providerId: PaymentProviderId): Promise<PaymentStartResult> {
  const provider = getProvider(providerId);
  if (!provider.available) throw new PaymentOrderError("PROVIDER_UNAVAILABLE", 409, "This payment provider is not available. Please choose another available provider.");
  const orders = db.collection<PaymentOrder>("payment_orders");
  const attempts = db.collection<PaymentAttempt>("payment_attempts");
  let order: PaymentOrder | null = null;
  let attempt: PaymentAttempt | null = null;
  for (let turn = 0; turn < 4; turn++) {
    order = await orders.findOne({ _id: orderId });
    if (!order) throw new PaymentOrderError("ORDER_NOT_FOUND", 404, "Order not found.");
    if (order.status === "paid") return response(order, resultUrl(order));
    if (Date.now() >= new Date(order.expiresAt).getTime()) throw new PaymentOrderError("ORDER_EXPIRED", 410, "This payment window expired. Please review your bag and start a new order.");
    if (order.activeAttemptId) {
      attempt = await attempts.findOne({ _id: order.activeAttemptId });
      if (!attempt || attempt.orderId !== orderId || attempt.amountMinor !== order.totalMinor || !Number.isSafeInteger(attempt.providerExpiresAtUnix) || !attempt.siteOrigin) throw new PaymentOrderError("ATTEMPT_MISMATCH", 409, "The saved payment attempt needs review.");
      if (attempt.provider !== providerId) throw new PaymentOrderError("ATTEMPT_ACTIVE", 409, "A payment is already in progress. Wait for its result before choosing another provider.");
      if (attempt.status === "paid") return response(order, resultUrl(order));
      if (attempt.status === "ready" && attempt.redirectUrl) return response(order, attempt.redirectUrl);
      if (attempt.status === "failed") {
        await orders.updateOne({ _id: orderId, activeAttemptId: attempt._id, status: "pending" }, { $unset: { activeAttemptId: "" } });
        continue;
      }
      break;
    }
    const id = randomUUID();
    const now = new Date();
    const proposed: PaymentAttempt = { _id: id, orderId, provider: providerId, status: "creating", currency: "THB", amountMinor: order.totalMinor, providerExpiresAtUnix: Math.floor(now.getTime() / 1000) + 31 * 60, siteOrigin: paymentSiteOrigin(), createdAt: now, updatedAt: now };
    await attempts.updateOne({ _id: id }, { $setOnInsert: proposed }, { upsert: true });
    // A Checkout Session can remain payable after an order's initial window.
    // Keep the order resumable through that attempt's frozen provider expiry.
    const result = await orders.updateOne({ _id: orderId, status: "pending", activeAttemptId: { $exists: false } }, { $set: { activeAttemptId: id, lastAttemptId: id, expiresAt: new Date(proposed.providerExpiresAtUnix * 1000), updatedAt: now } });
    if (result.modifiedCount !== 1) await attempts.updateOne({ _id: id }, { $set: { status: "failed", updatedAt: new Date() } });
    if (result.modifiedCount === 1) continue;
  }
  if (!order || !attempt) throw new PaymentOrderError("PAYMENT_BUSY", 503, "Payment setup is busy. Please retry with the same order.");

  try {
    const created = await provider.createPayment({
      orderId: order._id,
      attemptId: attempt._id,
      reference: order.reference,
      amountMinor: order.totalMinor,
      currency: order.currency,
      customerEmail: order.customer.email,
      locale: order.locale,
      siteOrigin: attempt.siteOrigin,
      expiresAtUnix: attempt.providerExpiresAtUnix,
      lines: order.items.map((line) => ({ name: line.name, quantity: line.quantity, lineTotalMinor: line.lineTotalMinor })),
    });
    // A webhook may have marked this attempt paid while Stripe responded.
    await attempts.updateOne({ _id: attempt._id, status: { $in: ["creating", "uncertain", "ready"] } }, { $set: { status: "ready", providerPaymentId: created.providerPaymentId, redirectUrl: created.redirectUrl, updatedAt: new Date() } });
    const latest = await orders.findOne({ _id: order._id });
    return response(latest || order, latest?.status === "paid" ? resultUrl(latest) : created.redirectUrl);
  } catch (error) {
    const latestAttempt = await attempts.findOne({ _id: attempt._id });
    const latestOrder = await orders.findOne({ _id: order._id });
    if (latestOrder?.status === "paid") return response(latestOrder, resultUrl(latestOrder));
    if (latestAttempt?.status === "ready" && latestAttempt.redirectUrl) return response(latestOrder || order, latestAttempt.redirectUrl);
    const definite = error instanceof PaymentProviderError && ["unavailable", "invalid-input", "rejected"].includes(error.kind);
    const status = definite ? "failed" : "uncertain";
    const changed = await attempts.updateOne({ _id: attempt._id, status: { $in: ["creating", "uncertain"] } }, { $set: { status, updatedAt: new Date() } });
    if (definite && changed.modifiedCount === 1) await orders.updateOne({ _id: order._id, activeAttemptId: attempt._id, status: "pending" }, { $unset: { activeAttemptId: "" } });
    if (error instanceof PaymentProviderError && definite) throw new PaymentOrderError("PAYMENT_NOT_STARTED", 409, "Payment could not begin. Please choose an available provider or try again.");
    throw new PaymentOrderError("PAYMENT_UNCERTAIN", 503, "Payment setup could not be confirmed. Retry this same order; do not start another payment yet.");
  }
}

export async function readPaymentResult(db: Db, orderId: string): Promise<{ reference: string; status: "pending" | "paid" | "failed" } | null> {
  const order = await db.collection<PaymentOrder>("payment_orders").findOne({ _id: orderId });
  if (!order) return null;
  if (order.status === "paid") return { reference: order.reference, status: "paid" };
  const attempt = order.lastAttemptId ? await db.collection<PaymentAttempt>("payment_attempts").findOne({ _id: order.lastAttemptId }) : null;
  return { reference: order.reference, status: attempt?.status === "failed" ? "failed" : "pending" };
}

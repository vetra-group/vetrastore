import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import type { CmsProduct } from "@/lib/cms/types";
import { localizedPath } from "@/lib/i18n";
import { PaymentInventoryError, reservePaymentInventory, settlePaymentInventory } from "./inventory";
import { PaymentOrderError, paymentAccessToken, paymentSiteOrigin, withPaymentTransaction, type PaymentAttempt, type PaymentOrder } from "./orders";
import { getProvider, PaymentProviderError, type PaymentProviderId } from "./providers";

const PROVIDER_CALL_LEASE_MS = 60_000;

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

/** One active attempt per order. The published catalog is loaded only when a
 * new stock reservation is needed; an existing payable Session can resume
 * even if catalog publishing is temporarily unavailable. */
export async function startPaymentAttempt(db: Db, orderId: string, providerId: PaymentProviderId, loadProducts: () => Promise<readonly CmsProduct[]>): Promise<PaymentStartResult> {
  const provider = getProvider(providerId);
  if (!provider.available) throw new PaymentOrderError("PROVIDER_UNAVAILABLE", 409, "This payment provider is not available. Please choose another available provider.");
  if (typeof loadProducts !== "function") throw new PaymentOrderError("PAYMENT_UNAVAILABLE", 503, "Current product stock is unavailable.");
  const orders = db.collection<PaymentOrder>("payment_orders");
  const attempts = db.collection<PaymentAttempt>("payment_attempts");
  let order: PaymentOrder | null = null;
  let attempt: PaymentAttempt | null = null;
  for (let turn = 0; turn < 4; turn++) {
    order = await orders.findOne({ _id: orderId });
    if (!order) throw new PaymentOrderError("ORDER_NOT_FOUND", 404, "Order not found.");
    if (order.status === "paid") return response(order, resultUrl(order));
    if (order.requiresPaymentReview) throw new PaymentOrderError("PAYMENT_REVIEW_REQUIRED", 409, "This payment needs staff review before another charge can begin.");
    if (Date.now() >= new Date(order.expiresAt).getTime()) throw new PaymentOrderError("ORDER_EXPIRED", 410, "This payment window expired. Please review your bag and start a new order.");
    if (order.activeAttemptId) {
      attempt = await attempts.findOne({ _id: order.activeAttemptId });
      if (!attempt || attempt.orderId !== orderId || attempt.amountMinor !== order.totalMinor || !Number.isSafeInteger(attempt.providerExpiresAtUnix) || !attempt.siteOrigin) throw new PaymentOrderError("ATTEMPT_MISMATCH", 409, "The saved payment attempt needs review.");
      if (attempt.provider !== providerId) throw new PaymentOrderError("ATTEMPT_ACTIVE", 409, "A payment is already in progress. Wait for its result before choosing another provider.");
      if (attempt.status === "paid") return response(order, resultUrl(order));
      if (attempt.status === "ready" && attempt.redirectUrl) return response(order, attempt.redirectUrl);
      if (attempt.status === "failed") {
        // Repair a legacy/stale active pointer only after the failed attempt's
        // reservation has been released in the same transaction.
        await withPaymentTransaction(async (session) => {
          const current = await orders.findOne({ _id: orderId }, { session });
          const failed = await attempts.findOne({ _id: attempt!._id }, { session });
          if (!current || !failed || current.status !== "pending" || current.activeAttemptId !== failed._id || failed.status !== "failed") return;
          await settlePaymentInventory(db, current, "released", session);
          await orders.updateOne({ _id: orderId, activeAttemptId: failed._id, status: "pending" }, { $unset: { activeAttemptId: "" }, $set: { updatedAt: new Date() } }, { session });
        });
        continue;
      }
      break;
    }
    let products: readonly CmsProduct[];
    try { products = await loadProducts(); }
    catch { throw new PaymentOrderError("STOCK_UNAVAILABLE", 503, "Current product stock is unavailable. Retry this order."); }
    const id = randomUUID();
    const now = new Date();
    const proposed: PaymentAttempt = { _id: id, orderId, provider: providerId, status: "creating", currency: "THB", amountMinor: order.totalMinor, providerExpiresAtUnix: Math.floor(now.getTime() / 1000) + 31 * 60, siteOrigin: paymentSiteOrigin(), createdAt: now, updatedAt: now };
    try {
      await withPaymentTransaction(async (session) => {
        const current = await orders.findOne({ _id: orderId }, { session });
        if (!current || current.status === "paid" || current.activeAttemptId) return;
        if (current.requiresPaymentReview) throw new PaymentOrderError("PAYMENT_REVIEW_REQUIRED", 409, "This payment needs staff review before another charge can begin.");
        if (Date.now() >= new Date(current.expiresAt).getTime()) throw new PaymentOrderError("ORDER_EXPIRED", 410, "This payment window expired. Please review your bag and start a new order.");
        await reservePaymentInventory(db, current, products, session);
        await attempts.insertOne(proposed, { session });
        // The provider's frozen Session expiry also bounds the order's
        // resumable payment window, but is not proof of a failed charge.
        const claimed = await orders.updateOne({ _id: orderId, status: "pending", activeAttemptId: { $exists: false } }, {
          $set: { activeAttemptId: id, lastAttemptId: id, expiresAt: new Date(proposed.providerExpiresAtUnix * 1000), updatedAt: now },
        }, { session });
        if (claimed.modifiedCount !== 1) throw new PaymentOrderError("PAYMENT_BUSY", 503, "Payment setup is busy. Retry this order.");
      });
    } catch (error) {
      if (error instanceof PaymentInventoryError) throw new PaymentOrderError(error.code, error.status, error.message);
      throw error;
    }
    continue;
  }
  if (!order || !attempt) throw new PaymentOrderError("PAYMENT_BUSY", 503, "Payment setup is busy. Please retry with the same order.");

  // A process can die after calling the provider. Another request may reclaim
  // the lease later, using this attempt's identical frozen request/key.
  const leaseId = randomUUID();
  const claimedLease = await attempts.updateOne({
    _id: attempt._id,
    status: { $in: ["creating", "uncertain"] },
    $or: [{ providerCallLeaseUntil: { $exists: false } }, { providerCallLeaseUntil: { $lte: new Date() } }],
  }, {
    $set: { providerCallLeaseId: leaseId, providerCallLeaseUntil: new Date(Date.now() + PROVIDER_CALL_LEASE_MS), updatedAt: new Date() },
  });
  if (claimedLease.modifiedCount !== 1) {
    const latestOrder = await orders.findOne({ _id: orderId });
    if (latestOrder?.status === "paid") return response(latestOrder, resultUrl(latestOrder));
    const latestAttempt = await attempts.findOne({ _id: attempt._id });
    if (latestAttempt?.status === "ready" && latestAttempt.redirectUrl) return response(latestOrder || order, latestAttempt.redirectUrl);
    throw new PaymentOrderError("PAYMENT_BUSY", 503, "This payment is already being started. Retry the same order shortly.");
  }
  const beforeProvider = await orders.findOne({ _id: orderId });
  if (beforeProvider?.status === "paid") return response(beforeProvider, resultUrl(beforeProvider));
  if (!beforeProvider || beforeProvider.requiresPaymentReview || beforeProvider.activeAttemptId !== attempt._id) {
    await attempts.updateOne({ _id: attempt._id, providerCallLeaseId: leaseId }, { $unset: { providerCallLeaseId: "", providerCallLeaseUntil: "" } });
    throw new PaymentOrderError("PAYMENT_REVIEW_REQUIRED", 409, "This payment needs staff review before another charge can begin.");
  }

  let created;
  try {
    created = await provider.createPayment({
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
  } catch (error) {
    const definite = error instanceof PaymentProviderError && ["unavailable", "invalid-input", "rejected"].includes(error.kind);
    if (definite) {
      const outcome = await withPaymentTransaction(async (session) => {
        const currentOrder = await orders.findOne({ _id: orderId }, { session });
        const currentAttempt = await attempts.findOne({ _id: attempt!._id }, { session });
        if (!currentOrder || !currentAttempt) throw new PaymentOrderError("ATTEMPT_MISMATCH", 409, "The saved payment attempt needs review.");
        if (currentOrder.status === "paid" || currentAttempt.status === "paid") return "paid" as const;
        if (currentAttempt.status === "ready" && currentAttempt.redirectUrl) return "ready" as const;
        if (currentAttempt.providerCallLeaseId !== leaseId) return "busy" as const;
        // A signed pending webhook proves a provider payment exists even if
        // the create call subsequently appears to fail: keep the stock held.
        if (currentAttempt.providerPaymentId) {
          await attempts.updateOne({ _id: currentAttempt._id, providerCallLeaseId: leaseId }, {
            $set: { status: "uncertain", updatedAt: new Date() },
            $unset: { providerCallLeaseId: "", providerCallLeaseUntil: "" },
          }, { session });
          return "uncertain" as const;
        }
        await attempts.updateOne({ _id: currentAttempt._id, providerCallLeaseId: leaseId, status: { $in: ["creating", "uncertain"] } }, {
          $set: { status: "failed", failureSource: "provider-create", updatedAt: new Date() },
          $unset: { providerCallLeaseId: "", providerCallLeaseUntil: "" },
        }, { session });
        if (currentOrder.status === "pending" && currentOrder.activeAttemptId === currentAttempt._id) {
          await settlePaymentInventory(db, currentOrder, "released", session);
          await orders.updateOne({ _id: orderId, status: "pending", activeAttemptId: currentAttempt._id }, {
            $unset: { activeAttemptId: "" }, $set: { updatedAt: new Date() },
          }, { session });
        }
        return "failed" as const;
      });
      const latestOrder = await orders.findOne({ _id: orderId });
      if (latestOrder?.status === "paid") return response(latestOrder, resultUrl(latestOrder));
      const latestAttempt = await attempts.findOne({ _id: attempt._id });
      if (outcome === "ready" && latestAttempt?.redirectUrl) return response(latestOrder || order, latestAttempt.redirectUrl);
      if (outcome === "busy") throw new PaymentOrderError("PAYMENT_BUSY", 503, "This payment is already being started. Retry the same order shortly.");
      if (outcome === "uncertain") throw new PaymentOrderError("PAYMENT_UNCERTAIN", 503, "Payment setup could not be confirmed. Retry this same order; do not start another payment yet.");
      throw new PaymentOrderError("PAYMENT_NOT_STARTED", 409, "Payment could not begin. Please choose an available provider or try again.");
    }
    await attempts.updateOne({ _id: attempt._id, providerCallLeaseId: leaseId, status: { $in: ["creating", "uncertain"] } }, {
      $set: { status: "uncertain", updatedAt: new Date() },
      $unset: { providerCallLeaseId: "", providerCallLeaseUntil: "" },
    });
    const latestOrder = await orders.findOne({ _id: orderId });
    if (latestOrder?.status === "paid") return response(latestOrder, resultUrl(latestOrder));
    const latestAttempt = await attempts.findOne({ _id: attempt._id });
    if (latestAttempt?.status === "ready" && latestAttempt.redirectUrl) return response(latestOrder || order, latestAttempt.redirectUrl);
    throw new PaymentOrderError("PAYMENT_UNCERTAIN", 503, "Payment setup could not be confirmed. Retry this same order; do not start another payment yet.");
  }

  // A verified webhook may settle the order while the create call returns.
  const stored = await attempts.updateOne({ _id: attempt._id, providerCallLeaseId: leaseId, status: { $in: ["creating", "uncertain"] } }, {
    $set: { status: "ready", providerPaymentId: created.providerPaymentId, redirectUrl: created.redirectUrl, updatedAt: new Date() },
    $unset: { providerCallLeaseId: "", providerCallLeaseUntil: "" },
  });
  const latestOrder = await orders.findOne({ _id: orderId });
  if (latestOrder?.status === "paid") return response(latestOrder, resultUrl(latestOrder));
  if (stored.modifiedCount === 1) return response(latestOrder || order, created.redirectUrl);
  const latestAttempt = await attempts.findOne({ _id: attempt._id });
  if (latestAttempt?.status === "ready" && latestAttempt.redirectUrl) return response(latestOrder || order, latestAttempt.redirectUrl);
  throw new PaymentOrderError("PAYMENT_UNCERTAIN", 503, "Payment setup changed while the provider responded. Check this order before trying again.");
}

export async function readPaymentResult(db: Db, orderId: string): Promise<{ reference: string; status: "pending" | "paid" | "failed" } | null> {
  const order = await db.collection<PaymentOrder>("payment_orders").findOne({ _id: orderId });
  if (!order) return null;
  if (order.status === "paid") return { reference: order.reference, status: "paid" };
  const attempt = order.lastAttemptId ? await db.collection<PaymentAttempt>("payment_attempts").findOne({ _id: order.lastAttemptId }) : null;
  return { reference: order.reference, status: attempt?.status === "failed" ? "failed" : "pending" };
}

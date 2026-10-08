import { getDb } from "@/lib/db";
import { cmsErrorResponse, readCmsJson, withCmsIdentity } from "@/lib/cms/auth";
import { CmsError } from "@/lib/cms/validation";
import { applyVerifiedPaymentEvent, paymentIdPattern, PaymentOrderError, type PaymentAttempt, type PaymentOrder } from "@/lib/payments/orders";
import { PaymentInventoryError } from "@/lib/payments/inventory";
import { getProvider, PaymentProviderError } from "@/lib/payments/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow", Vary: "Cookie" };

/** An owner can refresh a saved attempt from the provider's server API. The
 * provider's reported outcome enters the same transactional path as a webhook.
 * A missing provider reference or open session remains pending for review. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    return await withCmsIdentity(request, true, async () => {
      const { id } = await context.params;
      if (!paymentIdPattern.test(id)) throw new CmsError("Invalid order reference.", 400, "INVALID_ORDER");
      const body = await readCmsJson(request, 1024);
      const attemptId = body.attemptId;
      if (typeof attemptId !== "string" || !paymentIdPattern.test(attemptId) || Object.keys(body).some((key) => key !== "attemptId")) {
        throw new CmsError("Choose a saved payment attempt.", 400, "INVALID_ATTEMPT");
      }
      const db = await getDb();
      if (!db) throw new CmsError("Payment records are unavailable.", 503, "PAYMENT_UNAVAILABLE");
      const [order, attempt] = await Promise.all([
        db.collection<PaymentOrder>("payment_orders").findOne({ _id: id }),
        db.collection<PaymentAttempt>("payment_attempts").findOne({ _id: attemptId, orderId: id }),
      ]);
      if (!order || !attempt) throw new CmsError("Payment attempt not found.", 404, "ATTEMPT_NOT_FOUND");
      if (!attempt.providerPaymentId) throw new CmsError("This attempt has no confirmed provider reference. Review it in the provider dashboard before retrying.", 409, "REFERENCE_MISSING");
      const event = await getProvider(attempt.provider).inspect({
        providerPaymentId: attempt.providerPaymentId,
        orderId: order._id,
        attemptId: attempt._id,
        reference: order.reference,
        amountMinor: attempt.amountMinor,
        currency: attempt.currency,
      });
      await applyVerifiedPaymentEvent(db, event);
      const [savedOrder, savedAttempt] = await Promise.all([
        db.collection<PaymentOrder>("payment_orders").findOne({ _id: id }),
        db.collection<PaymentAttempt>("payment_attempts").findOne({ _id: attemptId }),
      ]);
      return Response.json({ status: savedOrder?.status, attemptStatus: savedAttempt?.status, requiresPaymentReview: savedOrder?.requiresPaymentReview === true }, { headers });
    }, "admin");
  } catch (error) {
    if (error instanceof PaymentOrderError || error instanceof PaymentInventoryError) {
      return Response.json({ code: error.code, error: error.message }, { status: error.status, headers });
    }
    if (error instanceof PaymentProviderError) {
      return Response.json({ code: "RECONCILIATION_UNAVAILABLE", error: "The provider outcome could not be confirmed. Review the payment in the provider dashboard and try again." }, { status: error.kind === "invalid-input" ? 409 : 503, headers });
    }
    return cmsErrorResponse(error);
  }
}

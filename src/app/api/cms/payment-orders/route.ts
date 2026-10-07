import { getDb } from "@/lib/db";
import { cmsErrorResponse, withCmsIdentity } from "@/lib/cms/auth";
import { CmsError } from "@/lib/cms/validation";
import { paymentIdPattern, type PaymentAttempt, type PaymentOrder } from "@/lib/payments/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  Vary: "Cookie",
};

export async function GET(request: Request) {
  try {
    return await withCmsIdentity(request, false, async () => {
      if (process.env.CMS_STORAGE !== "mongodb") {
        return Response.json({ available: false, page: 1, hasMore: false, orders: [] }, { headers });
      }
      const db = await getDb();
      if (!db) throw new CmsError("Paid orders are unavailable.", 503, "PAYMENT_ORDERS_UNAVAILABLE");
      const params = new URL(request.url).searchParams;
      const id = params.get("id");
      const orders = db.collection<PaymentOrder>("payment_orders");
      const attempts = db.collection<PaymentAttempt>("payment_attempts");

      if (id !== null) {
        if (!paymentIdPattern.test(id)) throw new CmsError("Invalid order reference.", 400, "INVALID_ORDER");
        const order = await orders.findOne({ _id: id, status: { $in: ["paid", "pending"] } });
        if (!order) throw new CmsError("Payment order not found.", 404, "ORDER_NOT_FOUND");
        const attemptId = order.status === "paid" ? order.paidAttemptId : order.lastAttemptId;
        const attempt = attemptId
          ? await attempts.findOne({ _id: attemptId, orderId: order._id })
          : null;
        return Response.json({ order: {
          id: order._id,
          reference: order.reference,
          status: order.status,
          customer: order.customer,
          items: order.items.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity, lineTotalMinor: item.lineTotalMinor })),
          subtotalMinor: order.subtotalMinor,
          shippingMinor: order.shippingMinor,
          totalMinor: order.totalMinor,
          currency: order.currency,
          createdAt: order.createdAt,
          paidAt: order.paidAt ?? null,
          expiresAt: order.expiresAt,
          initiationWindowElapsed: order.status === "pending" && Date.now() >= new Date(order.expiresAt).getTime(),
          attempt: attempt ? {
            status: attempt.status,
            provider: attempt.provider,
            providerPaymentId: attempt.providerPaymentId ?? null,
            createdAt: attempt.createdAt,
            updatedAt: attempt.updatedAt,
            providerExpiresAtUnix: attempt.providerExpiresAtUnix,
          } : null,
          requiresPaymentReview: order.requiresPaymentReview === true,
          additionalPaidAttempts: order.secondaryPaidAttemptIds?.length ?? 0,
        } }, { headers });
      }

      const pageValue = params.get("page") ?? "1";
      if (!/^[1-9]\d{0,3}$/.test(pageValue)) throw new CmsError("Invalid page.", 400, "INVALID_PAGE");
      const page = Number(pageValue);
      const group = params.get("group") ?? "paid";
      if (group !== "paid" && group !== "review") throw new CmsError("Invalid payment order group.", 400, "INVALID_GROUP");
      const rows = await orders.find({ status: group === "paid" ? "paid" : "pending" })
        .sort(group === "paid" ? { paidAt: -1, _id: -1 } : { createdAt: -1, _id: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE + 1)
        .toArray();
      const visible = rows.slice(0, PAGE_SIZE);
      const attemptIds = visible.map((order) => order.lastAttemptId).filter((value): value is string => Boolean(value));
      const lastAttempts = group === "review" && attemptIds.length
        ? await attempts.find({ _id: { $in: attemptIds } }).toArray()
        : [];
      const lastAttemptById = new Map(lastAttempts.map((attempt) => [attempt._id, attempt]));
      return Response.json({
        available: true,
        group,
        page,
        hasMore: rows.length > PAGE_SIZE,
        orders: visible.map((order) => {
          const candidate = order.lastAttemptId ? lastAttemptById.get(order.lastAttemptId) : null;
          const attempt = candidate?.orderId === order._id ? candidate : null;
          return {
            id: order._id,
            reference: order.reference,
            status: order.status,
            customerName: order.customer.name,
            totalMinor: order.totalMinor,
            currency: order.currency,
            createdAt: order.createdAt,
            paidAt: order.paidAt ?? null,
            expiresAt: order.expiresAt,
            initiationWindowElapsed: order.status === "pending" && Date.now() >= new Date(order.expiresAt).getTime(),
            attempt: attempt ? { status: attempt.status, provider: attempt.provider, providerPaymentId: attempt.providerPaymentId ?? null } : null,
            requiresPaymentReview: order.requiresPaymentReview === true,
          };
        }),
      }, { headers });
    }, "edit");
  } catch (error) {
    return cmsErrorResponse(error);
  }
}

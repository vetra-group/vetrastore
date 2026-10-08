import { NextRequest, NextResponse } from "next/server";
import { getDb, getMongoClient } from "@/lib/db";
import { getPublishedContent } from "@/lib/cms/server";
import { isRateLimited, readFormJson } from "@/app/api/contact/validation";
import { quotePaymentOrder } from "@/lib/payments/order-pricing";
import { newPaymentOrder, parsePaymentOrderInput, paymentIdPattern, paymentOrderFingerprint, paymentsConfigured, PaymentOrderError, type PaymentOrder } from "@/lib/payments/orders";
import { startPaymentAttempt } from "@/lib/payments/service";
import { chooseDefaultProvider, listAvailableProviders, type PaymentProviderId } from "@/lib/payments/providers";
import { PaymentInventoryError, reservePaymentInventory } from "@/lib/payments/inventory";

export const runtime = "nodejs";

const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  if (!paymentsConfigured() || !listAvailableProviders().length) return json({ code: "PAYMENT_UNAVAILABLE", error: "Online payment is not configured yet." }, 503);
  if (isRateLimited(request, "payment-order")) return json({ code: "RATE_LIMIT", error: "Please wait a moment and try again." }, 429);
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ code: "INVALID_REQUEST", error: "JSON is required." }, 415);
  const key = request.headers.get("idempotency-key");
  if (!key || !paymentIdPattern.test(key)) return json({ code: "INVALID_KEY", error: "A valid submission key is required." }, 400);
  const body = await readFormJson(request);
  if (!body) return json({ code: "INVALID_REQUEST", error: "Please check your request." }, 400);
  let savedOrder: PaymentOrder | null = null;
  try {
    const input = parsePaymentOrderInput(body);
    const fingerprint = paymentOrderFingerprint(input);
    const providerId = body.provider === undefined ? chooseDefaultProvider()?.id : body.provider;
    if (providerId !== "stripe" && providerId !== "merchant-ipay") throw new PaymentOrderError("INVALID_PROVIDER", 400, "Choose a payment provider.");
    if (!listAvailableProviders().some((entry) => entry.id === providerId)) throw new PaymentOrderError("PROVIDER_UNAVAILABLE", 409, "This provider is unavailable. Please choose another provider.");
    const db = await getDb();
    if (!db) throw new PaymentOrderError("PAYMENT_UNAVAILABLE", 503, "Online payment is not available yet.");
    const orders = db.collection<PaymentOrder>("payment_orders");
    savedOrder = await orders.findOne({ _id: key });
    if (savedOrder && savedOrder.fingerprint !== fingerprint) throw new PaymentOrderError("KEY_REUSED", 409, "This submission key was used for different order details.");
    if (!savedOrder) {
      // CMS_STORAGE=mongodb is required above. This read model probes the
      // authoritative published MongoDB snapshot and fails closed on outage.
      const products = (await getPublishedContent()).products.filter((product) => product.status === "published");
      for (const item of input.items) {
        const product = products.find((entry) => entry.id === item.id);
        // A paid order requires a confirmed stock figure. The CMS defaults to
        // unknown stock, so publishing a product alone cannot accept money.
        if (!product || typeof product.stock !== "number" || !Number.isSafeInteger(product.stock) || item.quantity > Math.min(96, product.stock)) throw new PaymentOrderError("PRODUCT_UNAVAILABLE", 409, "Please review your bag. A product or quantity is not confirmed as available.");
      }
      let quote;
      try { quote = quotePaymentOrder(input.items, products, input.locale); }
      catch { throw new PaymentOrderError("PRICE_UNAVAILABLE", 409, "A current price is unavailable. Please review your bag."); }
      if (quote.subtotalMinor !== input.expectedTotalMinor) return json({ code: "PRICE_CHANGED", error: "The price changed. Please review your bag and try again.", amountMinor: quote.subtotalMinor, currency: "THB" }, 409);
      const document = newPaymentOrder(key, fingerprint, input, quote, products);
      const client = await getMongoClient();
      if (!client) throw new PaymentOrderError("PAYMENT_UNAVAILABLE", 503, "Online payment is not available yet.");
      for (let transactionAttempt = 0; transactionAttempt < 3; transactionAttempt++) {
        const session = client.startSession();
        try {
          await session.withTransaction(async () => {
            // A duplicate submission may have committed while this request was
            // pricing. The first saved snapshot owns the idempotency key.
            if (await orders.findOne({ _id: key }, { session })) return;
            await reservePaymentInventory(db, document, products, session);
            await orders.insertOne(document, { session });
          }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, maxCommitTimeMS: 10000 });
          break;
        } catch (error) {
          // An identical submission can win, or another order may seed the
          // product stock document first. Retry that seed conflict against
          // the fresh balance; a genuine shortage then returns 409.
          const concurrent = await orders.findOne({ _id: key });
          if (concurrent?.fingerprint && concurrent.fingerprint !== fingerprint) throw new PaymentOrderError("KEY_REUSED", 409, "This submission key was used for different order details.");
          if (concurrent) break;
          if ((error as { code?: number })?.code !== 11000 || transactionAttempt === 2) throw error;
        } finally {
          await session.endSession();
        }
      }
      savedOrder = await orders.findOne({ _id: key });
      if (!savedOrder) throw new PaymentOrderError("SAVE_UNCERTAIN", 503, "The order could not be confirmed. Retry with the same submission key.");
      if (savedOrder.fingerprint !== fingerprint) throw new PaymentOrderError("KEY_REUSED", 409, "This submission key was used for different order details.");
    }
    const result = await startPaymentAttempt(db, savedOrder._id, providerId as PaymentProviderId,
      async () => (await getPublishedContent()).products.filter((product) => product.status === "published"));
    return json(result, 201);
  } catch (error) {
    if (error instanceof PaymentOrderError || error instanceof PaymentInventoryError) return json({ code: error.code, error: error.message, ...(savedOrder ? { orderId: savedOrder._id, reference: savedOrder.reference } : {}), availableProviders: listAvailableProviders().map((entry) => entry.id) }, error.status);
    return json({ code: "PAYMENT_UNAVAILABLE", error: "Payment could not be confirmed. Retry with the same submission key." }, 503);
  }
}

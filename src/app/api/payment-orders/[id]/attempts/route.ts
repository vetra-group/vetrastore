import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isRateLimited, readFormJson } from "@/app/api/contact/validation";
import { paymentIdPattern, paymentsConfigured, validPaymentAccess, PaymentOrderError } from "@/lib/payments/orders";
import { listAvailableProviders, type PaymentProviderId } from "@/lib/payments/providers";
import { startPaymentAttempt } from "@/lib/payments/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const headers = { "Cache-Control": "no-store" };
  if (!paymentsConfigured() || !listAvailableProviders().length) return NextResponse.json({ error: "Online payment is unavailable." }, { status: 503, headers });
  if (isRateLimited(request, "payment-attempt")) return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 429, headers });
  if (!paymentIdPattern.test(id) || !validPaymentAccess(id, request.headers.get("x-payment-access"))) return NextResponse.json({ error: "Order not found." }, { status: 404, headers });
  const body = await readFormJson(request);
  if (!body || (body.provider !== "stripe" && body.provider !== "merchant-ipay")) return NextResponse.json({ error: "Choose a payment provider." }, { status: 400, headers });
  try {
    const db = await getDb();
    if (!db) throw new PaymentOrderError("PAYMENT_UNAVAILABLE", 503, "Online payment is unavailable.");
    const result = await startPaymentAttempt(db, id, body.provider as PaymentProviderId);
    return NextResponse.json(result, { status: 201, headers });
  } catch (error) {
    if (error instanceof PaymentOrderError) return NextResponse.json({ code: error.code, error: error.message, availableProviders: listAvailableProviders().map((entry) => entry.id) }, { status: error.status, headers });
    return NextResponse.json({ error: "Payment could not be confirmed. Retry this same order." }, { status: 503, headers });
  }
}

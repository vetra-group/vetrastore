import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { applyVerifiedPaymentEvent, PaymentOrderError } from "@/lib/payments/orders";
import { getProvider, PaymentProviderError } from "@/lib/payments/providers";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 256_000;

async function readWebhookBody(request: NextRequest): Promise<Buffer | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_WEBHOOK_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return size ? Buffer.concat(chunks, size) : null;
}

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  const signature = request.headers.get("stripe-signature");
  if (!signature || Number(request.headers.get("content-length") || 0) > MAX_WEBHOOK_BYTES) return NextResponse.json({ error: "Invalid webhook." }, { status: 400, headers });
  try {
    const rawBody = await readWebhookBody(request);
    if (!rawBody) return NextResponse.json({ error: "Invalid webhook." }, { status: 400, headers });
    const event = await getProvider("stripe").verify({ rawBody, signature });
    if (!event) return NextResponse.json({ received: true }, { headers });
    const db = await getDb();
    if (!db) return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 503, headers });
    await applyVerifiedPaymentEvent(db, event);
    return NextResponse.json({ received: true }, { headers });
  } catch (error) {
    if (error instanceof PaymentProviderError && error.kind === "invalid-webhook") return NextResponse.json({ error: "Invalid webhook." }, { status: 400, headers });
    if (error instanceof PaymentOrderError && error.code === "PAYMENT_MISMATCH") {
      console.error("Verified Stripe payment did not match a saved order or attempt.");
    }
    return NextResponse.json({ error: "Payment verification is temporarily unavailable." }, { status: 503, headers });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { paymentIdPattern } from "@/lib/payments/orders";
import { readPaymentResult } from "@/lib/payments/service";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const headers = { "Cache-Control": "no-store" };
  if (!paymentIdPattern.test(id)) return NextResponse.json({ error: "Order not found." }, { status: 404, headers });
  try {
    const db = await getDb();
    if (!db) return NextResponse.json({ error: "Order status is temporarily unavailable." }, { status: 503, headers });
    const result = await readPaymentResult(db, id);
    return result ? NextResponse.json(result, { headers }) : NextResponse.json({ error: "Order not found." }, { status: 404, headers });
  } catch {
    return NextResponse.json({ error: "Order status is temporarily unavailable." }, { status: 503, headers });
  }
}

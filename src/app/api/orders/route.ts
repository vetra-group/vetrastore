import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { MAX_QUANTITY } from "@/lib/catalog";
import { getPublishedContent } from "@/lib/cms/server";
import { isLocale } from "@/lib/i18n";
import { isRateLimited, readFormJson } from "@/app/api/contact/validation";
import { pendingRequestNotices, type PendingRequestNotice } from "@/lib/request-outbox";

export const runtime = "nodejs";
type Enquiry = {
  _id: string;
  fingerprint: string;
  reference: string;
  status: "enquiry";
  locale: string;
  customer: Record<string, string>;
  items: { id: string; quantity: number; unitPrice: number }[];
  currency: "THB";
  subtotal: number;
  createdAt: Date;
  consentAt: Date;
  paymentStatus: "not-requested";
  fulfilmentStatus: "not-started";
  outbox: PendingRequestNotice[];
};
function enquiryFingerprint(customer: Record<string, string>, items: { id: string; quantity: number }[], locale: string) {
  const fields = ["name", "email", "phone", "address", "district", "province", "postcode", "notes"];
  return createHash("sha256").update(JSON.stringify({ customer: Object.fromEntries(fields.map((field) => [field, customer[field]])), items: items.map((item) => ({ id: item.id, quantity: item.quantity })).sort((a, b) => a.id.localeCompare(b.id)), locale })).digest("hex");
}
export async function POST(request: NextRequest) {
  if (
    process.env.ORDER_ENQUIRIES_ENABLED !== "true" ||
    !process.env.MONGODB_URI
  )
    return NextResponse.json(
      { error: "Ordering is not available yet." },
      { status: 503 },
    );
  if (isRateLimited(request, "order-enquiry"))
    return NextResponse.json(
      { error: "Please wait a moment and try again." },
      { status: 429 },
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json({ error: "JSON is required." }, { status: 415 });
  if (Number(request.headers.get("content-length") || 0) > 16000)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  const key = request.headers.get("idempotency-key");
  if (
    !key ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      key,
    )
  )
    return NextResponse.json(
      { error: "A valid submission key is required." },
      { status: 400 },
    );
  const body = await readFormJson(request);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const data = body as Record<string, unknown>;
  if (
    data.consent !== true ||
    typeof data.locale !== "string" ||
    !isLocale(data.locale) ||
    !data.customer ||
    typeof data.customer !== "object" ||
    Array.isArray(data.customer)
  )
    return NextResponse.json(
      { error: "Please check your details." },
      { status: 400 },
    );
  const input = data.customer as Record<string, unknown>;
  const limits: Record<string, number> = {
    name: 100,
    email: 254,
    phone: 30,
    address: 500,
    district: 100,
    province: 100,
    postcode: 5,
    notes: 1000,
  };
  const customer: Record<string, string> = {};
  for (const [field, limit] of Object.entries(limits)) {
    if (
      typeof input[field] !== "string" ||
      input[field].length > limit ||
      (field !== "notes" && !input[field].trim())
    )
      return NextResponse.json(
        { error: "Please check your details." },
        { status: 400 },
      );
    customer[field] = input[field].trim();
  }
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
    !/^[+()\d\s.-]{7,30}$/.test(customer.phone) ||
    !/^\d{5}$/.test(customer.postcode)
  )
    return NextResponse.json(
      { error: "Please check your contact details." },
      { status: 400 },
    );
  if (!Array.isArray(data.items) || !data.items.length || data.items.length > 200)
    return NextResponse.json(
      { error: "Please check your bag." },
      { status: 400 },
    );
  const ids = new Set<string>();
  const requested: { id: string; quantity: number }[] = [];
  for (const item of data.items) {
    if (!item || typeof item.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) || item.id.length > 80 || ids.has(item.id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) return NextResponse.json({ error: "Please check your bag." }, { status: 400 });
    ids.add(item.id);
    requested.push({ id: item.id, quantity: item.quantity });
  }
  const fingerprint = enquiryFingerprint(customer, requested, data.locale);
  const reference = `VT-${key.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  try {
    const db = await getDb();
    if (!db)
      return NextResponse.json(
        { error: "Service unavailable." },
        { status: 503 },
      );
    const collection = db.collection<Enquiry>("order_enquiries");
    const previous = await collection.findOne({ _id: key });
    if (previous) {
      if (enquiryFingerprint(previous.customer, previous.items, previous.locale) !== fingerprint) return NextResponse.json({ error: "Submission key was already used for different details." }, { status: 409 });
      return NextResponse.json({ reference: previous.reference, status: "enquiry" }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    const products = (await getPublishedContent()).products.filter((product) => product.status === "published");
    const items: Enquiry["items"] = [];
    for (const item of requested) {
      const product = products.find((product) => product.id === item.id);
      if (!product || item.quantity > Math.min(MAX_QUANTITY, product.stock ?? MAX_QUANTITY)) return NextResponse.json({ error: "Please check your bag." }, { status: 400 });
      items.push({ ...item, unitPrice: product.price });
    }
    const now = new Date();
    const document: Enquiry = {
      _id: key,
      fingerprint,
      reference,
      status: "enquiry",
      locale: data.locale,
      customer,
      items,
      currency: "THB",
      subtotal: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
      createdAt: now,
      consentAt: now,
      paymentStatus: "not-requested",
      fulfilmentStatus: "not-started",
      outbox: pendingRequestNotices(key, now),
    };
    try {
      await collection.updateOne(
        { _id: key },
        { $setOnInsert: document },
        { upsert: true },
      );
    } catch (error) {
      if (
        !(
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === 11000
        )
      )
        throw error;
    }
    const saved = await collection.findOne(
      { _id: key },
      { projection: { reference: 1, customer: 1, items: 1, locale: 1 } },
    );
    if (!saved) throw new Error("Save unconfirmed");
    if (enquiryFingerprint(saved.customer, saved.items, saved.locale) !== fingerprint)
      return NextResponse.json(
        { error: "Submission key was already used for different details." },
        { status: 409 },
      );
    return NextResponse.json(
      { reference: saved.reference, status: "enquiry" },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Your enquiry could not be confirmed. Please retry with the same submission key.",
      },
      { status: 503 },
    );
  }
}

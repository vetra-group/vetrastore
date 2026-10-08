import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { MAX_QUANTITY, type Currency, type Market } from "@/lib/catalog";
import { quoteCart } from "@/lib/cart-pricing";
import { getPublishedContent } from "@/lib/cms/server";
import { isLocale } from "@/lib/i18n";
import { isRateLimited, readFormJson } from "@/app/api/contact/validation";
import { pendingRequestNotices, type PendingRequestNotice } from "@/lib/request-outbox";
import { marketForShippingCountry } from "@/lib/shipping-market";

export const runtime = "nodejs";
type Enquiry = {
  _id: string;
  fingerprint: string;
  reference: string;
  status: "enquiry";
  locale: string;
  market: Market;
  customer: Record<string, string>;
  items: { id: string; quantity: number; unitPrice: number; lineTotal?: number }[];
  currency: Currency;
  subtotal: number;
  createdAt: Date;
  consentAt: Date;
  paymentStatus: "not-requested";
  fulfilmentStatus: "not-started";
  outbox: PendingRequestNotice[];
};
function enquiryFingerprint(customer: Record<string, string>, items: { id: string; quantity: number }[], locale: string, market: Market) {
  const fields = ["name", "email", "phone", "address", "district", "province", "country", "postcode", "notes"];
  return createHash("sha256").update(JSON.stringify({ customer: Object.fromEntries(fields.map((field) => [field, customer[field]])), items: items.map((item) => ({ id: item.id, quantity: item.quantity })).sort((a, b) => a.id.localeCompare(b.id)), locale, market })).digest("hex");
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
    (data.market !== "TH" && data.market !== "INTL") ||
    !data.customer ||
    typeof data.customer !== "object" ||
    Array.isArray(data.customer)
  )
    return NextResponse.json(
      { error: "Please check your details." },
      { status: 400 },
    );
  const market = data.market as Market;
  const input = data.customer as Record<string, unknown>;
  const limits: Record<string, number> = {
    name: 100,
    email: 254,
    phone: 30,
    address: 500,
    district: 100,
    province: 100,
    postcode: market === "TH" ? 5 : 20,
    notes: 1000,
    country: 100,
  };
  const customer: Record<string, string> = {};
  const optionalFields = new Set(["notes", ...(market === "TH" ? [] : ["province", "postcode"])]);
  for (const [field, limit] of Object.entries(limits)) {
    const value = input[field] === undefined && optionalFields.has(field) ? "" : input[field];
    if (
      typeof value !== "string" ||
      value.length > limit ||
      (!optionalFields.has(field) && !value.trim())
    )
      return NextResponse.json(
        { error: "Please check your details." },
        { status: 400 },
      );
    customer[field] = value.trim();
  }
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
    !/^[+()\d\s.-]{7,30}$/.test(customer.phone) ||
    !(market === "TH" ? /^\d{5}$/.test(customer.postcode) : !customer.postcode || /^[\p{L}\p{N}][\p{L}\p{N} -]{1,18}[\p{L}\p{N}]$/u.test(customer.postcode)) ||
    marketForShippingCountry(customer.country) !== market
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
  const fingerprint = enquiryFingerprint(customer, requested, data.locale, market);
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
      if (previous.fingerprint !== fingerprint) return NextResponse.json({ error: "Submission key was already used for different details." }, { status: 409 });
      return NextResponse.json({ reference: previous.reference, status: "enquiry" }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    const products = (await getPublishedContent()).products.filter((product) => product.status === "published");
    for (const item of requested) {
      const product = products.find((product) => product.id === item.id);
      if (!product || item.quantity > Math.min(MAX_QUANTITY, product.stock ?? MAX_QUANTITY)) return NextResponse.json({ error: "Please check your bag." }, { status: 400 });
    }
    let pricing: ReturnType<typeof quoteCart>;
    try { pricing = quoteCart(requested, products, market); }
    catch { return NextResponse.json({ error: "A current price is unavailable. Please contact us." }, { status: 409 }); }
    const now = new Date();
    const document: Enquiry = {
      _id: key,
      fingerprint,
      reference,
      status: "enquiry",
      locale: data.locale,
      market,
      customer,
      items: pricing.items,
      currency: pricing.currency,
      subtotal: pricing.subtotal,
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
      { projection: { reference: 1, fingerprint: 1 } },
    );
    if (!saved) throw new Error("Save unconfirmed");
    if (saved.fingerprint !== fingerprint)
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

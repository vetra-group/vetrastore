import { createHmac, timingSafeEqual } from "node:crypto";

import { localizedPath, type Locale } from "@/lib/i18n";

/** Payment gateways only see a frozen, server-calculated order amount. */
export type PaymentProviderId = "stripe" | "merchant-ipay";
export type PaymentEventStatus = "paid" | "failed" | "pending";

export interface CreatePaymentInput {
  orderId: string;
  attemptId: string;
  reference: string;
  amountMinor: number;
  currency: "THB";
  customerEmail: string;
  locale: Locale;
  siteOrigin: string;
  /** Frozen on the attempt before the first provider call. */
  expiresAtUnix: number;
  lines: readonly { name: string; quantity: number; lineTotalMinor: number }[];
}

export interface CreatedPayment {
  providerPaymentId: string;
  redirectUrl: string;
}

export interface VerifiedPaymentEvent {
  provider: PaymentProviderId;
  eventId: string;
  providerPaymentId: string;
  orderId: string;
  attemptId: string;
  reference: string;
  status: PaymentEventStatus;
  amountMinor: number;
  currency: "THB";
}

export interface InspectPaymentInput {
  providerPaymentId: string;
  orderId: string;
  attemptId: string;
  reference: string;
  amountMinor: number;
  currency: "THB";
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  readonly available: boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatedPayment>;
  /** A null result means the signed event belongs to another integration. */
  verify(input: { rawBody: Buffer; signature: string | null }): Promise<VerifiedPaymentEvent | null>;
  /** Server-to-provider lookup for an authenticated staff reconciliation.
   * An open or ambiguous payment remains pending. */
  inspect(input: InspectPaymentInput): Promise<VerifiedPaymentEvent>;
}

export type PaymentProviderErrorKind = "unavailable" | "invalid-input" | "rejected" | "uncertain" | "invalid-webhook";

export class PaymentProviderError extends Error {
  constructor(
    readonly kind: PaymentProviderErrorKind,
    message: string,
    readonly provider: PaymentProviderId,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }

  /** Never offer a new provider while the first attempt's outcome is unknown. */
  get fallbackAllowed(): boolean {
    return this.kind === "unavailable" || this.kind === "rejected";
  }
}

const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_TIMEOUT_MS = 15_000;
const WEBHOOK_TOLERANCE_SECONDS = 300;
const APP_METADATA = "vetra-store";

type StripeSession = {
  id?: unknown;
  url?: unknown;
  livemode?: unknown;
  amount_total?: unknown;
  currency?: unknown;
  status?: unknown;
  payment_status?: unknown;
  client_reference_id?: unknown;
  metadata?: unknown;
};

type StripeEvent = {
  id?: unknown;
  type?: unknown;
  livemode?: unknown;
  data?: { object?: { id?: unknown } };
};

/** Vercel production must never present a test checkout as a real sale.
 * Preview/development and local rehearsals cannot use a live Stripe key. */
function expectedStripeLiveMode(): boolean | null {
  const environment = process.env.VERCEL_ENV;
  if (environment === "production") return true;
  if (environment === "preview" || environment === "development") return false;
  if (environment || process.env.VERCEL) return null;
  return false;
}

function stripeKey(): string | null {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  const live = expectedStripeLiveMode();
  return live !== null && value?.startsWith(live ? "sk_live_" : "sk_test_") ? value : null;
}

function webhookSecret(): string | null {
  const value = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return value && value.startsWith("whsec_") ? value : null;
}

function validMinorAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 99_999_999;
}

function requiredText(value: string, name: string, maxLength = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new PaymentProviderError("invalid-input", `Invalid ${name}`, "stripe");
  }
  return value.trim();
}

function returnOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PaymentProviderError("invalid-input", "Invalid site origin", "stripe");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.username || url.password || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new PaymentProviderError("invalid-input", "Invalid site origin", "stripe");
  }
  return url.origin;
}

function checkedInput(input: CreatePaymentInput): CreatePaymentInput & { siteOrigin: string } {
  const orderId = requiredText(input.orderId, "order ID", 100);
  const attemptId = requiredText(input.attemptId, "attempt ID", 100);
  const reference = requiredText(input.reference, "reference", 100);
  const customerEmail = requiredText(input.customerEmail, "customer email", 800);
  if (!/^\S+@\S+\.\S+$/.test(customerEmail) || input.currency !== "THB" || !validMinorAmount(input.amountMinor)) {
    throw new PaymentProviderError("invalid-input", "Invalid payment amount or customer", "stripe");
  }
  if (!["en", "ar", "th"].includes(input.locale) || !Array.isArray(input.lines) || !input.lines.length || input.lines.length > 100) {
    throw new PaymentProviderError("invalid-input", "Invalid payment lines", "stripe");
  }
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(input.expiresAtUnix) || input.expiresAtUnix <= now || input.expiresAtUnix > now + 24 * 60 * 60) {
    throw new PaymentProviderError("invalid-input", "Invalid payment attempt expiry", "stripe");
  }
  let total = 0;
  for (const line of input.lines) {
    requiredText(line.name, "line name", 200);
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || !validMinorAmount(line.lineTotalMinor)) {
      throw new PaymentProviderError("invalid-input", "Invalid payment line", "stripe");
    }
    total += line.lineTotalMinor;
  }
  if (total !== input.amountMinor) {
    throw new PaymentProviderError("invalid-input", "Payment lines do not match the order total", "stripe");
  }
  return { ...input, orderId, attemptId, reference, customerEmail, siteOrigin: returnOrigin(input.siteOrigin) };
}

async function stripeRequest(path: string, init: RequestInit, purpose: "create" | "retrieve"): Promise<StripeSession> {
  const key = stripeKey();
  if (!key) throw new PaymentProviderError("unavailable", "Stripe is not configured", "stripe");
  let response: Response;
  try {
    response = await fetch(`${STRIPE_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
        ...(init.headers || {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
    });
  } catch {
    throw new PaymentProviderError("uncertain", `Stripe ${purpose} outcome is unknown`, "stripe");
  }
  if (!response.ok) {
    // A creation that times out, conflicts, or returns a server error might have
    // created a Session. Reconcile its attempt before permitting another gateway.
    let invalidRequest = false;
    if (purpose === "create" && response.status === 400) {
      try {
        const payload = await response.json() as { error?: { type?: unknown; code?: unknown } };
        invalidRequest = payload.error?.type === "invalid_request_error" && payload.error?.code !== "idempotency_error";
      } catch {
        // A malformed error body cannot establish that no Session was made.
      }
    }
    const definite = purpose === "create" && (invalidRequest || response.status === 401 || response.status === 403 || response.status === 404);
    throw new PaymentProviderError(definite ? "rejected" : "uncertain", `Stripe ${purpose} failed (${response.status})`, "stripe");
  }
  try {
    return await response.json() as StripeSession;
  } catch {
    throw new PaymentProviderError("uncertain", `Stripe ${purpose} response could not be read`, "stripe");
  }
}

function verifyStripeSignature(rawBody: Buffer, signatureHeader: string | null, secret: string): void {
  if (!Buffer.isBuffer(rawBody) || !signatureHeader || signatureHeader.length > 4096) {
    throw new PaymentProviderError("invalid-webhook", "Invalid Stripe webhook signature", "stripe");
  }
  const fields = signatureHeader.split(",").map((part) => part.trim());
  const timestampString = fields.find((field) => field.startsWith("t="))?.slice(2);
  const signatures = fields.filter((field) => field.startsWith("v1=")).map((field) => field.slice(3));
  if (!timestampString || !/^\d+$/.test(timestampString) || !signatures.length) {
    throw new PaymentProviderError("invalid-webhook", "Invalid Stripe webhook signature", "stripe");
  }
  const timestamp = Number(timestampString);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new PaymentProviderError("invalid-webhook", "Expired Stripe webhook signature", "stripe");
  }
  const expected = createHmac("sha256", secret).update(`${timestampString}.`).update(rawBody).digest();
  const matched = signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    return timingSafeEqual(expected, Buffer.from(signature, "hex"));
  });
  if (!matched) throw new PaymentProviderError("invalid-webhook", "Invalid Stripe webhook signature", "stripe");
}

function sessionMetadata(session: StripeSession): Record<string, unknown> | null {
  if (!session.metadata || typeof session.metadata !== "object" || Array.isArray(session.metadata)) return null;
  return session.metadata as Record<string, unknown>;
}

const stripeProvider: PaymentProvider = {
  id: "stripe",
  get available() { return Boolean(stripeKey() && webhookSecret()); },

  async createPayment(rawInput) {
    if (!this.available) throw new PaymentProviderError("unavailable", "Stripe is not configured", "stripe");
    const input = checkedInput(rawInput);
    const successUrl = new URL(localizedPath(input.locale, "/checkout/result"), input.siteOrigin);
    successUrl.searchParams.set("order", input.orderId);
    successUrl.searchParams.set("attempt", input.attemptId);
    successUrl.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
    const cancelUrl = new URL(localizedPath(input.locale, "/checkout/result"), input.siteOrigin);
    cancelUrl.searchParams.set("order", input.orderId);
    cancelUrl.searchParams.set("attempt", input.attemptId);
    cancelUrl.searchParams.set("cancelled", "1");

    const form = new URLSearchParams({
      mode: "payment",
      "payment_method_types[0]": "card",
      "adaptive_pricing[enabled]": "false",
      "allow_promotion_codes": "false",
      "client_reference_id": input.orderId,
      "customer_email": input.customerEmail,
      "metadata[app]": APP_METADATA,
      "metadata[orderId]": input.orderId,
      "metadata[attemptId]": input.attemptId,
      "metadata[reference]": input.reference,
      // Keep every retry byte-for-byte identical for Stripe's idempotency key.
      // The order service persists this value before the first API request.
      expires_at: String(input.expiresAtUnix),
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
    });
    // Stripe Checkout has no arbitrary discounted quantity pricing. Each line
    // is the frozen total for its whole bundle, with Stripe quantity one.
    input.lines.forEach((line, index) => {
      form.set(`line_items[${index}][price_data][currency]`, "thb");
      form.set(`line_items[${index}][price_data][unit_amount]`, String(line.lineTotalMinor));
      form.set(`line_items[${index}][price_data][product_data][name]`, `${line.name} × ${line.quantity}`);
      form.set(`line_items[${index}][quantity]`, "1");
    });
    if (input.locale === "en" || input.locale === "th") form.set("locale", input.locale);
    // Stripe Checkout currently does not accept `ar` as a Session locale. In
    // Arabic, allow Stripe to select a supported locale from the browser.

    const session = await stripeRequest("/checkout/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `vetra-payment-${input.attemptId}`,
      },
      body: form,
    }, "create");
    const metadata = sessionMetadata(session);
    let checkoutUrl: URL | null = null;
    try {
      checkoutUrl = new URL(String(session.url));
    } catch {
      // The Session may exist even when Stripe returned a malformed URL.
    }
    if (typeof session.id !== "string" || !session.id.startsWith("cs_") || !checkoutUrl || checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com" || checkoutUrl.username || checkoutUrl.password || session.livemode !== expectedStripeLiveMode() || session.currency !== "thb" || session.amount_total !== input.amountMinor || metadata?.app !== APP_METADATA || metadata.orderId !== input.orderId || metadata.attemptId !== input.attemptId || metadata.reference !== input.reference) {
      throw new PaymentProviderError("uncertain", "Stripe created a Session with unexpected details", "stripe");
    }
    return { providerPaymentId: session.id, redirectUrl: checkoutUrl.toString() };
  },

  async verify({ rawBody, signature }) {
    if (!this.available) throw new PaymentProviderError("unavailable", "Stripe is not configured for this deployment", "stripe");
    const secret = webhookSecret();
    if (!secret) throw new PaymentProviderError("unavailable", "Stripe webhook is not configured", "stripe");
    verifyStripeSignature(rawBody, signature, secret);
    let event: StripeEvent;
    try {
      event = JSON.parse(rawBody.toString("utf8")) as StripeEvent;
    } catch {
      throw new PaymentProviderError("invalid-webhook", "Invalid Stripe webhook body", "stripe");
    }
    if (typeof event.id !== "string" || !event.id.startsWith("evt_") || typeof event.type !== "string") {
      throw new PaymentProviderError("invalid-webhook", "Invalid Stripe webhook event", "stripe");
    }
    if (event.livemode !== expectedStripeLiveMode()) throw new PaymentProviderError("invalid-webhook", "Stripe webhook mode does not match this deployment", "stripe");
    const relevant = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"];
    if (!relevant.includes(event.type)) return null;
    const sessionId = event.data?.object?.id;
    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
      throw new PaymentProviderError("invalid-webhook", "Invalid Stripe Session reference", "stripe");
    }
    const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`, { method: "GET" }, "retrieve");
    if (session.id !== sessionId || session.livemode !== event.livemode) throw new PaymentProviderError("uncertain", "Stripe Session reference or mode mismatch", "stripe");
    const metadata = sessionMetadata(session);
    if (metadata?.app !== APP_METADATA) return null;
    const orderId = metadata.orderId;
    const attemptId = metadata.attemptId;
    const reference = metadata.reference;
    if (typeof orderId !== "string" || !orderId || typeof attemptId !== "string" || !attemptId || typeof reference !== "string" || !reference || session.client_reference_id !== orderId || session.currency !== "thb" || !validMinorAmount(session.amount_total as number)) {
      throw new PaymentProviderError("uncertain", "Stripe Session verification failed", "stripe");
    }
    const paid = session.status === "complete" && session.payment_status === "paid";
    const failed = !paid && (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired");
    return {
      provider: "stripe",
      eventId: event.id,
      providerPaymentId: sessionId,
      orderId,
      attemptId,
      reference,
      status: paid ? "paid" : failed ? "failed" : "pending",
      amountMinor: session.amount_total as number,
      currency: "THB",
    };
  },

  async inspect(input) {
    if (!this.available) throw new PaymentProviderError("unavailable", "Stripe is not configured", "stripe");
    if (!input.providerPaymentId.startsWith("cs_") || input.currency !== "THB" || !validMinorAmount(input.amountMinor)) {
      throw new PaymentProviderError("invalid-input", "Invalid saved payment reference", "stripe");
    }
    const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(input.providerPaymentId)}`, { method: "GET" }, "retrieve");
    const metadata = sessionMetadata(session);
    if (session.id !== input.providerPaymentId || session.livemode !== expectedStripeLiveMode() || metadata?.app !== APP_METADATA || metadata.orderId !== input.orderId || metadata.attemptId !== input.attemptId || metadata.reference !== input.reference || session.client_reference_id !== input.orderId || session.currency !== "thb" || session.amount_total !== input.amountMinor) {
      throw new PaymentProviderError("uncertain", "Stripe Session does not match the saved payment", "stripe");
    }
    const status: PaymentEventStatus = session.status === "complete" && session.payment_status === "paid"
      ? "paid"
      : session.status === "expired" && session.payment_status === "unpaid"
        ? "failed"
        : "pending";
    return {
      provider: "stripe", eventId: `reconcile:${input.providerPaymentId}:${status}`,
      providerPaymentId: input.providerPaymentId, orderId: input.orderId,
      attemptId: input.attemptId, reference: input.reference,
      status, amountMinor: input.amountMinor, currency: "THB",
    };
  },
};

const merchantIpayProvider: PaymentProvider = {
  id: "merchant-ipay",
  available: false,
  async createPayment() {
    // Never guess Bangkok Bank endpoints, request signing, callback rules or
    // refund/void behavior. Implement only with its current merchant guide.
    throw new PaymentProviderError("unavailable", "Merchant iPay is not yet approved or configured", "merchant-ipay");
  },
  async verify() {
    throw new PaymentProviderError("unavailable", "Merchant iPay is not yet approved or configured", "merchant-ipay");
  },
  async inspect() {
    throw new PaymentProviderError("unavailable", "Merchant iPay is not yet approved or configured", "merchant-ipay");
  },
};

const providers: Record<PaymentProviderId, PaymentProvider> = {
  stripe: stripeProvider,
  "merchant-ipay": merchantIpayProvider,
};

export function getProvider(id: PaymentProviderId): PaymentProvider {
  const provider = providers[id];
  if (!provider) throw new Error("Unknown payment provider");
  return provider;
}

export function listAvailableProviders(): PaymentProvider[] {
  return Object.values(providers).filter((provider) => provider.available);
}

export function chooseDefaultProvider(): PaymentProvider | null {
  const preferred = process.env.PAYMENT_PRIMARY_PROVIDER === "merchant-ipay" ? merchantIpayProvider : stripeProvider;
  return preferred.available ? preferred : listAvailableProviders()[0] ?? null;
}

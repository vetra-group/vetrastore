import { catalogProducts, type CatalogProduct } from "./catalog";
import { allocateMockStock, releaseMockStock } from "./mock-checkout";
import type { DemoData, DemoRecord, DemoStatus } from "./demo-types";
import { workflowCopy } from "@/content/workflow";

export type WholesaleRequest = { productId: string; quantity: number; business: string; destination: string; neededBy: string };
export const orderStages = ["enquiry", "awaiting-payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"] as const;
export type OrderStage = (typeof orderStages)[number];
export type OrderWorkflow = { mode: "mock"; stage: OrderStage; carrier: string; tracking: string };
export type RequestActivity = { id: string; at: string; actor: string; action: string; detail: string };
export type RequestPatch = { status?: DemoStatus; notes?: string; assignedTo?: string };
export const MAX_OUTBOX_ATTEMPTS = 3;
export const orderTransitions: Record<OrderStage, readonly OrderStage[]> = {
  enquiry: ["awaiting-payment", "cancelled"], "awaiting-payment": ["paid", "cancelled"],
  paid: ["processing", "refunded"], processing: ["shipped", "refunded"],
  shipped: ["delivered", "refunded"], delivered: ["refunded"], cancelled: [], refunded: [],
};

export function normalizeWholesale(value: unknown, products: readonly CatalogProduct[], historical = false): WholesaleRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Check wholesale details");
  const input = value as Record<string, unknown>;
  if (typeof input.productId !== "string" || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(input.productId) || (!historical && !products.some((product) => product.id === input.productId))) throw new Error("Choose a product");
  if (!Number.isSafeInteger(input.quantity) || Number(input.quantity) < 1 || Number(input.quantity) > 1_000_000) throw new Error("Check quantity");
  if (typeof input.business !== "string" || !input.business.trim() || input.business.length > 160 || typeof input.destination !== "string" || !input.destination.trim() || input.destination.length > 500) throw new Error("Check business and delivery details");
  if (typeof input.neededBy !== "string" || (input.neededBy && (!/^\d{4}-\d{2}-\d{2}$/.test(input.neededBy) || !Number.isFinite(Date.parse(input.neededBy)) || new Date(input.neededBy).toISOString().slice(0, 10) !== input.neededBy))) throw new Error("Check requested date");
  return { productId: input.productId, quantity: Number(input.quantity), business: input.business.trim(), destination: input.destination.trim(), neededBy: input.neededBy };
}

export function initialOrderWorkflow(payment: DemoRecord["payment"]): OrderWorkflow {
  return { mode: "mock", stage: payment === "demo-refunded" ? "refunded" : payment === "demo-paid" ? "paid" : payment === "demo-failed" ? "awaiting-payment" : "enquiry", carrier: "", tracking: "" };
}

export function parseOrderWorkflow(value: unknown): OrderWorkflow | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as OrderWorkflow;
  if (input.mode !== "mock" || !orderStages.includes(input.stage) || typeof input.carrier !== "string" || input.carrier.length > 100 || typeof input.tracking !== "string" || input.tracking.length > 100) return undefined;
  if (["shipped", "delivered"].includes(input.stage) && (!input.carrier.trim() || !input.tracking.trim())) return undefined;
  return { mode: "mock", stage: input.stage, carrier: input.carrier, tracking: input.tracking };
}

export function parseRequestActivity(value: unknown): RequestActivity[] {
  if (!Array.isArray(value)) return [];
  return value.filter((event): event is RequestActivity => Boolean(event && typeof event === "object" && [event.id, event.at, event.actor, event.action, event.detail].every((field) => typeof field === "string" && field.length <= 1000) && Number.isFinite(Date.parse(event.at)))).slice(-1000).map(({ id, at, actor, action, detail }) => ({ id, at, actor, action, detail }));
}

function addActivity(record: DemoRecord, action: string, detail: string, now: string): DemoRecord {
  if (!Number.isFinite(Date.parse(now))) throw new Error("Invalid activity date");
  const activity = record.activity || [];
  if (activity.length >= 1000) throw new Error("Activity history is full; export and review this request");
  return { ...record, updatedAt: now, activity: [...activity, { id: `${record.id}-${activity.length + 1}`, at: now, actor: "Mock staff", action, detail }] };
}

export function updateDemoRequest(data: DemoData, id: string, patch: RequestPatch, now = new Date().toISOString()): DemoData {
  const record = data.records.find((entry) => entry.id === id);
  if (!record) throw new Error("Request no longer exists");
  if (patch.status !== undefined && !["new", "reviewing", "completed"].includes(patch.status)) throw new Error("Invalid status");
  if (patch.notes !== undefined && (typeof patch.notes !== "string" || patch.notes.length > 5000)) throw new Error("Invalid notes");
  if (patch.assignedTo !== undefined && (typeof patch.assignedTo !== "string" || patch.assignedTo.length > 100)) throw new Error("Invalid assignee");
  const updates: RequestPatch = { ...(patch.status !== undefined ? { status: patch.status } : {}), ...(patch.notes !== undefined ? { notes: patch.notes } : {}), ...(patch.assignedTo !== undefined ? { assignedTo: patch.assignedTo.trim() } : {}) };
  const changed = Object.keys(updates).filter((key) => updates[key as keyof RequestPatch] !== (record[key as keyof RequestPatch] ?? ""));
  if (!changed.length) return data;
  const next = addActivity({ ...record, ...updates }, "request-updated", changed.join(", "), now);
  return { ...data, records: data.records.map((entry) => entry.id === id ? next : entry) };
}

export function transitionDemoOrder(data: DemoData, id: string, stage: OrderStage, details: { carrier?: string; tracking?: string; restock?: boolean } = {}, now = new Date().toISOString(), products: readonly CatalogProduct[] = catalogProducts): DemoData {
  const record = data.records.find((entry) => entry.id === id);
  if (!record || record.kind !== "order") throw new Error("Order no longer exists");
  const current = record.order || initialOrderWorkflow(record.payment);
  if (!orderTransitions[current.stage].includes(stage)) throw new Error("This order transition is not allowed");
  const carrier = details.carrier?.trim() || current.carrier, tracking = details.tracking?.trim() || current.tracking;
  const order = parseOrderWorkflow({ mode: "mock", stage, carrier, tracking });
  if (!order) throw new Error("Add valid carrier and tracking details before shipment");
  if (details.restock !== undefined && (typeof details.restock !== "boolean" || stage !== "refunded")) throw new Error("Restock confirmation belongs to a refund");
  const inventory = stage === "paid" || stage === "awaiting-payment"
    ? allocateMockStock(data.inventory, id, record.items || [], stage === "paid" ? "committed" : "reserved", products, Date.parse(now))
    : stage === "cancelled" || (stage === "refunded" && (!["shipped", "delivered"].includes(current.stage) || details.restock))
      ? releaseMockStock(data.inventory, id) : data.inventory;
  const payment = stage === "paid" ? "demo-paid" : stage === "refunded" ? "demo-refunded" : record.payment;
  // Preserve the submitted outcome for idempotency while recording the latest
  // result separately; changing the original fingerprint would break retries.
  const submittedPayment = record.submittedPayment ?? (record.payment === "demo-refunded" ? "demo-paid" : record.payment ?? "enquiry");
  const next = addActivity({ ...record, order, ...(payment !== record.payment ? { payment, submittedPayment } : {}) }, "order-transition", `${current.stage} → ${stage}`, now);
  const w = workflowCopy[record.locale];
  const notice = { id: `${id}-order-${stage}`, recordId: id, reference: record.reference, to: "customer" as const, recipient: record.email, subject: `${record.reference} · ${w.stages[stage]}`, body: `${w.stages[stage]}\n${carrier} ${tracking}\n${w.mockNote}`, createdAt: now, state: "preview" as const, attempts: 0 };
  return { ...data, inventory, records: data.records.map((entry) => entry.id === id ? next : entry), outbox: data.outbox.some((entry) => entry.id === notice.id) ? data.outbox : [notice, ...data.outbox] };
}

export function retryDemoNotification(data: DemoData, id: string, outcome: "success" | "failure", now = new Date().toISOString(), limit = MAX_OUTBOX_ATTEMPTS): DemoData {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10 || !["success", "failure"].includes(outcome) || !Number.isFinite(Date.parse(now))) throw new Error("Invalid mock delivery settings");
  const notice = data.outbox.find((entry) => entry.id === id);
  if (!notice || notice.state === "mock-delivered" || (notice.attempts || 0) >= limit) throw new Error("This notification cannot be retried");
  const attempts = (notice.attempts || 0) + 1;
  const next = { ...notice, attempts, lastAttemptAt: now, state: outcome === "success" ? "mock-delivered" as const : attempts >= limit ? "exhausted" as const : "failed" as const };
  return { ...data, outbox: data.outbox.map((entry) => entry.id === id ? next : entry) };
}

// These contracts intentionally stay disabled until server-side provider credentials
// and verified callbacks are configured. Staff simulations never call providers.
export interface PaymentProvider { readonly enabled: boolean; createPayment(input: { reference: string; amount: number; currency: "THB"; idempotencyKey: string }): Promise<{ paymentId: string; status: "pending" }>; refund(input: { reference: string; idempotencyKey: string }): Promise<{ refundId: string; status: "pending" }> }
export interface ShippingProvider { readonly enabled: boolean; createShipment(input: { reference: string; idempotencyKey: string }): Promise<{ shipmentId: string; status: "pending" }> }
export const disabledPaymentProvider: PaymentProvider = { enabled: false, async createPayment() { throw new Error("Payment provider is not configured"); }, async refund() { throw new Error("Refund provider is not configured"); } };
export const disabledShippingProvider: ShippingProvider = { enabled: false, async createShipment() { throw new Error("Shipping provider is not configured"); } };

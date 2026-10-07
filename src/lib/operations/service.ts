import { createHash } from "node:crypto";
import { cmsActor, cmsRole } from "../cms/auth";
import { CmsError } from "../cms/validation";
import { getPublishedContent } from "../cms/server";
import { getDb } from "../db";
import { catalogProducts, formatPrice, type CatalogProduct } from "../catalog";
import { createDemoSubmission, emptyDemoData, normalizeDemoInput } from "../demo";
import { initialOrderWorkflow, orderStages, orderTransitions, parseOrderWorkflow } from "../commerce-workflow";
import { MOCK_RESERVATION_MS, normalizeMockShippingRules } from "../mock-checkout";
import { workflowCopy } from "@/content/workflow";
import { mockCheckoutCopy } from "@/content/mock-checkout";
import { notificationCopy } from "@/content/notifications";
import type { DemoInput, DemoRecord } from "../demo-types";
import type { OperationsCommand, OperationsDelivery, OperationsInventory, OperationsNotice, OperationsReceipt, OperationsRepository, OperationsRequest, OperationsTransaction } from "./types";
import { operationsRepository } from "./repository";

const idPattern = /^[a-z0-9][a-z0-9-]{0,179}$/i;
const keyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const timestamp = () => new Date().toISOString();
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const ownerActions = new Set(["create", "transition", "shipping", "deliver", "resolve-notice"]);
function checkRevision(actual: number, expected: number) { if (actual !== expected) throw new CmsError("This record changed. Refresh to review the latest version; your draft is preserved.", 409, "OPERATIONS_CONFLICT"); }
function text(value: unknown, max: number, optional = false): value is string { return optional && value === undefined || typeof value === "string" && value.length <= max; }
export function validateOperationsCommand(value: Record<string, unknown>): OperationsCommand {
  const allowed: Record<string, string[]> = {
    create: ["action", "key", "input"], update: ["action", "key", "id", "revision", "patch"], transition: ["action", "key", "id", "revision", "stage", "carrier", "tracking", "restock"], archive: ["action", "key", "id", "revision"], restore: ["action", "key", "id", "revision"], shipping: ["action", "key", "revision", "rules"], deliver: ["action", "key", "id", "revision", "outcome"], "resolve-notice": ["action", "key", "id", "revision"],
  };
  if (typeof value.action !== "string" || !Object.hasOwn(allowed, value.action) || Object.keys(value).some((key) => !allowed[value.action as string].includes(key)) || typeof value.key !== "string" || !keyPattern.test(value.key)) throw new CmsError("Check the operations command.");
  if (value.action !== "create" && (!Number.isSafeInteger(value.revision) || Number(value.revision) < 0)) throw new CmsError("A current record revision is required.");
  if (!["create", "shipping"].includes(value.action) && (typeof value.id !== "string" || !idPattern.test(value.id))) throw new CmsError("Choose a valid record.");
  if (value.action === "update") {
    const patch = value.patch as Record<string, unknown>;
    if (!patch || typeof patch !== "object" || Array.isArray(patch) || !Object.keys(patch).length || Object.keys(patch).some((key) => !["notes", "status", "assignedTo"].includes(key)) || !text(patch.notes, 5000, true) || !text(patch.assignedTo, 100, true) || (patch.status !== undefined && !["new", "reviewing", "completed"].includes(String(patch.status)))) throw new CmsError("Check the request update.");
  }
  if (value.action === "transition" && (!orderStages.includes(value.stage as typeof orderStages[number]) || !text(value.carrier, 100, true) || !text(value.tracking, 100, true) || (value.restock !== undefined && (typeof value.restock !== "boolean" || value.stage !== "refunded")))) throw new CmsError("Check the simulated order transition.");
  if (value.action === "deliver" && !["success", "failure"].includes(String(value.outcome))) throw new CmsError("Choose a mock delivery outcome.");
  if (value.action === "shipping") { try { normalizeMockShippingRules(value.rules); } catch { throw new CmsError("Check simulated shipping rules."); } }
  return value as OperationsCommand;
}
function appendActivity(record: OperationsRequest, actor: string, action: string, detail: string, now: string) {
  if ((record.activity?.length || 0) >= 1000) throw new CmsError("This activity history is full. Export and review before further changes.", 409, "OPERATIONS_HISTORY_FULL");
  return [...record.activity || [], { id: `${record.id}-${record.revision + 1}`, at: now, actor, action, detail }];
}
export function requestNotices(record: OperationsRequest, now: string, suffix: string): OperationsNotice[] {
  const w = workflowCopy[record.locale], m = mockCheckoutCopy[record.locale];
  const kinds = notificationCopy[record.locale].sharedKinds;
  const subject = `${record.reference} · ${record.kind === "order" ? w.stages[record.order?.stage || "enquiry"] : kinds[record.kind]}`;
  const body = [subject, record.name, record.message || "", ...(record.items || []).map((item) => `${item.id} × ${item.quantity} · ${formatPrice(item.lineTotal ?? item.unitPrice * item.quantity, record.locale, record.currency ?? "THB")}`),
    ...(record.wholesale ? [`${w.product}: ${record.wholesale.productId}`, `${w.quantity}: ${record.wholesale.quantity}`, `${w.business}: ${record.wholesale.business}`, `${w.destination}: ${record.wholesale.destination}`, record.wholesale.neededBy ? `${w.neededBy}: ${record.wholesale.neededBy}` : ""] : []),
    ...(record.order?.tracking ? [`${w.carrier}: ${record.order.carrier}`, `${w.tracking}: ${record.order.tracking}`] : []),
    ...(record.shippingQuote?.state === "quoted" ? [`${m.shipping}: ${formatPrice(record.shippingQuote.fee, record.locale, "THB")}`, `${m.total}: ${formatPrice(record.shippingQuote.total, record.locale, "THB")}`, m.quoteNote] : record.kind === "order" ? [m.pendingNote] : []), w.mockNote,
  ].filter(Boolean).join("\n");
  return (["staff", "customer"] as const).map((audience) => ({ id: `${record.id}-${suffix}-${audience}`, revision: 0, requestId: record.id, reference: record.reference, recipient: audience === "staff" ? w.mockStaff : record.email, audience, subject, body, createdAt: now, updatedAt: now, state: "ready", attempts: 0 }));
}
async function commandResult(tx: OperationsTransaction, receipt: OperationsReceipt) {
  return { record: receipt.requestId ? await tx.get("requests", receipt.requestId) : null, notice: receipt.noticeId ? await tx.get("outbox", receipt.noticeId) : null, settings: receipt.requestId || receipt.noticeId ? null : await tx.get("settings", "settings") };
}
async function updateInventory(tx: OperationsTransaction, record: OperationsRequest, next: "reserved" | "committed" | "released", products: readonly CatalogProduct[], now: string) {
  const nowMs = Date.parse(now);
  for (const item of record.items || []) {
    const inventory: OperationsInventory = await tx.get("inventory", item.id) || { id: item.id, committed: 0, reservations: [] };
    const reservations = inventory.reservations.filter((entry) => entry.requestId !== record.id && Date.parse(entry.expiresAt) > nowMs);
    let committed = inventory.committed;
    if (record.stockState === "committed" && next === "released") committed = Math.max(0, committed - item.quantity);
    if (next !== "released") {
      const product = products.find((entry) => entry.id === item.id);
      const limit = product && "stock" in product && typeof product.stock === "number" ? product.stock : null;
      if (!product || (limit !== null && limit - committed - reservations.reduce((sum, entry) => sum + entry.quantity, 0) < item.quantity)) throw new CmsError("Insufficient stock for this simulation. No order changes were saved.", 409, "OPERATIONS_STOCK");
      if (next === "reserved") reservations.push({ requestId: record.id, quantity: item.quantity, expiresAt: new Date(nowMs + MOCK_RESERVATION_MS).toISOString() });
      else if (record.stockState !== "committed") committed += item.quantity;
    }
    await tx.put("inventory", { id: item.id, committed, reservations });
  }
  return { stockState: next, stockExpiresAt: next === "reserved" ? new Date(nowMs + MOCK_RESERVATION_MS).toISOString() : undefined };
}
export type OperationsDependencies = { repository?: OperationsRepository; products?: readonly CatalogProduct[]; actor?: string; role?: "owner" | "editor"; now?: string; afterDelivery?: () => Promise<void> };

// Provider receipt is durable independently of the outbox acknowledgement. A
// retry can resolve an interrupted acknowledgement without another delivery.
async function fakeDelivery(repository: OperationsRepository, notice: OperationsNotice, now: string): Promise<OperationsDelivery> {
  return repository.transaction(async (tx) => {
    const id = notice.claim!.key, previous = await tx.get("deliveries", id);
    if (previous) return previous;
    const receipt: OperationsDelivery = { id, noticeId: notice.id, outcome: notice.claim!.outcome, receiptId: `MOCK-${id}`, at: now };
    await tx.put("deliveries", receipt); return receipt;
  });
}
async function finishNotice(repository: OperationsRepository, notice: OperationsNotice, dependencies: OperationsDependencies, now: string) {
  const delivery = await fakeDelivery(repository, notice, now);
  await dependencies.afterDelivery?.();
  return repository.transaction(async (tx) => {
    const current = await tx.get("outbox", notice.id), command = await tx.get("commands", notice.claim!.key);
    if (!current || !command) throw new CmsError("The notification attempt could not be confirmed.", 503, "OPERATIONS_UNCERTAIN");
    if (command.state === "complete") return commandResult(tx, command);
    if (current.claim?.key !== notice.claim!.key) throw new CmsError("A newer delivery attempt owns this notification.", 409, "OPERATIONS_CONFLICT");
    const clean = { ...current }; delete clean.claim;
    const updated: OperationsNotice = { ...clean, revision: current.revision + 1, state: delivery.outcome === "success" ? "mock-delivered" : current.attempts >= 3 ? "exhausted" : "failed", updatedAt: now, receiptId: delivery.receiptId };
    await tx.put("outbox", updated); await tx.put("commands", { ...command, state: "complete" });
    return { record: null, notice: updated, settings: null };
  });
}
export async function executeOperations(value: Record<string, unknown>, dependencies: OperationsDependencies = {}) {
  const command = validateOperationsCommand(value), repository = dependencies.repository || operationsRepository;
  const actor = dependencies.actor || cmsActor(), role = dependencies.role || cmsRole(), now = dependencies.now || timestamp();
  if (role !== "owner" && role !== "editor" || ownerActions.has(command.action) && role !== "owner") throw new CmsError("An owner account is required for this action.", 403, "FORBIDDEN");
  const products = dependencies.products || (await getPublishedContent()).products.filter((product) => product.status === "published");
  const fingerprint = hash(command);
  const result = await repository.transaction(async (tx) => {
    const previous = await tx.get("commands", command.key);
    if (previous) {
      if (previous.hash !== fingerprint) throw new CmsError("This command key was used for different details.", 409, "OPERATIONS_KEY_CONFLICT");
      const existing = await commandResult(tx, previous);
      if (previous.state === "pending" && existing.notice?.state !== "processing") { await tx.put("commands", { ...previous, state: "complete" }); return { ...existing, pending: null }; }
      return { ...existing, pending: previous.state === "pending" ? existing.notice : null };
    }
    const receipt: OperationsReceipt = { id: command.key, hash: fingerprint, state: "complete", at: now };
    if (command.action === "create") {
      const id = `staff-${command.key}`;
      let created: DemoRecord;
      try { created = createDemoSubmission(emptyDemoData(), command.input, id, now, products).record; }
      catch { throw new CmsError("Check the test enquiry details."); }
      // New shared test orders start as enquiries. Staff transitions are explicit,
      // authorized commands; client-provided payment outcomes are not trusted.
      if (created.kind === "order" && created.payment !== "enquiry") throw new CmsError("Create an enquiry before simulating payment.");
      const record: OperationsRequest = { ...created, reference: `TEST-${command.key.slice(0, 8).toUpperCase()}`, revision: 0, source: "staff-test", archived: false, stockState: "none" };
      await tx.put("requests", record); for (const notice of requestNotices(record, now, "created")) await tx.put("outbox", notice);
      receipt.requestId = id;
    } else if (command.action === "shipping") {
      const settings = await tx.get("settings", "settings") || { id: "settings" as const, revision: 0, shippingRules: [] };
      checkRevision(settings.revision, command.revision);
      await tx.put("settings", { ...settings, revision: settings.revision + 1, shippingRules: normalizeMockShippingRules(command.rules) });
    } else if (command.action === "deliver" || command.action === "resolve-notice") {
      const notice = await tx.get("outbox", command.id);
      if (!notice) throw new CmsError("Notification not found.", 404, "NOT_FOUND");
      checkRevision(notice.revision, command.revision);
      if (command.action === "resolve-notice") {
        if (notice.state !== "processing" || !notice.claim) throw new CmsError("No pending attempt needs resolution.", 409, "OPERATIONS_CONFLICT");
        await tx.put("commands", { ...receipt, noticeId: notice.id, state: "pending" });
        return { record: null, notice, settings: null, pending: notice };
      }
      if (notice.state === "processing") throw new CmsError("Resolve the pending attempt before retrying.", 409, "OPERATIONS_PENDING");
      if (notice.state === "mock-delivered" || notice.attempts >= 3) throw new CmsError("This notification cannot be retried.", 409, "OPERATIONS_RETRY_LIMIT");
      const pending: OperationsNotice = { ...notice, revision: notice.revision + 1, state: "processing", attempts: notice.attempts + 1, updatedAt: now, claim: { key: command.key, until: new Date(Date.parse(now) + 60000).toISOString(), outcome: command.outcome } };
      await tx.put("outbox", pending); receipt.state = "pending"; receipt.noticeId = notice.id; await tx.put("commands", receipt);
      return { record: null, notice: pending, settings: null, pending };
    } else {
      const record = await tx.get("requests", command.id);
      if (!record) throw new CmsError("Request not found.", 404, "NOT_FOUND");
      checkRevision(record.revision, command.revision);
      let next: OperationsRequest = { ...record, revision: record.revision + 1, updatedAt: now };
      if (command.action === "update") next = { ...next, ...command.patch, ...(command.patch.assignedTo !== undefined ? { assignedTo: command.patch.assignedTo.trim() } : {}), activity: appendActivity(record, actor, "request-updated", Object.keys(command.patch).join(", "), now) };
      else if (command.action === "archive" || command.action === "restore") next = { ...next, archived: command.action === "archive", activity: appendActivity(record, actor, "request-updated", command.action, now) };
      else if (command.action === "transition") {
        const current = record.order || initialOrderWorkflow(record.payment);
        if (record.kind !== "order" || record.archived || !orderTransitions[current.stage].includes(command.stage)) throw new CmsError("This order transition is not allowed.", 409, "OPERATIONS_TRANSITION");
        const order = parseOrderWorkflow({ mode: "mock", stage: command.stage, carrier: command.carrier?.trim() || current.carrier, tracking: command.tracking?.trim() || current.tracking });
        if (!order) throw new CmsError("Carrier and tracking are required before shipment.");
        if (command.stage === "awaiting-payment" || command.stage === "paid") next = { ...next, ...await updateInventory(tx, record, command.stage === "paid" ? "committed" : "reserved", products, now) };
        else if (command.stage === "cancelled" || command.stage === "refunded" && (!["shipped", "delivered"].includes(current.stage) || command.restock)) next = { ...next, ...await updateInventory(tx, record, "released", products, now) };
        next = { ...next, order, payment: command.stage === "paid" ? "demo-paid" : command.stage === "refunded" ? "demo-refunded" : record.payment, activity: appendActivity(record, actor, "order-transition", `${current.stage} → ${command.stage}`, now) };
        for (const notice of requestNotices(next, now, command.stage)) await tx.put("outbox", notice);
      }
      await tx.put("requests", next); receipt.requestId = record.id;
    }
    await tx.put("commands", receipt);
    return { ...await commandResult(tx, receipt), pending: null };
  });
  if (result.pending) {
    const completed = await finishNotice(repository, result.pending, dependencies, now);
    if (command.action === "resolve-notice") await repository.transaction(async (tx) => { const receipt = await tx.get("commands", command.key); if (receipt) await tx.put("commands", { ...receipt, state: "complete" }); });
    return completed;
  }
  return { record: result.record, notice: result.notice, settings: result.settings };
}

export async function operationsDetail(id: string, repository = operationsRepository) {
  if (!idPattern.test(id)) throw new CmsError("Choose a valid request.");
  return repository.transaction(async (tx) => { const record = await tx.get("requests", id); if (!record) throw new CmsError("Request not found.", 404); return record; });
}

export async function ingestOperationsRequest(source: "contact" | "order", raw: Record<string, unknown>, repository = operationsRepository) {
  if (typeof raw._id !== "string" || !keyPattern.test(raw._id)) throw new CmsError("Invalid source enquiry identifier.");
  const id = `${source}-${raw._id}`, now = raw.createdAt instanceof Date ? raw.createdAt.toISOString() : String(raw.createdAt);
  if (!Number.isFinite(Date.parse(now))) throw new CmsError("Invalid source enquiry date.");
  const customer = source === "order" ? raw.customer as Record<string, string> : undefined;
  const input = normalizeDemoInput({ kind: source === "order" ? "order" : raw.subject === "wholesale" ? "wholesale" : "contact", locale: raw.locale, name: customer?.name || raw.name, email: customer?.email || raw.email, phone: customer?.phone || raw.phone, message: customer?.notes || raw.message, ...(source === "order" ? { customer, items: raw.items, currency: raw.currency, payment: "enquiry" } : raw.wholesale ? { wholesale: raw.wholesale } : {}) } as DemoInput, catalogProducts, true);
  return repository.transaction(async (tx) => {
    const previous = await tx.get("requests", id); if (previous) return false;
    const record: OperationsRequest = { ...input, id, reference: source === "order" && typeof raw.reference === "string" ? raw.reference : `REQ-${String(raw._id).slice(0, 8).toUpperCase()}`, fingerprint: hash(input), status: "new", notes: "", assignedTo: "", createdAt: now, updatedAt: now, revision: 0, source, sourceId: String(raw._id), archived: false, stockState: "none", activity: [{ id: `${id}-0`, at: now, actor: "Customer", action: "request-created", detail: source }], ...(source === "order" ? { order: initialOrderWorkflow("enquiry") } : {}) };
    await tx.put("requests", record); for (const notice of requestNotices(record, now, "created")) await tx.put("outbox", notice); return true;
  });
}

export async function syncOperationsSources() {
  const db = await getDb(); if (!db) return { imported: 0, remaining: false, configured: false };
  let imported = 0, remaining = false;
  for (const source of ["contact", "order"] as const) {
    const collection = db.collection<{ _id: string; operationsImported?: boolean }>(source === "contact" ? "contact_inquiries" : "order_enquiries");
    const documents = await collection.find({ operationsImported: { $ne: true } }).sort({ createdAt: 1, _id: 1 }).limit(51).toArray();
    remaining ||= documents.length > 50;
    for (const raw of documents.slice(0, 50)) {
      if (await ingestOperationsRequest(source, raw)) imported++;
      // Mark only after the atomic projection and notices exist. A crash before
      // this acknowledgement safely replays the same source ID on the next sync.
      await collection.updateOne({ _id: raw._id }, { $set: { operationsImported: true } });
    }
  }
  return { imported, remaining, configured: true };
}

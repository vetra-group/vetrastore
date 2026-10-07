import { catalogProducts, HONEY_ID, MAX_QUANTITY, type CatalogProduct } from "./catalog";
import { isLocale } from "./i18n";
import { initialOrderWorkflow, normalizeWholesale, parseOrderWorkflow, parseRequestActivity } from "./commerce-workflow";
import { workflowCopy } from "@/content/workflow";
import { mockCheckoutCopy } from "@/content/mock-checkout";
import { notificationCopy } from "@/content/notifications";
import { allocateMockStock, expireMockInventory, normalizeMockShippingRules, parseMockInventory, parseMockShippingQuote, quoteMockShipping } from "./mock-checkout";
import {
  demoChecklistKeys, demoKinds, demoStatuses,
  type DemoData, type DemoInput, type DemoNotification, type DemoRecord, type DemoTrashEntry,
} from "./demo-types";

export const DEMO_STORAGE_KEY = "vetra-demo-v1";
export const DEMO_TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const demoEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const payments = ["enquiry", "demo-paid", "demo-failed"] as const;

export function emptyDemoData(): DemoData {
  return {
    version: 1,
    records: [],
    outbox: [],
    trash: [],
    mockShippingRules: [],
    inventory: [],
    checklist: Object.fromEntries(demoChecklistKeys.map((key) => [key, "needs-confirmation"])) as DemoData["checklist"],
  };
}

// Normalize demo inputs too: UI simulations use the catalog's price and bounds.
export function normalizeDemoInput(input: DemoInput, products: readonly CatalogProduct[] = catalogProducts, historical = false): DemoInput {
  if (!input || !demoKinds.includes(input.kind) || !isLocale(input.locale)) throw new Error("Invalid demo submission");
  if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 100) throw new Error("Check your name");
  if (typeof input.email !== "string" || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new Error("Check your email");
  if (input.message !== undefined && (typeof input.message !== "string" || input.message.length > 5000)) throw new Error("Check your message");
  if (input.phone !== undefined && (typeof input.phone !== "string" || input.phone.length > 30)) throw new Error("Check your phone");
  if (input.payment !== undefined && !payments.includes(input.payment)) throw new Error("Invalid demo payment");
  if (input.customer && (typeof input.customer !== "object" || Array.isArray(input.customer) || Object.entries(input.customer).some(([key, value]) => key.length > 40 || typeof value !== "string" || value.length > 1000))) throw new Error("Check your details");
  const result: DemoInput = {
    kind: input.kind, locale: input.locale,
    name: input.name.trim(), email: input.email.trim().toLowerCase(),
    ...(input.phone ? { phone: input.phone.trim() } : {}),
    ...(input.message ? { message: input.message.trim() } : {}),
    ...(input.customer ? { customer: { ...input.customer } } : {}),
  };
  if (input.wholesale !== undefined) {
    if (input.kind !== "wholesale") throw new Error("Wholesale details belong to a wholesale request");
    result.wholesale = normalizeWholesale(input.wholesale, products, historical);
  }
  if (input.kind === "order") {
    if (!Array.isArray(input.items) || !input.items.length || input.items.length > (historical ? 200 : products.length)) throw new Error("Check your bag");
    const ids = new Set<string>();
    result.items = input.items.map((item) => {
      const product = products.find((entry) => entry.id === item?.id);
      const stock = product && "stock" in product && typeof product.stock === "number" ? product.stock : MAX_QUANTITY;
      const limit = historical ? MAX_QUANTITY : Math.min(MAX_QUANTITY, stock);
      if (!item || typeof item.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(item.id) || (!historical && !product) || ids.has(item.id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > limit || (historical && (!Number.isFinite(item.unitPrice) || item.unitPrice < 0 || item.unitPrice > 10000000))) throw new Error("Check your bag");
      ids.add(item.id);
      return { id: item.id, quantity: item.quantity, unitPrice: historical ? item.unitPrice : product!.price };
    });
    result.subtotal = result.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    result.payment = input.payment ?? "enquiry";
  }
  return result;
}

const validDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

function parseRecord(value: unknown): DemoRecord | null {
  try {
    if (!value || typeof value !== "object") return null;
    const entry = value as DemoRecord;
    const input = normalizeDemoInput({ ...entry, payment: entry.submittedPayment ?? entry.payment } as DemoInput, catalogProducts, true);
    if (typeof entry.id !== "string" || !entry.id || entry.id.length > 100 || typeof entry.reference !== "string" || entry.reference.length > 50 || typeof entry.fingerprint !== "string" || !demoStatuses.includes(entry.status) || typeof entry.notes !== "string" || entry.notes.length > 5000 || !validDate(entry.createdAt) || !validDate(entry.updatedAt)) return null;
    if (JSON.stringify(input) !== entry.fingerprint) return null;
    const order = input.kind === "order" ? parseOrderWorkflow(entry.order) || initialOrderWorkflow(entry.payment) : undefined;
    const payment = order?.stage === "refunded" ? "demo-refunded" : order && ["paid", "processing", "shipped", "delivered"].includes(order.stage) ? "demo-paid" : input.payment;
    const shippingQuote = input.kind === "order" ? parseMockShippingQuote(entry.shippingQuote, input.subtotal || 0) : undefined;
    return { ...input, id: entry.id, reference: entry.reference, fingerprint: entry.fingerprint, status: entry.status, notes: entry.notes, createdAt: entry.createdAt, updatedAt: entry.updatedAt,
      ...(payment ? { payment } : {}),
      ...(input.payment && (entry.submittedPayment || payment !== input.payment) ? { submittedPayment: input.payment } : {}),
      ...(typeof entry.assignedTo === "string" && entry.assignedTo.length <= 100 ? { assignedTo: entry.assignedTo } : {}),
      ...(entry.activity ? { activity: parseRequestActivity(entry.activity) } : {}),
      ...(order ? { order } : {}),
      ...(shippingQuote ? { shippingQuote } : {}),
    };
  } catch { return null; }
}

function parseNotifications(value: unknown, recordIds: Set<string>): DemoNotification[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.filter((item): item is DemoNotification => {
    if (!item || typeof item !== "object" || !recordIds.has(item.recordId) || !["preview", "mock-delivered", "failed", "exhausted"].includes(item.state) || !["staff", "customer"].includes(item.to) || ![item.id, item.reference, item.recipient, item.subject].every((field) => typeof field === "string" && field.length <= 6000) || typeof item.body !== "string" || item.body.length > 100000 || !validDate(item.createdAt) || ids.has(item.id) || (item.attempts !== undefined && (!Number.isInteger(item.attempts) || item.attempts < 0 || item.attempts > 10)) || (item.lastAttemptAt !== undefined && !validDate(item.lastAttemptAt))) return false;
    ids.add(item.id);
    return true;
  }).map((item) => ({ id: item.id, recordId: item.recordId, reference: item.reference, to: item.to, recipient: item.recipient, subject: item.subject, body: item.body, state: item.state, createdAt: item.createdAt, ...(item.attempts !== undefined ? { attempts: item.attempts } : {}), ...(item.lastAttemptAt ? { lastAttemptAt: item.lastAttemptAt } : {}) }));
}

export function pruneDemoTrash(data: DemoData, now = Date.now()): DemoData {
  const trash = data.trash.filter((entry) => Date.parse(entry.expiresAt) > now);
  const inventory = expireMockInventory(data.inventory, now);
  return trash.length === data.trash.length && inventory === data.inventory ? data : { ...data, trash, inventory };
}

export function parseDemoData(value: unknown, now = Date.now()): DemoData {
  const empty = emptyDemoData();
  if (!value || typeof value !== "object") return empty;
  const data = value as Partial<DemoData>;
  if (data.version !== 1) return empty;
  const records: DemoRecord[] = [];
  const ids = new Set<string>();
  if (Array.isArray(data.records)) for (const value of data.records) {
    const entry = parseRecord(value);
    if (!entry || ids.has(entry.id)) continue;
    ids.add(entry.id);
    records.push(entry);
  }
  const outbox = parseNotifications(data.outbox, ids);
  const trash: DemoTrashEntry[] = [];
  const trashIds = new Set<string>();
  if (Array.isArray(data.trash)) for (const entry of data.trash) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !entry.id || entry.id.length > 180 || trashIds.has(entry.id) || !validDate(entry.deletedAt) || !Number.isSafeInteger(entry.position) || entry.position < 0) continue;
    const record = parseRecord(entry.record);
    const expiry = Date.parse(entry.deletedAt) + DEMO_TRASH_RETENTION_MS;
    if (!record || !Number.isFinite(expiry) || expiry > 8640000000000000) continue;
    // The deletion date owns retention, so a damaged expiry cannot delete early.
    trashIds.add(entry.id);
    trash.push({ id: entry.id, deletedAt: new Date(Date.parse(entry.deletedAt)).toISOString(), expiresAt: new Date(expiry).toISOString(), position: entry.position, record, notifications: parseNotifications(entry.notifications, new Set([record.id])) });
  }
  const checklist = { ...empty.checklist };
  for (const key of demoChecklistKeys) if (data.checklist?.[key] === "reviewed") checklist[key] = "reviewed";
  let mockShippingRules = empty.mockShippingRules;
  try { mockShippingRules = normalizeMockShippingRules(data.mockShippingRules ?? []); } catch { /* Invalid local rules remain unconfigured; saved requests are retained. */ }
  // Upgrade old snapshots conservatively. Previously paid or refunded orders may
  // already have consumed stock; deleting a request must not replenish that stock.
  const legacyInventory = [...records, ...trash.map((entry) => entry.record)].filter((record) => record.kind === "order" && ["paid", "processing", "shipped", "delivered", "refunded"].includes(record.order?.stage || "")).map((record) => ({ orderId: record.id, items: record.items, state: "committed" }));
  const inventory = parseMockInventory(data.inventory ?? legacyInventory);
  return pruneDemoTrash({ version: 1, records, outbox, trash, checklist, mockShippingRules, inventory }, now);
}

type DemoStorage = Pick<Storage, "getItem" | "setItem">;

export function writeDemoStorage(storage: DemoStorage, data: DemoData): DemoData {
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
  return data;
}

export function readDemoStorage(storage: DemoStorage, now = Date.now()): DemoData {
  const value: unknown = JSON.parse(storage.getItem(DEMO_STORAGE_KEY) ?? "null");
  const retained = parseDemoData(value, Number.NEGATIVE_INFINITY);
  const current = pruneDemoTrash(retained, now);
  if (current !== retained) {
    // Expiry is retried on later reads if the browser temporarily refuses writes.
    try { writeDemoStorage(storage, current); } catch { /* The expired entry stays on disk until a later successful sweep. */ }
  }
  return current;
}

function trashEntry(data: DemoData, record: DemoRecord, position: number, now: number): DemoTrashEntry {
  if (!Number.isFinite(now)) throw new Error("Invalid deletion date");
  const base = `${record.id}-${now.toString(36)}`;
  let id = base, suffix = 1;
  while (data.trash.some((entry) => entry.id === id)) id = `${base}-${suffix++}`;
  return { id, deletedAt: new Date(now).toISOString(), expiresAt: new Date(now + DEMO_TRASH_RETENTION_MS).toISOString(), position, record, notifications: data.outbox.filter((entry) => entry.recordId === record.id) };
}

export function trashDemoRecord(data: DemoData, id: string, now = Date.now()): DemoData {
  const current = pruneDemoTrash(data, now);
  const position = current.records.findIndex((record) => record.id === id);
  if (position < 0) throw new Error("Record no longer exists");
  return { ...current, records: current.records.filter((record) => record.id !== id), outbox: current.outbox.filter((entry) => entry.recordId !== id), trash: [trashEntry(current, current.records[position], position, now), ...current.trash] };
}

export function restoreDemoRecord(data: DemoData, id: string, now = Date.now()): DemoData {
  const current = pruneDemoTrash(data, now);
  const entry = current.trash.find((item) => item.id === id);
  if (!entry) throw new Error("This record has expired or is no longer in Trash");
  if (current.records.some((record) => record.id === entry.record.id) || entry.notifications.some((notification) => current.outbox.some((item) => item.id === notification.id))) throw new Error("A record with this ID already exists; the item is still in Trash");
  const records = [...current.records];
  records.splice(Math.min(entry.position, records.length), 0, entry.record);
  return { ...current, records, outbox: [...entry.notifications, ...current.outbox], trash: current.trash.filter((item) => item.id !== id) };
}

export function resetDemoData(data: DemoData, now = Date.now()): DemoData {
  const current = pruneDemoTrash(data, now);
  return { ...emptyDemoData(), mockShippingRules: current.mockShippingRules, inventory: current.inventory, trash: [...current.records.map((record, position) => trashEntry(current, record, position, now)), ...current.trash] };
}

function notificationPreviews(record: DemoRecord, products: readonly CatalogProduct[]): DemoNotification[] {
  const copy = notificationCopy[record.locale];
  const subject = `${copy.kinds[record.kind]} · ${record.reference}`;
  const paymentLabel = record.payment ? copy.payment[record.payment] : "";
  const itemLabels = record.items?.map((item) => `${products.find((product) => product.id === item.id)?.name[record.locale] ?? item.id} × ${item.quantity}`).join("\n") ?? "";
  let body = `${copy.greeting} ${record.name}\n${copy.reference} ${record.reference}\n${record.message ?? ""}\n${itemLabels}\n${record.subtotal !== undefined ? `${copy.subtotal} ฿${record.subtotal} (${copy.excluded})` : ""}\n${paymentLabel}\n${copy.localNote}`;
  if (record.wholesale) {
    const w = workflowCopy[record.locale], value = record.wholesale;
    body += `\n\n${w.product}: ${products.find((product) => product.id === value.productId)?.name[record.locale] || value.productId}\n${w.quantity}: ${value.quantity}\n${w.business}: ${value.business}\n${w.destination}: ${value.destination}\n${w.neededBy}: ${value.neededBy || "—"}`;
  }
  if (record.shippingQuote) {
    const m = mockCheckoutCopy[record.locale], quote = record.shippingQuote;
    body += quote.state === "quoted" ? `\n${m.shipping}: ฿${quote.fee}\n${m.total}: ฿${quote.total}\n${m.quoteNote}` : `\n${m.pending[quote.reason]}\n${m.pendingNote}`;
  }
  return (["staff", "customer"] as const).map((to) => ({ id: `${record.id}-${to}`, recordId: record.id, reference: record.reference, to, recipient: to === "customer" ? record.email : copy.staff, subject, body, state: "preview", createdAt: record.createdAt }));
}

export function createDemoSubmission(data: DemoData, input: DemoInput, key: string, now = new Date().toISOString(), products: readonly CatalogProduct[] = catalogProducts): { data: DemoData; record: DemoRecord } {
  if (!/^[\w-]{1,100}$/.test(key)) throw new Error("Invalid submission key");
  if (!validDate(now)) throw new Error("Invalid submission date");
  if (data.trash.some((entry) => entry.record.id === key)) throw new Error("This submission is in Trash; restore it before retrying");
  const previous = data.records.find((record) => record.id === key);
  if (previous) {
    const retryInput = input.kind === "order" && Array.isArray(input.items) ? { ...input, items: input.items.map((item) => ({ ...item, unitPrice: previous.items?.find((saved) => saved.id === item?.id)?.unitPrice ?? NaN })) } : input;
    const retry = normalizeDemoInput(retryInput, products, true);
    if (previous.fingerprint !== JSON.stringify(retry)) throw new Error("Submission details changed; use a new key");
    return { data, record: previous };
  }
  if (data.inventory.some((hold) => hold.orderId === key)) throw new Error("This order reference was previously used; create a new submission");
  const normalized = normalizeDemoInput(input, products);
  const fingerprint = JSON.stringify(normalized);
  const existing = data.records.find((record) => record.id === key || (normalized.kind === "newsletter" && record.kind === "newsletter" && record.email === normalized.email));
  if (existing) {
    if (existing.id === key && existing.fingerprint !== fingerprint) throw new Error("Submission details changed; use a new key");
    return { data, record: existing };
  }
  if (data.records.length >= 200) throw new Error("Demo inbox is full");
  const record: DemoRecord = { ...normalized, id: key, reference: `DEMO-${key.replace(/-/g, "").slice(0, 10).toUpperCase()}`, fingerprint, status: "new", notes: "", createdAt: now, updatedAt: now, assignedTo: "", activity: [{ id: `${key}-0`, at: now, actor: "Mock customer", action: "request-created", detail: normalized.kind }], ...(normalized.kind === "order" ? { order: initialOrderWorkflow(normalized.payment), shippingQuote: quoteMockShipping(data.mockShippingRules, normalized.customer?.postcode || "", normalized.subtotal || 0) } : {}) };
  const inventory = record.kind === "order" && record.payment !== "enquiry" ? allocateMockStock(data.inventory, key, record.items!, record.payment === "demo-paid" ? "committed" : "reserved", products, Date.parse(now)) : data.inventory;
  return { data: { ...data, inventory, records: [record, ...data.records], outbox: [...notificationPreviews(record, products), ...data.outbox] }, record };
}

export function demoSamples(products: readonly CatalogProduct[] = catalogProducts): DemoInput[] {
  const honey = products.find((product) => product.id === HONEY_ID) ?? products[0];
  return [
    { kind: "contact", locale: "en", name: "Sample customer", email: "customer@example.test", message: "Sample message: how can I use this honey with coffee?" },
    { kind: "wholesale", locale: "th", name: "ร้านค้าตัวอย่าง", email: "retailer@example.test", message: "ข้อความตัวอย่าง: ต้องการสอบถามรายละเอียดขายส่ง" },
    ...(honey && (!("stock" in honey) || honey.stock === null || (typeof honey.stock === "number" && honey.stock > 0)) ? [{ kind: "order" as const, locale: "en" as const, name: "Sample buyer", email: "buyer@example.test", message: "Sample order, no payment taken.", items: [{ id: honey.id, quantity: "stock" in honey && typeof honey.stock === "number" ? Math.min(2, honey.stock) : 2, unitPrice: honey.price }], payment: "enquiry" as const }] : []),
  ];
}

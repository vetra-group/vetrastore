import type { ClientSession, Db } from "mongodb";
import { MAX_QUANTITY } from "@/lib/catalog";
import type { CmsProduct } from "@/lib/cms/types";
import type { PaymentOrder } from "./orders";

export type PaymentInventoryState = "reserved" | "committed" | "released";
export type PaymentInventoryLine = { id: string; quantity: number };

export type PaymentInventoryRecord = {
  _id: string;
  /** Last CMS quantity explicitly reconciled with this real inventory record. */
  publishedStock: number;
  /** Cumulative sellable budget including units committed since this ledger
   * started. This may differ from the CMS's current on-hand stock figure. */
  sourceStock: number;
  available: number;
  reserved: number;
  committed: number;
  version: number;
  updatedAt: Date;
};

export type PaymentInventoryAllocation = {
  _id: string;
  items: PaymentInventoryLine[];
  state: PaymentInventoryState;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentInventoryLedgerEntry = {
  _id: string;
  orderId: string;
  revision: number;
  action: PaymentInventoryState;
  items: PaymentInventoryLine[];
  at: Date;
};

export type PaymentInventoryAdjustmentEntry = {
  _id: string;
  productId: string;
  action: "reconciled";
  before: { publishedStock: number; sourceStock: number; available: number; reserved: number; committed: number; version: number };
  after: { publishedStock: number; sourceStock: number; available: number; reserved: number; committed: number; version: number };
  actor: string;
  reason: string;
  at: Date;
};

export type ReconcilePaymentInventoryInput = {
  productId: string;
  expectedVersion: number;
  /** The current confirmed value from the published CMS product. */
  confirmedPublishedStock: number;
  /** Explicit cumulative sellable budget, including committed sales since the
   * ledger began. Do not automatically equate it with current CMS on-hand. */
  totalSellableBudget: number;
  actor: string;
  reason: string;
};

export class PaymentInventoryError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) {
    super(message);
    this.name = "PaymentInventoryError";
  }
}

function orderLines(order: PaymentOrder): PaymentInventoryLine[] {
  if (!Array.isArray(order.items) || !order.items.length || order.items.length > 100) {
    throw new PaymentInventoryError("INVENTORY_MISMATCH", 409, "The saved order needs inventory review.");
  }
  const seen = new Set<string>();
  const lines = order.items.map((item) => {
    if (!item || typeof item.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) || seen.has(item.id) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      throw new PaymentInventoryError("INVENTORY_MISMATCH", 409, "The saved order needs inventory review.");
    }
    seen.add(item.id);
    return { id: item.id, quantity: item.quantity };
  });
  return lines.sort((a, b) => a.id.localeCompare(b.id));
}

function matchingAllocation(allocation: PaymentInventoryAllocation, lines: PaymentInventoryLine[]): boolean {
  return Array.isArray(allocation.items) && JSON.stringify([...allocation.items].sort((a, b) => a.id.localeCompare(b.id))) === JSON.stringify(lines) && Number.isSafeInteger(allocation.revision) && allocation.revision >= 0;
}

function checkedStock(record: PaymentInventoryRecord): void {
  if (![record.publishedStock, record.sourceStock, record.available, record.reserved, record.committed, record.version].every(Number.isSafeInteger) || record.publishedStock < 0 || record.sourceStock < 0 || record.reserved < 0 || record.committed < 0 || record.version < 0 || record.available + record.reserved + record.committed !== record.sourceStock) {
    throw new PaymentInventoryError("INVENTORY_MISMATCH", 409, "The saved stock balance needs review.");
  }
}

function publishedStock(products: readonly CmsProduct[], id: string): number {
  const product = products.find((entry) => entry.id === id);
  if (!product || product.status !== "published" || !Number.isSafeInteger(product.stock) || product.stock === null || product.stock < 0) {
    throw new PaymentInventoryError("STOCK_UNCONFIRMED", 409, "This product does not have confirmed stock for online payment.");
  }
  return product.stock;
}

async function transitionEntry(db: Db, orderId: string, revision: number, action: PaymentInventoryState, items: PaymentInventoryLine[], at: Date, session: ClientSession): Promise<void> {
  await db.collection<PaymentInventoryLedgerEntry>("payment_inventory_ledger").insertOne({
    _id: `${orderId}:${revision}`, orderId, revision, action, items, at,
  }, { session });
}

/** Call inside the same MongoDB transaction that creates the pending order or
 * claims a deliberate retry. A reservation is per order, not per attempt.
 * The _id indexes, document writes and caller's transaction serialize
 * concurrent claims for the last available units. */
export async function reservePaymentInventory(db: Db, order: PaymentOrder, products: readonly CmsProduct[], session: ClientSession): Promise<void> {
  const lines = orderLines(order);
  const stock = db.collection<PaymentInventoryRecord>("payment_inventory");
  const allocations = db.collection<PaymentInventoryAllocation>("payment_inventory_allocations");
  const existing = await allocations.findOne({ _id: order._id }, { session });
  if (existing && !matchingAllocation(existing, lines)) throw new PaymentInventoryError("INVENTORY_MISMATCH", 409, "The saved allocation does not match this order.");
  if (existing?.state === "reserved") return;
  if (existing?.state === "committed") throw new PaymentInventoryError("INVENTORY_SETTLED", 409, "This order has already committed its stock.");
  if (existing && existing.state !== "released") throw new PaymentInventoryError("INVENTORY_MISMATCH", 409, "The saved allocation needs review.");

  const at = new Date();
  for (const line of lines) {
    const confirmedStock = publishedStock(products, line.id);
    let record = await stock.findOne({ _id: line.id }, { session });
    if (!record) {
      record = { _id: line.id, publishedStock: confirmedStock, sourceStock: confirmedStock, available: confirmedStock, reserved: 0, committed: 0, version: 0, updatedAt: at };
      await stock.insertOne(record, { session });
    }
    checkedStock(record);
    if (record.publishedStock !== confirmedStock) throw new PaymentInventoryError("STOCK_RECONCILIATION_REQUIRED", 409, "Published stock changed. Staff must reconcile real inventory before online payment resumes.");
    if (record.available < line.quantity) throw new PaymentInventoryError("STOCK_INSUFFICIENT", 409, "The requested quantity is no longer available.");
    const changed = await stock.updateOne({ _id: line.id, version: record.version, available: { $gte: line.quantity }, publishedStock: confirmedStock }, {
      $inc: { available: -line.quantity, reserved: line.quantity, version: 1 }, $set: { updatedAt: at },
    }, { session });
    if (changed.modifiedCount !== 1) throw new PaymentInventoryError("INVENTORY_BUSY", 503, "Stock changed during checkout. Please retry this order.");
  }

  const revision = existing ? existing.revision + 1 : 0;
  if (existing) {
    const changed = await allocations.updateOne({ _id: order._id, revision: existing.revision, state: "released" }, { $set: { state: "reserved", revision, updatedAt: at } }, { session });
    if (changed.modifiedCount !== 1) throw new PaymentInventoryError("INVENTORY_BUSY", 503, "The order allocation changed. Please retry.");
  } else {
    await allocations.insertOne({ _id: order._id, items: lines, state: "reserved", revision, createdAt: at, updatedAt: at }, { session });
  }
  await transitionEntry(db, order._id, revision, "reserved", lines, at, session);
}

/** Call only inside a transaction after an authoritative provider outcome.
 * A late verified success after a prior release must still be represented as
 * paid stock, even if that makes available stock negative; flag it for staff. */
export async function settlePaymentInventory(db: Db, order: PaymentOrder, action: "paid" | "released", session: ClientSession): Promise<{ requiresReview: boolean }> {
  const lines = orderLines(order);
  const stock = db.collection<PaymentInventoryRecord>("payment_inventory");
  const allocations = db.collection<PaymentInventoryAllocation>("payment_inventory_allocations");
  const existing = await allocations.findOne({ _id: order._id }, { session });
  if (!existing || !matchingAllocation(existing, lines) || !["reserved", "committed", "released"].includes(existing.state)) {
    throw new PaymentInventoryError("INVENTORY_MISMATCH", 409, "The saved order allocation needs review.");
  }
  if (action === "paid" && existing.state === "committed" || action === "released" && existing.state !== "reserved") return { requiresReview: false };
  const latePaid = action === "paid" && existing.state === "released";
  const at = new Date();
  for (const line of lines) {
    const record = await stock.findOne({ _id: line.id }, { session });
    if (!record) throw new PaymentInventoryError("INVENTORY_MISMATCH", 409, "The product stock record is missing.");
    checkedStock(record);
    const decrement = existing.state === "reserved" ? { reserved: -line.quantity } : { available: -line.quantity };
    const increment = action === "paid" ? { committed: line.quantity } : { available: line.quantity };
    if (existing.state === "reserved" && record.reserved < line.quantity) throw new PaymentInventoryError("INVENTORY_MISMATCH", 409, "Reserved stock is missing.");
    const changed = await stock.updateOne({ _id: line.id, version: record.version, ...(existing.state === "reserved" ? { reserved: { $gte: line.quantity } } : {}) }, {
      $inc: { ...decrement, ...increment, version: 1 }, $set: { updatedAt: at },
    }, { session });
    if (changed.modifiedCount !== 1) throw new PaymentInventoryError("INVENTORY_BUSY", 503, "Stock changed during settlement. The provider event can be retried.");
  }
  const next: PaymentInventoryState = action === "paid" ? "committed" : "released";
  const revision = existing.revision + 1;
  const changed = await allocations.updateOne({ _id: order._id, revision: existing.revision, state: existing.state }, { $set: { state: next, revision, updatedAt: at } }, { session });
  if (changed.modifiedCount !== 1) throw new PaymentInventoryError("INVENTORY_BUSY", 503, "The order allocation changed. The provider event can be retried.");
  await transitionEntry(db, order._id, revision, next, lines, at, session);
  return { requiresReview: latePaid };
}

/** Owner-authorized reconciliation primitive. The caller must load and verify
 * the current published CMS stock, then require a separately confirmed total
 * budget. All counters and the audit entry change in its MongoDB transaction.
 * No reservations or paid commitments are discarded. */
export async function reconcilePaymentInventory(db: Db, input: ReconcilePaymentInventoryInput, session: ClientSession): Promise<PaymentInventoryRecord> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.productId) || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 || !Number.isSafeInteger(input.confirmedPublishedStock) || input.confirmedPublishedStock < 0 || !Number.isSafeInteger(input.totalSellableBudget) || input.totalSellableBudget < 0 || input.totalSellableBudget > 1_000_000 || typeof input.actor !== "string" || !input.actor.trim() || input.actor.length > 200 || typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 1000) {
    throw new PaymentInventoryError("INVALID_RECONCILIATION", 400, "Check the confirmed stock adjustment and its reason.");
  }
  const stock = db.collection<PaymentInventoryRecord>("payment_inventory");
  const previous = await stock.findOne({ _id: input.productId }, { session });
  if (!previous) throw new PaymentInventoryError("INVENTORY_NOT_FOUND", 404, "No real payment stock record exists for this product.");
  checkedStock(previous);
  if (previous.version !== input.expectedVersion) throw new PaymentInventoryError("INVENTORY_CONFLICT", 409, "Stock changed. Refresh and review the latest balance.");
  const available = input.totalSellableBudget - previous.reserved - previous.committed;
  if (available < 0) throw new PaymentInventoryError("STOCK_BELOW_COMMITMENTS", 409, "The confirmed total is below units already reserved or paid. Review those orders first.");
  if (previous.publishedStock === input.confirmedPublishedStock && previous.sourceStock === input.totalSellableBudget) return previous;
  const at = new Date();
  const next: PaymentInventoryRecord = { ...previous, publishedStock: input.confirmedPublishedStock, sourceStock: input.totalSellableBudget, available, version: previous.version + 1, updatedAt: at };
  const changed = await stock.updateOne({ _id: input.productId, version: previous.version }, { $set: { publishedStock: next.publishedStock, sourceStock: next.sourceStock, available: next.available, updatedAt: at }, $inc: { version: 1 } }, { session });
  if (changed.modifiedCount !== 1) throw new PaymentInventoryError("INVENTORY_CONFLICT", 409, "Stock changed. Refresh and review the latest balance.");
  const before = { publishedStock: previous.publishedStock, sourceStock: previous.sourceStock, available: previous.available, reserved: previous.reserved, committed: previous.committed, version: previous.version };
  const after = { publishedStock: next.publishedStock, sourceStock: next.sourceStock, available: next.available, reserved: next.reserved, committed: next.committed, version: next.version };
  await db.collection<PaymentInventoryLedgerEntry | PaymentInventoryAdjustmentEntry>("payment_inventory_ledger").insertOne({
    _id: `stock:${input.productId}:${next.version}`, productId: input.productId, action: "reconciled", before, after, actor: input.actor.trim(), reason: input.reason.trim(), at,
  }, { session });
  return next;
}

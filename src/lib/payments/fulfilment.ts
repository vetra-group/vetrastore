import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { CmsError } from "@/lib/cms/validation";
import { withPaymentTransaction, type PaymentOrder } from "./orders";
import type { PaymentInventoryAllocation } from "./inventory";

export type PaymentFulfilmentStatus = "not-started" | "preparing" | "shipped" | "delivered";
export type PaymentFulfilment = {
  _id: string;
  revision: number;
  status: PaymentFulfilmentStatus;
  assignedTo: string;
  carrier: string;
  tracking: string;
  createdAt: Date;
  updatedAt: Date;
  activity: { id: string; at: Date; actor: string; from: PaymentFulfilmentStatus; to: PaymentFulfilmentStatus }[];
};

export type FulfilmentInput = {
  expectedRevision: number;
  status: PaymentFulfilmentStatus;
  assignedTo: string;
  carrier: string;
  tracking: string;
};

const nextStatus: Record<PaymentFulfilmentStatus, PaymentFulfilmentStatus | null> = {
  "not-started": "preparing",
  preparing: "shipped",
  shipped: "delivered",
  delivered: null,
};

export function parseFulfilmentInput(body: Record<string, unknown>): FulfilmentInput {
  if (Object.keys(body).some((key) => !["expectedRevision", "status", "assignedTo", "carrier", "tracking"].includes(key)) ||
      !Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0 ||
      !["not-started", "preparing", "shipped", "delivered"].includes(String(body.status)) ||
      typeof body.assignedTo !== "string" || body.assignedTo.length > 100 ||
      (body.carrier !== undefined && (typeof body.carrier !== "string" || body.carrier.length > 100)) ||
      (body.tracking !== undefined && (typeof body.tracking !== "string" || body.tracking.length > 150))) {
    throw new CmsError("Check the fulfilment details.", 400, "INVALID_FULFILMENT");
  }
  return {
    expectedRevision: body.expectedRevision as number,
    status: body.status as PaymentFulfilmentStatus,
    assignedTo: body.assignedTo.trim(),
    carrier: typeof body.carrier === "string" ? body.carrier.trim() : "",
    tracking: typeof body.tracking === "string" ? body.tracking.trim() : "",
  };
}

export function emptyFulfilment(orderId: string): PaymentFulfilment {
  return { _id: orderId, revision: 0, status: "not-started", assignedTo: "", carrier: "", tracking: "", createdAt: new Date(0), updatedAt: new Date(0), activity: [] };
}

export async function readPaymentFulfilment(db: Db, orderId: string): Promise<PaymentFulfilment | null> {
  const order = await db.collection<PaymentOrder>("payment_orders").findOne({ _id: orderId });
  if (!order) return null;
  return await db.collection<PaymentFulfilment>("payment_fulfilments").findOne({ _id: orderId }) ?? emptyFulfilment(orderId);
}

/** Staff progress is separate from payment state. Only a provider-confirmed,
 * inventory-committed order without an unresolved second charge may advance. */
export async function updatePaymentFulfilment(db: Db, orderId: string, input: FulfilmentInput, actor: string): Promise<PaymentFulfilment> {
  return withPaymentTransaction(async (session) => {
    const orders = db.collection<PaymentOrder>("payment_orders");
    const fulfilments = db.collection<PaymentFulfilment>("payment_fulfilments");
    const order = await orders.findOne({ _id: orderId }, { session });
    if (!order) throw new CmsError("Order not found.", 404, "ORDER_NOT_FOUND");
    if (order.status !== "paid" || order.requiresPaymentReview) throw new CmsError("Resolve payment review before fulfilment.", 409, "PAYMENT_REVIEW_REQUIRED");
    const allocation = await db.collection<PaymentInventoryAllocation>("payment_inventory_allocations").findOne({ _id: orderId }, { session });
    if (allocation?.state !== "committed") throw new CmsError("Confirm the paid order's inventory before fulfilment.", 409, "INVENTORY_REVIEW_REQUIRED");
    const previous = await fulfilments.findOne({ _id: orderId }, { session });
    const current = previous ?? emptyFulfilment(orderId);
    if (current.revision !== input.expectedRevision) throw new CmsError("Fulfilment changed. Reload the latest order before saving.", 409, "REVISION_CONFLICT");
    if (input.status !== current.status && input.status !== nextStatus[current.status]) throw new CmsError("Choose the next fulfilment stage.", 409, "INVALID_TRANSITION");
    const carrier = input.carrier || current.carrier;
    const tracking = input.tracking || current.tracking;
    if (input.status !== "not-started" && !input.assignedTo) throw new CmsError("Assign a staff owner before preparing this order.", 400, "OWNER_REQUIRED");
    if ((input.status === "shipped" || input.status === "delivered") && (!carrier || !tracking)) throw new CmsError("Carrier and tracking reference are required before shipment.", 400, "TRACKING_REQUIRED");
    if (current.status === "shipped" || current.status === "delivered") {
      if (input.carrier && input.carrier !== current.carrier || input.tracking && input.tracking !== current.tracking) {
        throw new CmsError("Shipment references cannot be changed here. Review the carrier record with an owner.", 409, "SHIPMENT_LOCKED");
      }
    }
    if (input.status === current.status && input.assignedTo === current.assignedTo && carrier === current.carrier && tracking === current.tracking) return current;
    const now = new Date();
    // Touch the paid order in this transaction. A concurrent second-charge
    // webhook also writes it, so shipment cannot race past its review flag.
    const claim = await orders.updateOne({ _id: orderId, status: "paid", requiresPaymentReview: { $ne: true } }, {
      $inc: { fulfilmentRevision: 1 }, $set: { updatedAt: now },
    }, { session });
    if (claim.modifiedCount !== 1) throw new CmsError("Payment changed. Refresh before fulfilling this order.", 409, "PAYMENT_REVIEW_REQUIRED");
    const next: PaymentFulfilment = {
      _id: orderId, revision: current.revision + 1, status: input.status,
      assignedTo: input.assignedTo, carrier, tracking,
      createdAt: previous?.createdAt ?? now, updatedAt: now,
      activity: [...current.activity, { id: randomUUID(), at: now, actor, from: current.status, to: input.status }].slice(-100),
    };
    if (previous) {
      const saved = await fulfilments.replaceOne({ _id: orderId, revision: current.revision }, next, { session });
      if (saved.modifiedCount !== 1) throw new CmsError("Fulfilment changed. Reload the latest order before saving.", 409, "REVISION_CONFLICT");
    } else {
      await fulfilments.insertOne(next, { session });
    }
    return next;
  });
}

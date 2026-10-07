import type { DemoInput, DemoRecord, DemoStatus } from "../demo-types";
import type { OrderStage } from "../commerce-workflow";
import type { MockShippingRule } from "../mock-checkout";

export type OperationsRequest = DemoRecord & { revision: number; source: "staff-test" | "website-test" | "contact" | "order"; sourceId?: string; archived: boolean; stockState: "none" | "reserved" | "committed" | "released"; stockExpiresAt?: string };
export type OperationsNotice = { id: string; revision: number; requestId: string; reference: string; recipient: string; audience: "staff" | "customer"; subject: string; body: string; createdAt: string; updatedAt: string; state: "ready" | "processing" | "mock-delivered" | "failed" | "exhausted"; attempts: number; receiptId?: string; claim?: { key: string; until: string; outcome: "success" | "failure" } };
export type OperationsInventory = { id: string; committed: number; reservations: { requestId: string; quantity: number; expiresAt: string }[] };
export type OperationsSettings = { id: "settings"; revision: number; shippingRules: MockShippingRule[] };
export type OperationsReceipt = { id: string; hash: string; state: "pending" | "complete"; requestId?: string; noticeId?: string; at: string };
export type OperationsDelivery = { id: string; noticeId: string; outcome: "success" | "failure"; receiptId: string; at: string };
export type OperationsTables = { requests: OperationsRequest; inventory: OperationsInventory; outbox: OperationsNotice; settings: OperationsSettings; commands: OperationsReceipt; deliveries: OperationsDelivery };
export type OperationsTable = keyof OperationsTables;
export interface OperationsTransaction {
  get<K extends OperationsTable>(table: K, id: string): Promise<OperationsTables[K] | null>;
  put<K extends OperationsTable>(table: K, value: OperationsTables[K]): Promise<void>;
}
export type OperationsQuery = { q: string; kind: string; status: string; assignment: string; archived: boolean; page: number; view: "requests" | "outbox"; email: string };
export interface OperationsRepository {
  transaction<T>(task: (transaction: OperationsTransaction) => Promise<T>): Promise<T>;
  list(query: OperationsQuery): Promise<{ records: OperationsRequest[]; notices: OperationsNotice[]; total: number; page: number; pageSize: number }>;
}
export type OperationsCommand =
  | { action: "create"; key: string; input: DemoInput }
  | { action: "update"; key: string; id: string; revision: number; patch: { status?: DemoStatus; notes?: string; assignedTo?: string } }
  | { action: "transition"; key: string; id: string; revision: number; stage: OrderStage; carrier?: string; tracking?: string; restock?: boolean }
  | { action: "archive" | "restore"; key: string; id: string; revision: number }
  | { action: "shipping"; key: string; revision: number; rules: MockShippingRule[] }
  | { action: "deliver"; key: string; id: string; revision: number; outcome: "success" | "failure" }
  | { action: "resolve-notice"; key: string; id: string; revision: number };

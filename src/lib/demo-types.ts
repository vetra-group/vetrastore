import type { Locale } from "./i18n";
import type { Currency } from "./catalog";
import type { OrderWorkflow, RequestActivity, WholesaleRequest } from "./commerce-workflow";
import type { MockInventoryHold, MockShippingQuote, MockShippingRule } from "./mock-checkout";

export const demoKinds = ["contact", "wholesale", "order", "newsletter"] as const;
export const demoStatuses = ["new", "reviewing", "completed"] as const;
export const demoChecklistKeys = ["shipping", "returns", "stock", "wholesale", "contact", "domain", "payment", "data"] as const;
export type DemoKind = (typeof demoKinds)[number];
export type DemoStatus = (typeof demoStatuses)[number];
export type DemoChecklistKey = (typeof demoChecklistKeys)[number];
export type DemoChecklistStatus = "needs-confirmation" | "reviewed";
export type DemoChecklist = Record<DemoChecklistKey, DemoChecklistStatus>;
export type DemoPayment = "enquiry" | "demo-paid" | "demo-failed";
export type DemoPaymentOutcome = DemoPayment | "demo-refunded";
export type DemoItem = { id: string; quantity: number; unitPrice: number; lineTotal?: number };

export type DemoInput = {
  kind: DemoKind;
  locale: Locale;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  customer?: Record<string, string>;
  items?: DemoItem[];
  subtotal?: number;
  /** Absent on legacy THB records. */
  currency?: Currency;
  payment?: DemoPayment;
  wholesale?: WholesaleRequest;
};

export type DemoRecord = Omit<DemoInput, "payment"> & {
  payment?: DemoPaymentOutcome;
  submittedPayment?: DemoPayment;
  id: string;
  reference: string;
  fingerprint: string;
  status: DemoStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  activity?: RequestActivity[];
  order?: OrderWorkflow;
  shippingQuote?: MockShippingQuote;
};

export type DemoNotification = {
  id: string;
  recordId: string;
  reference: string;
  to: "staff" | "customer";
  recipient: string;
  subject: string;
  body: string;
  createdAt: string;
  state: "preview" | "mock-delivered" | "failed" | "exhausted";
  attempts?: number;
  lastAttemptAt?: string;
};

export type DemoTrashEntry = {
  id: string;
  deletedAt: string;
  expiresAt: string;
  position: number;
  record: DemoRecord;
  notifications: DemoNotification[];
};

export type DemoData = {
  version: 1;
  records: DemoRecord[];
  outbox: DemoNotification[];
  trash: DemoTrashEntry[];
  checklist: DemoChecklist;
  mockShippingRules: MockShippingRule[];
  inventory: MockInventoryHold[];
};

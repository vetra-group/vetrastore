"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";
import { createDemoSubmission, DEMO_STORAGE_KEY, demoSamples, emptyDemoData, readDemoStorage, resetDemoData, restoreDemoRecord, trashDemoRecord, writeDemoStorage } from "@/lib/demo";
import { demoChecklistKeys, type DemoChecklistKey, type DemoChecklistStatus, type DemoData, type DemoInput, type DemoRecord } from "@/lib/demo-types";
import { retryDemoNotification, transitionDemoOrder, updateDemoRequest, type OrderStage, type RequestPatch } from "@/lib/commerce-workflow";
import { usePublished } from "@/components/cms/PublishedProvider";
import { normalizeMockShippingRules, type MockShippingRule } from "@/lib/mock-checkout";

type DemoStore = DemoData & {
  enabled: boolean;
  hydrated: boolean;
  submit: (input: DemoInput, submissionKey?: string) => DemoRecord;
  updateRecord: (id: string, patch: RequestPatch) => void;
  transitionOrder: (id: string, stage: OrderStage, details?: { carrier?: string; tracking?: string; restock?: boolean }) => void;
  updateMockShippingRules: (rules: MockShippingRule[]) => void;
  retryNotification: (id: string, outcome: "success" | "failure") => void;
  deleteRecord: (id: string) => void;
  restoreRecord: (id: string) => void;
  updateChecklist: (key: DemoChecklistKey, status: DemoChecklistStatus) => void;
  seedSamples: () => void;
  resetDemo: () => void;
};
const DemoContext = createContext<DemoStore | null>(null);
const empty = emptyDemoData();
let snapshot = empty;
let initialized = false;
const listeners = new Set<() => void>();
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
const serverSnapshot = () => empty;
const isClient = () => true;
const isServer = () => false;
function readStorage() {
  try { return readDemoStorage(localStorage); }
  catch { return snapshot; }
}
function getSnapshot() {
  if (!initialized) { snapshot = readStorage(); initialized = true; }
  return snapshot;
}
function notify() { listeners.forEach((listener) => listener()); }
function scheduleExpiry() {
  clearTimeout(expiryTimer);
  if (!listeners.size || document.visibilityState === "hidden") return;
  const nextExpiry = Math.min(snapshot.trash.reduce((nearest, entry) => Math.min(nearest, Date.parse(entry.expiresAt)), Infinity), snapshot.inventory.reduce((nearest, hold) => hold.state === "reserved" ? Math.min(nearest, Date.parse(hold.expiresAt!)) : nearest, Infinity));
  const remaining = nextExpiry - Date.now();
  // One shared timer follows expiry and retries cleanup hourly while visible.
  // Failed storage reads retry after a minute instead of creating a busy loop.
  expiryTimer = setTimeout(syncStorage, remaining <= 0 ? 60 * 1000 : Math.max(1, Math.min(remaining, 60 * 60 * 1000)));
}
function syncStorage() {
  const next = readStorage();
  if (JSON.stringify(next) !== JSON.stringify(snapshot)) { snapshot = next; initialized = true; notify(); }
  scheduleExpiry();
}
function storageChanged(event: StorageEvent) {
  if (event.key === DEMO_STORAGE_KEY || event.key === null) syncStorage();
}
function visibilityChanged() {
  if (document.visibilityState === "visible") syncStorage();
  else scheduleExpiry();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("storage", storageChanged);
    window.addEventListener("focus", syncStorage);
    document.addEventListener("visibilitychange", visibilityChanged);
    syncStorage();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(expiryTimer);
      window.removeEventListener("storage", storageChanged);
      window.removeEventListener("focus", syncStorage);
      document.removeEventListener("visibilitychange", visibilityChanged);
    }
  };
}

export function DemoProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { products } = usePublished();
  const data = useSyncExternalStore(subscribe, enabled ? getSnapshot : serverSnapshot, serverSnapshot);
  const hydrated = useSyncExternalStore(subscribe, isClient, isServer);
  const persist = useCallback((next: DemoData) => {
    if (!enabled) throw new Error("Demo mode is disabled");
    // Confirm persistence before reporting success; storage failures keep the form draft.
    snapshot = writeDemoStorage(localStorage, next);
    initialized = true;
    notify();
    scheduleExpiry();
  }, [enabled]);
  const submit = useCallback((input: DemoInput, key: string = crypto.randomUUID()) => {
    const next = createDemoSubmission(readDemoStorage(localStorage), input, key, undefined, products);
    persist(next.data);
    return next.record;
  }, [persist, products]);
  const deleteRecord = useCallback((id: string) => {
    persist(trashDemoRecord(readDemoStorage(localStorage), id));
  }, [persist]);
  const restoreRecord = useCallback((id: string) => {
    persist(restoreDemoRecord(readDemoStorage(localStorage), id));
  }, [persist]);
  const updateRecord = useCallback((id: string, patch: RequestPatch) => persist(updateDemoRequest(readDemoStorage(localStorage), id, patch)), [persist]);
  const transitionOrder = useCallback((id: string, stage: OrderStage, details?: { carrier?: string; tracking?: string; restock?: boolean }) => persist(transitionDemoOrder(readDemoStorage(localStorage), id, stage, details, undefined, products)), [persist, products]);
  const updateMockShippingRules = useCallback((rules: MockShippingRule[]) => persist({ ...readDemoStorage(localStorage), mockShippingRules: normalizeMockShippingRules(rules) }), [persist]);
  const retryNotification = useCallback((id: string, outcome: "success" | "failure") => persist(retryDemoNotification(readDemoStorage(localStorage), id, outcome)), [persist]);
  const updateChecklist = useCallback((key: DemoChecklistKey, status: DemoChecklistStatus) => {
    if (!demoChecklistKeys.includes(key) || !["needs-confirmation", "reviewed"].includes(status)) throw new Error("Invalid checklist update");
    const current = readDemoStorage(localStorage);
    persist({ ...current, checklist: { ...current.checklist, [key]: status } });
  }, [persist]);
  const seedSamples = useCallback(() => {
    let current = readDemoStorage(localStorage);
    demoSamples(products).forEach((input, index) => { current = createDemoSubmission(current, input, `sample-${index + 1}`, undefined, products).data; });
    persist(current);
  }, [persist, products]);
  const resetDemo = useCallback(() => persist(resetDemoData(readDemoStorage(localStorage))), [persist]);
  return <DemoContext.Provider value={{ ...data, enabled, hydrated, submit, updateRecord, transitionOrder, updateMockShippingRules, retryNotification, deleteRecord, restoreRecord, updateChecklist, seedSamples, resetDemo }}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const store = useContext(DemoContext);
  if (!store) throw new Error("useDemo must be rendered inside DemoProvider");
  return store;
}

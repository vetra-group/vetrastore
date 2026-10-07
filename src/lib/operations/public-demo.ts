import { createHash } from "node:crypto";
import { createDemoSubmission, emptyDemoData, normalizeDemoInput } from "../demo";
import type { DemoInput } from "../demo-types";
import { CmsError } from "../cms/validation";
import { getPublishedContent } from "../cms/server";
import type { CatalogProduct } from "../catalog";
import { operationsRepository } from "./repository";
import type { OperationsRepository, OperationsRequest } from "./types";
import { requestNotices } from "./service";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validate(body: Record<string, unknown>) {
  if (Object.keys(body).some((key) => !["submissionId", "input", "consent", "website"].includes(key)) || typeof body.submissionId !== "string" || !uuid.test(body.submissionId) || body.consent !== true || body.website || !body.input || typeof body.input !== "object" || Array.isArray(body.input)) throw new CmsError("Check the enquiry details.");
  const input = body.input as DemoInput;
  if (Object.keys(input).some((key) => !["kind", "locale", "name", "email", "phone", "message", "customer", "items", "currency", "payment", "wholesale"].includes(key)) || !["contact", "wholesale", "order"].includes(input.kind) || input.payment !== undefined && input.payment !== "enquiry") throw new CmsError("Only nonbinding test enquiries are accepted here.");
  if (input.kind === "order") {
    const limits = { name: 100, email: 254, phone: 30, address: 500, district: 100, province: 100, postcode: input.locale === "th" ? 5 : 20, notes: 1000, ...(input.locale === "th" ? {} : { country: 100 }) };
    if (!input.customer || Object.keys(input.customer).some((key) => !Object.hasOwn(limits, key))) throw new CmsError("Check your delivery details.");
    for (const [key, limit] of Object.entries(limits)) if (typeof input.customer[key] !== "string" || input.customer[key].length > limit || key !== "notes" && !input.customer[key].trim()) throw new CmsError("Check your delivery details.");
    if (!/^[+()\d\s.-]{7,30}$/.test(input.customer.phone) || !(input.locale === "th" ? /^\d{5}$/.test(input.customer.postcode) : /^[\p{L}\p{N}][\p{L}\p{N} -]{1,18}[\p{L}\p{N}]$/u.test(input.customer.postcode)) || input.name !== input.customer.name || input.email !== input.customer.email || input.phone !== input.customer.phone) throw new CmsError("Check your contact details.");
  } else {
    if (typeof input.message !== "string" || input.message.trim().length < 10 || input.items !== undefined || input.payment !== undefined) throw new CmsError("Check your message.");
    if (input.customer && (Object.keys(input.customer).some((key) => key !== "subject") || !["general", "product", "wholesale", "order", "privacy"].includes(input.customer.subject))) throw new CmsError("Check your enquiry subject.");
    if (input.kind === "wholesale" && !input.wholesale) throw new CmsError("Complete the wholesale details.");
  }
  try {
    // The retry identity excludes client prices and uses normalized input. A
    // saved enquiry remains retryable after catalog prices or stock change.
    const normalized = normalizeDemoInput({ ...input, currency: undefined, ...(Array.isArray(input.items) ? { items: input.items.map((item) => ({ id: item.id, quantity: item.quantity, unitPrice: 0 })).sort((a, b) => String(a.id).localeCompare(String(b.id))) } : {}) }, [], true);
    return { key: body.submissionId, input: normalized, fingerprint: createHash("sha256").update(JSON.stringify(normalized)).digest("hex") };
  } catch { throw new CmsError("Check the enquiry details."); }
}

export async function submitSharedDemo(body: Record<string, unknown>, dependencies: { repository?: OperationsRepository; products?: readonly CatalogProduct[]; now?: string } = {}) {
  const { key, input, fingerprint } = validate(body), repository = dependencies.repository || operationsRepository;
  const now = dependencies.now || new Date().toISOString(), id = `website-${key}`;
  return repository.transaction(async (tx) => {
    const previous = await tx.get("commands", id);
    if (previous) {
      if (previous.hash !== fingerprint) throw new CmsError("This submission key was used for different details.", 409, "OPERATIONS_KEY_CONFLICT");
      const record = await tx.get("requests", id);
      if (!record) throw new CmsError("The saved enquiry could not be confirmed.", 503);
      return { id: record.id, reference: record.reference, status: "enquiry" as const };
    }
    const products = dependencies.products || (await getPublishedContent()).products.filter((product) => product.status === "published");
    let created;
    try { created = createDemoSubmission(emptyDemoData(), input, id, now, products).record; }
    catch { throw new CmsError("Check the enquiry and current product availability."); }
    const record: OperationsRequest = { ...created, source: "website-test", reference: `DEMO-${key.replaceAll("-", "").slice(0, 12).toUpperCase()}`, revision: 0, archived: false, stockState: "none" };
    await tx.put("requests", record);
    for (const notice of requestNotices(record, now, "created")) await tx.put("outbox", notice);
    await tx.put("commands", { id, hash: fingerprint, state: "complete", requestId: record.id, at: now });
    return { id: record.id, reference: record.reference, status: "enquiry" as const };
  });
}

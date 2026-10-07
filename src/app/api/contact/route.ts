import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { isLocale } from "@/lib/i18n";
import { getPublishedContent } from "@/lib/cms/server";
import { normalizeWholesale, type WholesaleRequest } from "@/lib/commerce-workflow";
import { pendingRequestNotices, type PendingRequestNotice } from "@/lib/request-outbox";
import {
  EMAIL_PATTERN,
  isRateLimited,
  readFormJson,
  response,
} from "./validation";
export const runtime = "nodejs";
type Inquiry = {
  _id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: string;
  consent: true;
  consentVersion: string;
  payloadHash: string;
  createdAt: Date;
  status: "new";
  phone?: string;
  wholesale?: WholesaleRequest;
  outbox: PendingRequestNotice[];
};
export async function POST(request: Request) {
  if (isRateLimited(request, "contact")) return response(429, "rate_limited");
  const body = await readFormJson(request);
  if (!body) return response(400, "invalid_request");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject : "";
  const submissionId =
    typeof body.submissionId === "string" ? body.submissionId : "";
  const locale = typeof body.locale === "string" ? body.locale : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (
    name.length < 1 ||
    name.length > 100 ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email) ||
    message.length < 10 ||
    message.length > 5000 ||
    !["general", "product", "wholesale", "order", "privacy"].includes(
      subject,
    ) ||
    !isLocale(locale) ||
    body.consent !== true ||
    body.website ||
    (body.phone !== undefined && typeof body.phone !== "string") || phone.length > 30 ||
    (subject !== "wholesale" && body.wholesale !== undefined) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      submissionId,
    )
  )
    return response(400, "invalid_request");
  try {
    let wholesale: WholesaleRequest | undefined;
    if (subject === "wholesale") {
      try { wholesale = normalizeWholesale(body.wholesale, [], true); }
      catch { return response(400, "invalid_request"); }
    }
    const db = await getDb();
    if (!db) return response(503, "temporarily_unavailable");
    const collection = db.collection<Inquiry>("contact_inquiries");
    const payloadHash = createHash("sha256")
      .update(JSON.stringify({ name, email, message, subject, locale, ...(phone ? { phone } : {}), ...(wholesale ? { wholesale } : {}) }))
      .digest("hex");
    const previous = await collection.findOne({ _id: submissionId }, { projection: { payloadHash: 1 } });
    if (previous) return previous.payloadHash === payloadHash ? response(200, "received") : response(409, "submission_conflict");
    if (wholesale && !(await getPublishedContent()).products.some((product) => product.status === "published" && product.id === wholesale.productId)) return response(400, "invalid_request");
    await collection.updateOne(
      { _id: submissionId },
      {
        $setOnInsert: {
          name,
          email,
          subject,
          message,
          locale,
          consent: true,
          consentVersion: "2026-09-30",
          payloadHash,
          createdAt: new Date(),
          status: "new",
          ...(phone ? { phone } : {}), ...(wholesale ? { wholesale } : {}),
          outbox: pendingRequestNotices(submissionId, new Date()),
        },
      },
      { upsert: true },
    );
    const saved = await collection.findOne(
      { _id: submissionId },
      { projection: { payloadHash: 1 } },
    );
    if (!saved) return response(503, "temporarily_unavailable");
    if (saved.payloadHash !== payloadHash)
      return response(409, "submission_conflict");
    return response(200, "received");
  } catch {
    return response(503, "temporarily_unavailable");
  }
}

import { getDb } from "@/lib/db";
import { isLocale } from "@/lib/i18n";
import {
  EMAIL_PATTERN,
  isRateLimited,
  readFormJson,
  response,
} from "../contact/validation";
export const runtime = "nodejs";
type Subscriber = {
  _id: string;
  email: string;
  locale: string;
  consent: true;
  consentVersion: string;
  createdAt: Date;
  status: "subscribed";
};
export async function POST(request: Request) {
  if (isRateLimited(request, "newsletter"))
    return response(429, "rate_limited");
  const body = await readFormJson(request);
  if (!body) return response(400, "invalid_request");
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const locale = typeof body.locale === "string" ? body.locale : "";
  if (
    email.length > 254 ||
    !EMAIL_PATTERN.test(email) ||
    !isLocale(locale) ||
    body.consent !== true ||
    body.website
  )
    return response(400, "invalid_request");
  try {
    const db = await getDb();
    if (!db) return response(503, "temporarily_unavailable");
    const result = await db
      .collection<Subscriber>("newsletter_subscribers")
      .updateOne(
        { _id: email },
        {
          $setOnInsert: {
            email,
            locale,
            consent: true,
            consentVersion: "2026-09-30",
            createdAt: new Date(),
            status: "subscribed",
          },
        },
        { upsert: true },
      );
    return result.acknowledged
      ? response(200, "subscribed")
      : response(503, "temporarily_unavailable");
  } catch {
    return response(503, "temporarily_unavailable");
  }
}

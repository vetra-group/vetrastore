import { cmsErrorResponse, withCmsIdentity } from "@/lib/cms/auth";
import { CmsError } from "@/lib/cms/validation";
import { getDb } from "@/lib/db";
import { releaseExpiredUnstartedPaymentOrders } from "@/lib/payments/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow", Vary: "Cookie" };

/** Only orders with no provider attempt ever can expire from local time.
 * Anything that reached a gateway stays reserved until authoritative review. */
export async function POST(request: Request) {
  try {
    return await withCmsIdentity(request, true, async () => {
      if (process.env.CMS_STORAGE !== "mongodb") throw new CmsError("Payment maintenance requires durable storage.", 503, "PAYMENT_UNAVAILABLE");
      const db = await getDb();
      if (!db) throw new CmsError("Payment records are temporarily unavailable.", 503, "PAYMENT_UNAVAILABLE");
      const released = await releaseExpiredUnstartedPaymentOrders(db, 50);
      return Response.json({ released }, { headers });
    }, "admin");
  } catch (error) { return cmsErrorResponse(error); }
}

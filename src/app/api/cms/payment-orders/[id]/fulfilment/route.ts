import { cmsActor, cmsErrorResponse, readCmsJson, withCmsIdentity } from "@/lib/cms/auth";
import { CmsError } from "@/lib/cms/validation";
import { getDb } from "@/lib/db";
import { parseFulfilmentInput, readPaymentFulfilment, updatePaymentFulfilment } from "@/lib/payments/fulfilment";
import { paymentIdPattern } from "@/lib/payments/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow", Vary: "Cookie" };

async function database(orderId: string) {
  if (!paymentIdPattern.test(orderId)) throw new CmsError("Invalid order reference.", 400, "INVALID_ORDER");
  if (process.env.CMS_STORAGE !== "mongodb") throw new CmsError("Payment fulfilment requires durable storage.", 503, "FULFILMENT_UNAVAILABLE");
  const db = await getDb();
  if (!db) throw new CmsError("Payment fulfilment is temporarily unavailable.", 503, "FULFILMENT_UNAVAILABLE");
  return db;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    return await withCmsIdentity(request, false, async () => {
      const { id } = await context.params;
      const db = await database(id);
      const fulfilment = await readPaymentFulfilment(db, id);
      if (!fulfilment) throw new CmsError("Order not found.", 404, "ORDER_NOT_FOUND");
      return Response.json({ fulfilment }, { headers });
    }, "edit");
  } catch (error) { return cmsErrorResponse(error); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    return await withCmsIdentity(request, true, async () => {
      const { id } = await context.params;
      const db = await database(id);
      const input = parseFulfilmentInput(await readCmsJson(request, 3000));
      const fulfilment = await updatePaymentFulfilment(db, id, input, cmsActor());
      return Response.json({ fulfilment }, { headers });
    }, "edit");
  } catch (error) { return cmsErrorResponse(error); }
}

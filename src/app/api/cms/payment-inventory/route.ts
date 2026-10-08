import { cmsActor, cmsErrorResponse, readCmsJson, withCmsIdentity } from "@/lib/cms/auth";
import { getPublishedContent } from "@/lib/cms/server";
import { CmsError } from "@/lib/cms/validation";
import { getDb, getMongoClient } from "@/lib/db";
import { PaymentInventoryError, reconcilePaymentInventory, type PaymentInventoryRecord } from "@/lib/payments/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow", Vary: "Cookie" };

function requireRemoteStorage() {
  if (process.env.CMS_STORAGE !== "mongodb") throw new CmsError("Real payment inventory requires durable MongoDB storage.", 503, "PAYMENT_INVENTORY_UNAVAILABLE");
}

export async function GET(request: Request) {
  try {
    return await withCmsIdentity(request, false, async () => {
      requireRemoteStorage();
      const db = await getDb();
      if (!db) throw new CmsError("Real payment inventory is unavailable.", 503, "PAYMENT_INVENTORY_UNAVAILABLE");
      const published = (await getPublishedContent()).products.filter((product) => product.status === "published");
      const records = await db.collection<PaymentInventoryRecord>("payment_inventory").find({}).sort({ _id: 1 }).limit(1001).toArray();
      if (records.length > 1000) throw new CmsError("The inventory list is too large. Review it in smaller groups.", 503, "PAYMENT_INVENTORY_CAPACITY");
      const byId = new Map(published.map((product) => [product.id, product]));
      return Response.json({
        inventory: records.map((record) => ({
          productId: record._id,
          productName: byId.get(record._id)?.name ?? null,
          currentPublishedStock: byId.get(record._id)?.stock ?? null,
          publishedStock: record.publishedStock,
          totalSellableBudget: record.sourceStock,
          available: record.available,
          reserved: record.reserved,
          committed: record.committed,
          version: record.version,
          updatedAt: record.updatedAt,
          needsReconciliation: byId.get(record._id)?.stock !== record.publishedStock,
        })),
      }, { headers });
    }, "admin");
  } catch (error) { return cmsErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    return await withCmsIdentity(request, true, async () => {
      requireRemoteStorage();
      const body = await readCmsJson(request, 3000);
      if (Object.keys(body).some((key) => !["productId", "expectedVersion", "totalSellableBudget", "reason"].includes(key)) || typeof body.productId !== "string" || typeof body.reason !== "string" || !Number.isSafeInteger(body.expectedVersion) || !Number.isSafeInteger(body.totalSellableBudget)) {
        throw new CmsError("Check the stock reconciliation details.", 400, "INVALID_RECONCILIATION");
      }
      const productId = body.productId;
      const product = (await getPublishedContent()).products.find((entry) => entry.id === productId && entry.status === "published");
      if (!product || product.stock === null || !Number.isSafeInteger(product.stock)) throw new CmsError("Publish a confirmed stock quantity before reconciling real inventory.", 409, "STOCK_UNCONFIRMED");
      const client = await getMongoClient();
      const db = await getDb();
      if (!client || !db) throw new CmsError("Real payment inventory is unavailable.", 503, "PAYMENT_INVENTORY_UNAVAILABLE");
      const session = client.startSession();
      try {
        const record = await session.withTransaction(() => reconcilePaymentInventory(db, {
          productId,
          expectedVersion: body.expectedVersion as number,
          confirmedPublishedStock: product.stock as number,
          totalSellableBudget: body.totalSellableBudget as number,
          reason: body.reason as string,
          actor: cmsActor(),
        }, session), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, maxCommitTimeMS: 10000 });
        if (!record) throw new CmsError("Stock reconciliation could not be confirmed. Refresh before trying again.", 503, "INVENTORY_UNCERTAIN");
        return Response.json({ inventory: {
          productId: record._id,
          publishedStock: record.publishedStock,
          totalSellableBudget: record.sourceStock,
          available: record.available,
          reserved: record.reserved,
          committed: record.committed,
          version: record.version,
          updatedAt: record.updatedAt,
        } }, { headers });
      } finally { await session.endSession(); }
    }, "admin");
  } catch (error) {
    return cmsErrorResponse(error instanceof PaymentInventoryError ? new CmsError(error.message, error.status, error.code) : error);
  }
}

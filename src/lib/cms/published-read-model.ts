import path from "node:path";
import { createHash } from "node:crypto";
import { cmsDirectory } from "./auth";
import { defaultContent } from "./defaults";
import { fileVersion, readFile, remoteCmsStorage } from "./storage";
import { CmsError, validateCmsContent, validateRevision } from "./validation";
import { publishedContentProjection } from "./public-content";
import type { CmsContent } from "./types";

type CachedPublication = { sourceVersion: string; hash: string; content: CmsContent };
const cache = new Map<string, CachedPublication>();
const namespace = () => `${remoteCmsStorage() ? "mongodb" : "local"}:${cmsDirectory()}`;
const digest = (content: CmsContent) => createHash("sha256").update(JSON.stringify(content)).digest("hex");
const absent = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

export function invalidatePublishedReadModel() { cache.delete(namespace()); }

function remember(sourceVersion: string, content: CmsContent) {
  const key = namespace();
  cache.delete(key);
  cache.set(key, { sourceVersion, hash: digest(content), content });
  while (cache.size > 4) cache.delete(cache.keys().next().value!);
  return structuredClone(content);
}

/** Public requests never run CMS validation for drafts/Trash, expiry maintenance,
 * image cleanup, or CMS writes. A metadata probe precedes every cache lookup,
 * so a database outage cannot serve cached prices as current information. */
export async function readPublishedContent(): Promise<CmsContent> {
  const statePath = path.join(cmsDirectory(), "state.json"), projectionPath = path.join(cmsDirectory(), "published.json");
  for (let attempt = 0; attempt < 3; attempt++) {
    let source;
    try { source = await fileVersion(statePath); }
    catch (error) {
      if (absent(error) && !remoteCmsStorage()) return publishedContentProjection(defaultContent());
      throw error;
    }
    if (source.size > 32 * 1024 * 1024) throw new CmsError("Published content exceeds the storage limit. The saved data has been preserved.", 503, "CMS_STORAGE_INVALID");
    const previous = cache.get(namespace());
    if (previous?.sourceVersion === source.version) return structuredClone(previous.content);
    let content: CmsContent | undefined;
    try {
      const projectionMetadata = await fileVersion(projectionPath);
      if (projectionMetadata.size <= 32 * 1024 * 1024) {
        const projection = JSON.parse(await readFile(projectionPath, "utf8"));
        if (projection && projection.version === 1 && projection.sourceVersion === source.version && projection.content && projection.hash === digest(projection.content)) content = previous && previous.hash === projection.hash ? previous.content : publishedContentProjection(validateCmsContent(projection.content, { requireHoney: false }));
      }
    } catch (error) {
      // Missing/old/invalid derived projections are recoverable from the
      // authoritative snapshot. A source read failure still fails closed.
      if (!absent(error) && !(error instanceof SyntaxError) && !(error instanceof CmsError)) throw error;
    }
    if (!content) {
      let state;
      try { state = JSON.parse(await readFile(statePath, "utf8")); }
      catch { throw new CmsError("Published content could not be read. The saved data has been preserved.", 503, "CMS_STORAGE_INVALID"); }
      if (state.version !== 1) throw new CmsError("Unsupported published snapshot.", 503, "CMS_STORAGE_INVALID");
      validateRevision(state.revision);
      content = publishedContentProjection(validateCmsContent(state.published));
    }
    const current = await fileVersion(statePath);
    if (current.version === source.version) return remember(source.version, content);
  }
  throw new CmsError("Publication changed while loading. Please try again.", 503, "CMS_BUSY");
}

import type { CmsMedia, CmsState } from "./types";

// Keep preparation and submission limits shared by the browser and server.
export const MAX_MEDIA_RETRIES = 2;
export const MAX_MEDIA_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_MEDIA_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_MEDIA_DIMENSION = 3000;
export const MAX_MEDIA_BATCH = 20;
export const CMS_MEDIA_STAGE_LEASE_MS = 8 * 60 * 60 * 1000;

export type CmsStagedUpload = Omit<CmsMedia, "alt">;
export type CmsMediaSubmissionResult = {
  status: "pending" | "committed" | "abandoned";
  uploads: CmsStagedUpload[];
  state?: CmsState;
};
export type CmsMediaCleanupResult = {
  status: "abandoned" | "committed";
  deletedIds: string[];
  retainedIds: string[];
  failedIds: string[];
  state?: CmsState;
};
export type CmsMediaCleanupSummary = Pick<CmsMediaCleanupResult, "deletedIds" | "retainedIds" | "failedIds">;

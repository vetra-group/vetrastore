import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
// Reuse the production origin rules without evaluating configured constants.
const originRules = {};
const originCode = ts.transpileModule(readFileSync(new URL("../src/lib/site-origin.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function("exports", "process", originCode)(originRules, { env: {} });
const publicDomain = originRules.isPublicHttpsOrigin(process.env.NEXT_PUBLIC_SITE_URL || "");
const databaseName = process.env.MONGODB_DB;
const mongoUri = process.env.MONGODB_URI;
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const mediaFolder = process.env.CMS_CLOUDINARY_FOLDER || "vetra-cms";
const checks = {
  "HTTPS public domain": publicDomain,
  "Demo mode disabled": process.env.NEXT_PUBLIC_DEMO_MODE !== "true",
  "MongoDB CMS storage selected": process.env.CMS_STORAGE === "mongodb" && !!mongoUri && /^mongodb(?:\+srv)?:\/\/[^/?#]+/i.test(mongoUri) && !!databaseName && databaseName === databaseName.trim(),
  "Private media credentials present": !!(cloudName && /^[\w-]+$/.test(cloudName) && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET && /^[\w-]+(?:\/[\w-]+)*$/.test(mediaFolder)),
  "Staff sign-in configured": process.env.CMS_AUTH_MODE === "password" && !!process.env.CMS_STAFF_ACCOUNTS && (process.env.CMS_SESSION_SECRET?.length || 0) >= 64,
};
for (const [label, okay] of Object.entries(checks)) console.log(`${okay ? "READY" : "PENDING"}: ${label}`);
console.log(`Indexing: ${!publicDomain || process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.SITE_NOINDEX === "true" ? "blocked (keep blocked on staging)" : "enabled by configuration; verify the deployed responses"}`);
console.log("Configuration presence only. No service connections, payments, uploads, deployments, or content changes were made.");
console.log("Use CMS Settings > Launch preparation for published business terms. Rehearse live providers and restore a backup before launch.");
if (Object.values(checks).some((okay) => !okay)) process.exitCode = 1;

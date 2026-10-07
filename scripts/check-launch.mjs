import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const checks = {
  "HTTPS public domain": (() => { try { const url = new URL(process.env.NEXT_PUBLIC_SITE_URL); return url.protocol === "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname); } catch { return false; } })(),
  "Demo mode disabled": process.env.NEXT_PUBLIC_DEMO_MODE !== "true",
  "MongoDB CMS storage selected": process.env.CMS_STORAGE === "mongodb" && !!process.env.MONGODB_URI,
  "Private media credentials present": !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
  "Staff sign-in configured": process.env.CMS_AUTH_MODE === "password" && !!process.env.CMS_STAFF_ACCOUNTS && (process.env.CMS_SESSION_SECRET?.length || 0) >= 64,
};
for (const [label, okay] of Object.entries(checks)) console.log(`${okay ? "READY" : "PENDING"}: ${label}`);
console.log(`Indexing: ${process.env.SITE_NOINDEX === "true" ? "blocked (keep blocked on staging)" : "allowed when demo mode is off"}`);
console.log("Configuration presence only. No service connections, payments, uploads, deployments, or content changes were made.");
console.log("Use CMS Settings > Launch preparation for published business terms. Rehearse live providers and restore a backup before launch.");
if (Object.values(checks).some((okay) => !okay)) process.exitCode = 1;

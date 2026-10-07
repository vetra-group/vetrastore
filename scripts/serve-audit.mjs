import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";

// A local GET-only lab proxy. It does not change the application or call services.
const upstream = new URL(process.argv[2] || "http://127.0.0.1:3100");
const port = Number(process.env.AUDIT_PORT || 3320);
const latency = Number(process.env.AUDIT_LATENCY_MS || 150);
const bytesPerSecond = Number(process.env.AUDIT_BYTES_PER_SECOND || 200000);
if (upstream.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(upstream.hostname) || upstream.username || upstream.password || !Number.isInteger(port) || port < 1024 || port > 65535 || !Number.isFinite(latency) || latency < 0 || latency > 2000 || !Number.isFinite(bytesPerSecond) || bytesPerSecond < 10000 || bytesPerSecond > 10000000) throw new Error("Use a loopback HTTP source, valid port and bounded network settings.");
let nextTransfer = 0;
const server = http.createServer(async (request, response) => {
  const target = new URL(request.url, upstream);
  if (!["GET", "HEAD"].includes(request.method) || target.origin !== upstream.origin || /^\/(?:en\/|th\/)?(?:cms|staff)(?:\/|$)/.test(target.pathname) || /^\/api\/(?!cms-media\/)/.test(target.pathname)) { response.writeHead(403); response.end("This lab proxy supports public page reads only."); return; }
  await delay(latency);
  if (response.destroyed) return;
  const remote = http.request(target, { method: request.method, headers: { accept: request.headers.accept || "*/*", "accept-encoding": request.headers["accept-encoding"] || "identity", "user-agent": request.headers["user-agent"] || "VETRA-local-audit" } }, async (incoming) => {
    const headers = { ...incoming.headers, "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "x-vetra-audit": `${latency}ms latency; ${bytesPerSecond} bytes/sec shared; no CPU throttle` };
    delete headers["set-cookie"]; delete headers.connection;
    response.writeHead(incoming.statusCode || 502, headers);
    try {
      for await (const data of incoming) {
        for (let offset = 0; offset < data.length; offset += 4096) {
          if (response.destroyed) { incoming.destroy(); return; }
          const part = data.subarray(offset, offset + 4096), start = Math.max(Date.now(), nextTransfer);
          nextTransfer = start + part.length / bytesPerSecond * 1000;
          await delay(Math.max(0, nextTransfer - Date.now()));
          if (!response.destroyed) response.write(part);
        }
      }
      response.end();
    } catch { if (!response.destroyed) response.end(); }
  });
  remote.setTimeout(60000, () => remote.destroy(new Error("Lab upstream timed out")));
  remote.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end("Local preview is unavailable."); });
  response.on("close", () => remote.destroy());
  remote.end();
});
server.listen(port, "127.0.0.1", () => console.log(`Local audit: http://127.0.0.1:${port}/?audit=1 -> ${upstream.origin}; ${latency}ms/request, ${bytesPerSecond} bytes/s shared. External fonts are not throttled. Ctrl+C stops.`));

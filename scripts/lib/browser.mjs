import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A dependency-free CDP harness, always using a fresh disposable profile. */
export async function launchBrowser(output, { preferences, windowSize } = {}) {
  output = path.resolve(output);
  const candidates = [process.env.BROWSER_EXECUTABLE, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
  let executable;
  for (const candidate of candidates) { try { await access(candidate); executable = candidate; break; } catch { /* Try the next installed browser. */ } }
  if (!executable) throw new Error("Install Chrome/Edge or set BROWSER_EXECUTABLE to its executable path.");
  const directory = await mkdtemp(path.join(output, "browser-profile-"));
  if (!path.resolve(directory).startsWith(path.resolve(output) + path.sep)) throw new Error("Browser profile must stay in the test output folder.");
  // Accessibility preferences belong only to this disposable profile. They
  // exercise the browser's real font/zoom settings, never injected page CSS.
  if (preferences) {
    await mkdir(path.join(directory, "Default"), { recursive: true });
    await writeFile(path.join(directory, "Default", "Preferences"), JSON.stringify(preferences));
  }
  const child = spawn(executable, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-background-networking", "--remote-debugging-port=0", ...(windowSize ? [`--window-size=${windowSize.width},${windowSize.height}`] : []), `--user-data-dir=${directory}`, "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
  let exited = false, processError, diagnostics = "";
  child.stderr.on("data", (chunk) => { diagnostics = (diagnostics + chunk.toString()).slice(-3000); });
  child.on("exit", () => { exited = true; }); child.on("error", (error) => { processError = error; });
  let socket;
  try {
    let address;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (processError) throw processError;
      // On Windows Edge's launcher may exit after handing the isolated profile
      // to its browser process. Readiness is the profile's endpoint, not its PID.
      try { const [port, endpoint] = (await readFile(path.join(directory, "DevToolsActivePort"), "utf8")).trim().split(/\r?\n/); address = `ws://127.0.0.1:${port}${endpoint}`; break; } catch { await delay(100); }
    }
    if (!address) throw new Error(`The test browser did not expose its local control endpoint. ${diagnostics}`);
    socket = new WebSocket(address);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    let counter = 0;
    const pending = new Map(), listeners = new Set();
    socket.addEventListener("message", ({ data }) => {
      const result = JSON.parse(data);
      if (result.id) { const call = pending.get(result.id); if (call) { clearTimeout(call.timer); pending.delete(result.id); if (result.error) call.reject(new Error(result.error.message)); else call.resolve(result.result); } }
      else for (const listener of listeners) listener(result);
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++counter;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 30000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const command = (method, params) => send(method, params, sessionId);
    await command("Page.enable"); await command("Runtime.enable");
    // Before-unload prompts remain part of the app; the test explicitly accepts
    // its own reload/navigation so it can exercise recovery after losing a tab.
    listeners.add((event) => { if (event.sessionId === sessionId && event.method === "Page.javascriptDialogOpening") void command("Page.handleJavaScriptDialog", { accept: true }); });
    const errors = [];
    listeners.add((event) => { if (event.sessionId === sessionId && event.method === "Runtime.exceptionThrown") errors.push(event.params.exceptionDetails.exception?.description ?? event.params.exceptionDetails.text); });
    const evaluate = async (expression) => {
      const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result.value;
    };
    const wait = async (expression, timeout = 20000) => {
      new Function(`return (${expression});`); // Fail malformed checks immediately.
      const until = Date.now() + timeout;
      while (Date.now() < until) { try { if (await evaluate(expression)) return; } catch { /* Navigation may replace the execution context. */ } await delay(80); }
      throw new Error(`Browser condition did not become true: ${expression}`);
    };
    const selector = (css) => `document.querySelector(${JSON.stringify(css)})`;
    const clickExpression = async (expression) => {
      await wait(`Boolean(${expression})`);
      // A newly opened drawer is visible before it reaches its final position.
      // Let finite ancestor motion finish before aiming a real pointer click.
      await wait(`(() => { for(let e=${expression}; e; e=e.parentElement) if(e.getAnimations().some(a=>a.playState==='running' && a.effect?.getTiming().iterations!==Infinity)) return false; return true; })()`);
      const box = await evaluate(`(() => { const e=${expression}; e.scrollIntoView({block:'center',behavior:'instant'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      await command("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...box });
      await command("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...box });
    };
    return {
      command, evaluate, wait, errors, clickExpression,
      async goto(url) { await command("Page.navigate", { url }); await wait(`location.href === ${JSON.stringify(url)} && document.readyState === 'complete'`); },
      async viewport(width, height = 900) { await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }); },
      click: (css) => clickExpression(selector(css)),
      clickText: (text, scope = "document") => clickExpression(`Array.from(${scope}.querySelectorAll('button,a')).find(e => e.textContent.trim() === ${JSON.stringify(text)} && e.getClientRects().length && !e.disabled)`),
      async fill(css, text) { await wait(`Boolean(${selector(css)})`); await evaluate(`${selector(css)}.focus(); ${selector(css)}.select()`); await command("Input.insertText", { text }); },
      async key(key) { await command("Input.dispatchKeyEvent", { type: "keyDown", key, code: key, windowsVirtualKeyCode: ({ Escape: 27, Tab: 9, Enter: 13, ArrowDown: 40, ArrowUp: 38, ArrowLeft: 37, ArrowRight: 39, Home: 36, End: 35 })[key] }); await command("Input.dispatchKeyEvent", { type: "keyUp", key, code: key }); },
      async screenshot(filename) { const { data } = await command("Page.captureScreenshot", { format: "png" }); const { writeFile } = await import("node:fs/promises"); await writeFile(filename, Buffer.from(data, "base64")); },
      async close() {
        await send("Browser.close").catch(() => undefined); socket.close();
        for (const value of pending.values()) { clearTimeout(value.timer); value.reject(new Error("Browser closed")); } pending.clear();
        for (let i = 0; !exited && i < 40; i++) await delay(100);
        if (!exited) child.kill();
        if (exited) await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => console.warn(`Disposable browser profile retained while still locked: ${directory}`));
      },
    };
  } catch (error) { socket?.close(); child.kill(); for (let i = 0; !exited && i < 30; i++) await delay(100); if (exited) await rm(directory, { recursive: true, force: true, maxRetries: 3 }).catch(() => console.warn(`Disposable browser profile retained while still locked: ${directory}`)); throw error; }
}

import { randomBytes, scryptSync } from "node:crypto";
import readline from "node:readline";

// Local setup helper. A password is never accepted in command-line arguments.
if (process.argv.length > 2 || !process.stdin.isTTY) {
  console.error("Run this interactively with no arguments. Password input is hidden.");
  process.exitCode = 1;
} else {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true); process.stdin.resume();
  process.stderr.write("Staff password (at least 16 characters; hidden): ");
  let password = "";
  const finish = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeAllListeners("keypress"); process.stderr.write("\n"); };
  process.stdin.on("keypress", (text, key) => {
    if (key.ctrl && key.name === "c") { finish(); process.exitCode = 1; return; }
    if (key.name === "return") {
      finish();
      if (password.length < 16 || password.length > 256) { console.error("Use between 16 and 256 characters. No hash was created."); process.exitCode = 1; return; }
      const salt = randomBytes(16).toString("hex");
      console.log(`scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`);
      password = ""; return;
    }
    if (key.name === "backspace") password = password.slice(0, -1);
    else if (text && !key.ctrl && !/[\r\n\u0000-\u001f]/.test(text) && password.length + text.length <= 256) password += text;
  });
}

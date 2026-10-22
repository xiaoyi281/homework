import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const proc = spawn(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--use-angle=swiftshader",
  "--remote-debugging-port=9223",
  "--user-data-dir=C:\\Users\\ASUS\\Desktop\\手势作业\\.chrome-profile",
  "about:blank",
], { stdio: "ignore" });

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function get(url, method = "GET") {
  const res = await fetch(url, { method });
  const text = await res.text();
  return JSON.parse(text);
}

let wsUrl;
for (let i = 0; i < 40; i += 1) {
  try {
    const version = await get("http://127.0.0.1:9223/json/version");
    wsUrl = version.webSocketDebuggerUrl;
    break;
  } catch {
    await wait(200);
  }
}
if (!wsUrl) {
  console.error("devtools not ready");
  proc.kill();
  process.exit(1);
}

const page = await get("http://127.0.0.1:9223/json/new?http://127.0.0.1:5500", "PUT");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const logs = [];

function send(method, params = {}) {
  const messageId = ++id;
  ws.send(JSON.stringify({ id: messageId, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(messageId, { resolve, reject });
    setTimeout(() => {
      if (pending.has(messageId)) {
        pending.delete(messageId);
        reject(new Error(`timeout ${method}`));
      }
    }, 20000);
  });
}

ws.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) reject(new Error(JSON.stringify(data.error)));
    else resolve(data.result);
  }
  if (data.method === "Runtime.consoleAPICalled") {
    logs.push(data.params.args.map((arg) => arg.value || arg.description || "").join(" "));
  }
  if (data.method === "Runtime.exceptionThrown") {
    logs.push("EXC " + (data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text));
  }
});

await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve);
  ws.addEventListener("error", reject);
});

await send("Runtime.enable");
await send("Page.enable");
await wait(4500);

async function shot(name) {
  const image = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(name, Buffer.from(image.data, "base64"));
}

async function key(code, keyName) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", code, key: keyName, windowsVirtualKeyCode: keyName === "o" ? 79 : keyName === "f" ? 70 : 49 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", code, key: keyName });
}

await shot("preview-bridge.png");
await key("KeyO", "o");
await wait(1200);
await shot("preview-open.png");
await key("KeyF", "f");
await wait(1800);
const info = await send("Runtime.evaluate", {
  expression: `({
    title: document.querySelector('h1')?.textContent || '',
    scene: document.querySelector('#scene-label')?.textContent || '',
    active: document.querySelector('.panel li.active strong')?.textContent || ''
  })`,
  returnByValue: true,
});
await shot("preview-next.png");
console.log(JSON.stringify(info.result.value, null, 2));
console.log(logs.join("\n"));
ws.close();
proc.kill();
process.exit(0);

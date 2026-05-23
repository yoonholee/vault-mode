#!/usr/bin/env node
// Scale benchmark: measure marksman init + first-definition latency as a
// function of workspace size. Helps decide acceptable vault size and whether
// we need ignore rules.
//
// Usage: node scripts/marksman-scale-bench.mjs <workspace-root> <link-source-file> <wikilink-literal>

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const WORKSPACE = process.argv[2];
const SRC = process.argv[3];
const LITERAL = process.argv[4];
const TIMEOUT = parseInt(process.env.TIMEOUT_MS || "120000", 10);

if (!WORKSPACE || !SRC || !LITERAL) {
  console.error("Usage: marksman-scale-bench.mjs <workspace-root> <link-source-file> '<[[wikilink]]>'");
  process.exit(2);
}

let id = 0;
const pending = new Map();
let buf = "";

function send(p, m) { const j = JSON.stringify(m); p.stdin.write(`Content-Length: ${Buffer.byteLength(j, "utf8")}\r\n\r\n${j}`); }
function req(p, method, params) {
  const i = ++id;
  return new Promise((res, rej) => {
    const t = setTimeout(() => { pending.delete(i); rej(new Error(`Timeout ${method}`)); }, TIMEOUT);
    pending.set(i, { res, rej, t });
    send(p, { jsonrpc: "2.0", id: i, method, params });
  });
}
function notify(p, m, params) { send(p, { jsonrpc: "2.0", method: m, params }); }
function handle(c) {
  buf += c.toString("utf8");
  while (true) {
    const h = buf.indexOf("\r\n\r\n");
    if (h === -1) return;
    const m = buf.slice(0, h).match(/Content-Length:\s*(\d+)/i);
    if (!m) { buf = buf.slice(h + 4); continue; }
    const len = parseInt(m[1], 10);
    if (buf.length < h + 4 + len) return;
    let msg;
    try { msg = JSON.parse(buf.slice(h + 4, h + 4 + len)); } catch {}
    buf = buf.slice(h + 4 + len);
    if (msg?.id !== undefined && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      clearTimeout(p.t);
      pending.delete(msg.id);
      msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result);
    }
  }
}

async function main() {
  const proc = spawn("marksman", ["server"], { stdio: ["pipe", "pipe", "pipe"] });
  proc.stdout.on("data", handle);
  let lastStderr = "";
  proc.stderr.on("data", (d) => { lastStderr = d.toString(); if (process.env.DEBUG) process.stderr.write(`[stderr] ${d}`); });

  const t0 = performance.now();
  await req(proc, "initialize", {
    processId: process.pid,
    rootUri: pathToFileURL(WORKSPACE).href,
    capabilities: { textDocument: { definition: { linkSupport: true }, hover: {}, references: {} }, workspace: { workspaceFolders: true } },
    workspaceFolders: [{ uri: pathToFileURL(WORKSPACE).href, name: path.basename(WORKSPACE) }],
  });
  notify(proc, "initialized", {});
  const initMs = performance.now() - t0;
  console.log(JSON.stringify({ phase: "init", workspace: WORKSPACE, initMs: Math.round(initMs) }));

  // Wait briefly for marksman to settle
  await new Promise(r => setTimeout(r, 200));

  const srcPath = path.resolve(WORKSPACE, SRC);
  const text = readFileSync(srcPath, "utf8");
  const lines = text.split("\n");
  let pos = null;
  for (let i = 0; i < lines.length; i++) {
    const c = lines[i].indexOf(LITERAL);
    if (c !== -1) { pos = { line: i, character: c + 2 }; break; }
  }
  if (!pos) { console.error(`Literal ${LITERAL} not found in ${srcPath}`); process.exit(2); }
  notify(proc, "textDocument/didOpen", { textDocument: { uri: pathToFileURL(srcPath).href, languageId: "markdown", version: 1, text } });

  const dt0 = performance.now();
  let result, err = null;
  try {
    result = await req(proc, "textDocument/definition", { textDocument: { uri: pathToFileURL(srcPath).href }, position: pos });
  } catch (e) {
    err = e.message;
  }
  const defMs = performance.now() - dt0;
  const target = result ? (Array.isArray(result) ? (result[0]?.uri || result[0]?.targetUri) : (result.uri || result.targetUri)) : null;
  console.log(JSON.stringify({ phase: "definition", defMs: Math.round(defMs), target: target ? path.relative(WORKSPACE, fileURLToPath(target)) : null, error: err, lastStderrSnippet: lastStderr.slice(-200) }));

  try { await req(proc, "shutdown", null); notify(proc, "exit", null); } catch {}
  proc.kill();
  process.exit(err ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });

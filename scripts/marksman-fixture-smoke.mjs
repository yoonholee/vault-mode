#!/usr/bin/env node
// Smoke test: minimal LSP harness against a tiny 3-file fixture.
// Confirms marksman correctly resolves [[X]], [[X|alias]], [[X#header]]
// in isolation before we worry about vault scale.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const FIXTURE = "/tmp/marksman-fixture";
const TIMEOUT_MS = 30000;

const CASES = [
  { file: "A.md", linkLiteral: "[[B]]", innerOffset: 2, expectSuffix: "B.md" },
  { file: "A.md", linkLiteral: "[[B|aliased B]]", innerOffset: 2, expectSuffix: "B.md" },
  { file: "A.md", linkLiteral: "[[C#Section]]", innerOffset: 2, expectSuffix: "C.md" },
];

let id = 0;
const pending = new Map();
let buf = "";

function send(proc, msg) {
  const json = JSON.stringify(msg);
  proc.stdin.write(`Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`);
}

function request(proc, method, params) {
  const reqId = ++id;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(reqId);
      reject(new Error(`Timeout ${method} id=${reqId}`));
    }, TIMEOUT_MS);
    pending.set(reqId, { resolve, reject, timer });
    send(proc, { jsonrpc: "2.0", id: reqId, method, params });
  });
}

function notify(proc, method, params) {
  send(proc, { jsonrpc: "2.0", method, params });
}

function handle(chunk) {
  buf += chunk.toString("utf8");
  while (true) {
    const hi = buf.indexOf("\r\n\r\n");
    if (hi === -1) return;
    const m = buf.slice(0, hi).match(/Content-Length:\s*(\d+)/i);
    if (!m) {
      buf = buf.slice(hi + 4);
      continue;
    }
    const len = parseInt(m[1], 10);
    if (buf.length < hi + 4 + len) return;
    const body = buf.slice(hi + 4, hi + 4 + len);
    buf = buf.slice(hi + 4 + len);
    let msg;
    try {
      msg = JSON.parse(body);
    } catch {
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      clearTimeout(p.timer);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    }
  }
}

function locate(text, literal, innerOffset) {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const c = lines[i].indexOf(literal);
    if (c !== -1) return { line: i, character: c + innerOffset };
  }
  return null;
}

async function main() {
  console.log(`Fixture: ${FIXTURE}`);
  const proc = spawn("marksman", ["server"], { stdio: ["pipe", "pipe", "pipe"] });
  proc.stdout.on("data", handle);
  proc.stderr.on("data", (d) => {
    if (process.env.DEBUG) process.stderr.write(`[stderr] ${d}`);
  });

  const t0 = Date.now();
  await request(proc, "initialize", {
    processId: process.pid,
    rootUri: pathToFileURL(FIXTURE).href,
    capabilities: {
      textDocument: { definition: { linkSupport: true }, hover: { contentFormat: ["markdown"] }, references: {} },
      workspace: { workspaceFolders: true },
    },
    workspaceFolders: [{ uri: pathToFileURL(FIXTURE).href, name: "fixture" }],
  });
  notify(proc, "initialized", {});
  console.log(`init in ${Date.now() - t0}ms`);

  await new Promise((r) => setTimeout(r, 300));

  let pass = 0;
  let fail = 0;
  for (const c of CASES) {
    const fp = path.join(FIXTURE, c.file);
    const text = readFileSync(fp, "utf8");
    const pos = locate(text, c.linkLiteral, c.innerOffset);
    if (!pos) {
      console.log(`SKIP ${c.linkLiteral} (not found)`);
      continue;
    }
    notify(proc, "textDocument/didOpen", {
      textDocument: { uri: pathToFileURL(fp).href, languageId: "markdown", version: 1, text },
    });
    const rt0 = Date.now();
    let result;
    try {
      result = await request(proc, "textDocument/definition", {
        textDocument: { uri: pathToFileURL(fp).href },
        position: pos,
      });
    } catch (e) {
      console.log(`FAIL ${c.linkLiteral} (${e.message})`);
      fail++;
      continue;
    }
    const ms = Date.now() - rt0;
    const targetUri = Array.isArray(result) ? (result[0]?.uri || result[0]?.targetUri) : (result?.uri || result?.targetUri);
    if (!targetUri) {
      console.log(`FAIL ${c.linkLiteral} (no def; ${ms}ms; result=${JSON.stringify(result)})`);
      fail++;
      continue;
    }
    const targetPath = fileURLToPath(targetUri);
    const ok = targetPath.endsWith(c.expectSuffix);
    console.log(`${ok ? "PASS" : "FAIL"} ${c.linkLiteral} -> ${path.relative(FIXTURE, targetPath)} (${ms}ms)`);
    ok ? pass++ : fail++;
  }

  console.log(`\n${pass} pass, ${fail} fail`);

  try { await request(proc, "shutdown", null); notify(proc, "exit", null); } catch {}
  proc.kill();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("ERR", e); process.exit(2); });

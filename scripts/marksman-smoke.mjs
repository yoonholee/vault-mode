#!/usr/bin/env node
// Minimal LSP harness to verify marksman resolves vault wikilinks correctly.
// Usage: node scripts/marksman-smoke.mjs [vault-path]
//
// Sends initialize + didOpen + a series of textDocument/definition requests
// targeting real wikilinks in the vault. Verifies each definition resolves
// to a file that actually exists.

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const VAULT = process.argv[2] || path.join(process.env.HOME, "repos/vault");
const TIMEOUT_MS = 60000;

// Cases: { file (path relative to vault), wikilink (the literal [[X]] or [[X|y]] or [[X#h]]), expectedTargetSuffix }
const CASES = [
  {
    file: "Reference/People/Jurgen Schmidhuber.md",
    wikilink: "[[Self-Writing Harnesses]]",
    expectedSuffix: "Research/Agentic Harnesses/Self-Writing Harnesses.md",
  },
  {
    file: "Reference/People/Jurgen Schmidhuber.md",
    wikilink: "[[1008_interestingness|interestingness]]",
    expectedSuffix: "Research/Reviews/2026 ICML Position/1008_interestingness.md",
  },
  {
    file: "Reference/People/Jurgen Schmidhuber.md",
    wikilink: "[[Chelsea Finn]]",
    expectedSuffix: "Reference/People/Chelsea Finn.md",
  },
  {
    file: "Reference/People/Jurgen Schmidhuber.md",
    wikilink: "[[Recursive Superintelligence|RSI lab pitches]]",
    expectedSuffix: "Reference/Labs/Recursive Superintelligence.md",
  },
  {
    file: "Concepts/EIRA - Self-Modification Credit Assignment Without Episodes.md",
    wikilink: "[[Jurgen Schmidhuber]]",
    expectedSuffix: "Reference/People/Jurgen Schmidhuber.md",
  },
  {
    file: "Concepts/EIRA - Self-Modification Credit Assignment Without Episodes.md",
    wikilink: "[[Multi-Agent RL and Meta-RL Sample Efficiency]]",
    expectedSuffix: "Concepts/Multi-Agent RL and Meta-RL Sample Efficiency.md",
  },
];

let id = 0;
const pending = new Map();
let buf = "";

function send(proc, msg) {
  const json = JSON.stringify(msg);
  const header = `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n`;
  proc.stdin.write(header + json);
}

function request(proc, method, params) {
  const reqId = ++id;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(reqId);
      reject(new Error(`Timeout waiting for ${method} (id=${reqId})`));
    }, TIMEOUT_MS);
    pending.set(reqId, { resolve, reject, timer });
    send(proc, { jsonrpc: "2.0", id: reqId, method, params });
  });
}

function notify(proc, method, params) {
  send(proc, { jsonrpc: "2.0", method, params });
}

function handleData(chunk) {
  buf += chunk.toString("utf8");
  // Parse LSP framed messages
  while (true) {
    const headerEnd = buf.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const header = buf.slice(0, headerEnd);
    const m = header.match(/Content-Length:\s*(\d+)/i);
    if (!m) {
      buf = buf.slice(headerEnd + 4);
      continue;
    }
    const len = parseInt(m[1], 10);
    const bodyStart = headerEnd + 4;
    if (buf.length < bodyStart + len) return;
    const body = buf.slice(bodyStart, bodyStart + len);
    buf = buf.slice(bodyStart + len);
    let msg;
    try {
      msg = JSON.parse(body);
    } catch (e) {
      console.error("BAD JSON from server:", body);
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject, timer } = pending.get(msg.id);
      clearTimeout(timer);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method) {
      // Notification from server (window/logMessage, etc) — ignore for smoke test
    }
  }
}

function locateWikilink(text, wikilink) {
  // Find the wikilink occurrence; return 0-based line/character of a position
  // inside the inner name (after [[, before any | or #).
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const col = lines[i].indexOf(wikilink);
    if (col !== -1) {
      // Position cursor just inside the inner name (after "[[")
      return { line: i, character: col + 2 };
    }
  }
  return null;
}

async function main() {
  if (!existsSync(VAULT)) {
    console.error(`Vault not found at ${VAULT}`);
    process.exit(2);
  }

  console.log(`Vault: ${VAULT}`);
  console.log(`Spawning marksman server...`);
  const t0 = Date.now();
  const proc = spawn("marksman", ["server"], { stdio: ["pipe", "pipe", "pipe"] });
  proc.stdout.on("data", handleData);
  proc.stderr.on("data", (d) => {
    // marksman emits server logs on stderr at -v 2; quiet unless DEBUG=1
    if (process.env.DEBUG) process.stderr.write(`[marksman stderr] ${d}`);
  });
  proc.on("exit", (code) => {
    if (code !== 0 && code !== null) console.error(`marksman exited with code ${code}`);
  });

  const initResult = await request(proc, "initialize", {
    processId: process.pid,
    rootUri: pathToFileURL(VAULT).href,
    capabilities: {
      textDocument: {
        definition: { linkSupport: true },
        completion: { completionItem: { snippetSupport: false } },
        references: {},
        hover: { contentFormat: ["markdown", "plaintext"] },
      },
      workspace: { workspaceFolders: true },
    },
    workspaceFolders: [{ uri: pathToFileURL(VAULT).href, name: "vault" }],
  });
  notify(proc, "initialized", {});
  const t1 = Date.now();
  console.log(`marksman initialized in ${t1 - t0}ms`);
  console.log(`Server capabilities: definitionProvider=${!!initResult.capabilities.definitionProvider}, hoverProvider=${!!initResult.capabilities.hoverProvider}, referencesProvider=${!!initResult.capabilities.referencesProvider}, completionProvider=${!!initResult.capabilities.completionProvider}`);

  // Give marksman a moment to index the workspace
  await new Promise((r) => setTimeout(r, 500));

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const c of CASES) {
    const filePath = path.join(VAULT, c.file);
    if (!existsSync(filePath)) {
      console.log(`SKIP  ${c.wikilink}  (source file missing: ${c.file})`);
      continue;
    }
    const text = readFileSync(filePath, "utf8");
    const pos = locateWikilink(text, c.wikilink);
    if (!pos) {
      console.log(`SKIP  ${c.wikilink}  (wikilink not found in source)`);
      continue;
    }
    notify(proc, "textDocument/didOpen", {
      textDocument: {
        uri: pathToFileURL(filePath).href,
        languageId: "markdown",
        version: 1,
        text,
      },
    });
    const reqT0 = Date.now();
    let result;
    try {
      result = await request(proc, "textDocument/definition", {
        textDocument: { uri: pathToFileURL(filePath).href },
        position: pos,
      });
    } catch (e) {
      console.log(`FAIL  ${c.wikilink}  (LSP error: ${e.message})`);
      failed++;
      failures.push({ case: c, reason: `LSP error: ${e.message}` });
      continue;
    }
    const reqMs = Date.now() - reqT0;

    let targetUri = null;
    if (Array.isArray(result) && result.length > 0) {
      targetUri = result[0].uri || result[0].targetUri;
    } else if (result && typeof result === "object") {
      targetUri = result.uri || result.targetUri;
    }

    if (!targetUri) {
      console.log(`FAIL  ${c.wikilink}  (no definition; ${reqMs}ms)`);
      failed++;
      failures.push({ case: c, reason: "no definition returned" });
      continue;
    }
    const targetPath = fileURLToPath(targetUri);
    const ok = targetPath.endsWith(c.expectedSuffix);
    if (ok) {
      console.log(`PASS  ${c.wikilink} -> ${path.relative(VAULT, targetPath)} (${reqMs}ms)`);
      passed++;
    } else {
      console.log(`FAIL  ${c.wikilink} -> ${path.relative(VAULT, targetPath)} (expected suffix: ${c.expectedSuffix}; ${reqMs}ms)`);
      failed++;
      failures.push({ case: c, reason: `resolved to ${targetPath}` });
    }
  }

  console.log(`\nResults: ${passed} pass, ${failed} fail`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f.case.wikilink}: ${f.reason}`);
  }

  // Shutdown
  try {
    await request(proc, "shutdown", null);
    notify(proc, "exit", null);
  } catch {}
  proc.kill();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Harness error:", e);
  process.exit(2);
});

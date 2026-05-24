#!/usr/bin/env node
// Bench: walk the real vault, parse every active markdown file, time it.

import { readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const VAULT = process.argv[2] || path.join(process.env.HOME, "repos/vault");

// Find active md files using rg (which honors .ignore)
const out = execSync(
  `rg --files -t md "${VAULT}" --hidden -g '!.git/**' -g '!node_modules/**'`,
  { maxBuffer: 1024 * 1024 * 64 },
).toString();
const files = out.split("\n").filter(Boolean);

// Dynamic import after register — but we don't really need ts-node since we
// can just bench the compiled JS or transpile inline. Simpler: use esbuild
// to bundle wikilinkParser to a temp JS file once.

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(tmpdir(), `wikilinkparser-${Date.now()}.cjs`);
await build({
  entryPoints: [path.join(__dirname, "..", "src", "wikilinkParser.ts")],
  bundle: false,
  format: "cjs",
  platform: "node",
  outfile: tmp,
  logLevel: "silent",
});
const { parseWikilinks } = await import(tmp);

let totalBytes = 0;
let totalLinks = 0;
let perFile = [];
const t0 = performance.now();
for (const f of files) {
  let buf;
  try { buf = readFileSync(f, "utf8"); } catch { continue; }
  totalBytes += statSync(f).size;
  const ft0 = performance.now();
  const links = parseWikilinks(buf);
  const dt = performance.now() - ft0;
  totalLinks += links.length;
  perFile.push({ f, ms: dt, links: links.length, bytes: buf.length });
}
const total = performance.now() - t0;

perFile.sort((a, b) => b.ms - a.ms);
const slowest = perFile.slice(0, 5).map((p) => ({ file: path.relative(VAULT, p.f), ms: Math.round(p.ms * 100) / 100, links: p.links, kb: Math.round(p.bytes / 1024) }));

console.log(JSON.stringify({
  vault: VAULT,
  files: files.length,
  totalMs: Math.round(total),
  totalMB: Math.round(totalBytes / (1024 * 1024)),
  totalLinks,
  meanMsPerFile: Math.round((total / files.length) * 1000) / 1000,
  meanLinksPerFile: Math.round((totalLinks / files.length) * 10) / 10,
  slowest,
}, null, 2));

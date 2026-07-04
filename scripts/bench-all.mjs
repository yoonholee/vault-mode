#!/usr/bin/env node
// Bench all hot paths against a real vault: listFiles, buildAll (I/O+parse),
// parse-only (CPU), resolve, backlinks, allStems. R runs each, mean +/- sigma.
// Usage: node scripts/bench-all.mjs [vaultPath] [runs]

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { build } from "esbuild";
import fs from "node:fs/promises";

const VAULT = process.argv[2] || path.join(process.env.HOME, "repos/vault");
const RUNS = Number(process.argv[3] || 5);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bundle the real TS sources (no vscode imports in these modules).
const tmp = path.join(tmpdir(), `vault-light-bench-${Date.now()}.cjs`);
await build({
  entryPoints: [path.join(__dirname, "..", "src", "workspaceIndex.ts")],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: tmp,
  logLevel: "silent",
});
const { WorkspaceIndex } = await import(tmp);
const parserTmp = path.join(tmpdir(), `vault-light-bench-parser-${Date.now()}.cjs`);
await build({
  entryPoints: [path.join(__dirname, "..", "src", "wikilinkParser.ts")],
  bundle: true, format: "cjs", platform: "node", outfile: parserTmp, logLevel: "silent",
});
const { parseWikilinks } = await import(parserTmp);

// Node-side FileSystem impl mirroring VscodeFs (rg honors .ignore like findFiles honors excludes).
function listVaultFiles() {
  const out = execSync(
    `rg --files -t md "${VAULT}" --hidden -g '!.git/**' -g '!node_modules/**' -g '!Archive/**' -g '!.obsidian/**' -g '!.cache/**'`,
    { maxBuffer: 1024 * 1024 * 64 },
  ).toString();
  return out.split("\n").filter(Boolean);
}
const nodeFs = {
  listFiles: async () => listVaultFiles(),
  readFile: (p) => fs.readFile(p, "utf8"),
};

const stats = (xs) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1 || 1));
  return { mean: +mean.toFixed(2), sd: +sd.toFixed(2), runs: xs.map((x) => +x.toFixed(1)) };
};
async function bench(name, fn, runs = RUNS) {
  await fn(); // warmup (page cache, JIT)
  const xs = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    xs.push(performance.now() - t0);
  }
  results[name] = stats(xs);
}

const results = {};
const files = listVaultFiles();
const contents = files.map((f) => { try { return readFileSync(f, "utf8"); } catch { return ""; } });
const totalMB = contents.reduce((a, c) => a + c.length, 0) / 1024 / 1024;

// 1. listFiles
await bench("listFiles", () => nodeFs.listFiles());

// 2. buildAll end-to-end (fresh index each run; I/O warm from page cache)
await bench("buildAll", async () => {
  const idx = new WorkspaceIndex(VAULT, nodeFs);
  await idx.buildAll([]);
});

// 3. parse-only CPU over all pre-read contents
await bench("parseAll_cpu", () => { for (const c of contents) parseWikilinks(c); });

// Build one index for query benches
const idx = new WorkspaceIndex(VAULT, nodeFs);
await idx.buildAll([]);
const stems = idx.allStems();
const sample = Array.from({ length: 2000 }, (_, i) => stems[(i * 2654435761) % stems.length]);

// 4. resolve x2000
await bench("resolve_x2000", () => { for (const s of sample) idx.resolve(s); });

// 5. backlinksFor x2000
await bench("backlinks_x2000", () => { for (const s of sample) idx.backlinksFor(s); });

// 6. allStems (completion path)
await bench("allStems", () => { idx.allStems(); });

// 7. updateFile (watcher hot path) on the 20 largest files
const bySize = files.map((f, i) => [f, contents[i].length]).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([f]) => f);
await bench("updateFile_x20_largest", async () => { for (const f of bySize) await idx.updateFile(f); });

console.log(JSON.stringify({ vault: VAULT, files: files.length, corpusMB: +totalMB.toFixed(1), runsPerBench: RUNS, results }, null, 2));

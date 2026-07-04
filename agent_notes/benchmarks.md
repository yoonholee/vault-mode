# Benchmarks

Artifact for perf claims: claim → axis → eval → numbers → repro.

## 2026-07-04 — activation-path optimization (v0.2.0)

**Claim:** index build and parsing are the dominant activation costs; both had obvious inefficiencies (serial file reads, unconditional mask allocation in the parser).

**Axis:** wall-clock ms on the real vault (2716 files, 18.2MB), warm page cache, M-series laptop.

**Eval:** `npm run bench` (`scripts/bench-all.mjs`), 5 runs per bench + 1 warmup, mean ± σ.

| bench | before | after | Δ |
|---|---|---|---|
| buildAll (I/O + parse) | 1279 ± 32 ms | 539 ± 16 ms | 2.4× |
| parseAll (CPU only) | 298 ± 33 ms | 84 ± 6 ms | 3.5× |
| updateFile ×20 largest | 89 ± 6 ms | 32 ± 6 ms | 2.8× |
| listFiles | 142 ± 9 ms | 151 ± 21 ms | unchanged (rg path; VS Code uses findFiles) |
| resolve ×2000 | 3.1 ± 0.8 ms | 2.4 ± 0.5 ms | noise |
| backlinks ×2000 | 1.6 ± 0.2 ms | 0.6 ± 0.1 ms | noise-adjacent, not a target |

**Changes:**
1. `WorkspaceIndex.buildAll`: 32-way bounded-concurrency read+parse pool (was serial `await` per file).
2. `parseWikilinks` fast paths: early return when no `[[` in source (33% of vault files); skip fence/code-span mask allocation when no backtick / `~~~` (83% of files have no backtick). Zero-length mask sentinel preserves exact semantics.

**Verification:** 94/94 unit tests green; mutation check on the `hasTildeFence` branch (forced false → tilde-fence test fails, restored → green).

**Not pursued:** query paths (resolve/backlinks/allStems) are all sub-4ms per 2000 ops; listFiles is VS Code's `findFiles` in production, not reachable from this harness; `fs.readFile` concurrency beyond 32 is bounded by libuv's 4-thread pool.

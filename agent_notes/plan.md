# Plan

Current phase: Phase 0 (setup + load-bearing smoke tests).

## Phases

- [x] **Phase 0** Repo setup, SPEC, agent_notes scaffolding
- [x] **Phase 0.5** Marksman smoke test — REVEALED CRASH; architecture pivot below
- [ ] **Phase 1** Project skeleton (TS, esbuild, vitest, lint, pre-commit)
- [ ] **Phase 2** Wikilink preview rendering (TDD)
- [ ] **Phase 3** Syntax highlighting (TextMate injection)
- [ ] **Phase 4** ~~Marksman LSP client~~ In-extension WorkspaceIndex (file walker, wikilink parser, resolver, backlinks index, file watcher)
- [ ] **Phase 5** vs CLI bridge: commands + hover provider (TDD)
- [ ] **Phase 6** Daily notes command
- [ ] **Phase 7** Copilot context booster (preview-tab preloader + instructions.md)
- [ ] **Phase 8** Performance + reliability hardening (measure, regress)
- [ ] **Phase 9** README + final regression + v0.1.0 tag

## Working principles (from Yoonho)

- Write tests up front.
- Smoke test every external dependency before integrating.
- Measure everything; performance and reliability are first-class.
- Each intervention requires evidence it actually helps; otherwise revert.
- Regression test after every change.
- Git commit at every working state. Atomic commits.

## Decision log

- **2026-05-23 (morning)** Architecture: marksman LSP + thin extension. Not a Foam fork.
- **2026-05-23 (afternoon, REVISED)** Pivoted: in-extension WorkspaceIndex + providers. Reason: marksman crashes (SIGSEGV) on the real vault even after ignore-tuning. See friction.md. The features marksman gives us (definition, backlinks via find-references, completion, hover) are tractable to implement in 300-500 LOC TypeScript against a workspace file index. We lose marksman's `[[X#header]]` anchor resolution and code-action richness, but the vault sample showed anchor links are rare (~5 cases across 4800 files).
- **2026-05-23** Bundling: do NOT bundle Markdown All in One / Prettier / markdownlint. Recommend in README. Reason: bundling = feature creep + version-pinning headaches.
- **2026-05-23** Distribution: personal-first via `vsce package` + manual install. Marketplace deferred 2+ weeks.

## Next action

Phase 0.5: spawn marksman against the real vault, sample 20 wikilinks, verify resolution semantics match Obsidian. Decision gate before writing any extension code.

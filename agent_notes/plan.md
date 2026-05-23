# Plan

Current phase: Phase 0 (setup + load-bearing smoke tests).

## Phases

- [x] **Phase 0** Repo setup, SPEC, agent_notes scaffolding
- [ ] **Phase 0.5** Marksman smoke test against vault (LOAD-BEARING; if marksman fails, architecture changes)
- [ ] **Phase 1** Project skeleton (TS, esbuild, vitest, lint, pre-commit)
- [ ] **Phase 2** Wikilink preview rendering (TDD)
- [ ] **Phase 3** Syntax highlighting (TextMate injection)
- [ ] **Phase 4** Marksman LSP client wiring
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

- **2026-05-23** Architecture: marksman LSP + thin extension. Not a Foam fork. Reason: marksman is MIT, battle-tested for Obsidian-style wikilinks, already provides backlinks/hover/completions. Forking Foam would mean maintaining ~10k LOC of TS that re-implements what marksman does in Rust.
- **2026-05-23** Bundling: do NOT bundle Markdown All in One / Prettier / markdownlint. Recommend in README. Reason: bundling = feature creep + version-pinning headaches.
- **2026-05-23** Distribution: personal-first via `vsce package` + manual install. Marketplace deferred 2+ weeks.

## Next action

Phase 0.5: spawn marksman against the real vault, sample 20 wikilinks, verify resolution semantics match Obsidian. Decision gate before writing any extension code.

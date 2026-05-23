# Obsidian Light — Spec

## Status: approved

Yoonho greenlit on 2026-05-23 with these specifics: don't fork Foam, use marksman + thin extension; install MarkTone-equivalents alongside; vs integration; hover provider; Copilot context booster via preview-tab preloader; project name "Obsidian Light"; write tests up front; measure everything; iterate.

## Goal

A VSCode extension that gives a vault editor inside VSCode the Obsidian-essential affordances: clickable wikilink rendering in preview, syntax highlighting, completions / backlinks / hover (via marksman LSP), bridge to the user's `vs` semantic search CLI, and a Copilot context booster. Personal-first; possibly publish later.

## Non-goals

- Re-implementing markdown editing utilities that already exist: GFM tables, list formatting, lint. Defer to Markdown All in One, Prettier, markdownlint (recommended in README, not bundled).
- Graph view (Obsidian has this).
- Multi-vault support in v0.
- Embedded image / video / canvas / drawing UIs.
- Re-implementing wikilink parsing or link-graph indexing (marksman owns that).

## Root constraints

- Mac only for v0 (Yoonho is on Mac; marksman cross-platform but untested elsewhere).
- VSCode 1.85+ (LSP client features used).
- Marksman as a runtime dependency, installed via `brew install marksman` on first launch if missing.
- The vault is a single workspace folder. `.marksman.toml` at vault root tunes link-resolution behavior.

## Architecture

External LSP backend + thin TypeScript extension.

```
┌─────────────────────────────────────────────┐
│            VSCode (TypeScript)               │
│                                              │
│  ┌──────────────┐   ┌────────────────────┐   │
│  │  Commands    │   │  Providers         │   │
│  │  - vs.search │   │  - hover           │   │
│  │  - vs.insert │   │  - markdown-it     │   │
│  │  - daily     │   │  - inline-context  │   │
│  └──────┬───────┘   └────────┬───────────┘   │
│         │                    │               │
│  ┌──────▼────────────────────▼────────────┐  │
│  │  Services                              │  │
│  │  - VsClient (spawn vs CLI)             │  │
│  │  - WikilinkParser (extract refs)       │  │
│  │  - NeighborPreloader (preview tabs)    │  │
│  │  - PerfLogger (every hot path)         │  │
│  └────────────────────────────────────────┘  │
│         │                                    │
└─────────┼────────────────────────────────────┘
          │  LSP (stdio)
┌─────────▼──────────────────────────────────┐
│  marksman (Rust, external)                  │
│  - wikilink parsing / resolution            │
│  - completions, hover, find-references,     │
│    go-to-def, diagnostics, rename           │
└─────────────────────────────────────────────┘
```

## Components and responsibilities

| Component | Source | Notes |
|---|---|---|
| Marksman LSP | external binary | Brew-installed. Started on extension activation via vscode-languageclient. Owns all wikilink intelligence. |
| Preview renderer | `markdown-it-*` plugin | Registered via `markdown.markdownItPlugins` contribution. Renders `[[X]]`, `[[X\|alias]]`, `[[X#header]]`, `![[X]]`. |
| Syntax injection | TextMate grammar JSON | Injects into `text.html.markdown` so wikilinks get distinct token scope and color. |
| VsClient | TS service | Wraps `vs` CLI: timeout, stderr capture, JSON-line parsing where possible. |
| Commands | TS | `obsidianLight.semanticSearch`, `.insertWikilink`, `.relatedNotes`, `.openDailyNote`, `.openRandomNote`. |
| HoverProvider | TS | On hover over a `[[wikilink]]`, augment marksman's hover with top-3 `vs` semantic neighbors of the target. |
| NeighborPreloader | TS | On active editor change in markdown: extract wikilinks, open each target as a preview tab so Copilot reads their content. Configurable. |
| CopilotInstructionsGen | TS one-shot command | Generate `.github/copilot-instructions.md` from vault structure + `CLAUDE.md`. |

## Performance targets

| Operation | Target | How measured |
|---|---|---|
| Extension activation (cold) | < 100 ms | `performance.now()` at extension entry/exit, logged to outputChannel |
| Marksman cold start to first response | < 500 ms | LSP `initialized` callback time |
| Markdown preview render, 100 wikilinks | < 50 ms | bench script using `markdown-it.render()` |
| Hover provider response | < 300 ms p95 | wrap provider, log per-call duration |
| `vs` cold call | not extension's fault (~1-2s) | spinner shown |
| `vs` warm call | < 200 ms | enforced via timeout |
| NeighborPreloader for a 5-link doc | < 100 ms | open all preview tabs in parallel |

## Reliability requirements

- Every external call has an explicit timeout (`vs`: 5s; marksman init: 10s).
- Every error caught at the provider boundary; logged to outputChannel; never thrown to the user as a popup unless actionable.
- If marksman dies, extension restarts it (max 3 retries in 60s, then surfaces an error).
- If `vs` is missing or fails, commands degrade gracefully (show a message, do not crash).
- All settings have safe defaults; no setting required for first-run success.

## Test plan

- **Unit tests (vitest):** wikilink parser, vs-result formatter, neighbor selector, copilot-instructions generator. Pure functions only.
- **Integration tests (@vscode/test-electron):** extension activates, commands registered, hover provider returns expected content for a sample workspace, preview rendering integration.
- **Smoke tests (manual + scripted):**
  - Marksman against the actual vault: 20 sampled wikilinks, verify resolution matches Obsidian.
  - vs CLI invocation: real call returns results in expected format.
  - Preview-tab preloader: open a real note, confirm neighbors open as preview tabs.
- **Performance bench:** scripts/bench-*.ts, run on every meaningful change. Regression gate: any target metric worsens by >20%, fail.

## Open questions (will resolve during build)

- Does `markdown-it-wikilinks` (the popular plugin) handle `[[X#header]]` and `![[X]]` embeds correctly, or do we need a custom plugin? Verify by smoke test before committing.
- Does the preview-tab preloader actually improve Copilot completions? Need a manual A/B on a real coding task before keeping the feature.
- Does marksman's title-vs-file-stem resolution match Obsidian for the vault? Smoke test will answer.

## Distribution

Personal-first. Repo at `~/repos/vscode-extensions/obsidian-light`. Install via `vsce package` + manual `code --install-extension`. Marketplace publication deferred until v0 has been used for 2+ weeks and proven better than current setup.

## License

MIT.

## Versioning

semver from v0.1.0. Pre-1.0: minor bumps for breaking changes acceptable.

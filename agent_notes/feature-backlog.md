# Feature Backlog

Ideas, not commitments. Favor small, local features that keep Vault Mode personal-first and offline-first.

## Most promising

- Perf summary command: show p50/p95/max by operation from the current session.
- Perf budget CI: fail if parser/index/resolve benches regress beyond a threshold.
- Perf baseline artifact per release, checked into `agent_notes/benchmarks.md`.
- Hot-path trace mode: log slow individual files during index/read/parse.
- Index build cancellation if a newer rebuild starts.
- File watcher debounce for bursty writes.
- Rebuild index on ignore-pattern config changes.
- Surface unreadable-file count after build.
- `vs` setup doctor: show resolved binary, timeout, cwd, sample output.
- Cache recent `vs` results per query.
- Create note from unresolved wikilink.
- Command: show all unresolved wikilinks in workspace.
- Quick fix: rename unresolved wikilink to nearest matching stem.
- Backlink panel in a Webview or native TreeView.
- Hover: show target path, backlink count, and ambiguous-candidate warning.
- Definition: support heading anchors by jumping to heading line.
- Completion: fuzzy-match stems and rank local folder matches above global matches.
- Completion: include heading anchors after typing `#`.
- Agent handoff command: copy current note plus top related notes.
- Agent handoff command: write a temporary context bundle.
- Related-notes panel backed by `vs`.
- Respect `.gitignore` and `.ignore` explicitly if VS Code search does not.
- Multi-root workspace policy: explicit first-root warning or root picker.
- Windows path smoke test.
- Add `npm run check` as one command for typecheck/lint/unit/build.
- Add release checklist for Marketplace publish.

## Wikilinks and navigation

- Show all ambiguous targets when a stem collision exists.
- Command: show all orphan notes (no backlinks).
- Command: show notes with no outgoing links.
- Command: show recently changed notes.
- Command: jump to next/previous wikilink in file.
- Command: copy wikilink for current note.
- Command: copy markdown link for current note.
- Command: insert backlink list into current note.
- References: include aliases/anchors in preview text.
- Completion: include aliases harvested from frontmatter.
- Rename: warn before rewriting many files.
- Rename: skip generated/export folders even if indexed.
- Rename: preserve interior whitespace if possible.
- Parser: support escaped pipes in aliases.
- Parser: decide and document behavior for nested brackets.

## Backlinks and graph shape

- Per-note stats: backlinks, outgoing links, unresolved links, word count.
- Workspace graph export as JSON.
- Workspace graph export as Mermaid.
- Command: find shortest wikilink path between two notes.
- Command: find strongly connected note clusters.
- Command: find duplicate stems and collision winners.
- Command: find stale aliases that no longer match target title.
- Sort backlinks by modified time, path, or link location.
- Show backlinks grouped by source folder.

## Daily notes and writing flow

- Configurable daily-note date format.
- Weekly notes.
- Monthly notes.
- Command: open yesterday/tomorrow daily note.
- Command: insert link to today's daily note.
- Daily-note template variables for previous/next day.
- Daily-note template variables for week/month.
- Create missing parent folders with clearer output logs.
- Optional calendar QuickPick for daily notes.
- Preserve local timezone semantics in all date commands.

## Preview and markdown rendering

- Preview CSS setting presets: house, compact, system.
- Preview command: open preview and reveal current section.
- More Obsidian-style callout types and icons.
- Collapsible callouts if VS Code preview allows safe markup.
- Render unresolved wikilinks with a visible but quiet style.
- Render embeds as transcluded excerpts for markdown notes.
- Image embed polish for `![[image.png]]`.
- Local preview regression fixture for every supported wikilink syntax.
- Visual regression script for `styles/preview.png`.
- Expose a command to regenerate preview screenshot.

## Semantic search and agent workflows

- `vs` health-check command.
- Cancel in-flight `vs` searches when input changes.
- Related-notes hover: filter out the current note.
- Related-notes hover: show relative paths, not just stems.
- Agent handoff command: print a `codex`/agent CLI invocation rooted at vault.
- Command: search current selection with `vs`.
- Command: lexical-only search through the same UI.
- Configurable `vs` default flags.
- Validate `vs` output paths are inside the vault.
- Support relative paths from `vs`.
- Warn when `vs` returns non-markdown files.
- Add a fake `vs` fixture for integration tests.

## Indexing, scale, and reliability

- File watcher trace mode for debugging missed updates.
- Persist last index stats in output channel.
- Better error accounting for unreadable files.
- Document exact ignore precedence.
- Benchmark on larger vault snapshots.
- Perf test for rename propagation on N linked files.
- Perf test for parser on pathological bracket-heavy notes.
- Protect against duplicate watcher events causing stale state.
- Remote workspace smoke test.

## Packaging, public repo, and support

- Add issue labels: bug, feature, docs, needs-repro, good-first-issue.
- Add Marketplace screenshots beyond the preview image.
- Add a short demo GIF.
- Add a `vs` wrapper example script.
- Add example vault fixtures for bug reports.
- Add CI job that packages VSIX and verifies contents.
- Add smoke test for installed VSIX in a temp profile.
- Add docs for Cursor install and update path.
- Add docs for VSCodium/Open VSX if publishing there later.

## Non-goals unless the project changes shape

- Full Obsidian clone.
- Sync, collaboration, or cloud storage.
- Graph view as a primary UI.
- External database as a hard dependency.
- Markdown formatting/linting already handled by sidecar extensions.

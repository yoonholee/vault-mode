# Friction log

Format per entry: what tried, what happened, workaround, suggested fix.

## 2026-05-23: Copilot booster jumped focus around the editor

**Tried:** Open wikilink neighbors as `preview: true` tabs in `ViewColumn.Beside` with `preserveFocus: true`, then refocus the original editor.

**What happened:** Visible "switching around" on every active-editor change. `preserveFocus` only preserves keyboard focus; the editor pane still flashed across columns as each neighbor loaded and then again as we refocused. Distracting in normal use.

**Root cause:** Wrong API. `showTextDocument` mutates the UI. We wanted "load into context, no UI change." The right call is `workspace.openTextDocument(uri)`: silent load, document goes into `workspace.textDocuments`, no tab, no focus.

**Workaround:** v0.1.1 switched to silent `openTextDocument`, deduped per active file per session, default OFF.

**RESOLVED 2026-07-04:** removed in v0.3.0. Copilot's documented completion context is files open in visible editors (tabs); silently-loaded `workspace.textDocuments` entries never reach it, so the feature was a no-op.

## 2026-05-23: marksman SIGSEGV on real vault

**Tried:** Use marksman LSP as wikilink backend for the extension. Smoke test against ~/repos/vault (~4815 .md files including Archive content).

**What happened:** Marksman 2026-02-08 crashes (EXC_BAD_ACCESS / SIGSEGV at 0x0 in CorUnix synchronization manager) when indexing the full vault. Symptoms: initialize call hangs forever; ~4 crash reports in ~/Library/Logs/DiagnosticReports/ within minutes of testing. Adding `.ignore` to exclude Archive/, Roam-imports, scraped/, etc. (~929 files instead of 4815) initially made it work (init 2.8s, definition 15ms) but subsequent runs hung again. Not reproducible on tiny fixtures.

**Workaround:** Pivoted away from marksman. Built in-extension wikilink resolution against a workspace file index. ~300-500 LOC, no external runtime dependency, no .NET crashes.

**Suggested fix:** File upstream issue at artempyanykh/marksman if we can find a minimal reproducer. Until then, marksman is not viable as a hard dependency for any vault with mixed/scraped content.

**Trust trade-off:** External LSPs can vanish for reasons we can't fix. For a personal tool that has to work on this user's vault today, owning the resolution logic is worth the 500 LOC.


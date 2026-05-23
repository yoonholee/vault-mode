# Friction log

Format per entry: what tried, what happened, workaround, suggested fix.

## 2026-05-23 — marksman SIGSEGV on real vault

**Tried:** Use marksman LSP as wikilink backend for the extension. Smoke test against ~/repos/vault (~4815 .md files including Archive content).

**What happened:** Marksman 2026-02-08 crashes (EXC_BAD_ACCESS / SIGSEGV at 0x0 in CorUnix synchronization manager) when indexing the full vault. Symptoms: initialize call hangs forever; ~4 crash reports in ~/Library/Logs/DiagnosticReports/ within minutes of testing. Adding `.ignore` to exclude Archive/, Roam-imports, scraped/, etc. (~929 files instead of 4815) initially made it work (init 2.8s, definition 15ms) but subsequent runs hung again. Not reproducible on tiny fixtures.

**Workaround:** Pivoted away from marksman. Built in-extension wikilink resolution against a workspace file index. ~300-500 LOC, no external runtime dependency, no .NET crashes.

**Suggested fix:** File upstream issue at artempyanykh/marksman if we can find a minimal reproducer. Until then, marksman is not viable as a hard dependency for any vault with mixed/scraped content.

**Trust trade-off:** External LSPs can vanish for reasons we can't fix. For a personal tool that has to work on this user's vault today, owning the resolution logic is worth the 500 LOC.


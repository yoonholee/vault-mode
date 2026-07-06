# Plan

## Current task: remove Copilot generator, simplify, ship

Status: v0.4.0 ready to commit/push, then Marketplace publish.

- Removed command contribution/registration, generator implementation/test, README command docs.
- Added broad perf logging for activation/indexing/watchers/commands/providers/`vs`.
- Fixed stale index/backlink cases, shared wikilink inner parsing, local-date daily notes.
- Added issue templates, CONTRIBUTING.md, package issue metadata, and feature backlog.
- Verified: typecheck, lint, unit, build, bench, VSIX package.
- Not green: integration test download hung; logged in friction.md.
- Next: commit/push, then `vsce publish` (may need interactive auth/token).

---

Status: v0.3.0 shipped (GitHub release + CI green + installed in VS Code and Cursor). Only vsce Marketplace publish remains (needs interactive `vsce login yoonholee`).

## Done (2026-07-04)

- Renamed from the personal extension (id, commands, config, folder).
- Merged preview-to-side (command + editor-title button) and vscode-markdown-css (styles/ + render harness, shipped via markdown.previewStyles).
- vs graceful degradation (vsBinaryAvailable probe, tested + mutation-checked).
- Publish prep: icon, Marketplace README, CHANGELOG, .vscodeignore audit (VSIX = 12 files, clean), personal-info grep clean.
- Perf: buildAll 1279→539ms, parse 298→84ms (see benchmarks.md).
- Consumers repointed: md-print CSS dir, User settings jsdelivr block removed, old extensions uninstalled.

## Remaining

- [ ] `vsce publish` (user-interactive login). Everything else shipped: repo public, v0.2.0 + v0.3.0 releases, CI (typecheck/lint/unit/integration/package) green, vscode-markdown-css archived.
- [ ] Preview styling + callout eyeball in the running editor (extension behavior is covered by the integration suite; the CSS pixels still deserve one human look).

## Open questions / deferred

- v0.3.0 closed the old list: callouts render in preview (calloutPlugin), copilotBooster deleted (no-op, see friction.md resolution), depth config gone with it.
- Rename propagation only sees in-editor renames (onDidRenameFiles excludes fs-level renames by design).

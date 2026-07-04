# Plan

Status: v0.2.0 built, tested, installed locally. Awaiting: GitHub repo creation + push, vsce publish (needs interactive `vsce login yoonholee`), vscode-markdown-css archive.

## Done (2026-07-04)

- Renamed from the personal extension (id, commands, config, folder).
- Merged preview-to-side (command + editor-title button) and vscode-markdown-css (styles/ + render harness, shipped via markdown.previewStyles).
- vs graceful degradation (vsBinaryAvailable probe, tested + mutation-checked).
- Publish prep: icon, Marketplace README, CHANGELOG, .vscodeignore audit (VSIX = 12 files, clean), personal-info grep clean.
- Perf: buildAll 1279→539ms, parse 298→84ms (see benchmarks.md).
- Consumers repointed: md-print CSS dir, User settings jsdelivr block removed, old extensions uninstalled.

## Remaining

- [ ] `private: true` → remove, as the literal last step before `vsce publish`.
- [ ] Create public github.com/yoonholee/vault-mode, push (README image links depend on it).
- [ ] `vsce publish` (user-interactive login) + optionally ovsx.
- [ ] Archive vscode-markdown-css on GitHub with pointer README; keep local clone until confident.
- [ ] Preview styling eyeball in real VS Code (screen-recording permission was missing; blocked mid-session).

## Open questions / deferred

- Callouts (`> [!note]`) render literal in the VS Code preview; now fixable in our markdown-it plugin (see agent_notes/css-backlog.md, merged from vscode-markdown-css).
- copilotBooster still unverified whether Copilot reads silently-loaded docs (friction.md 2026-05-23).
- depth>1 neighbor traversal reserved but unimplemented.

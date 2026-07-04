# Changelog

## 0.3.0

- Callouts render in the preview: `> [!type] Title` becomes a bold-titled blockquote with `callout callout-<type>` classes (was literal text).
- Rename propagation: renaming a note rewrites every `[[wikilink]]` pointing at it (alias/anchor/embed preserved), gated by `vaultMode.updateLinksOnRename` (default on). Applies to renames made inside the editor; fs-level renames from outside are not observable.
- Removed the experimental Copilot context booster. Copilot's documented completion context is files open in visible editors; the booster's silently-loaded documents never reach it, so the feature was a no-op. Configs `vaultMode.copilotBooster.*` and the preload command are gone.
- Integration test suite runs the real extension host (`npm run test:integration`): activation, commands, definition resolution, rename propagation.
- CI on GitHub Actions (typecheck, lint, unit + integration tests, package); tagged releases attach the VSIX automatically.
- Dead code removed: legacy marksman smoke scripts, superseded parser bench, unused index/resolver/fs methods.

## 0.2.0

First public release, under the new name **Vault Mode** (previously a personal-install-only extension).

- Renamed: extension id `vault-mode`, command ids `vaultMode.*`, config keys `vaultMode.*`.
- Merged in `preview-to-side`: `Vault: Open Markdown Preview to Side` plus an editor-title button for markdown and markdown-adjacent languages (prompt/instructions/chatagent/skill).
- Merged in `vscode-markdown-css`: the preview is now styled by bundled house-style CSS via `markdown.previewStyles` (light, serif headings, hidden frontmatter table). No settings wiring needed; the CSS source and render harness live in `styles/`.
- `vs` semantic search degrades gracefully: when the binary is not on PATH the features disable with an informational message instead of raw spawn errors.
- Removed a vault-specific default from `ignorePatterns` (`__etc/Roam-*/**`).

## 0.1.1 (unpublished)

- `.vscodeignore`: exclude `SPEC.md` and `*.vsix` -- SPEC.md (with dev-planning notes) was shipping inside the packaged VSIX.
- Fix `copilotBooster.enabled` runtime default: was falling back to `?? true` in `extension.ts`, contradicting the documented (and package.json-declared) default of `false`.
- `package.json`: add `keywords`, fix `repository.url` to include `.git` suffix.

## 0.1.0 (unpublished)

- Initial build: wikilink preview rendering, syntax highlighting, in-extension workspace index (definition/hover/completion/references), `vs` bridge, daily notes, Copilot context booster + instructions generator.

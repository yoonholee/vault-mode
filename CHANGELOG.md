# Changelog

## 0.2.0

First public release, under the new name **Vault Light** (previously `obsidian-light`, personal-install only).

- Renamed: extension id `vault-light`, command ids `vaultLight.*`, config keys `vaultLight.*`.
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

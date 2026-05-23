# External patterns

Imported patterns from external code or docs. Each entry: source URL, pattern summary, where used here.

- **VSCode extension activation perf logging** — std pattern: `const t0 = performance.now()` at entry, `logger.info('activated in', performance.now() - t0)` at exit. Used in `src/extension.ts`.
- **Markdown-it preview contribution** — VSCode `markdown.markdownItPlugins` contribution point lets extensions extend the built-in markdown preview without owning rendering. Used for wikilink preview.
- **vscode-languageclient LSP wrapper** — official MS package; standard pattern for spawning an external LSP via stdio. Used to wire marksman.

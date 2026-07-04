# styles/ — markdown look, on screen and in print

Single source of truth for how markdown renders in the VS Code preview (screen) and in `md-print` PDFs (print).
Formerly the standalone `vscode-markdown-css` repo; merged into Vault Light 2026-07-04.

## Files

- `tokens.css` — shared house-style design tokens: palette (~85% black, grayscale, surgical accent red) and font families.
- `preview.css` — VS Code Markdown preview (screen): force light mode, rem sizes, vertical rhythm, hide the frontmatter table.
- `print.css` — `md-print` PDF (Chrome): `@page`, pt sizes, page-break control.
- `render.py` — render/check harness (below). `fixtures/` — markdown corpus it renders.

`preview.css` and `print.css` both consume `tokens.css`'s `:root` variables.
Change a color or font in `tokens.css` once and both media update.
No `@import`: each consumer loads `tokens.css` as a separate stylesheet (CSS custom properties are global), which avoids webview/Chrome import-resolution issues.

## How each is wired

- **Preview:** the extension contributes `markdown.previewStyles: ["./styles/tokens.css", "./styles/preview.css"]` (package.json).
  Extension-contributed styles load from the install dir and are additive with user `markdown.styles`, so there is no jsdelivr, no purge, no `?v=` bump, and no workspace-folder restriction.
  Edit → rebuild/reinstall the extension (or Reload Window when running from source) → reopen preview.
- **Print:** `md-print.py` (dotfiles) passes `tokens.css` then `print.css` as two `--css` flags, read from this directory (override with `MD_CSS_DIR`).

## Verifying changes (`render.py`)

Needs `pandoc`, Google Chrome, and `pdftoppm` (poppler) on PATH.

```
./render.py                # render every fixtures/*.md → out/<name>.preview.png + out/<name>.print-1.png
./render.py fixtures/x.md  # render one file
./render.py --check        # headless: assert HTML invariants; exit 1 on failure (CI-able)
./render.py --readme       # regenerate preview.png from fixtures/showcase.md
```

The two pipelines mirror the real consumers: preview = pandoc (`gfm`) → `tokens.css`+`preview.css`, Chrome screenshot; print = pandoc (`gfm`) → `tokens.css`+`print.css`, Chrome `--print-to-pdf`.
To reproduce a rendering bug: drop a minimal `.md` in `fixtures/`, run `./render.py`, look at `out/`.
If it's structural/parsing, add an assertion to `CHECKS` and gate it with `--check`.
`fixtures/regressions.md` pins the cases that have bitten before.

After any change: `./render.py --check`, eyeball `out/`, run `./render.py --readme`, commit.

See `agent_notes/lessons.md` (merged section) for renderer gotchas and `agent_notes/css-backlog.md` for the improvement backlog.

# vscode-markdown-css — plan & improvement backlog

## What this is

One public, standalone repo (`github.com/yoonholee/vscode-markdown-css`) for how markdown looks on screen (VS Code preview) and in print (md-print). Not tied to any vault.
- `tokens.css` — shared house-style tokens (palette + font families). Loaded first by both consumers.
- `preview.css` — VS Code built-in Markdown preview (Chromium webview), screen rem sizes, force light, hide frontmatter table.
- `print.css` — `md-print` PDF: pandoc (gfm reader) → standalone HTML → Chrome headless `--print-to-pdf`, US letter.

Sharing is via separate stylesheets (no `@import`): both consumers load `tokens.css` alongside their leaf file, and `:root` custom properties are global, so a token change reaches both. See `README.md` for wiring; `lessons.md` for the consumer-side gotchas.

Delivery: preview via jsdelivr (User-settings `markdown.styles`); print reads a local clone (`md-print`, `MD_CSS_DIR`). Edit here → push → purge jsdelivr → bump `?v=` for preview; print is immediate.

## Shipped 2026-05-30

Quick wins 1–4, 6, 7 applied (print-color-adjust, underline links [kept GitHub blue], orphans/widows, break-inside coverage + h5/h6, print blockquote accent bar, tabular-nums in tables). Taste forks resolved: link color = GitHub blue; print measure capped to 90ch. Item 12 (verification harness) shipped 2026-05-31: `render.py` renders `fixtures/*.md` through both pipelines to `out/` (preview PNG + print PDF/PNG), `--check` asserts HTML invariants headlessly, `--readme` regenerates `preview.png`. `fixtures/regressions.md` pins the cases that have bitten (list-no-blank-line, nesting, math, tables, tasks, autolinks). Remaining of 12: optional stylelint, a `just` release recipe, `pdffonts` font-substitution assertion.

Edge-case passes (2026-05-31), found by stress-testing fixtures + real notes via the harness, fixed: overflow-wrap on body/code/td (long tokens no longer run off the page); restore CJK fallback `Apple SD Gothic Neo`; `img`/`mjx-container` max-width (wide images/math scale to the column); inline-code gray box in print; **relative image paths resolved to absolute** (were 404ing in every PDF, ≈314 notes); **Obsidian callouts → bold-title blockquotes** (were literal `[!type]`). Harness hardened: preprocess (frontmatter/wikilinks/images/callouts), `--mathjax`, vendored MathJax, render math in preview path. Confirmed clean: math environments (cases/bmatrix/align), footnotes, nested lists, multi-page pagination (headings stay with content, nothing splits badly).

Remaining overall: quick win 5 (install Source Code Pro), structural items 8–11, lower-priority + the taste forks below. Open: callouts render literal in the *VS Code preview* (a markdown-it plugin in the obsidian-light extension would fix it there too); wide-table convention documented (transpose/stack/split, see README).

## Improvement backlog

Synthesized from a 6-axis review (typography, color/a11y, print fidelity, screen↔print parity, maintainability, robustness). Severity·Effort in parens. Several items were flagged independently by multiple axes — those are real.

### Quick wins (one-to-few lines, high payoff — do first)

1. `print-color-adjust: exact` on `th, pre, code` in print.css (high·S). Chrome `--print-to-pdf` drops `background` by default, so the table-header gray and code backgrounds currently **do not render in the PDF** — a shipping silent loss.
2. Underline links in preview.css (high·S). Links are color-only (`text-decoration: none`); link-vs-text color contrast is 2.79:1, a WCAG 1.4.1 fail. Print already underlines.
3. `orphans: 3; widows: 3;` on `body, p, li` in print.css (high·S). `md-print --agent` runs an LLM loop to *detect* orphans the CSS never tells Chrome to prevent. Closes that loop.
4. Complete `break-inside: avoid` to `blockquote, figure, img, svg` and add `h5, h6` to `break-after: avoid` (high·S). Today a display equation (math SVG) or blockquote can split across pages.
5. Fix the mono chain (med·S). `--font-mono` lists "Source Code Pro" first, but it is **not installed** — code silently renders in the paid MonoLisa fallback. Install Source Code Pro (free, OFL) or reorder/comment.
6. Port the blockquote rule into print.css (high·S). The `4px solid var(--color-accent)` Stanford-red bar exists only on screen; in print, blockquotes fall back to browser default and the accent never appears on paper.
7. Tabular figures in tables: `th, td { font-variant-numeric: tabular-nums; }` (med·S). Proportional numerals currently misalign numeric columns — a correctness bug, not polish.

### Structural (medium effort, real single-source payoff)

8. Unify the type scale across media (high·M). The Major Third 1.25 ratio is hardcoded twice and already diverges: print collapses h2=h3 (14pt) and uses heading weight 700 vs screen's 600, so a document's hierarchy is medium-dependent. Move unitless `--scale-h*` + `--weight-heading` into tokens.css, derive each ladder with `calc()`. This is the biggest gap between the repo's stated promise and reality.
9. Promote shared *rules* (not just vars) into tokens.css (high·M). Heading family, table borders, mono family, list resets are restated per medium; variables don't stop rule drift (that's how print.css drifted to hardcoded Helvetica originally). Leave only medium-specific declarations in the leaf files.
10. Self-host the free OFL fonts via `@font-face` (med·M). Today every font resolves against whatever is installed; a PDF made on a machine missing Tiempos/Source* substitutes silently and changes pagination (which feeds md-print's page-fit loop). Bundle Source Serif 4 / Source Sans 3 / Source Code Pro; keep paid names (Tiempos, MonoLisa) as local-only first choices. Coordinate with md-print's render-wait (a self-hosted `@font-face` can race Chrome's snapshot — extend the wait beyond the current `"mathjax" in html` trigger).
11. Robust dark-mode opt-out (med·M). preview.css whack-a-moles `.vscode-dark <tag>` overrides; uncovered elements (`hr`, selection, scrollbars, and VS Code's injected syntax-token colors in fenced code) leak the dark theme. Prefer `color-scheme: light` + neutralizing syntax tokens.
12. Tooling: a `sample.md` fixture exercising every construct + a one-command render harness (preview HTML + `md-print` PDF) + a `just release` recipe for the submodule commit→push→bump dance (med·M). This closes the actual friction: today "edited a token" → "confirmed in both media" is manual reload + eyeballing. `pdffonts sample.pdf` is a cheap real assertion that catches silent font substitution.

### Lower priority / hardening

- Darken `--color-text-muted` #666 → ~#595959 (AAA 7:1) since it's used for blockquote *body* prose, not just incidental marks (med·S).
- Row borders `--color-border` #ddd are 1.36:1 vs white (below 3:1 UI contrast); bump toward #bbb–#999 for table scanability (med·S).
- Remove the positive `letter-spacing: 0.02em` on h2/h3 (serif display wants neutral-to-negative tracking; it's also applied to the wrong levels) (low·S).
- `hanging-punctuation: first` is a no-op in Chromium (Safari-only) — dead rule (low·S).
- `--font-size-sm` is defined but unused — wire or delete (low·S).
- Submodule-not-initialized: VS Code preview silently renders unstyled (md-print already guards with a clear error). Document `git submodule update --init`; consider a session check (med·S).
- `table.frontmatter` hide depends on a VS Code internal class; if VS Code renames it, frontmatter shows (not data-losing; print is robust via md-print's Python strip). Accept + document (low).

## Taste forks (need the owner's eye — do not pick the median)

- **Type scale ratio reconciliation:** keep Major Third 1.25 and force print to match (h1 ≈ 21pt off an 11pt body) vs accept that print wants a tighter ladder. Decides item 8's target numbers.
- **Print measure:** cap to ~66ch (book-like, wide right margin) vs bump body to 12pt (denser) vs widen `@page` side margins to ~30mm (classical). Current print measure is ~95ch — past readable.
- **Link color (the palette-honesty fork):** GitHub blue #0366d6 (familiar) vs Stanford red #8c1515 (on-brand, but red reads as a warning to some) vs text-color + underline only (strictest grayscale). The repo claims "grayscale + surgical red" but ships two blues (link + checkbox); this fork decides if that claim is true.
- **Figures:** oldstyle figures in body prose (literary, matches the serif house style) vs lining everywhere (cleaner for number/ID-heavy notes). Tabular-in-tables (item 7) regardless.
- **Print links:** keep blue+underline (matches screen) vs black+underline (cleaner on a B/W laser, where blue → muddy gray).

## Highest-leverage if doing only a few

Quick wins 1–4 (all one-to-few lines, all fix silent shipping defects), then structural 8 (unify the type scale) and 12 (the render harness, so any further change is verifiable in both media from one command).

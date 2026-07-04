# Lessons

Durable, non-obvious learnings only. Each entry: claim, evidence, when-it-applies.

## Smoke-test external dependencies against the real target before committing architecture

**Claim:** When choosing an architecture that hinges on an external dependency, run that dependency against the real production data, not just a fixture, before treating the architecture decision as locked.

**Evidence:** marksman LSP passed cleanly on a 3-file fixture and a 929-file subset. Crashed reproducibly on the real 4815-file vault. We would have built half the extension before discovering the crash if we had skipped the vault smoke test.

**When it applies:** Any "delegate the hard part to an external tool" architecture decision. The cost of one upfront smoke test is far less than the cost of designing around a tool that doesn't work.



---

# Merged from vscode-markdown-css (2026-07-04)

## Consumer-side knowledge (VS Code preview + md-print)

Hard-won facts about the two renderers. The CSS is simple; the delivery is where the traps are.

## VS Code Markdown preview

The preview is VS Code's **built-in** Markdown preview (opened via the `preview-to-side` extension → `markdown.showPreviewToSide`), a Chromium webview. NOT Obsidian — `.obsidian/` changes do nothing.
Styling comes from the `markdown.styles` setting. A local file there loads **only if it sits inside a workspace folder** (verified in VS Code's `localResourceRoots`: it adds the workspace folders, else the previewed doc's own dir). That is why the CSS lives in the vault, not an outside clone, and why jsdelivr (public-only) was dropped when the repo went private.
`markdown.styles` arrays do **NOT merge**: a workspace-level entry fully REPLACES the user-level one. (A workspace `display:none`-only CSS once dropped the user's light theme → whole preview went dark.) The User-settings note "absolute paths don't work" is wrong; the real rule is "must be under a workspace folder."
VS Code renders YAML frontmatter as `table.frontmatter` (class is in VS Code's shipped `markdown-language-features/media/markdown.css`); we hide it in preview.css. A markdown-it override in an extension does NOT work: VS Code registers its own `front_matter` rule `before("fence")` and re-sets the renderer after `extendMarkdownIt`, so an override loses. Print doesn't rely on this — md-print strips frontmatter in Python.
Forcing light mode is whack-a-mole: preview.css overrides `.vscode-dark <tag>`, but VS Code injects per-token inline colors for fenced code (the syntax highlighter) that win over `code{}` rules, and elements like `hr`/selection/scrollbars leak. Set a light editor theme, or neutralize syntax tokens, for full coverage.

## md-print (PDF)

Pipeline: pandoc (reader `gfm+tex_math_dollars`, `--mathjax`) → standalone HTML (MathJax SVG, vendored locally) → Chrome headless `--print-to-pdf`, US letter. `tokens.css` + `print.css` passed as two `--css` from `$MD_CSS_DIR` (default `~/repos/vscode-markdown-css`, a plain clone of this repo).
Reader: `gfm` (not pandoc `markdown`) so a list interrupts a paragraph without a blank line, matching the preview. `--mathjax` is required: without it, complex TeX pandoc can't pre-convert keeps literal `$...$` and renders raw; with it, all math becomes `\(...\)` that MathJax typesets.
Chrome `--print-to-pdf` **drops `background` by default** — need `print-color-adjust: exact` for header/code fills to appear. (Borders survive; backgrounds don't.)
A PDF embeds whatever font resolved; substitution is invisible to the reader and changes pagination, which feeds md-print's `--agent` orphan/page-fit introspection. So font determinism matters more for print than screen.
The harness `render.py` mirrors this pipeline; the preview is global via jsdelivr (User-settings `markdown.styles`), so a fresh machine needs the clone for print + the jsdelivr URL for preview, not a submodule.

## Preprocessing (md-print + harness, kept in sync)

Both md-print's `preprocess_markdown` (dotfiles) and `render.py`'s `preprocess` (here) transform markdown before pandoc, so notes render the way the consumers show them, NOT raw pandoc. **They are duplicated and must stay in sync** (no shared module — md-print is in dotfiles, the harness here). The chain, in order:
1. Drop a leading `---...---` YAML frontmatter block (pandoc/gfm would otherwise render it as text/hr).
2. Callout headers `> [!type] Title` → `> **Title**` (bold title in the blockquote). pandoc and VS Code's built-in preview don't know Obsidian callouts, so without this the literal `[!type]` shows. Print is now cleaner than the actual preview here (fixing the preview needs a markdown-it plugin in the obsidian-light extension).
3. Unwrap `[[wikilink]]` / `[[note|alias]]` → text.
4. Resolve **relative image paths** to absolute `file://` against the note's dir. The HTML renders from a temp dir, so `![](../assets/x.png)` would 404 — this was silently breaking images in every PDF (≈314 image notes).
Fences are skipped throughout. Tests: dotfiles `test_md_print.py`; structural checks `render.py --check`.

## Fonts (this machine, fc-list verified 2026-05-30)

Installed: Tiempos Headline, Source Serif 4, Source Sans 3, MonoLisa.
**NOT installed: Source Code Pro** — the named first choice of `--font-mono`. Code silently renders in the paid MonoLisa fallback, not the intended free font. The fallback chain is "working" by accident.

## Verify the real render, not a replica

When changing how something renders in VS Code or Chrome, observe the actual output (open the preview HTML / the PDF), not a hand-built markdown-it stand-in. A replica that shares your assumption can't falsify it. (Three preview "fixes" shipped wrong this way before the cause was found by reading VS Code's actual bundled code.)

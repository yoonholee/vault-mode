#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# ///
"""Render + check harness for this repo's markdown CSS. Self-contained: needs only
pandoc, Google Chrome, and pdftoppm (poppler) on PATH.

  ./render.py                  render every fixtures/*.md to out/<name>.preview.png and
                               out/<name>.print-1.png (and .print.pdf) so you can eyeball both media
  ./render.py fixtures/x.md    render one file (or any .md path)
  ./render.py --readme         regenerate the committed README image (preview.png) from fixtures/showcase.md
  ./render.py --check          headless: assert structural invariants on the rendered HTML; exit 1 on failure

How to reproduce a rendering bug: drop a minimal .md in fixtures/, run ./render.py, look at
out/. If it's a structural/parsing issue, add an assertion to CHECKS and run ./render.py --check.

Pipelines mirror the real consumers (so what you see here is what they produce):
  preview = pandoc (READER) -> HTML + tokens.css + preview.css, screenshotted by Chrome  (~= VS Code preview)
  print   = pandoc (READER) -> HTML + tokens.css + print.css, Chrome --print-to-pdf       (= md-print)
READER is kept identical to md-print's PANDOC_FORMAT; bump both together.
"""

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures"
OUT = ROOT / "out"
READER = "gfm+tex_math_dollars"  # keep in sync with md-print's PANDOC_FORMAT
# Prefer the same vendored MathJax md-print uses (loads via file://, no network race that
# leaves a long math note half-typeset); fall back to the CDN if it isn't present.
_VENDORED_MATHJAX = Path.home() / "dotfiles/hosts/laptop/bin/mathjax-tex-svg-full.js"
MATHJAX = _VENDORED_MATHJAX.as_uri() if _VENDORED_MATHJAX.exists() else "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg-full.js"
CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def sh(*args: str, stdin: str | None = None) -> str:
    return subprocess.run(args, check=True, capture_output=True, text=True, input=stdin).stdout


def preprocess(md_text: str, base: Path | None = None) -> str:
    """Mirror md-print: drop a leading YAML frontmatter block, unwrap [[wikilinks]], and
    resolve relative image paths against the note's dir to absolute file:// URIs (the HTML
    renders from a temp dir, so a relative ../assets/x.png would 404). Code fences untouched."""
    import re
    from urllib.parse import unquote
    img = re.compile(r"(!\[[^\]]*\]\()([^)\s]+)")
    callout = re.compile(r"^(\s*>+\s*)\[!(\w+)\][+-]?\s*(.*)$")  # Obsidian callout header

    def abs_img(m):
        url = m.group(2)
        if base is None or re.match(r"^(https?:|file:|data:|/|#)", url):
            return m.group(0)
        p = (base / unquote(url)).resolve()
        return m.group(1) + (p.as_uri() if p.exists() else url)

    md_text = re.sub(r"\A---\n.*?\n---\n", "", md_text, count=1, flags=re.DOTALL).lstrip("\n")
    out, in_fence = [], False
    for line in md_text.splitlines():
        if line.lstrip().startswith(("```", "~~~")):
            in_fence = not in_fence
        if not in_fence:
            line = callout.sub(lambda m: f"{m.group(1)}**{m.group(3).strip() or m.group(2).capitalize()}**", line)
            line = re.sub(r"\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]", lambda m: m.group(2) or m.group(1), line)
            line = img.sub(abs_img, line)
        out.append(line)
    return "\n".join(out)


def to_html_body(md: Path) -> str:
    src = preprocess(md.read_text(encoding="utf-8", errors="ignore"), md.resolve().parent)
    # --mathjax makes pandoc emit \(...\)/\[...\] (MathJax-readable) even for complex TeX it
    # can't pre-convert; without it those spans keep literal $...$ and MathJax leaves them raw.
    return sh("pandoc", "-f", READER, "-t", "html", "--mathjax", stdin=src)


def page(body: str, css: list[str], body_class: str = "", mathjax: bool = False) -> str:
    links = "\n".join(f'<link rel="stylesheet" href="{(ROOT / c).as_uri()}">' for c in css)
    mj = f'<script src="{MATHJAX}"></script>' if mathjax else ""
    return (
        f'<!doctype html><html><head><meta charset="utf-8">{links}{mj}</head>'
        f'<body class="{body_class}">{body}</body></html>'
    )


def _chrome(html: str, *flags: str) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(html)
        path = f.name
    try:
        sh(
            CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--default-background-color=ffffffff", *flags, f"file://{path}",
        )
    finally:
        os.unlink(path)


def render(md: Path) -> None:
    OUT.mkdir(exist_ok=True)
    body = to_html_body(md)
    has_math = 'class="math' in body
    name = md.stem

    math_wait = ["--run-all-compositor-stages-before-draw", "--virtual-time-budget=20000"] if has_math else []
    preview_png = OUT / f"{name}.preview.png"
    _chrome(page(body, ["tokens.css", "preview.css"], "vscode-body", mathjax=has_math),
            "--window-size=900,1600", f"--screenshot={preview_png}", *math_wait)

    pdf = OUT / f"{name}.print.pdf"
    flags = [f"--print-to-pdf={pdf}", "--no-pdf-header-footer"]
    if has_math:  # let MathJax typeset before the snapshot (mirrors md-print)
        flags += ["--run-all-compositor-stages-before-draw", "--virtual-time-budget=20000"]
    _chrome(page(body, ["tokens.css", "print.css"], mathjax=has_math), *flags)
    sh("pdftoppm", "-png", "-r", "110", "-f", "1", "-l", "1", str(pdf), str(OUT / f"{name}.print"))
    print(f"  {name}: out/{name}.preview.png  out/{name}.print-1.png")


# (fixture stem, [substrings that MUST appear], [substrings that must NOT appear])
CHECKS = [
    ("regressions",
     ['<ul>', '<ol', '<table>', 'class="math inline"', 'class="math display"',
      'type="checkbox"', '<del>', 'href="https://example.com'],
     ['Mechanism / understand them - Deepest pain']),  # list must not collapse to a paragraph
    ("showcase", ['<table>', '<ul>', 'type="checkbox"'], []),
    ("inline", ['class="footnote-ref"', '<del>', '<strong>', '<em>'], ['<em>not italic']),  # escapes stay literal
    ("markup", ['<a href=', '<img', '<hr', '<strong>'],
     ['a comment that should not render']),  # HTML comment must not leak
    ("edge", ['<table>', 'class="math display"', '서람'], []),  # CJK present, math, table
]


def check() -> int:
    import re
    failures = []
    for stem, must, must_not in CHECKS:
        html = to_html_body(FIXTURES / f"{stem}.md")
        html = re.sub(r"<!--.*?-->", "", html, flags=re.DOTALL)  # comments don't render
        html = re.sub(r"\s+", " ", html)  # normalize pandoc line-wraps
        for s in must:
            if s not in html:
                failures.append(f"{stem}.md: missing {s!r}")
        for s in must_not:
            if s in html:
                failures.append(f"{stem}.md: found forbidden {s!r}")
    # the original bug, asserted precisely: the no-blank-line list is a real list
    reg = to_html_body(FIXTURES / "regressions.md")
    if reg.count("<li>") < 3:
        failures.append("regressions.md: list-without-blank-line did not produce list items")
    for f in failures:
        print("FAIL:", f, file=sys.stderr)
    print(f"{'FAILED' if failures else 'OK'}: {len(CHECKS)} fixtures checked", file=sys.stderr)
    return 1 if failures else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="*", help="markdown files to render (default: fixtures/*.md)")
    ap.add_argument("--check", action="store_true", help="assert HTML invariants; exit 1 on failure")
    ap.add_argument("--readme", action="store_true", help="regenerate preview.png from fixtures/showcase.md")
    args = ap.parse_args()

    if args.check:
        return check()
    if args.readme:
        render(FIXTURES / "showcase.md")
        import shutil
        shutil.copy(OUT / "showcase.preview.png", ROOT / "preview.png")
        print("updated preview.png")
        return 0

    targets = [Path(p) for p in args.paths] if args.paths else sorted(FIXTURES.glob("*.md"))
    print(f"rendering {len(targets)} fixture(s) to out/")
    for md in targets:
        render(md)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

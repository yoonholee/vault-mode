# Rendered Markdown Sample

A fixture that exercises every styled construct, so the screenshot (`preview.png`) shows what the house style actually produces. Regenerate with `./screenshot.sh` after changing the CSS.

## Headings & prose

Serif titles, **Source Sans** body at ~85% black, generous measure. Links are [GitHub blue and underlined](https://example.com). Inline `code` sits in a light box.

### A third level

- A bullet list with custom muted markers
- A second item with a [link](https://example.com)
  - A nested item one level down
- [ ] An unchecked task
- [x] A checked task

> A blockquote, set in muted text behind a Stanford-red rule. The accent appears here and nowhere else: color through scarcity.

## A table with numbers

| Method      | Params |  Score |
| ----------- | -----: | -----: |
| Baseline    |   1.2B |  41.30 |
| + retrieval |   1.2B |  47.85 |
| + reranking |   1.4B | 100.00 |

## A code block

```python
def score(x: float) -> float:
    """Tabular numerals keep the table columns aligned."""
    return x / (1 + x)
```

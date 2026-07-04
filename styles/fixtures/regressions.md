# Regressions

Tricky cases that have broken before, or are easy to break. `render.py --check` asserts
on the HTML; `render.py` renders the PDF/PNG so you can eyeball pagination and spacing.

## List interrupting a paragraph (no blank line)

The Seoram-TV digest bug: bullets directly under a label line, no blank line. Pandoc's
default `markdown` reader swallowed these into a run-on paragraph; the gfm reader (and
VS Code's preview) render a real list.

Mechanism / understand them
- Deepest pain: admitting fault.
- Emotions they feel: chronic fear the mask cracks.
- This phobia: an emotion phobia.

## Ordered list

1. First
2. Second
3. Third

## Deeply nested

- L1
  - L2
    - L3
      - L4

## Task list

- [ ] undone
- [x] done

## Loose list

- one

- two

- three

## List item with sub-blocks

- An item with a second paragraph.

  Second paragraph inside the item.

  ```python
  x = [i for i in range(10)]
  ```

- A normal item after it.

## Math

Inline $x^2 + y^2 = z^2$ and display:

$$\int_0^1 f(x)\,dx = F(1) - F(0)$$

## Table with numbers

| Method      | Params |  Score |
| ----------- | -----: | -----: |
| Baseline    |   1.2B |  41.30 |
| + retrieval |   1.4B | 100.00 |

## Long URL + strikethrough

A ~~struck~~ phrase and a bare link https://example.com/a/very/long/path/that/should/wrap/in/print that must wrap.

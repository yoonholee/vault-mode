# Edge cases

## CJK (Korean) + emoji

서람TV 나르시시스트 회복 채널의 핵심은 하나다: 나르시시스트는 당신의 감정 반응을 먹고 산다. 그러니 공급을 끊어라.

- 감정을 제거하라 — "아니오"를 완전한 문장으로 말하라.
- 이성과 공감은 통하지 않는다; 오직 힘과 두려움만이 움직인다.
- 投影 is the engine. 中文 mixed in too. Emoji: 🔥 ✅ 😀 → arrows.

## Wide table (many columns)

| Method | Params | Layers | Heads | Ctx | Train Tok | MMLU | GSM8K | HumanEval | Latency |
| --- | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| Baseline | 1.2B | 24 | 16 | 4096 | 300B | 41.30 | 12.4 | 18.9 | 120ms |
| + retrieval | 1.4B | 24 | 16 | 8192 | 350B | 47.85 | 19.0 | 22.1 | 180ms |

## Long inline code and unbroken token

Here is a long inline token `supercalifragilisticexpialidocious_method_name_that_is_extremely_long_and_unbreakable_xyz` mid-sentence, and a bare unbroken string aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa that must wrap.

## Wide display math

$$\sum_{i=1}^{n} a_i x_i + \sum_{j=1}^{m} b_j y_j + \sum_{k=1}^{p} c_k z_k + \int_0^\infty e^{-t^2}\,dt = \frac{\sqrt{\pi}}{2} + \text{a long right-hand side that keeps going and going}$$

$$\begin{pmatrix} a & b & c & d & e & f & g \\ h & i & j & k & l & m & n \\ o & p & q & r & s & t & u \end{pmatrix}$$

## Nested structures

> A blockquote.
>
> > A nested blockquote inside it.
> >
> > ```python
> > code_inside_a_blockquote = True
> > ```

- A list item containing a blockquote:

  > quoted text inside a list item

- A list item with a table:

  | a | b |
  | - | - |
  | 1 | 2 |

## Wide code block

```python
def very_long_signature(argument_one, argument_two, argument_three, argument_four, argument_five, argument_six, argument_seven):
    return argument_one + argument_two + argument_three + argument_four + argument_five
```

// Pure-function parser for Obsidian-style wikilinks.
//
// Recognizes [[target]], [[target|alias]], [[target#anchor]],
// [[target#anchor|alias]], and embed variant ![[target]].
// Skips wikilinks inside fenced code blocks (```...``` and ~~~...~~~)
// and inline code spans (`...`).
//
// Returns offsets (byte indexes into the source string) plus line/col.

export interface Wikilink {
  raw: string;
  target: string;
  anchor?: string;
  alias?: string;
  embed: boolean;
  range: { start: number; end: number };
  line: number;
  col: number;
}

const WIKILINK_REGEX = /(!?)\[\[([^\[\]]+?)\]\]/g;

export function parseWikilinks(source: string): Wikilink[] {
  const out: Wikilink[] = [];
  const lines = source.split("\n");

  // Pre-compute line start offsets for fast offset->line conversion
  const lineStarts: number[] = [0];
  for (let i = 0; i < lines.length - 1; i++) {
    lineStarts.push(lineStarts[i] + lines[i].length + 1); // +1 for the \n
  }

  // First pass: mark byte ranges that are inside fenced code blocks
  const fenceMask = new Uint8Array(source.length);
  let inFence = false;
  let fenceChar: "`" | "~" | null = null;
  let cursor = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const m = trimmed.match(/^(```+|~~~+)/);
    if (m) {
      const ch = m[1][0] as "`" | "~";
      if (!inFence) {
        inFence = true;
        fenceChar = ch;
      } else if (fenceChar === ch) {
        inFence = false;
        fenceChar = null;
      }
    }
    if (inFence) {
      // Mark the entire line plus newline as in-fence
      const lineEnd = cursor + line.length + (i < lines.length - 1 ? 1 : 0);
      for (let j = cursor; j < lineEnd; j++) fenceMask[j] = 1;
    }
    cursor += line.length + 1;
  }

  // Second pass: mark inline code spans
  // Approach: walk each line outside fences, toggle on/off at unescaped backticks
  cursor = 0;
  const codeSpanMask = new Uint8Array(source.length);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip whole-line scanning if line is in a fence
    if (cursor < source.length && fenceMask[cursor]) {
      cursor += line.length + 1;
      continue;
    }
    let inCode = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === "`") {
        inCode = !inCode;
        codeSpanMask[cursor + j] = 1;
        continue;
      }
      if (inCode) codeSpanMask[cursor + j] = 1;
    }
    cursor += line.length + 1;
  }

  // Third pass: extract wikilinks, skipping fenced and inline-code regions
  let match: RegExpExecArray | null;
  WIKILINK_REGEX.lastIndex = 0;
  while ((match = WIKILINK_REGEX.exec(source)) !== null) {
    const isEmbed = match[1] === "!";
    const inner = match[2];
    if (!inner || !inner.trim()) continue;

    const bracketStart = match.index + (isEmbed ? 1 : 0);
    const fullStart = match.index;
    const fullEnd = match.index + match[0].length;

    // Reject if anchor brackets are inside fence or code span
    if (fenceMask[bracketStart] || codeSpanMask[bracketStart]) continue;

    // Triple-open guard: [[[X]] should not be parsed as a wikilink.
    // If the character immediately before the [[ is also a [, skip.
    if (fullStart - (isEmbed ? 1 : 0) - 1 >= 0) {
      const prev = source[fullStart - (isEmbed ? 1 : 0) - 1];
      // For [[X case we look at the char before; for ![[X we look at the char before !.
      // The [[ starts at bracketStart, so source[bracketStart - 1] is what we want.
      const prevOfBracket = source[bracketStart - 1];
      if (prevOfBracket === "[" && prev !== "!") continue;
      if (prevOfBracket === "[") continue;
    }

    // Parse inner: split on | for alias, then on # for anchor
    let target = inner;
    let alias: string | undefined;
    let anchor: string | undefined;
    const pipeIdx = inner.indexOf("|");
    if (pipeIdx !== -1) {
      target = inner.slice(0, pipeIdx).trim();
      alias = inner.slice(pipeIdx + 1).trim();
    } else {
      target = inner.trim();
    }
    const hashIdx = target.indexOf("#");
    if (hashIdx !== -1) {
      anchor = target.slice(hashIdx + 1).trim();
      target = target.slice(0, hashIdx).trim();
    }
    if (!target) continue;

    // Find line/col from offset
    const { line, col } = offsetToLineCol(lineStarts, fullStart);

    out.push({
      raw: match[0],
      target,
      anchor,
      alias,
      embed: isEmbed,
      range: { start: fullStart, end: fullEnd },
      line,
      col,
    });
  }

  return out;
}

function offsetToLineCol(lineStarts: number[], offset: number): { line: number; col: number } {
  // Binary search for the largest lineStart <= offset
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo, col: offset - lineStarts[lo] };
}

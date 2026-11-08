export interface NoteHeading {
  text: string;
  level: number;
  /** Zero-based source line. */
  line: number;
}

export interface NoteMetadata {
  relPath: string;
  stem: string;
  aliases: string[];
  headings: NoteHeading[];
}

export function parseNoteMetadata(relPath: string, source = ""): NoteMetadata {
  return {
    relPath,
    stem: stemOf(relPath),
    aliases: parseAliases(source),
    headings: parseHeadings(source),
  };
}

function stemOf(relPath: string): string {
  const slash = relPath.lastIndexOf("/");
  const base = slash === -1 ? relPath : relPath.slice(slash + 1);
  return base.replace(/\.md$/i, "");
}

function parseAliases(source: string): string[] {
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return [];
  const end = lines.slice(1).findIndex((line) => line.trim() === "---");
  if (end === -1) return [];
  const frontmatter = lines.slice(1, end + 1);
  const aliases: string[] = [];

  for (let i = 0; i < frontmatter.length; i++) {
    const match = /^aliases\s*:\s*(.*)$/.exec(frontmatter[i]);
    if (!match) continue;
    const inline = match[1].trim();
    if (inline.startsWith("[") && inline.endsWith("]")) {
      aliases.push(...splitInlineList(inline.slice(1, -1)));
    } else if (inline) {
      aliases.push(unquote(inline));
    } else {
      for (let j = i + 1; j < frontmatter.length; j++) {
        const item = /^\s+-\s+(.+?)\s*$/.exec(frontmatter[j]);
        if (!item) break;
        aliases.push(unquote(item[1]));
      }
    }
    break;
  }

  const seen = new Set<string>();
  return aliases.filter((alias) => {
    const value = alias.trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitInlineList(value: string): string[] {
  const items: string[] = [];
  let current = "";
  let quote: '"' | "'" | undefined;
  let escaped = false;

  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === "\\" && quote === '"') {
      current += char;
      escaped = true;
    } else if (quote) {
      current += char;
      if (char === quote) quote = undefined;
    } else if (char === '"' || char === "'") {
      quote = char;
      current += char;
    } else if (char === ",") {
      items.push(unquote(current.trim()));
      current = "";
    } else {
      current += char;
    }
  }
  items.push(unquote(current.trim()));
  return items.filter(Boolean);
}

function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function parseHeadings(source: string): NoteHeading[] {
  const headings: NoteHeading[] = [];
  const lines = source.split(/\r?\n/);
  let frontmatter = lines[0]?.trim() === "---";
  let fenceChar: string | undefined;
  let fenceLength = 0;

  for (let line = 0; line < lines.length; line++) {
    const text = lines[line];
    if (frontmatter) {
      if (line > 0 && text.trim() === "---") frontmatter = false;
      continue;
    }

    const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(text)?.[1];
    if (fence) {
      if (!fenceChar) {
        fenceChar = fence[0];
        fenceLength = fence.length;
      } else if (fence[0] === fenceChar && fence.length >= fenceLength) {
        fenceChar = undefined;
        fenceLength = 0;
      }
      continue;
    }
    if (fenceChar) continue;

    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(text);
    if (!match) continue;
    const heading = match[2].replace(/\s+#+\s*$/, "").trim();
    if (heading) headings.push({ text: heading, level: match[1].length, line });
  }
  return headings;
}

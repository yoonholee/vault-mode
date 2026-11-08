import * as path from "node:path";
import type { NoteMetadata } from "./noteMetadata";

export interface NoteCompletion {
  label: string;
  relPath: string;
  description: string;
  insertText: string;
  filterText: string;
  matchedAlias?: string;
  score: number;
}

export interface HeadingCompletion {
  label: string;
  insertText: string;
  level: number;
  line: number;
}

export type CompletionContext =
  | { kind: "note"; query: string; replaceStart: number }
  | { kind: "heading"; target: string; query: string; replaceStart: number };

export function completionContext(beforeCursor: string): CompletionContext | undefined {
  const open = beforeCursor.lastIndexOf("[[");
  if (open === -1) return undefined;
  const inner = beforeCursor.slice(open + 2);
  if (inner.includes("]]")) return undefined;
  if (inner.includes("[") || inner.includes("]") || inner.includes("|")) return undefined;

  const anchor = inner.indexOf("#");
  if (anchor === -1) {
    return { kind: "note", query: inner, replaceStart: open + 2 };
  }
  const target = inner.slice(0, anchor).trim();
  if (!target) return undefined;
  return {
    kind: "heading",
    target,
    query: inner.slice(anchor + 1),
    replaceStart: open + 2 + anchor + 1,
  };
}

export function rankNoteCompletions(
  notes: NoteMetadata[],
  query: string,
  currentRelPath: string,
  limit = 100,
): NoteCompletion[] {
  const stemCounts = new Map<string, number>();
  for (const note of notes) {
    const key = normalize(note.stem);
    stemCounts.set(key, (stemCounts.get(key) ?? 0) + 1);
  }

  const results: NoteCompletion[] = [];
  for (const note of notes) {
    const titleScore = matchScore(note.stem, query);
    let bestScore = titleScore;
    let matchedAlias: string | undefined;
    const pathScore = query.includes("/")
      ? matchScore(note.relPath.replace(/\.md$/i, ""), query)
      : undefined;
    if (pathScore !== undefined && (bestScore === undefined || pathScore + 0.1 < bestScore)) {
      bestScore = pathScore + 0.1;
    }
    for (const alias of note.aliases) {
      const aliasScore = matchScore(alias, query);
      if (aliasScore !== undefined && (bestScore === undefined || aliasScore + 0.25 < bestScore)) {
        bestScore = aliasScore + 0.25;
        matchedAlias = alias;
      }
    }
    if (bestScore === undefined) continue;

    const ambiguous = (stemCounts.get(normalize(note.stem)) ?? 0) > 1;
    const target = ambiguous ? note.relPath.replace(/\.md$/i, "") : note.stem;
    results.push({
      label: note.stem,
      relPath: note.relPath,
      description: note.relPath,
      insertText: target,
      filterText: [note.stem, note.relPath, ...note.aliases].join(" "),
      matchedAlias,
      score: bestScore + directoryDistance(currentRelPath, note.relPath) * 0.25,
    });
  }

  return results
    .sort(
      (a, b) =>
        a.score - b.score || a.label.localeCompare(b.label) || a.relPath.localeCompare(b.relPath),
    )
    .slice(0, limit);
}

export function rankHeadingCompletions(
  note: NoteMetadata,
  query: string,
  limit = 100,
): HeadingCompletion[] {
  return note.headings
    .map((heading) => ({ heading, score: matchScore(heading.text, query) }))
    .filter(
      (candidate): candidate is { heading: NoteMetadata["headings"][number]; score: number } =>
        candidate.score !== undefined,
    )
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.heading.line - b.heading.line ||
        a.heading.text.localeCompare(b.heading.text),
    )
    .slice(0, limit)
    .map(({ heading }) => ({
      label: heading.text,
      insertText: heading.text,
      level: heading.level,
      line: heading.line,
    }));
}

function matchScore(value: string, query: string): number | undefined {
  const candidate = normalize(value);
  const wanted = normalize(query);
  if (!wanted) return 100;
  if (candidate === wanted) return 0;
  if (candidate.startsWith(wanted)) return 10 + (candidate.length - wanted.length) * 0.01;

  const wordStart = candidate.split(" ").findIndex((word) => word.startsWith(wanted));
  if (wordStart !== -1) return 20 + wordStart;

  const substring = candidate.indexOf(wanted);
  if (substring !== -1) return 30 + substring;

  let cursor = 0;
  let gaps = 0;
  for (const char of wanted) {
    const found = candidate.indexOf(char, cursor);
    if (found === -1) return undefined;
    gaps += found - cursor;
    cursor = found + 1;
  }
  return 60 + gaps + candidate.length * 0.01;
}

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function directoryDistance(fromFile: string, toFile: string): number {
  const from = path.posix.dirname(fromFile).split("/").filter(Boolean);
  const to = path.posix.dirname(toFile).split("/").filter(Boolean);
  let common = 0;
  while (common < from.length && common < to.length && from[common] === to[common]) common++;
  return from.length - common + (to.length - common);
}

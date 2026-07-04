// Rewrites wikilinks when a note is renamed: [[Old]] -> [[New]], preserving
// alias/anchor/embed syntax. Path-qualified targets ([[dir/Old]]) get their
// last segment replaced; a directory move with an unchanged stem needs no
// rewrite because resolution is stem-based.

import { parseWikilinks } from "./wikilinkParser";

/**
 * Returns the source with every wikilink referencing `oldStem` rewritten to
 * `newStem`, or null when no link matched. Stem comparison is case-insensitive,
 * matching the resolver. Rewritten links are re-serialized in canonical form
 * (interior whitespace normalized).
 */
export function computeRenameEdits(
  source: string,
  oldStem: string,
  newStem: string,
): string | null {
  const links = parseWikilinks(source);
  const oldLower = oldStem.toLowerCase();
  let out = "";
  let cursor = 0;
  let changed = false;

  for (const link of links) {
    const segments = link.target.split("/");
    const stem = segments[segments.length - 1];
    if (stem.toLowerCase() !== oldLower) continue;

    segments[segments.length - 1] = newStem;
    const newTarget = segments.join("/");
    const anchor = link.anchor !== undefined ? `#${link.anchor}` : "";
    const alias = link.alias !== undefined ? `|${link.alias}` : "";
    const raw = `${link.embed ? "!" : ""}[[${newTarget}${anchor}${alias}]]`;

    out += source.slice(cursor, link.range.start) + raw;
    cursor = link.range.end;
    changed = true;
  }

  if (!changed) return null;
  return out + source.slice(cursor);
}

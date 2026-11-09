// Finds wikilinks whose target matches more than one note, and rewrites one
// to a chosen candidate. Bare `[[Note]]` with A/Note.md and B/Note.md resolves
// to a single file by tie-break; this surfaces those links so the user can
// pin each to a specific note.

import { formatWikilink, parseWikilinks, type Wikilink } from "./wikilinkParser";
import type { Resolver } from "./resolver";

export interface AmbiguousLink {
  link: Wikilink;
  /** Vault-relative paths the link's target matches, in resolver order. */
  candidates: string[];
}

export function findAmbiguousLinks(source: string, resolver: Resolver): AmbiguousLink[] {
  const out: AmbiguousLink[] = [];
  for (const link of parseWikilinks(source)) {
    const candidates = resolver.matches(link.target);
    if (candidates.length > 1) out.push({ link, candidates });
  }
  return out;
}

/** Wikilink text pointing `link` at `candidate` via its shortest unique target. */
export function pinnedLinkText(link: Wikilink, candidate: string, resolver: Resolver): string {
  return formatWikilink(link, resolver.shortestTarget(candidate));
}

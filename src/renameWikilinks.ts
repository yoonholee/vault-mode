// Rewrites wikilinks when notes are renamed or moved. A link is rewritten only
// if the resolver, run against the vault as it was before the rename, resolved
// it to a renamed file. The new target is the shortest form that resolves
// uniquely to that file after the rename, keeping alias/anchor/embed syntax.

import { parseWikilinks } from "./wikilinkParser";
import type { Resolver } from "./resolver";

/**
 * Builds a function that returns the source with affected wikilinks rewritten,
 * or null when no link changed. `renames` maps old to new vault-relative paths.
 * `resolver` may reflect the vault either before or after the rename.
 */
export function createRenamer(
  resolver: Resolver,
  renames: ReadonlyMap<string, string>,
): (source: string) => string | null {
  const before = resolver.clone();
  const after = resolver.clone();
  for (const [from, to] of renames) {
    before.remove(to);
    before.add(from);
    after.remove(from);
    after.add(to);
  }

  return (source) => {
    let out = "";
    let cursor = 0;
    let changed = false;

    for (const link of parseWikilinks(source)) {
      const resolved = before.resolve(link.target);
      const moved = resolved === undefined ? undefined : renames.get(resolved);
      if (moved === undefined) continue;

      const target = after.shortestTarget(moved);
      const anchor = link.anchor !== undefined ? `#${link.anchor}` : "";
      const alias = link.alias !== undefined ? `|${link.alias}` : "";
      const raw = `${link.embed ? "!" : ""}[[${target}${anchor}${alias}]]`;
      if (raw === source.slice(link.range.start, link.range.end)) continue;

      out += source.slice(cursor, link.range.start) + raw;
      cursor = link.range.end;
      changed = true;
    }

    return changed ? out + source.slice(cursor) : null;
  };
}

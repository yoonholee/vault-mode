// Maps wikilink targets to file paths.
//
// Lookup is case-insensitive on the stem (matches Obsidian).
// On stem collision, picks shortest path (fewest slashes), then alphabetical.
// Path-qualified targets (e.g. "subdir/Note") match by suffix path.

export class Resolver {
  // stem (lowercased) -> list of relative file paths (preserving original case)
  private byStem = new Map<string, string[]>();

  add(relPath: string): void {
    const stem = stemOf(relPath);
    if (!stem) return;
    const key = stem.toLowerCase();
    const list = this.byStem.get(key) ?? [];
    if (!list.includes(relPath)) list.push(relPath);
    this.byStem.set(key, list);
  }

  remove(relPath: string): void {
    const stem = stemOf(relPath);
    if (!stem) return;
    const key = stem.toLowerCase();
    const list = this.byStem.get(key);
    if (!list) return;
    const idx = list.indexOf(relPath);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) this.byStem.delete(key);
  }

  /**
   * Resolve a wikilink target (e.g. "Foo" or "subdir/Foo") to a single path.
   * Returns undefined if no match.
   */
  resolve(target: string): string | undefined {
    const normalized = target.replace(/\.md$/i, "");
    const segments = normalized.split("/");
    const stem = segments[segments.length - 1];
    if (!stem) return undefined;

    const candidates = this.candidates(stem);
    if (candidates.length === 0) return undefined;

    if (segments.length > 1) {
      // Path-qualified: require the relative path to end with normalized + .md
      const wanted = normalized + ".md";
      const exact = candidates.find((c) => c === wanted || c.endsWith("/" + wanted));
      return exact;
    }

    if (candidates.length === 1) return candidates[0];

    // Ambiguous stem: prefer shortest path (fewest slashes), then alphabetical
    return candidates.slice().sort((a, b) => {
      const da = depthOf(a);
      const db = depthOf(b);
      if (da !== db) return da - db;
      return a.localeCompare(b);
    })[0];
  }

  /** All file paths that share this stem (case-insensitive). */
  candidates(stem: string): string[] {
    const normalized = stem.replace(/\.md$/i, "");
    return [...(this.byStem.get(normalized.toLowerCase()) ?? [])];
  }

  /** All known stems (lowercased), for completion. */
  allStems(): string[] {
    return [...this.byStem.keys()];
  }

  /** Total number of indexed files (counting all paths under all stems). */
  size(): number {
    let n = 0;
    for (const list of this.byStem.values()) n += list.length;
    return n;
  }
}

function stemOf(relPath: string): string {
  const slash = relPath.lastIndexOf("/");
  const base = slash === -1 ? relPath : relPath.slice(slash + 1);
  return base.replace(/\.md$/i, "");
}

function depthOf(p: string): number {
  let n = 0;
  for (let i = 0; i < p.length; i++) if (p[i] === "/") n++;
  return n;
}

// Maps wikilink targets to file paths.
//
// Lookup is case-insensitive on the stem (the common vault convention).
// On stem collision, picks shortest path (fewest slashes), then alphabetical.
// Path-qualified targets (e.g. "subdir/Note") match by suffix path.

export class Resolver {
  // stem (lowercased) -> list of relative file paths (preserving original case)
  private byStem = new Map<string, string[]>();

  clear(): void {
    this.byStem.clear();
  }

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
    const matches = this.matches(target);
    if (matches.length <= 1 || target.includes("/")) return matches[0];

    // Ambiguous bare stem: prefer shortest path (fewest slashes), then alphabetical
    return matches.sort((a, b) => depthOf(a) - depthOf(b) || a.localeCompare(b))[0];
  }

  /**
   * Every file a wikilink target matches: all files sharing the stem for a
   * bare target, those whose path ends with the target for a qualified one.
   */
  matches(target: string): string[] {
    const normalized = target.replace(/\.md$/i, "");
    const stem = normalized.slice(normalized.lastIndexOf("/") + 1);
    if (!stem) return [];
    const candidates = this.candidates(stem);
    if (!normalized.includes("/")) return candidates;
    const wanted = normalized + ".md";
    return candidates.filter((c) => c === wanted || c.endsWith("/" + wanted));
  }

  /** Stems (lowercased) shared by more than one file, with their paths. */
  ambiguousStems(): Map<string, string[]> {
    return new Map([...this.byStem].filter(([, paths]) => paths.length > 1));
  }

  /** All file paths that share this stem (case-insensitive). */
  candidates(stem: string): string[] {
    const normalized = stem.replace(/\.md$/i, "");
    return [...(this.byStem.get(normalized.toLowerCase()) ?? [])];
  }

  /** Independent copy that can be mutated without affecting this resolver. */
  clone(): Resolver {
    const copy = new Resolver();
    for (const [k, v] of this.byStem) copy.byStem.set(k, [...v]);
    return copy;
  }

  /**
   * Shortest wikilink target for `relPath` that resolves to it unambiguously:
   * the bare stem when no other file shares it, otherwise the shortest
   * path-qualified suffix that matches only this file.
   */
  shortestTarget(relPath: string): string {
    const noExt = relPath.replace(/\.md$/i, "");
    const segments = noExt.split("/");
    const stem = segments[segments.length - 1];
    const others = this.candidates(stem).filter((c) => c !== relPath);
    for (let n = 1; n <= segments.length; n++) {
      const target = segments.slice(segments.length - n).join("/");
      const wanted = target + ".md";
      if (!others.some((c) => c === wanted || c.endsWith("/" + wanted))) return target;
    }
    return noExt;
  }

  /** All known stems (lowercased), for completion. */
  allStems(): string[] {
    return [...this.byStem.keys()];
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

// Reverse index from a wikilink target (lowercased stem) to the source files
// that contain wikilinks pointing at it.

export interface OutgoingLink {
  target: string;
  line: number;
  col: number;
}

export interface Backlink {
  source: string;
  line: number;
  col: number;
}

export class BacklinksIndex {
  // target (lowercased) -> list of backlinks
  private byTarget = new Map<string, Backlink[]>();
  // source path -> list of targets it currently links to (for invalidation)
  private outgoingBySource = new Map<string, Set<string>>();

  clear(): void {
    this.byTarget.clear();
    this.outgoingBySource.clear();
  }

  /**
   * Replace all outgoing links from `source`. Removes any prior entries
   * recorded for that source, then adds the new ones.
   */
  recordOutgoing(source: string, links: OutgoingLink[]): void {
    this.removeSource(source);
    const targets = new Set<string>();
    for (const link of links) {
      const key = targetKey(link.target);
      const list = this.byTarget.get(key) ?? [];
      list.push({ source, line: link.line, col: link.col });
      this.byTarget.set(key, list);
      targets.add(key);
    }
    if (targets.size > 0) this.outgoingBySource.set(source, targets);
  }

  removeSource(source: string): void {
    const oldTargets = this.outgoingBySource.get(source);
    if (!oldTargets) return;
    for (const target of oldTargets) {
      const list = this.byTarget.get(target);
      if (!list) continue;
      const filtered = list.filter((b) => b.source !== source);
      if (filtered.length === 0) this.byTarget.delete(target);
      else this.byTarget.set(target, filtered);
    }
    this.outgoingBySource.delete(source);
  }

  backlinks(target: string): Backlink[] {
    return [...(this.byTarget.get(targetKey(target)) ?? [])];
  }
}

function targetKey(target: string): string {
  const withoutExt = target.replace(/\.md$/i, "");
  const slash = withoutExt.lastIndexOf("/");
  const stem = slash === -1 ? withoutExt : withoutExt.slice(slash + 1);
  return stem.toLowerCase();
}

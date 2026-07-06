// Composes parser + resolver + backlinks into a workspace-level service.
//
// The class is injection-friendly (FileSystem interface) so it can be unit
// tested without touching disk or VSCode. The VSCode-specific file walker
// + watcher lives in src/services/vscodeFs.ts.

import { Resolver } from "./resolver";
import { BacklinksIndex, type OutgoingLink, type Backlink } from "./backlinksIndex";
import { parseWikilinks } from "./wikilinkParser";

export interface FileSystem {
  /** Returns ABSOLUTE paths to .md files under `root`, honoring ignore globs. */
  listFiles(root: string, ignorePatterns: string[]): Promise<string[]>;
  readFile(absPath: string): Promise<string>;
}

export interface BuildResult {
  files: number;
  bytes: number;
  links: number;
  readErrors: number;
  listMs: number;
  parseMs: number;
  durationMs: number;
}

export interface UpdateResult {
  ok: boolean;
  bytes: number;
  links: number;
  durationMs: number;
}

export class WorkspaceIndex {
  readonly resolver = new Resolver();
  readonly backlinks = new BacklinksIndex();

  constructor(
    private readonly root: string,
    private readonly fs: FileSystem,
  ) {}

  async buildAll(ignorePatterns: string[]): Promise<BuildResult> {
    const t0 = performance.now();
    const listT0 = performance.now();
    const files = await this.fs.listFiles(this.root, ignorePatterns);
    const listMs = performance.now() - listT0;
    this.resolver.clear();
    this.backlinks.clear();
    for (const abs of files) {
      // Always add to resolver (stem map). Parsing may fail; that's OK.
      this.resolver.add(this.toRel(abs));
    }
    // Read+parse with bounded concurrency: reads are I/O-bound and serial
    // awaiting was the dominant activation cost (see scripts/bench-all.mjs).
    const CONCURRENCY = 32;
    let next = 0;
    let bytes = 0;
    let linksCount = 0;
    let readErrors = 0;
    const parseT0 = performance.now();
    const worker = async () => {
      while (next < files.length) {
        const abs = files[next++];
        try {
          const text = await this.fs.readFile(abs);
          const links = parseWikilinks(text);
          bytes += text.length;
          linksCount += links.length;
          const outgoing: OutgoingLink[] = links.map((l) => ({
            target: l.target,
            line: l.line,
            col: l.col,
          }));
          this.backlinks.recordOutgoing(abs, outgoing);
        } catch {
          readErrors++;
          // Skip unreadable files; resolver still has the stem.
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
    return {
      files: files.length,
      bytes,
      links: linksCount,
      readErrors,
      listMs,
      parseMs: performance.now() - parseT0,
      durationMs: performance.now() - t0,
    };
  }

  /** Re-parse a single file and update resolver + backlinks. */
  async updateFile(absPath: string): Promise<UpdateResult> {
    const t0 = performance.now();
    // Update resolver (in case the file is new)
    this.resolver.add(this.toRel(absPath));
    try {
      const text = await this.fs.readFile(absPath);
      const links = parseWikilinks(text);
      const outgoing: OutgoingLink[] = links.map((l) => ({
        target: l.target,
        line: l.line,
        col: l.col,
      }));
      this.backlinks.recordOutgoing(absPath, outgoing);
      return {
        ok: true,
        bytes: text.length,
        links: links.length,
        durationMs: performance.now() - t0,
      };
    } catch {
      this.backlinks.removeSource(absPath);
      return { ok: false, bytes: 0, links: 0, durationMs: performance.now() - t0 };
    }
  }

  removeFile(absPath: string): void {
    this.resolver.remove(this.toRel(absPath));
    this.backlinks.removeSource(absPath);
  }

  /** Resolve a wikilink target to an ABSOLUTE file path, or undefined. */
  resolve(target: string): string | undefined {
    const rel = this.resolver.resolve(target);
    return rel ? this.toAbs(rel) : undefined;
  }

  backlinksFor(target: string): Backlink[] {
    return this.backlinks.backlinks(target);
  }

  allStems(): string[] {
    return this.resolver.allStems();
  }

  /** Absolute paths of files with at least one outgoing link whose stem matches (case-insensitive). */
  sourcesLinkingToStem(stem: string): string[] {
    return [...new Set(this.backlinks.backlinks(stem).map((b) => b.source))];
  }

  private toRel(abs: string): string {
    if (abs.startsWith(this.root + "/")) return abs.slice(this.root.length + 1);
    if (abs === this.root) return "";
    return abs;
  }

  private toAbs(rel: string): string {
    if (rel.startsWith("/")) return rel;
    return `${this.root}/${rel}`;
  }
}

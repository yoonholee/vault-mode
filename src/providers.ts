// LSP-style providers (definition, hover, completion, references) wired to
// the WorkspaceIndex.

import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import type { WorkspaceIndex } from "./workspaceIndex";
import type { VsClient } from "./vsClient";
import { parseWikilinkInner } from "./wikilinkParser";
import type { PerfLogger } from "./perfLogger";

const WIKILINK_AT_POS = /(!?\[\[)([^[\]]+?)\]\]/g;

interface WikilinkAtCursor {
  range: vscode.Range;
  target: string;
  alias?: string;
  anchor?: string;
  embed: boolean;
}

/** Find the wikilink whose inner content the cursor sits on. */
export function wikilinkAt(
  doc: vscode.TextDocument,
  pos: vscode.Position,
): WikilinkAtCursor | undefined {
  const line = doc.lineAt(pos.line).text;
  WIKILINK_AT_POS.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKILINK_AT_POS.exec(line)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (pos.character >= start && pos.character <= end) {
      const embed = m[1].startsWith("!");
      const parts = parseWikilinkInner(m[2]);
      if (!parts) continue;
      return {
        range: new vscode.Range(
          new vscode.Position(pos.line, start),
          new vscode.Position(pos.line, end),
        ),
        target: parts.target,
        alias: parts.alias,
        anchor: parts.anchor,
        embed,
      };
    }
  }
  return undefined;
}

export class DefinitionProvider implements vscode.DefinitionProvider {
  constructor(
    private index: WorkspaceIndex,
    private perf?: PerfLogger,
  ) {}

  provideDefinition(
    doc: vscode.TextDocument,
    pos: vscode.Position,
  ): vscode.ProviderResult<vscode.Definition> {
    const t0 = performance.now();
    let resolved = false;
    try {
      const hit = wikilinkAt(doc, pos);
      if (!hit) return undefined;
      const target = this.index.resolve(hit.target);
      resolved = target !== undefined;
      if (!target) return undefined;
      return new vscode.Location(vscode.Uri.file(target), new vscode.Position(0, 0));
    } finally {
      this.perf?.log("provider.definition", performance.now() - t0, { resolved });
    }
  }
}

export class ReferenceProvider implements vscode.ReferenceProvider {
  constructor(
    private index: WorkspaceIndex,
    private perf?: PerfLogger,
  ) {}

  provideReferences(doc: vscode.TextDocument): vscode.ProviderResult<vscode.Location[]> {
    const t0 = performance.now();
    let count = 0;
    try {
      const docStem = path.basename(doc.uri.fsPath, ".md");
      const links = this.index.backlinksFor(docStem);
      count = links.length;
      return links.map(
        (b) => new vscode.Location(vscode.Uri.file(b.source), new vscode.Position(b.line, b.col)),
      );
    } finally {
      this.perf?.log("provider.references", performance.now() - t0, { count });
    }
  }
}

export class HoverProvider implements vscode.HoverProvider {
  constructor(
    private index: WorkspaceIndex,
    private vs: VsClient | null,
    private opts: { augmentWithVs: boolean; vsLimit: number },
    private perf?: PerfLogger,
  ) {}

  async provideHover(
    doc: vscode.TextDocument,
    pos: vscode.Position,
  ): Promise<vscode.Hover | undefined> {
    const t0 = performance.now();
    let resolved = false;
    let related = 0;
    try {
      const hit = wikilinkAt(doc, pos);
      if (!hit) return undefined;
      const resolvedPath = this.index.resolve(hit.target);
      resolved = resolvedPath !== undefined;
      const md = new vscode.MarkdownString();
      md.isTrusted = true;
      md.supportHtml = false;

      if (!resolvedPath) {
        md.appendMarkdown(`**\`[[${hit.target}]]\`**: unresolved.\n\n`);
      } else {
        md.appendMarkdown(`**${path.basename(resolvedPath)}**\n\n`);
        try {
          const text = await fs.readFile(resolvedPath, "utf8");
          const excerpt = firstParagraph(text, 400);
          if (excerpt) md.appendMarkdown(excerpt + "\n\n");
        } catch {
          // ignore
        }
      }

      if (this.opts.augmentWithVs && this.vs) {
        try {
          const results = await this.vs.search(hit.target, {
            limit: this.opts.vsLimit,
            noUpdate: true,
          });
          related = results.length;
          if (results.length > 0) {
            md.appendMarkdown(`\n**Related (via \`vs\`):**\n\n`);
            for (const r of results.slice(0, this.opts.vsLimit)) {
              const rel = path.basename(r, ".md");
              md.appendMarkdown(`- [[${rel}]]\n`);
            }
          }
        } catch {
          // vs failures are non-fatal for hover
        }
      }

      return new vscode.Hover(md, hit.range);
    } finally {
      this.perf?.log("provider.hover", performance.now() - t0, {
        resolved,
        related,
        vs: this.opts.augmentWithVs && this.vs !== null,
      });
    }
  }
}

export class CompletionProvider implements vscode.CompletionItemProvider {
  constructor(
    private index: WorkspaceIndex,
    private perf?: PerfLogger,
  ) {}

  provideCompletionItems(
    doc: vscode.TextDocument,
    pos: vscode.Position,
  ): vscode.ProviderResult<vscode.CompletionList> {
    const t0 = performance.now();
    let itemsCount = 0;
    let stemsCount = 0;
    try {
      const line = doc.lineAt(pos.line).text;
      const before = line.slice(0, pos.character);
      const m = /\[\[([^[\]]*)$/.exec(before);
      if (!m) return undefined;
      const prefix = m[1].toLowerCase();
      const stems = this.index.allStems();
      stemsCount = stems.length;
      const items = stems
        .filter((s) => s.includes(prefix))
        .slice(0, 100)
        .map((stem) => {
          const candidates = this.index.resolve(stem);
          const item = new vscode.CompletionItem(stem, vscode.CompletionItemKind.File);
          if (candidates) item.detail = path.relative(path.dirname(doc.uri.fsPath), candidates);
          item.insertText = stem;
          return item;
        });
      itemsCount = items.length;
      return new vscode.CompletionList(items, true);
    } finally {
      this.perf?.log("provider.completion", performance.now() - t0, {
        items: itemsCount,
        stems: stemsCount,
      });
    }
  }
}

function firstParagraph(text: string, maxChars: number): string | undefined {
  // Strip YAML frontmatter, then the first heading, then take the first
  // non-empty paragraph up to maxChars.
  let s = text;
  if (s.startsWith("---")) {
    const end = s.indexOf("\n---", 3);
    if (end !== -1) s = s.slice(end + 4);
  }
  s = s.trim();
  // Drop leading H1
  if (s.startsWith("# ")) {
    const nl = s.indexOf("\n\n");
    s = nl === -1 ? "" : s.slice(nl + 2);
  }
  const stopAt = s.indexOf("\n\n");
  const para = (stopAt === -1 ? s : s.slice(0, stopAt)).trim();
  if (!para) return undefined;
  return para.length > maxChars ? para.slice(0, maxChars) + "…" : para;
}

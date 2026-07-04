// LSP-style providers (definition, hover, completion, references) wired to
// the WorkspaceIndex.

import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import type { WorkspaceIndex } from "./workspaceIndex";
import type { VsClient } from "./vsClient";

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
      const inner = m[2];
      let target = inner;
      let alias: string | undefined;
      let anchor: string | undefined;
      const pipeIdx = inner.indexOf("|");
      if (pipeIdx !== -1) {
        target = inner.slice(0, pipeIdx).trim();
        alias = inner.slice(pipeIdx + 1).trim();
      } else {
        target = inner.trim();
      }
      const hashIdx = target.indexOf("#");
      if (hashIdx !== -1) {
        anchor = target.slice(hashIdx + 1).trim();
        target = target.slice(0, hashIdx).trim();
      }
      return {
        range: new vscode.Range(
          new vscode.Position(pos.line, start),
          new vscode.Position(pos.line, end),
        ),
        target,
        alias,
        anchor,
        embed,
      };
    }
  }
  return undefined;
}

export class DefinitionProvider implements vscode.DefinitionProvider {
  constructor(private index: WorkspaceIndex) {}
  provideDefinition(
    doc: vscode.TextDocument,
    pos: vscode.Position,
  ): vscode.ProviderResult<vscode.Definition> {
    const hit = wikilinkAt(doc, pos);
    if (!hit) return undefined;
    const target = this.index.resolve(hit.target);
    if (!target) return undefined;
    return new vscode.Location(vscode.Uri.file(target), new vscode.Position(0, 0));
  }
}

export class ReferenceProvider implements vscode.ReferenceProvider {
  constructor(private index: WorkspaceIndex) {}
  provideReferences(doc: vscode.TextDocument): vscode.ProviderResult<vscode.Location[]> {
    const docStem = path.basename(doc.uri.fsPath, ".md");
    const links = this.index.backlinksFor(docStem);
    return links.map(
      (b) => new vscode.Location(vscode.Uri.file(b.source), new vscode.Position(b.line, b.col)),
    );
  }
}

export class HoverProvider implements vscode.HoverProvider {
  constructor(
    private index: WorkspaceIndex,
    private vs: VsClient | null,
    private opts: { augmentWithVs: boolean; vsLimit: number },
  ) {}
  async provideHover(
    doc: vscode.TextDocument,
    pos: vscode.Position,
  ): Promise<vscode.Hover | undefined> {
    const hit = wikilinkAt(doc, pos);
    if (!hit) return undefined;
    const resolved = this.index.resolve(hit.target);
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = false;

    if (!resolved) {
      md.appendMarkdown(`**\`[[${hit.target}]]\`** — unresolved.\n\n`);
    } else {
      md.appendMarkdown(`**${path.basename(resolved)}**\n\n`);
      try {
        const text = await fs.readFile(resolved, "utf8");
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
  }
}

export class CompletionProvider implements vscode.CompletionItemProvider {
  constructor(private index: WorkspaceIndex) {}
  provideCompletionItems(
    doc: vscode.TextDocument,
    pos: vscode.Position,
  ): vscode.ProviderResult<vscode.CompletionList> {
    const line = doc.lineAt(pos.line).text;
    const before = line.slice(0, pos.character);
    const m = /\[\[([^[\]]*)$/.exec(before);
    if (!m) return undefined;
    const prefix = m[1].toLowerCase();
    const items = this.index
      .allStems()
      .filter((s) => s.includes(prefix))
      .slice(0, 100)
      .map((stem) => {
        const candidates = this.index.resolve(stem);
        const item = new vscode.CompletionItem(stem, vscode.CompletionItemKind.File);
        if (candidates) item.detail = path.relative(path.dirname(doc.uri.fsPath), candidates);
        item.insertText = stem;
        return item;
      });
    return new vscode.CompletionList(items, true);
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

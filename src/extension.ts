// Vault Mode - extension entry point.
//
// On activate: pick the first workspace folder as the vault, build the
// WorkspaceIndex, wire providers/commands, install a FS watcher.
// Returns an object whose `extendMarkdownIt` is called by VSCode to inject
// the wikilink preview plugin.

import * as vscode from "vscode";
import * as path from "node:path";
import MarkdownIt from "markdown-it";
import { WorkspaceIndex } from "./workspaceIndex";
import { VscodeFs } from "./services/vscodeFs";
import { VsClient, vsBinaryAvailable } from "./vsClient";
import { PerfLogger } from "./perfLogger";
import {
  DefinitionProvider,
  HoverProvider,
  CompletionProvider,
  ReferenceProvider,
} from "./providers";
import { registerCommands } from "./commands";
import { createRenamer } from "./renameWikilinks";
import { wikilinkPlugin, calloutPlugin, relativeLinkHref } from "./markdownItPlugin";

let globalIndex: WorkspaceIndex | undefined;

export async function activate(ctx: vscode.ExtensionContext) {
  const t0 = performance.now();
  const output = vscode.window.createOutputChannel("Vault Mode");
  ctx.subscriptions.push(output);

  const cfg = vscode.workspace.getConfiguration("vaultMode");
  const perfLog = new PerfLogger((line) => output.appendLine(line), {
    enabled: cfg.get<boolean>("perfLog") ?? true,
  });

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    output.appendLine("No workspace folder; Vault Mode idle.");
    return undefined;
  }
  const vaultRoot = folders[0].uri.fsPath;
  output.appendLine(`Vault root: ${vaultRoot}`);

  const fs = new VscodeFs(vaultRoot);
  const index = new WorkspaceIndex(vaultRoot, fs);
  globalIndex = index;

  // Build index in background; providers handle empty index gracefully
  const ignorePatterns = cfg.get<string[]>("ignorePatterns") ?? [];
  perfLog
    .time("buildAll", () => index.buildAll(ignorePatterns))
    .then((r) =>
      output.appendLine(
        `Index built: files=${r.files} bytes=${r.bytes} links=${r.links} readErrors=${r.readErrors} list=${Math.round(r.listMs)}ms parse=${Math.round(r.parseMs)}ms total=${Math.round(r.durationMs)}ms`,
      ),
    )
    .catch((e) =>
      output.appendLine(`Index build error: ${e instanceof Error ? e.message : String(e)}`),
    );

  // vs client (optional integration; null when the binary is absent)
  const vsBinary = cfg.get<string>("vsPath") ?? "vs";
  const vsTimeoutMs = cfg.get<number>("vsTimeoutMs") ?? 5000;
  const vs = vsBinaryAvailable(vsBinary)
    ? new VsClient({ binary: vsBinary, timeoutMs: vsTimeoutMs, vaultRoot, perf: perfLog })
    : null;
  if (!vs)
    output.appendLine(`vs binary '${vsBinary}' not found; semantic-search features disabled.`);

  // Providers
  const mdSelector: vscode.DocumentSelector = { scheme: "file", language: "markdown" };
  ctx.subscriptions.push(
    vscode.languages.registerDefinitionProvider(mdSelector, new DefinitionProvider(index, perfLog)),
    vscode.languages.registerReferenceProvider(mdSelector, new ReferenceProvider(index, perfLog)),
    vscode.languages.registerHoverProvider(
      mdSelector,
      new HoverProvider(
        index,
        vs,
        {
          augmentWithVs: cfg.get<boolean>("hover.augmentWithVs") ?? true,
          vsLimit: 3,
        },
        perfLog,
      ),
    ),
    vscode.languages.registerCompletionItemProvider(
      mdSelector,
      new CompletionProvider(index, perfLog),
      "[",
      "#",
    ),
  );

  // Commands
  registerCommands({
    context: ctx,
    index,
    vs,
    vaultRoot,
    log: (line) => output.appendLine(line),
    perf: perfLog,
  });

  // FS watcher
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vaultRoot, "**/*.md"),
  );
  ctx.subscriptions.push(watcher);
  const update = (uri: vscode.Uri) => {
    const rel = path.relative(vaultRoot, uri.fsPath);
    const tFile = performance.now();
    index
      .updateFile(uri.fsPath)
      .then((r) =>
        perfLog.log("watcher.update", performance.now() - tFile, {
          file: rel,
          ok: r.ok,
          bytes: r.bytes,
          links: r.links,
        }),
      )
      .catch((e) => perfLog.log("watcher.update", performance.now() - tFile, { file: rel }, e));
  };
  const remove = (uri: vscode.Uri) => {
    const t0 = performance.now();
    index.removeFile(uri.fsPath);
    perfLog.log("watcher.delete", performance.now() - t0, {
      file: path.relative(vaultRoot, uri.fsPath),
    });
  };
  watcher.onDidCreate(update);
  watcher.onDidChange(update);
  watcher.onDidDelete(remove);

  // Rename propagation: rewrite wikilinks that resolved to a renamed or moved note
  ctx.subscriptions.push(
    vscode.workspace.onDidRenameFiles(async (e) => {
      const cfgNow = vscode.workspace.getConfiguration("vaultMode");
      if (!(cfgNow.get<boolean>("updateLinksOnRename") ?? true)) return;
      const renames = new Map<string, string>();
      for (const { oldUri, newUri } of e.files) {
        const oldRel = path.relative(vaultRoot, oldUri.fsPath);
        const newRel = path.relative(vaultRoot, newUri.fsPath);
        if (oldUri.fsPath.endsWith(".md") && newUri.fsPath.endsWith(".md")) {
          renames.set(oldRel, newRel);
          continue;
        }
        // Folder move: pair each note under the new folder with its old path.
        const moved = await vscode.workspace.findFiles(
          new vscode.RelativePattern(newUri, "**/*.md"),
        );
        for (const f of moved) {
          const rel = path.relative(vaultRoot, f.fsPath);
          renames.set(path.join(oldRel, path.relative(newRel, rel)), rel);
        }
      }
      if (renames.size === 0) return;

      const rewrite = createRenamer(index.resolver, renames);
      const stems = new Set([...renames.keys()].map((p) => path.basename(p, ".md")));
      const movedAbs = new Map(
        [...renames].map(([from, to]) => [path.join(vaultRoot, from), path.join(vaultRoot, to)]),
      );
      const sources = new Set(
        [...stems].flatMap((s) => index.sourcesLinkingToStem(s)).map((s) => movedAbs.get(s) ?? s),
      );
      const edit = new vscode.WorkspaceEdit();
      let touched = 0;
      for (const src of sources) {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(src));
        const updated = rewrite(doc.getText());
        if (updated === null) continue;
        const full = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
        edit.replace(doc.uri, full, updated);
        touched++;
      }
      if (touched > 0) {
        await vscode.workspace.applyEdit(edit);
        output.appendLine(`rename: updated wikilinks in ${touched} files`);
      }
    }),
  );

  // React to config changes
  ctx.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration("vaultMode")) return;
      const cfg2 = vscode.workspace.getConfiguration("vaultMode");
      perfLog.setEnabled(cfg2.get<boolean>("perfLog") ?? true);
    }),
  );

  output.appendLine(`Vault Mode activated in ${Math.round(performance.now() - t0)}ms`);

  // Return public API: VSCode markdown preview calls extendMarkdownIt to
  // inject our wikilink plugin.
  return {
    extendMarkdownIt(md: MarkdownIt) {
      md.use(calloutPlugin);
      return md.use(wikilinkPlugin, {
        resolve: (target: string, env?: Record<string, unknown>) => {
          if (!globalIndex) return undefined;
          const abs = globalIndex.resolve(target);
          if (!abs) return undefined;
          const doc = env?.currentDocument as vscode.Uri | undefined;
          if (doc?.scheme === "file") return relativeLinkHref(doc.fsPath, abs);
          return vscode.Uri.file(abs).toString();
        },
      });
    },
  };
}

export function deactivate(): void {
  globalIndex = undefined;
}

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
import { computeRenameEdits } from "./renameWikilinks";
import { wikilinkPlugin, calloutPlugin } from "./markdownItPlugin";

let globalIndex: WorkspaceIndex | undefined;
let globalOutput: vscode.OutputChannel | undefined;

export async function activate(ctx: vscode.ExtensionContext) {
  const t0 = performance.now();
  const output = vscode.window.createOutputChannel("Vault Mode");
  globalOutput = output;
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
      output.appendLine(`Index built: ${r.files} files in ${Math.round(r.durationMs)}ms`),
    )
    .catch((e) =>
      output.appendLine(`Index build error: ${e instanceof Error ? e.message : String(e)}`),
    );

  // vs client (optional integration; null when the binary is absent)
  const vsBinary = cfg.get<string>("vsPath") ?? "vs";
  const vsTimeoutMs = cfg.get<number>("vsTimeoutMs") ?? 5000;
  const vs = vsBinaryAvailable(vsBinary)
    ? new VsClient({ binary: vsBinary, timeoutMs: vsTimeoutMs, vaultRoot })
    : null;
  if (!vs)
    output.appendLine(`vs binary '${vsBinary}' not found; semantic-search features disabled.`);

  // Providers
  const mdSelector: vscode.DocumentSelector = { scheme: "file", language: "markdown" };
  ctx.subscriptions.push(
    vscode.languages.registerDefinitionProvider(mdSelector, new DefinitionProvider(index)),
    vscode.languages.registerReferenceProvider(mdSelector, new ReferenceProvider(index)),
    vscode.languages.registerHoverProvider(
      mdSelector,
      new HoverProvider(index, vs, {
        augmentWithVs: cfg.get<boolean>("hover.augmentWithVs") ?? true,
        vsLimit: 3,
      }),
    ),
    vscode.languages.registerCompletionItemProvider(mdSelector, new CompletionProvider(index), "["),
  );

  // Commands
  registerCommands({
    context: ctx,
    index,
    vs,
    vaultRoot,
    log: (line) => output.appendLine(line),
  });

  // FS watcher
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vaultRoot, "**/*.md"),
  );
  ctx.subscriptions.push(watcher);
  const update = (uri: vscode.Uri) =>
    index
      .updateFile(uri.fsPath)
      .catch((e) =>
        output.appendLine(
          `watcher.update ${uri.fsPath} error: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
  const remove = (uri: vscode.Uri) => index.removeFile(uri.fsPath);
  watcher.onDidCreate(update);
  watcher.onDidChange(update);
  watcher.onDidDelete(remove);

  // Rename propagation: when a note's stem changes, rewrite wikilinks that point at it
  ctx.subscriptions.push(
    vscode.workspace.onDidRenameFiles(async (e) => {
      const cfgNow = vscode.workspace.getConfiguration("vaultMode");
      if (!(cfgNow.get<boolean>("updateLinksOnRename") ?? true)) return;
      for (const { oldUri, newUri } of e.files) {
        if (!oldUri.fsPath.endsWith(".md") || !newUri.fsPath.endsWith(".md")) continue;
        const oldStem = path.basename(oldUri.fsPath, ".md");
        const newStem = path.basename(newUri.fsPath, ".md");
        if (oldStem === newStem) continue;
        const sources = index.sourcesLinkingToStem(oldStem);
        if (sources.length === 0) continue;
        const edit = new vscode.WorkspaceEdit();
        let touched = 0;
        for (const src of sources) {
          const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(src));
          const updated = computeRenameEdits(doc.getText(), oldStem, newStem);
          if (updated === null) continue;
          const full = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
          edit.replace(doc.uri, full, updated);
          touched++;
        }
        if (touched > 0) {
          await vscode.workspace.applyEdit(edit);
          output.appendLine(
            `rename ${oldStem} -> ${newStem}: updated wikilinks in ${touched} files`,
          );
        }
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
        resolve: (target: string) => {
          if (!globalIndex) return undefined;
          const abs = globalIndex.resolve(target);
          if (!abs) return undefined;
          // For VSCode preview, return a vscode:// URL via Uri to ensure proper resolution
          return vscode.Uri.file(abs).toString();
        },
      });
    },
  };
}

export function deactivate(): void {
  globalIndex = undefined;
  globalOutput?.dispose();
}

// Vault Light - extension entry point.
//
// On activate: pick the first workspace folder as the vault, build the
// WorkspaceIndex, wire providers/commands/preloader, install a FS watcher.
// Returns an object whose `extendMarkdownIt` is called by VSCode to inject
// the wikilink preview plugin.

import * as vscode from "vscode";
import MarkdownIt from "markdown-it";
import { WorkspaceIndex } from "./workspaceIndex";
import { VscodeFs } from "./services/vscodeFs";
import { VsClient } from "./vsClient";
import { PerfLogger } from "./perfLogger";
import {
  DefinitionProvider,
  HoverProvider,
  CompletionProvider,
  ReferenceProvider,
} from "./providers";
import { NeighborPreloader } from "./neighborPreloader";
import { registerCommands } from "./commands";
import { wikilinkPlugin } from "./markdownItPlugin";

let globalIndex: WorkspaceIndex | undefined;
let globalOutput: vscode.OutputChannel | undefined;

export async function activate(ctx: vscode.ExtensionContext) {
  const t0 = performance.now();
  const output = vscode.window.createOutputChannel("Vault Light");
  globalOutput = output;
  ctx.subscriptions.push(output);

  const cfg = vscode.workspace.getConfiguration("vaultLight");
  const perfLog = new PerfLogger(
    (line) => output.appendLine(line),
    { enabled: cfg.get<boolean>("perfLog") ?? true },
  );

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    output.appendLine("No workspace folder; Vault Light idle.");
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
    .then((r) => output.appendLine(`Index built: ${r.files} files in ${Math.round(r.durationMs)}ms`))
    .catch((e) => output.appendLine(`Index build error: ${e instanceof Error ? e.message : String(e)}`));

  // vs client
  const vsBinary = cfg.get<string>("vsPath") ?? "vs";
  const vsTimeoutMs = cfg.get<number>("vsTimeoutMs") ?? 5000;
  const vs = new VsClient({ binary: vsBinary, timeoutMs: vsTimeoutMs, vaultRoot });

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

  // Preloader
  const preloader = new NeighborPreloader(
    index,
    {
      enabled: cfg.get<boolean>("copilotBooster.enabled") ?? false,
      maxNeighbors: cfg.get<number>("copilotBooster.maxNeighbors") ?? 5,
      depth: cfg.get<number>("copilotBooster.depth") ?? 1,
    },
    (line) => output.appendLine(line),
  );
  ctx.subscriptions.push(preloader);

  // Commands
  registerCommands({
    context: ctx,
    index,
    vs,
    preloader,
    vaultRoot,
    log: (line) => output.appendLine(line),
  });

  // FS watcher
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vaultRoot, "**/*.md"),
  );
  ctx.subscriptions.push(watcher);
  const update = (uri: vscode.Uri) =>
    index.updateFile(uri.fsPath).catch((e) =>
      output.appendLine(`watcher.update ${uri.fsPath} error: ${e instanceof Error ? e.message : String(e)}`),
    );
  const remove = (uri: vscode.Uri) => index.removeFile(uri.fsPath);
  watcher.onDidCreate(update);
  watcher.onDidChange(update);
  watcher.onDidDelete(remove);

  // React to config changes
  ctx.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration("vaultLight")) return;
      const cfg2 = vscode.workspace.getConfiguration("vaultLight");
      perfLog.setEnabled(cfg2.get<boolean>("perfLog") ?? true);
      preloader.setOptions({
        enabled: cfg2.get<boolean>("copilotBooster.enabled") ?? false,
        maxNeighbors: cfg2.get<number>("copilotBooster.maxNeighbors") ?? 5,
        depth: cfg2.get<number>("copilotBooster.depth") ?? 1,
      });
    }),
  );

  output.appendLine(`Vault Light activated in ${Math.round(performance.now() - t0)}ms`);

  // Return public API: VSCode markdown preview calls extendMarkdownIt to
  // inject our wikilink plugin.
  return {
    extendMarkdownIt(md: MarkdownIt) {
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

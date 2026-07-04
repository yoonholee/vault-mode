// All commands. Each is a thin glue layer over a service + VSCode UI calls.

import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import type { WorkspaceIndex } from "./workspaceIndex";
import type { VsClient } from "./vsClient";
import type { NeighborPreloader } from "./neighborPreloader";
import { dailyNotePath, renderDailyNoteTemplate } from "./dailyNote";
import { generateCopilotInstructions } from "./copilotInstructionsGen";

export interface CommandDeps {
  context: vscode.ExtensionContext;
  index: WorkspaceIndex;
  vs: VsClient | null;
  preloader: NeighborPreloader;
  vaultRoot: string;
  log: (line: string) => void;
}

export function registerCommands(deps: CommandDeps): void {
  const { context } = deps;
  const r = (cmd: string, handler: (...args: unknown[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(cmd, handler));

  r("vaultLight.semanticSearch", () => semanticSearch(deps));
  r("vaultLight.insertWikilink", () => insertWikilink(deps));
  r("vaultLight.relatedNotes", () => relatedNotes(deps));
  r("vaultLight.openDailyNote", () => openDailyNote(deps));
  r("vaultLight.openRandomNote", () => openRandomNote(deps));
  r("vaultLight.regenerateCopilotInstructions", () => regenerateCopilotInstructions(deps));
  r("vaultLight.preloadNeighbors", () => {
    const ed = vscode.window.activeTextEditor;
    if (ed) return deps.preloader.maybePreload(ed);
    return undefined;
  });
  r("vaultLight.previewToSide", () => vscode.commands.executeCommand("markdown.showPreviewToSide"));
  r("vaultLight.rebuildIndex", async () => {
    const cfg = vscode.workspace.getConfiguration("vaultLight");
    const patterns = cfg.get<string[]>("ignorePatterns") ?? [];
    const r = await deps.index.buildAll(patterns);
    deps.log(`rebuildIndex  ${r.durationMs}ms  files=${r.files}`);
    vscode.window.showInformationMessage(
      `Vault Light: indexed ${r.files} files in ${Math.round(r.durationMs)}ms`,
    );
  });
}

async function semanticSearch(deps: CommandDeps): Promise<void> {
  if (!deps.vs) {
    vscode.window.showInformationMessage(
      "Vault Light: this command needs the optional `vs` semantic-search CLI (not found on PATH). See the README's vs section.",
    );
    return;
  }
  const query = await vscode.window.showInputBox({
    prompt: "Vault semantic search",
    placeHolder: "query",
  });
  if (!query) return;
  const t0 = performance.now();
  try {
    const results = await deps.vs.search(query, { limit: 20 });
    deps.log(
      `semanticSearch '${query.slice(0, 40)}'  ${Math.round(performance.now() - t0)}ms  hits=${results.length}`,
    );
    if (results.length === 0) {
      vscode.window.showInformationMessage("No results.");
      return;
    }
    const pick = await vscode.window.showQuickPick(
      results.map((p) => ({
        label: path.basename(p, ".md"),
        description: path.relative(deps.vaultRoot, p),
        absPath: p,
      })),
      { matchOnDescription: true, placeHolder: `${results.length} results` },
    );
    if (pick) await vscode.window.showTextDocument(vscode.Uri.file(pick.absPath));
  } catch (e) {
    vscode.window.showErrorMessage(`vs error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function insertWikilink(deps: CommandDeps): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  if (!deps.vs) {
    // Fallback: list all stems
    const stems = deps.index.allStems().sort();
    const pick = await vscode.window.showQuickPick(stems, { placeHolder: "Insert wikilink" });
    if (pick) editor.edit((eb) => eb.insert(editor.selection.active, `[[${pick}]]`));
    return;
  }

  const query = await vscode.window.showInputBox({
    prompt: "Insert wikilink (vs search)",
    placeHolder: "query",
  });
  if (!query) return;
  try {
    const results = await deps.vs.search(query, { limit: 20 });
    const pick = await vscode.window.showQuickPick(
      results.map((p) => ({
        label: path.basename(p, ".md"),
        description: path.relative(deps.vaultRoot, p),
        stem: path.basename(p, ".md"),
      })),
      { matchOnDescription: true },
    );
    if (pick) {
      await editor.edit((eb) => eb.insert(editor.selection.active, `[[${pick.stem}]]`));
    }
  } catch (e) {
    vscode.window.showErrorMessage(`vs error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function relatedNotes(deps: CommandDeps): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  if (!deps.vs) {
    vscode.window.showInformationMessage(
      "Vault Light: this command needs the optional `vs` semantic-search CLI (not found on PATH). See the README's vs section.",
    );
    return;
  }
  const stem = path.basename(editor.document.uri.fsPath, ".md");
  try {
    const results = await deps.vs.search(stem, { limit: 10 });
    const filtered = results.filter((p) => p !== editor.document.uri.fsPath);
    const pick = await vscode.window.showQuickPick(
      filtered.map((p) => ({
        label: path.basename(p, ".md"),
        description: path.relative(deps.vaultRoot, p),
        absPath: p,
      })),
      { matchOnDescription: true, placeHolder: `${filtered.length} related notes` },
    );
    if (pick) await vscode.window.showTextDocument(vscode.Uri.file(pick.absPath));
  } catch (e) {
    vscode.window.showErrorMessage(`vs error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function openDailyNote(deps: CommandDeps): Promise<void> {
  const cfg = vscode.workspace.getConfiguration("vaultLight");
  const folder = cfg.get<string>("dailyNotesFolder") ?? "Daily";
  const template = cfg.get<string>("dailyNoteTemplate") ?? "# {date}\n\n";
  const now = new Date();
  const filePath = dailyNotePath(deps.vaultRoot, folder, now);
  if (!fsSync.existsSync(filePath)) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, renderDailyNoteTemplate(template, now), "utf8");
    deps.log(`openDailyNote create ${filePath}`);
  }
  await vscode.window.showTextDocument(vscode.Uri.file(filePath));
}

async function openRandomNote(deps: CommandDeps): Promise<void> {
  const stems = deps.index.allStems();
  if (stems.length === 0) {
    vscode.window.showInformationMessage("Index empty.");
    return;
  }
  const stem = stems[Math.floor(Math.random() * stems.length)];
  const target = deps.index.resolve(stem);
  if (target) await vscode.window.showTextDocument(vscode.Uri.file(target));
}

async function regenerateCopilotInstructions(deps: CommandDeps): Promise<void> {
  const claudeMdPath = path.join(deps.vaultRoot, "CLAUDE.md");
  let claudeMd: string | undefined;
  try {
    claudeMd = await fs.readFile(claudeMdPath, "utf8");
  } catch {
    claudeMd = undefined;
  }
  const entries = await fs.readdir(deps.vaultRoot, { withFileTypes: true });
  const topLevelDirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
    .map((e) => e.name)
    .sort();
  const out = generateCopilotInstructions({
    vaultName: path.basename(deps.vaultRoot),
    topLevelDirs,
    claudeMd,
  });
  const outDir = path.join(deps.vaultRoot, ".github");
  const outFile = path.join(outDir, "copilot-instructions.md");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outFile, out, "utf8");
  vscode.window.showInformationMessage(`Wrote ${path.relative(deps.vaultRoot, outFile)}`);
  await vscode.window.showTextDocument(vscode.Uri.file(outFile));
}

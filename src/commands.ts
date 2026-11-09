// All commands. Each is a thin glue layer over a service + VSCode UI calls.

import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import type { WorkspaceIndex } from "./workspaceIndex";
import type { VsClient } from "./vsClient";
import type { PerfLogger } from "./perfLogger";
import { findAmbiguousLinks, pinnedLinkText } from "./ambiguousLinks";
import { dailyNotePath, renderDailyNoteTemplate } from "./dailyNote";

export interface CommandDeps {
  context: vscode.ExtensionContext;
  index: WorkspaceIndex;
  vs: VsClient | null;
  vaultRoot: string;
  log: (line: string) => void;
  perf: PerfLogger;
}

export function registerCommands(deps: CommandDeps): void {
  const { context } = deps;
  const r = (cmd: string, handler: (...args: unknown[]) => unknown) =>
    context.subscriptions.push(
      vscode.commands.registerCommand(cmd, (...args: unknown[]) =>
        deps.perf.time(`command.${cmd.replace("vaultMode.", "")}`, () =>
          Promise.resolve(handler(...args)),
        ),
      ),
    );

  r("vaultMode.semanticSearch", () => semanticSearch(deps));
  r("vaultMode.insertWikilink", () => insertWikilink(deps));
  r("vaultMode.relatedNotes", () => relatedNotes(deps));
  r("vaultMode.openDailyNote", () => openDailyNote(deps));
  r("vaultMode.openRandomNote", () => openRandomNote(deps));
  r("vaultMode.showAmbiguousLinks", () => showAmbiguousLinks(deps));
  r("vaultMode.previewToSide", () => vscode.commands.executeCommand("markdown.showPreviewToSide"));
  r("vaultMode.rebuildIndex", async () => {
    const cfg = vscode.workspace.getConfiguration("vaultMode");
    const patterns = cfg.get<string[]>("ignorePatterns") ?? [];
    const r = await deps.index.buildAll(patterns);
    deps.log(
      `rebuildIndex files=${r.files} bytes=${r.bytes} links=${r.links} readErrors=${r.readErrors} list=${Math.round(r.listMs)}ms parse=${Math.round(r.parseMs)}ms total=${Math.round(r.durationMs)}ms`,
    );
    vscode.window.showInformationMessage(
      `Vault Mode: indexed ${r.files} files in ${Math.round(r.durationMs)}ms`,
    );
  });
}

async function semanticSearch(deps: CommandDeps): Promise<void> {
  if (!deps.vs) {
    vscode.window.showInformationMessage(
      "Vault Mode: this command needs the optional `vs` semantic-search CLI (not found on PATH). See the README's vs section.",
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
    if (pick) await editor.edit((eb) => eb.insert(editor.selection.active, `[[${pick}]]`));
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
      "Vault Mode: this command needs the optional `vs` semantic-search CLI (not found on PATH). See the README's vs section.",
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
  const cfg = vscode.workspace.getConfiguration("vaultMode");
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

interface AmbiguousPick extends vscode.QuickPickItem {
  relPath?: string;
  /** Set when picking should rewrite this link range in the editor. */
  link?: ReturnType<typeof findAmbiguousLinks>[number]["link"];
}

async function showAmbiguousLinks(deps: CommandDeps): Promise<void> {
  const { resolver } = deps.index;
  const editor = vscode.window.activeTextEditor;
  const items: AmbiguousPick[] = [];
  const separator = (label: string): AmbiguousPick => ({
    label,
    kind: vscode.QuickPickItemKind.Separator,
  });

  if (editor) {
    for (const { link, candidates } of findAmbiguousLinks(editor.document.getText(), resolver)) {
      items.push(separator(`line ${link.line + 1}: [[${link.target}]]`));
      for (const relPath of candidates.sort()) items.push({ label: relPath, relPath, link });
    }
  } else {
    for (const [stem, paths] of resolver.ambiguousStems()) {
      items.push(separator(stem));
      for (const relPath of paths.sort()) items.push({ label: relPath, relPath });
    }
  }
  if (items.length === 0) {
    vscode.window.showInformationMessage(
      editor ? "Vault Mode: no ambiguous links in this note." : "Vault Mode: no ambiguous stems.",
    );
    return;
  }

  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: editor ? "Pick the note this link should point to" : "Notes sharing a name",
  });
  if (!pick?.relPath) return;
  if (!editor || !pick.link) {
    await vscode.window.showTextDocument(vscode.Uri.file(path.join(deps.vaultRoot, pick.relPath)));
    return;
  }
  const { link } = pick;
  const range = new vscode.Range(
    editor.document.positionAt(link.range.start),
    editor.document.positionAt(link.range.end),
  );
  await editor.edit((eb) => eb.replace(range, pinnedLinkText(link, pick.relPath!, resolver)));
}

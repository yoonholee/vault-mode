// Loads wikilink neighbors of the active markdown file into VSCode's document
// cache (workspace.textDocuments) so they're available as context.
//
// Uses workspace.openTextDocument (silent, no tab, no focus change) rather
// than showTextDocument. Whether this actually feeds Copilot's inline-
// completion context is UNVERIFIED: Copilot's neighboring-tabs heuristic
// may key off window.tabGroups instead. This feature is opt-in (default off)
// until we measure benefit. See SPEC.md open questions.
//
// Dedupe: a file's neighbors are only preloaded once per extension session
// per active file. Switching between two known files does no work.

import * as vscode from "vscode";
import type { WorkspaceIndex } from "./workspaceIndex";
import { selectNeighborsToPreload } from "./neighborSelector";

export interface NeighborPreloaderOptions {
  enabled: boolean;
  maxNeighbors: number;
  depth: number; // not yet used; reserved for v0.2
}

export class NeighborPreloader implements vscode.Disposable {
  private disposable: vscode.Disposable;
  private opts: NeighborPreloaderOptions;
  private preloadedFor = new Set<string>();

  constructor(
    private index: WorkspaceIndex,
    opts: NeighborPreloaderOptions,
    private log: (line: string) => void,
  ) {
    this.opts = opts;
    this.disposable = vscode.window.onDidChangeActiveTextEditor((ed) => {
      if (ed) {
        // Fire-and-forget; never await on a UI event handler
        void this.maybePreload(ed);
      }
    });
  }

  setOptions(opts: NeighborPreloaderOptions) {
    this.opts = opts;
    // If user just disabled, no need to clear cache; if enabled, start fresh
    // so a manual command re-runs.
  }

  /** Forget the dedupe set; the next preload for any file will rerun. */
  resetCache(): void {
    this.preloadedFor.clear();
  }

  async maybePreload(editor: vscode.TextEditor) {
    if (!this.opts.enabled) return;
    if (editor.document.languageId !== "markdown") return;
    if (editor.document.uri.scheme !== "file") return;

    const activeFile = editor.document.uri.fsPath;
    if (this.preloadedFor.has(activeFile)) return;
    this.preloadedFor.add(activeFile);

    const t0 = performance.now();
    const outgoing = this.index.outgoingLinks(activeFile);
    if (outgoing.length === 0) return;

    const neighbors = selectNeighborsToPreload({
      activeFile,
      outgoing,
      resolve: (t) => this.index.resolve(t),
      maxNeighbors: this.opts.maxNeighbors,
      activeFileExclusionEnabled: true,
    });
    if (neighbors.length === 0) return;

    // Load each neighbor SILENTLY into workspace.textDocuments. No tabs
    // open, no focus change, no UI flicker. Documents become available
    // via vscode.workspace.textDocuments.
    let loaded = 0;
    const results = await Promise.allSettled(
      neighbors.map((n) => vscode.workspace.openTextDocument(vscode.Uri.file(n))),
    );
    for (const r of results) if (r.status === "fulfilled") loaded++;

    this.log(
      `preload  ${Math.round(performance.now() - t0)}ms  loaded=${loaded}/${neighbors.length}  silent`,
    );
  }

  dispose() {
    this.disposable.dispose();
  }
}

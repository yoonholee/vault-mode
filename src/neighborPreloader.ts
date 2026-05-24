// Listens for active-editor changes. When the user opens a markdown file,
// opens its wikilink neighbors as preview tabs so Copilot reads them.

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

  constructor(
    private index: WorkspaceIndex,
    opts: NeighborPreloaderOptions,
    private log: (line: string) => void,
  ) {
    this.opts = opts;
    this.disposable = vscode.window.onDidChangeActiveTextEditor((ed) => {
      if (ed) this.maybePreload(ed);
    });
  }

  setOptions(opts: NeighborPreloaderOptions) {
    this.opts = opts;
  }

  async maybePreload(editor: vscode.TextEditor) {
    if (!this.opts.enabled) return;
    if (editor.document.languageId !== "markdown") return;
    if (editor.document.uri.scheme !== "file") return;

    const t0 = performance.now();
    const activeFile = editor.document.uri.fsPath;
    const outgoing = this.index.outgoingLinks(activeFile);
    if (outgoing.length === 0) return;

    const neighbors = selectNeighborsToPreload({
      activeFile,
      outgoing,
      resolve: (t) => this.index.resolve(t),
      maxNeighbors: this.opts.maxNeighbors,
      activeFileExclusionEnabled: true,
    });

    let opened = 0;
    for (const n of neighbors) {
      try {
        // preview: true makes the tab "italicized" (auto-replacing) so we
        // don't permanently clutter the workspace.
        await vscode.window.showTextDocument(vscode.Uri.file(n), {
          preview: true,
          preserveFocus: true,
          viewColumn: vscode.ViewColumn.Beside,
        });
        opened++;
      } catch {
        // ignore
      }
    }
    // Refocus original editor
    try {
      await vscode.window.showTextDocument(editor.document, {
        preview: false,
        preserveFocus: false,
        viewColumn: editor.viewColumn ?? vscode.ViewColumn.One,
      });
    } catch {
      // ignore
    }
    this.log(`preload neighbors  ${Math.round(performance.now() - t0)}ms  opened=${opened}`);
  }

  dispose() {
    this.disposable.dispose();
  }
}

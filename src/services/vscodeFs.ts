// FileSystem impl backed by VSCode's workspace API. Honors workspace excludes
// in addition to the explicit ignorePatterns passed to listFiles.

import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import type { FileSystem } from "../workspaceIndex";

export class VscodeFs implements FileSystem {
  constructor(private readonly root: string) {}

  async listFiles(_root: string, ignorePatterns: string[]): Promise<string[]> {
    // We use VSCode's findFiles for ignore-glob handling; pass include = **/*.md
    // and exclude = our patterns joined with VSCode's defaults.
    const exclude = ignorePatterns.length > 0 ? `{${ignorePatterns.join(",")}}` : null;
    const uris = await vscode.workspace.findFiles(
      new vscode.RelativePattern(this.root, "**/*.md"),
      exclude,
    );
    return uris.map((u) => u.fsPath);
  }

  async readFile(absPath: string): Promise<string> {
    return fs.readFile(absPath, "utf8");
  }
}

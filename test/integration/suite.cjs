// Runs inside the extension host. Asserts activation, command registration,
// index build, and rename propagation against the temp vault.
const assert = require("node:assert");
const path = require("node:path");
const vscode = require("vscode");

exports.run = async function run() {
  const ext = vscode.extensions.getExtension("yoonholee.vault-mode");
  assert.ok(ext, "extension not found in host");
  await ext.activate();
  assert.ok(ext.isActive, "extension failed to activate");

  const commands = await vscode.commands.getCommands(true);
  for (const cmd of [
    "vaultMode.semanticSearch",
    "vaultMode.openDailyNote",
    "vaultMode.previewToSide",
    "vaultMode.rebuildIndex",
  ]) {
    assert.ok(commands.includes(cmd), `command missing: ${cmd}`);
  }

  // Index built: definition provider resolves [[Beta]] from Alpha.md
  const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const alpha = vscode.Uri.file(path.join(root, "Alpha.md"));
  const doc = await vscode.workspace.openTextDocument(alpha);
  await vscode.commands.executeCommand("vaultMode.rebuildIndex"); // deterministic: no race with background build
  const pos = doc.positionAt(doc.getText().indexOf("Beta"));
  const defs = await vscode.commands.executeCommand("vscode.executeDefinitionProvider", alpha, pos);
  assert.ok(
    defs && defs.length === 1,
    `expected 1 definition for [[Beta]], got ${defs && defs.length}`,
  );
  assert.ok(defs[0].uri.fsPath.endsWith("Beta.md"), `definition points at ${defs[0].uri.fsPath}`);

  // Rename propagation: Beta -> Gamma rewrites Alpha.md.
  // Rename via WorkspaceEdit: onDidRenameFiles fires for explorer/applyEdit
  // renames, not workspace.fs.rename (fs-level ops are documented as excluded).
  const renameEdit = new vscode.WorkspaceEdit();
  renameEdit.renameFile(
    vscode.Uri.file(path.join(root, "Beta.md")),
    vscode.Uri.file(path.join(root, "Gamma.md")),
  );
  const applied = await vscode.workspace.applyEdit(renameEdit);
  assert.ok(applied, "rename edit not applied");
  await new Promise((r) => setTimeout(r, 1500)); // listener + workspace edit settle
  const alphaText = (await vscode.workspace.openTextDocument(alpha)).getText();
  assert.ok(alphaText.includes("[[Gamma]]"), `Alpha.md not rewritten: ${alphaText}`);
  assert.ok(!alphaText.includes("[[Beta]]"), "old link still present after rename");

  console.log("integration suite: all assertions passed");
};

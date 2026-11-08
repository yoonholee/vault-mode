// Launches a real VS Code extension host against a temp vault and runs suite.cjs.
import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDevelopmentPath = path.resolve(__dirname, "..", "..");

// Temp vault fixture
const vault = fs.mkdtempSync(path.join(os.tmpdir(), "vault-mode-itest-"));
fs.writeFileSync(path.join(vault, "Alpha.md"), "Links to [[Beta]] and [[Missing]].\n");
fs.writeFileSync(
  path.join(vault, "Beta.md"),
  [
    "---",
    "aliases:",
    "  - Second Note",
    "---",
    "# Beta",
    "> [!note] Title",
    "> body",
    "",
    "## Detailed Result",
    "Back to [[Alpha]].",
    "",
  ].join("\n"),
);
fs.writeFileSync(path.join(vault, "Completion.md"), "[[second\n");
fs.writeFileSync(path.join(vault, "Heading.md"), "[[Beta#detail\n");

try {
  const downloadedExecutable = await downloadAndUnzipVSCode();
  const vscodeExecutablePath = resolveMacExecutableRename(downloadedExecutable);
  await runTests({
    vscodeExecutablePath,
    extensionDevelopmentPath,
    extensionTestsPath: path.resolve(__dirname, "suite.cjs"),
    launchArgs: [vault, "--disable-extensions", "--disable-workspace-trust"],
  });
} catch (err) {
  console.error("Integration tests failed:", err);
  process.exit(1);
} finally {
  fs.rmSync(vault, { recursive: true, force: true });
}

function resolveMacExecutableRename(executablePath) {
  if (fs.existsSync(executablePath)) return executablePath;
  const renamed = executablePath.replace(/\/Electron$/, "/Code");
  if (renamed !== executablePath && fs.existsSync(renamed)) return renamed;
  throw new Error(`VS Code executable not found: ${executablePath}`);
}

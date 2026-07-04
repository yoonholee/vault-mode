// Generates a .github/copilot-instructions.md describing this vault to Copilot.
// Pure function: takes the inputs, returns the markdown body. The caller writes it to disk.

export interface CopilotInstructionsInput {
  vaultName: string;
  topLevelDirs: string[];
  claudeMd: string | undefined;
}

const MAX_CLAUDE_EXCERPT_BYTES = 8000;

export function generateCopilotInstructions(input: CopilotInstructionsInput): string {
  const { vaultName, topLevelDirs, claudeMd } = input;
  const lines: string[] = [];

  lines.push(`# Copilot instructions for ${vaultName}`);
  lines.push("");
  lines.push(
    "This workspace is an Obsidian-style markdown vault. Apply these conventions when generating or completing markdown content.",
  );
  lines.push("");

  lines.push("## Style");
  lines.push("");
  lines.push("- One sentence per line. No mid-sentence line breaks. Let the editor soft-wrap.");
  lines.push("- Terse, working-notes style. No filler. No press-release verbs.");
  lines.push("- No em-dashes. Use periods, colons, parentheses, or commas instead.");
  lines.push("- Math in LaTeX (`$...$` or `$$...$$`), not Unicode.");
  lines.push("");

  lines.push("## Wikilinks");
  lines.push("");
  lines.push("- Cross-reference other notes with `[[Note Name]]` (basename only, no path).");
  lines.push("- Aliased: `[[Note Name|displayed text]]`.");
  lines.push("- Header anchors: `[[Note Name#Section]]`.");
  lines.push("- Embeds: `![[Note Name]]` (rare).");
  lines.push("- Wikilinks resolve case-insensitively to a file whose basename matches the target.");
  lines.push("");

  if (topLevelDirs.length > 0) {
    lines.push("## Vault layout");
    lines.push("");
    for (const d of topLevelDirs) lines.push(`- \`${d}/\``);
    lines.push("");
  }

  if (claudeMd && claudeMd.trim().length > 0) {
    lines.push("## CLAUDE.md excerpt");
    lines.push("");
    const excerpt =
      claudeMd.length > MAX_CLAUDE_EXCERPT_BYTES
        ? claudeMd.slice(0, MAX_CLAUDE_EXCERPT_BYTES) +
          "\n\n[... truncated for Copilot context budget]"
        : claudeMd;
    lines.push(excerpt.trim());
    lines.push("");
  }

  return lines.join("\n");
}

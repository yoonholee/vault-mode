import { describe, it, expect } from "vitest";
import { generateCopilotInstructions } from "../../src/copilotInstructionsGen";

describe("generateCopilotInstructions", () => {
  it("produces a non-empty markdown document", () => {
    const out = generateCopilotInstructions({
      vaultName: "vault",
      topLevelDirs: ["Concepts", "Reference", "Research"],
      claudeMd: undefined,
    });
    expect(out).toContain("# ");
    expect(out.length).toBeGreaterThan(100);
  });

  it("lists top-level directories", () => {
    const out = generateCopilotInstructions({
      vaultName: "vault",
      topLevelDirs: ["Concepts", "Personal", "Research"],
      claudeMd: undefined,
    });
    expect(out).toContain("Concepts");
    expect(out).toContain("Personal");
    expect(out).toContain("Research");
  });

  it("includes wikilink convention guidance", () => {
    const out = generateCopilotInstructions({
      vaultName: "vault",
      topLevelDirs: [],
      claudeMd: undefined,
    });
    expect(out.toLowerCase()).toContain("wikilink");
    expect(out).toContain("[[");
  });

  it("includes one-sentence-per-line guidance", () => {
    const out = generateCopilotInstructions({
      vaultName: "vault",
      topLevelDirs: [],
      claudeMd: undefined,
    });
    expect(out.toLowerCase()).toContain("one sentence per line");
  });

  it("embeds a CLAUDE.md excerpt when present", () => {
    const out = generateCopilotInstructions({
      vaultName: "vault",
      topLevelDirs: [],
      claudeMd: "# Project rules\n\nUse markdown. Be terse.\n",
    });
    expect(out).toContain("Be terse");
  });

  it("truncates very long CLAUDE.md inputs", () => {
    const huge = "x".repeat(50_000);
    const out = generateCopilotInstructions({
      vaultName: "vault",
      topLevelDirs: [],
      claudeMd: huge,
    });
    // Output should not include the full 50k of x's
    expect(out.length).toBeLessThan(20_000);
  });
});

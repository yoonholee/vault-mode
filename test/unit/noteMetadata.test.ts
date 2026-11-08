import { describe, expect, it } from "vitest";
import { parseNoteMetadata } from "../../src/noteMetadata";

describe("parseNoteMetadata", () => {
  it("extracts canonical casing, frontmatter aliases, and headings", () => {
    const note = parseNoteMetadata(
      "Research/Weights vs. Harnesses.md",
      [
        "---",
        "aliases:",
        '  - "Models vs Harnesses"',
        "  - Weights and Harnesses",
        "---",
        "",
        "# Weights vs. Harnesses",
        "",
        "## Main Result",
      ].join("\n"),
    );

    expect(note).toEqual({
      relPath: "Research/Weights vs. Harnesses.md",
      stem: "Weights vs. Harnesses",
      aliases: ["Models vs Harnesses", "Weights and Harnesses"],
      headings: [
        { text: "Weights vs. Harnesses", level: 1, line: 6 },
        { text: "Main Result", level: 2, line: 8 },
      ],
    });
  });

  it("accepts inline aliases and ignores headings inside fences", () => {
    const note = parseNoteMetadata(
      "Note.md",
      [
        "---",
        'aliases: [Short Name, "Quoted, Alias"]',
        "---",
        "# Real Heading",
        "```markdown",
        "## Not A Heading",
        "```",
        "### Another Heading ###",
      ].join("\n"),
    );

    expect(note.aliases).toEqual(["Short Name", "Quoted, Alias"]);
    expect(note.headings.map((heading) => heading.text)).toEqual([
      "Real Heading",
      "Another Heading",
    ]);
  });
});

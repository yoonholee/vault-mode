import { describe, it, expect } from "vitest";
import { computeRenameEdits } from "../../src/renameWikilinks";

describe("computeRenameEdits", () => {
  it("rewrites a plain wikilink to the new stem", () => {
    expect(computeRenameEdits("see [[Old Note]] here", "Old Note", "New Note")).toBe(
      "see [[New Note]] here",
    );
  });

  it("preserves alias, anchor, and embed syntax", () => {
    const src = "a [[Old|shown]] b [[Old#Sec]] c ![[Old]] d";
    expect(computeRenameEdits(src, "Old", "New")).toBe(
      "a [[New|shown]] b [[New#Sec]] c ![[New]] d",
    );
  });

  it("matches the stem case-insensitively but keeps other links intact", () => {
    const src = "[[old note]] and [[Other]]";
    expect(computeRenameEdits(src, "Old Note", "Fresh")).toBe("[[Fresh]] and [[Other]]");
  });

  it("rewrites the last segment of path-qualified links", () => {
    expect(computeRenameEdits("[[dir/Old]]", "Old", "New")).toBe("[[dir/New]]");
  });

  it("returns null when nothing references the old stem", () => {
    expect(computeRenameEdits("[[Other]] text", "Old", "New")).toBeNull();
  });

  it("does not touch wikilinks inside code fences", () => {
    const src = "```\n[[Old]]\n```\n[[Old]]";
    expect(computeRenameEdits(src, "Old", "New")).toBe("```\n[[Old]]\n```\n[[New]]");
  });

  it("does not rewrite partial-stem matches", () => {
    expect(computeRenameEdits("[[Older]] [[Old Notes]]", "Old", "New")).toBeNull();
  });
});

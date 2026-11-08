import { describe, it, expect } from "vitest";
import { createRenamer } from "../../src/renameWikilinks";
import { Resolver } from "../../src/resolver";

function rename(files: string[], from: string, to: string, source: string): string | null {
  const r = new Resolver();
  for (const f of files) r.add(f);
  return createRenamer(r, new Map([[from, to]]))(source);
}

describe("createRenamer", () => {
  it("rewrites a plain wikilink to the new stem", () => {
    expect(rename(["Old Note.md"], "Old Note.md", "New Note.md", "see [[Old Note]] here")).toBe(
      "see [[New Note]] here",
    );
  });

  it("preserves alias, anchor, and embed syntax", () => {
    const src = "a [[Old|shown]] b [[Old#Sec]] c ![[Old]] d [[Old#H|alias]]";
    expect(rename(["Old.md"], "Old.md", "New.md", src)).toBe(
      "a [[New|shown]] b [[New#Sec]] c ![[New]] d [[New#H|alias]]",
    );
  });

  it("returns null when no link resolves to the renamed file", () => {
    expect(rename(["Old.md", "Other.md"], "Old.md", "New.md", "[[Other]]")).toBeNull();
  });

  it("does not touch wikilinks inside code fences", () => {
    const src = "```\n[[Old]]\n```\n[[Old]]";
    expect(rename(["Old.md"], "Old.md", "New.md", src)).toBe("```\n[[Old]]\n```\n[[New]]");
  });

  it("does not rewrite partial-stem matches", () => {
    expect(
      rename(["Old.md", "Older.md"], "Old.md", "New.md", "[[Older]] [[Old Notes]]"),
    ).toBeNull();
  });

  it("leaves links to a same-named note in another folder alone", () => {
    const files = ["A/Note.md", "B/Note.md"];
    // Bare [[Note]] resolves to A/Note (alphabetical tie-break), so it follows A.
    expect(rename(files, "B/Note.md", "B/Renamed.md", "[[Note]]")).toBeNull();
    expect(rename(files, "A/Note.md", "A/Renamed.md", "[[Note]] [[B/Note]]")).toBe(
      "[[Renamed]] [[B/Note]]",
    );
  });

  it("rewrites a qualified link only when it resolves to the renamed file", () => {
    const files = ["A/Note.md", "B/Note.md"];
    expect(rename(files, "B/Note.md", "B/Renamed.md", "[[A/Note]] [[B/Note]]")).toBe(
      "[[A/Note]] [[Renamed]]",
    );
  });

  it("qualifies the rewritten link when the new name collides", () => {
    const files = ["A/Old.md", "B/Taken.md"];
    expect(rename(files, "A/Old.md", "A/Taken.md", "[[Old]] [[Old|o]]")).toBe(
      "[[A/Taken]] [[A/Taken|o]]",
    );
  });

  it("handles a resolver that already reflects the rename", () => {
    expect(rename(["A/Renamed.md", "B/Note.md"], "A/Note.md", "A/Renamed.md", "[[A/Note]]")).toBe(
      "[[Renamed]]",
    );
  });

  it("rewrites links for a move with an unchanged stem when qualification changes", () => {
    const files = ["A/Note.md", "B/Note.md"];
    expect(rename(files, "A/Note.md", "C/Note.md", "[[A/Note]] [[B/Note]]")).toBe(
      "[[C/Note]] [[B/Note]]",
    );
    expect(rename(["A/Note.md"], "A/Note.md", "C/Note.md", "[[A/Note]]")).toBe("[[Note]]");
  });

  it("handles several renames at once", () => {
    const r = new Resolver();
    for (const f of ["A/X.md", "A/Y.md"]) r.add(f);
    const fn = createRenamer(
      r,
      new Map([
        ["A/X.md", "B/X.md"],
        ["A/Y.md", "B/Y.md"],
      ]),
    );
    expect(fn("[[A/X]] [[Y]]")).toBe("[[X]] [[Y]]");
  });
});

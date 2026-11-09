import { describe, it, expect } from "vitest";
import { findAmbiguousLinks, pinnedLinkText } from "../../src/ambiguousLinks";
import { Resolver } from "../../src/resolver";

function makeResolver(files: string[]): Resolver {
  const r = new Resolver();
  for (const f of files) r.add(f);
  return r;
}

describe("findAmbiguousLinks", () => {
  const r = makeResolver(["A/Note.md", "B/Note.md", "Solo.md"]);

  it("reports a bare link whose stem matches several notes", () => {
    const found = findAmbiguousLinks("see [[Note]] and [[Solo]]", r);
    expect(found).toHaveLength(1);
    expect(found[0].link.target).toBe("Note");
    expect(found[0].candidates.sort()).toEqual(["A/Note.md", "B/Note.md"]);
  });

  it("ignores path-qualified links that match one note", () => {
    expect(findAmbiguousLinks("[[B/Note]]", r)).toEqual([]);
  });

  it("reports a qualified link that still matches several notes", () => {
    const deep = makeResolver(["X/A/Note.md", "Y/A/Note.md"]);
    expect(findAmbiguousLinks("[[A/Note]]", deep)).toHaveLength(1);
  });

  it("ignores links inside code fences and unresolved links", () => {
    expect(findAmbiguousLinks("```\n[[Note]]\n```\n[[Missing]]", r)).toEqual([]);
  });
});

describe("pinnedLinkText", () => {
  const r = makeResolver(["A/Note.md", "B/Note.md"]);
  const link = findAmbiguousLinks("![[note#Sec|shown]]", r)[0].link;

  it("uses the shortest unique target and keeps embed, anchor, alias", () => {
    expect(pinnedLinkText(link, "B/Note.md", r)).toBe("![[B/Note#Sec|shown]]");
  });
});

describe("Resolver.ambiguousStems", () => {
  it("lists only stems shared by several files", () => {
    const r = makeResolver(["A/Note.md", "B/Note.md", "Solo.md"]);
    expect([...r.ambiguousStems().keys()]).toEqual(["note"]);
  });
});

import { describe, it, expect } from "vitest";
import { parseWikilinks } from "../../src/wikilinkParser";

describe("parseWikilinks", () => {
  it("returns empty array for text without wikilinks", () => {
    expect(parseWikilinks("plain markdown text")).toEqual([]);
  });

  it("parses a simple wikilink", () => {
    const links = parseWikilinks("see [[Note Name]] for more");
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      raw: "[[Note Name]]",
      target: "Note Name",
      alias: undefined,
      anchor: undefined,
      embed: false,
      line: 0,
      col: 4,
    });
  });

  it("parses an aliased wikilink", () => {
    const links = parseWikilinks("[[Target|displayed text]]");
    expect(links[0]).toMatchObject({
      target: "Target",
      alias: "displayed text",
      anchor: undefined,
      embed: false,
    });
  });

  it("parses a header-anchored wikilink", () => {
    const links = parseWikilinks("[[Note#Section Heading]]");
    expect(links[0]).toMatchObject({
      target: "Note",
      anchor: "Section Heading",
      alias: undefined,
      embed: false,
    });
  });

  it("parses anchor + alias", () => {
    const links = parseWikilinks("[[Note#H|alias]]");
    expect(links[0]).toMatchObject({
      target: "Note",
      anchor: "H",
      alias: "alias",
      embed: false,
    });
  });

  it("parses an embed", () => {
    const links = parseWikilinks("![[Image]]");
    expect(links[0]).toMatchObject({
      target: "Image",
      embed: true,
    });
  });

  it("parses multiple wikilinks on the same line", () => {
    const links = parseWikilinks("[[A]] then [[B|b]] and [[C#h]]");
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.target)).toEqual(["A", "B", "C"]);
    expect(links[1].alias).toBe("b");
    expect(links[2].anchor).toBe("h");
  });

  it("tracks line numbers correctly", () => {
    const text = "line0\nline1 [[A]]\nline2 [[B]]";
    const links = parseWikilinks(text);
    expect(links[0].line).toBe(1);
    expect(links[1].line).toBe(2);
  });

  it("tracks column positions correctly", () => {
    const links = parseWikilinks("xx [[A]] yy");
    expect(links[0].col).toBe(3);
  });

  it("returns range offsets (start, end) that cover the full [[...]]", () => {
    const text = "see [[A]] now";
    const links = parseWikilinks(text);
    expect(links[0].range.start).toBe(4);
    expect(links[0].range.end).toBe(9);
    expect(text.slice(links[0].range.start, links[0].range.end)).toBe("[[A]]");
  });

  it("range for embed includes the leading !", () => {
    const text = "see ![[A]] now";
    const links = parseWikilinks(text);
    expect(text.slice(links[0].range.start, links[0].range.end)).toBe("![[A]]");
  });

  it("skips wikilinks inside fenced code blocks (triple backtick)", () => {
    const text = "before\n```\n[[InsideCode]]\n```\nafter [[Real]]";
    const links = parseWikilinks(text);
    expect(links).toHaveLength(1);
    expect(links[0].target).toBe("Real");
  });

  it("skips wikilinks inside fenced code blocks with language tag", () => {
    const text = "```typescript\nconst x = [[NotALink]];\n```\n[[YesALink]]";
    const links = parseWikilinks(text);
    expect(links.map((l) => l.target)).toEqual(["YesALink"]);
  });

  it("skips wikilinks inside inline code spans (single backticks)", () => {
    const text = "`[[NotALink]]` and [[Real]]";
    const links = parseWikilinks(text);
    expect(links.map((l) => l.target)).toEqual(["Real"]);
  });

  it("skips wikilinks inside tilde fenced blocks", () => {
    const text = "~~~\n[[Nope]]\n~~~\n[[Yes]]";
    const links = parseWikilinks(text);
    expect(links.map((l) => l.target)).toEqual(["Yes"]);
  });

  it("handles wikilinks with leading/trailing whitespace in inner", () => {
    const links = parseWikilinks("[[ Note ]]");
    expect(links[0].target).toBe("Note");
  });

  it("handles aliased wikilink with whitespace around pipe", () => {
    const links = parseWikilinks("[[Target | Alias]]");
    expect(links[0].target).toBe("Target");
    expect(links[0].alias).toBe("Alias");
  });

  it("ignores empty wikilink [[]]", () => {
    expect(parseWikilinks("[[]]")).toEqual([]);
  });

  it("ignores malformed wikilink [[[X]]", () => {
    // Triple-open is not a valid wikilink; treat conservatively (parse the inner valid one)
    const links = parseWikilinks("[[[X]]");
    // We accept either: 0 links (strict) or 1 link with target "X". Pick strict to avoid false positives.
    // Adjust if real-vault behavior says otherwise.
    expect(links).toHaveLength(0);
  });

  it("does not match a path-prefixed wikilink target as containing slashes", () => {
    const links = parseWikilinks("[[folder/sub/Note]]");
    expect(links[0].target).toBe("folder/sub/Note");
  });

  it("handles unicode in targets", () => {
    const links = parseWikilinks("[[율촌 AI장학금]]");
    expect(links[0].target).toBe("율촌 AI장학금");
  });
});

import { describe, expect, it } from "vitest";
import {
  completionContext,
  rankHeadingCompletions,
  rankNoteCompletions,
} from "../../src/completion";
import type { NoteMetadata } from "../../src/noteMetadata";

function note(
  relPath: string,
  aliases: string[] = [],
  headings: NoteMetadata["headings"] = [],
): NoteMetadata {
  const base = relPath.slice(relPath.lastIndexOf("/") + 1);
  return { relPath, stem: base.replace(/\.md$/i, ""), aliases, headings };
}

describe("rankNoteCompletions", () => {
  it("fuzzy-matches canonical note titles", () => {
    const results = rankNoteCompletions(
      [note("Research/Mentoring Without Resentment.md"), note("Research/Memory.md")],
      "mtr rsnt",
      "Research/Current.md",
    );

    expect(results.map((result) => result.label)).toEqual(["Mentoring Without Resentment"]);
  });

  it("matches aliases but inserts the canonical note title", () => {
    const results = rankNoteCompletions(
      [note("Research/Weights vs Harnesses.md", ["Models vs Harnesses"])],
      "models",
      "Research/Current.md",
    );

    expect(results[0]).toMatchObject({
      label: "Weights vs Harnesses",
      matchedAlias: "Models vs Harnesses",
      insertText: "Weights vs Harnesses",
    });
  });

  it("ranks equally relevant notes in the current folder first", () => {
    const results = rankNoteCompletions(
      [note("Concepts/Agent Design.md"), note("Projects/Agent Memory.md")],
      "agent",
      "Projects/Current.md",
    );

    expect(results.map((result) => result.relPath)).toEqual([
      "Projects/Agent Memory.md",
      "Concepts/Agent Design.md",
    ]);
  });

  it("shows every duplicate title and inserts path-qualified targets", () => {
    const results = rankNoteCompletions(
      [note("Concepts/README.md"), note("Projects/README.md")],
      "readme",
      "Projects/Current.md",
    );

    expect(results.map(({ description, insertText }) => ({ description, insertText }))).toEqual([
      { description: "Projects/README.md", insertText: "Projects/README" },
      { description: "Concepts/README.md", insertText: "Concepts/README" },
    ]);
  });

  it("matches an explicitly typed path", () => {
    const results = rankNoteCompletions(
      [note("Concepts/README.md"), note("Projects/README.md")],
      "projects/read",
      "Ideas/Current.md",
    );

    expect(results.map((result) => result.insertText)).toEqual(["Projects/README"]);
  });

  it("does not let folder locality manufacture a textual match", () => {
    const results = rankNoteCompletions(
      [note("Projects/Completely Different.md")],
      "zzzz",
      "Projects/Current.md",
    );

    expect(results).toEqual([]);
  });
});

describe("heading completion", () => {
  const target = note(
    "Research/Weights vs Harnesses.md",
    [],
    [
      { text: "Main Result", level: 2, line: 12 },
      { text: "Matched Controls", level: 3, line: 24 },
    ],
  );

  it("fuzzy-matches headings after the anchor separator", () => {
    expect(rankHeadingCompletions(target, "mtch ctrl")).toEqual([
      { label: "Matched Controls", insertText: "Matched Controls", level: 3, line: 24 },
    ]);
  });

  it("parses note and heading completion contexts", () => {
    expect(completionContext("See [[model")).toEqual({
      kind: "note",
      query: "model",
      replaceStart: 6,
    });
    expect(completionContext("See [[Weights vs Harnesses#match")).toEqual({
      kind: "heading",
      target: "Weights vs Harnesses",
      query: "match",
      replaceStart: 27,
    });
    expect(completionContext("Closed [[Note]] text")).toBeUndefined();
  });
});

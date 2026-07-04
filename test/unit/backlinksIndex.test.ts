import { describe, it, expect } from "vitest";
import { BacklinksIndex } from "../../src/backlinksIndex";

describe("BacklinksIndex", () => {
  it("returns empty array for unknown target", () => {
    const idx = new BacklinksIndex();
    expect(idx.backlinks("Foo")).toEqual([]);
  });

  it("records a backlink", () => {
    const idx = new BacklinksIndex();
    idx.recordOutgoing("A.md", [{ target: "B", line: 5, col: 0 }]);
    expect(idx.backlinks("B")).toEqual([{ source: "A.md", line: 5, col: 0 }]);
  });

  it("records multiple backlinks to the same target", () => {
    const idx = new BacklinksIndex();
    idx.recordOutgoing("A.md", [{ target: "B", line: 1, col: 0 }]);
    idx.recordOutgoing("C.md", [{ target: "B", line: 2, col: 0 }]);
    expect(idx.backlinks("B")).toHaveLength(2);
    expect(
      idx
        .backlinks("B")
        .map((b) => b.source)
        .sort(),
    ).toEqual(["A.md", "C.md"]);
  });

  it("treats backlink target as case-insensitive", () => {
    const idx = new BacklinksIndex();
    idx.recordOutgoing("A.md", [{ target: "Foo", line: 0, col: 0 }]);
    expect(idx.backlinks("foo")).toHaveLength(1);
    expect(idx.backlinks("FOO")).toHaveLength(1);
  });

  it("replaces all outgoing links from a source when re-recorded", () => {
    const idx = new BacklinksIndex();
    idx.recordOutgoing("A.md", [
      { target: "X", line: 0, col: 0 },
      { target: "Y", line: 1, col: 0 },
    ]);
    expect(idx.backlinks("X")).toHaveLength(1);
    expect(idx.backlinks("Y")).toHaveLength(1);

    // Re-record: A.md no longer links to X, now links to Z
    idx.recordOutgoing("A.md", [
      { target: "Y", line: 1, col: 0 },
      { target: "Z", line: 2, col: 0 },
    ]);
    expect(idx.backlinks("X")).toHaveLength(0);
    expect(idx.backlinks("Y")).toHaveLength(1);
    expect(idx.backlinks("Z")).toHaveLength(1);
  });

  it("clears all backlinks from a source on removeSource", () => {
    const idx = new BacklinksIndex();
    idx.recordOutgoing("A.md", [
      { target: "X", line: 0, col: 0 },
      { target: "Y", line: 1, col: 0 },
    ]);
    idx.removeSource("A.md");
    expect(idx.backlinks("X")).toEqual([]);
    expect(idx.backlinks("Y")).toEqual([]);
  });

  it("preserves backlinks from other sources after removeSource", () => {
    const idx = new BacklinksIndex();
    idx.recordOutgoing("A.md", [{ target: "B", line: 0, col: 0 }]);
    idx.recordOutgoing("C.md", [{ target: "B", line: 0, col: 0 }]);
    idx.removeSource("A.md");
    expect(idx.backlinks("B")).toHaveLength(1);
    expect(idx.backlinks("B")[0].source).toBe("C.md");
  });

  it("dedupes multiple links from the same source on the same line", () => {
    // Edge case: A.md has [[B]] [[B]] on the same line. We want both recorded
    // because each is a real syntactic reference and may sit at different columns.
    const idx = new BacklinksIndex();
    idx.recordOutgoing("A.md", [
      { target: "B", line: 0, col: 0 },
      { target: "B", line: 0, col: 10 },
    ]);
    expect(idx.backlinks("B")).toHaveLength(2);
  });
});

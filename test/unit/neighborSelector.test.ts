import { describe, it, expect } from "vitest";
import { selectNeighborsToPreload } from "../../src/neighborSelector";

describe("selectNeighborsToPreload", () => {
  it("returns resolved paths for outgoing links", () => {
    const out = selectNeighborsToPreload({
      activeFile: "/vault/A.md",
      outgoing: [
        { target: "B", line: 0, col: 0 },
        { target: "C", line: 1, col: 0 },
      ],
      resolve: (t) => ({ B: "/vault/B.md", C: "/vault/C.md" })[t] ?? undefined,
      maxNeighbors: 10,
      activeFileExclusionEnabled: true,
    });
    expect(out.sort()).toEqual(["/vault/B.md", "/vault/C.md"]);
  });

  it("dedupes when the same target appears multiple times", () => {
    const out = selectNeighborsToPreload({
      activeFile: "/vault/A.md",
      outgoing: [
        { target: "B", line: 0, col: 0 },
        { target: "B", line: 1, col: 0 },
      ],
      resolve: () => "/vault/B.md",
      maxNeighbors: 10,
      activeFileExclusionEnabled: true,
    });
    expect(out).toEqual(["/vault/B.md"]);
  });

  it("excludes the active file from its own neighbors", () => {
    const out = selectNeighborsToPreload({
      activeFile: "/vault/A.md",
      outgoing: [
        { target: "A", line: 0, col: 0 },
        { target: "B", line: 1, col: 0 },
      ],
      resolve: (t) => ({ A: "/vault/A.md", B: "/vault/B.md" })[t] ?? undefined,
      maxNeighbors: 10,
      activeFileExclusionEnabled: true,
    });
    expect(out).toEqual(["/vault/B.md"]);
  });

  it("respects maxNeighbors cap", () => {
    const out = selectNeighborsToPreload({
      activeFile: "/vault/A.md",
      outgoing: [
        { target: "B", line: 0, col: 0 },
        { target: "C", line: 1, col: 0 },
        { target: "D", line: 2, col: 0 },
      ],
      resolve: (t) => `/vault/${t}.md`,
      maxNeighbors: 2,
      activeFileExclusionEnabled: true,
    });
    expect(out).toHaveLength(2);
  });

  it("preserves source order when capping", () => {
    const out = selectNeighborsToPreload({
      activeFile: "/vault/A.md",
      outgoing: [
        { target: "first", line: 0, col: 0 },
        { target: "second", line: 1, col: 0 },
        { target: "third", line: 2, col: 0 },
      ],
      resolve: (t) => `/vault/${t}.md`,
      maxNeighbors: 2,
      activeFileExclusionEnabled: true,
    });
    expect(out).toEqual(["/vault/first.md", "/vault/second.md"]);
  });

  it("skips unresolved targets", () => {
    const out = selectNeighborsToPreload({
      activeFile: "/vault/A.md",
      outgoing: [
        { target: "Real", line: 0, col: 0 },
        { target: "Missing", line: 1, col: 0 },
      ],
      resolve: (t) => (t === "Real" ? "/vault/Real.md" : undefined),
      maxNeighbors: 10,
      activeFileExclusionEnabled: true,
    });
    expect(out).toEqual(["/vault/Real.md"]);
  });
});

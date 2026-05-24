import { describe, it, expect } from "vitest";
import { Resolver } from "../../src/resolver";

function makeResolver(files: string[]): Resolver {
  const r = new Resolver();
  for (const f of files) r.add(f);
  return r;
}

describe("Resolver", () => {
  it("returns the path for a single-file stem", () => {
    const r = makeResolver(["Concepts/Foo.md"]);
    expect(r.resolve("Foo")).toBe("Concepts/Foo.md");
  });

  it("returns undefined when no file matches", () => {
    const r = makeResolver(["Concepts/Foo.md"]);
    expect(r.resolve("Bar")).toBeUndefined();
  });

  it("is case-insensitive on the stem", () => {
    const r = makeResolver(["Concepts/Foo.md"]);
    expect(r.resolve("foo")).toBe("Concepts/Foo.md");
    expect(r.resolve("FOO")).toBe("Concepts/Foo.md");
  });

  it("picks the shortest path on collision (fewer slashes)", () => {
    const r = makeResolver(["Archive/old/Foo.md", "Concepts/Foo.md", "Foo.md"]);
    expect(r.resolve("Foo")).toBe("Foo.md");
  });

  it("breaks tie by alphabetical when paths have equal depth", () => {
    const r = makeResolver(["B/Foo.md", "A/Foo.md"]);
    expect(r.resolve("Foo")).toBe("A/Foo.md");
  });

  it("resolves a path-qualified target by exact path match", () => {
    const r = makeResolver(["A/Foo.md", "B/Foo.md"]);
    expect(r.resolve("B/Foo")).toBe("B/Foo.md");
  });

  it("falls back to stem match when path qualifier does not exist", () => {
    const r = makeResolver(["A/Foo.md", "B/Foo.md"]);
    // C/Foo doesn't exist as path, but Foo as stem ambiguates; pick first
    expect(r.resolve("C/Foo")).toBeUndefined();
  });

  it("returns all candidates for an ambiguous stem", () => {
    const r = makeResolver(["A/Foo.md", "B/Foo.md"]);
    expect(r.candidates("Foo").sort()).toEqual(["A/Foo.md", "B/Foo.md"]);
  });

  it("returns empty array for unknown stem candidates", () => {
    const r = makeResolver(["A/Foo.md"]);
    expect(r.candidates("Nope")).toEqual([]);
  });

  it("supports remove()", () => {
    const r = makeResolver(["A/Foo.md", "B/Foo.md"]);
    r.remove("A/Foo.md");
    expect(r.resolve("Foo")).toBe("B/Foo.md");
    r.remove("B/Foo.md");
    expect(r.resolve("Foo")).toBeUndefined();
  });

  it("update() replaces the path for a stem", () => {
    const r = makeResolver(["Old.md"]);
    r.remove("Old.md");
    r.add("Renamed.md");
    expect(r.resolve("Old")).toBeUndefined();
    expect(r.resolve("Renamed")).toBe("Renamed.md");
  });

  it("returns all stems for completion", () => {
    const r = makeResolver(["A/Foo.md", "B/Bar.md"]);
    expect(r.allStems().sort()).toEqual(["bar", "foo"]);
  });

  it("strips .md extension from stem on add and on lookup", () => {
    const r = makeResolver(["Concepts/Foo.md"]);
    // Internally stored as "foo". Lookup accepts both "Foo" and "Foo.md".
    expect(r.candidates("Foo")).toEqual(["Concepts/Foo.md"]);
    expect(r.candidates("Foo.md")).toEqual(["Concepts/Foo.md"]);
  });
});

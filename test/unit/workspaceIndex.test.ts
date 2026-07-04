import { describe, it, expect, beforeEach } from "vitest";
import { WorkspaceIndex, type FileSystem } from "../../src/workspaceIndex";

class InMemoryFs implements FileSystem {
  files = new Map<string, string>();
  async listFiles(_root: string, _ignore: string[]): Promise<string[]> {
    return [...this.files.keys()];
  }
  async readFile(absPath: string): Promise<string> {
    const content = this.files.get(absPath);
    if (content === undefined) throw new Error(`ENOENT: ${absPath}`);
    return content;
  }
}

describe("WorkspaceIndex", () => {
  const ROOT = "/vault";
  let fs: InMemoryFs;
  let idx: WorkspaceIndex;

  beforeEach(() => {
    fs = new InMemoryFs();
    idx = new WorkspaceIndex(ROOT, fs);
  });

  it("builds an index from listed files", async () => {
    fs.files.set("/vault/A.md", "[[B]]");
    fs.files.set("/vault/B.md", "");
    const res = await idx.buildAll([]);
    expect(res.files).toBe(2);
    expect(idx.resolve("B")).toBe("/vault/B.md");
    expect(idx.resolve("A")).toBe("/vault/A.md");
  });

  it("populates backlinks during build", async () => {
    fs.files.set("/vault/A.md", "see [[B]] and [[C]]");
    fs.files.set("/vault/B.md", "");
    fs.files.set("/vault/C.md", "");
    await idx.buildAll([]);
    expect(idx.backlinksFor("B").map((b) => b.source)).toEqual(["/vault/A.md"]);
    expect(idx.backlinksFor("C").map((b) => b.source)).toEqual(["/vault/A.md"]);
  });

  it("resolve returns absolute paths", async () => {
    fs.files.set("/vault/sub/Foo.md", "");
    await idx.buildAll([]);
    expect(idx.resolve("Foo")).toBe("/vault/sub/Foo.md");
  });

  it("updateFile incrementally updates resolver and backlinks", async () => {
    fs.files.set("/vault/A.md", "[[Old]]");
    fs.files.set("/vault/Old.md", "");
    await idx.buildAll([]);
    expect(idx.backlinksFor("Old")).toHaveLength(1);

    // Rewrite A to link to New instead
    fs.files.set("/vault/A.md", "[[New]]");
    fs.files.set("/vault/New.md", "");
    await idx.updateFile("/vault/New.md");
    await idx.updateFile("/vault/A.md");
    expect(idx.backlinksFor("Old")).toHaveLength(0);
    expect(idx.backlinksFor("New")).toHaveLength(1);
    expect(idx.resolve("New")).toBe("/vault/New.md");
  });

  it("removeFile drops the file from resolver and clears its backlinks", async () => {
    fs.files.set("/vault/A.md", "[[B]]");
    fs.files.set("/vault/B.md", "");
    await idx.buildAll([]);

    idx.removeFile("/vault/A.md");
    expect(idx.resolve("A")).toBeUndefined();
    expect(idx.backlinksFor("B")).toHaveLength(0);

    idx.removeFile("/vault/B.md");
    expect(idx.resolve("B")).toBeUndefined();
  });

  it("ignores binary read failures and continues", async () => {
    fs.files.set("/vault/Good.md", "[[Other]]");
    fs.files.set("/vault/Other.md", "");
    // Simulate a missing file in the list
    const orig = fs.readFile.bind(fs);
    fs.readFile = async (p: string) => {
      if (p === "/vault/Other.md") throw new Error("EACCES");
      return orig(p);
    };
    const res = await idx.buildAll([]);
    expect(res.files).toBe(2);
    // Other.md was still added to the resolver (stem only); content failure logged
    expect(idx.resolve("Good")).toBe("/vault/Good.md");
    expect(idx.resolve("Other")).toBe("/vault/Other.md");
  });

  it("reports build duration", async () => {
    fs.files.set("/vault/A.md", "");
    const res = await idx.buildAll([]);
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("allStems returns lowercased stems across all files", async () => {
    fs.files.set("/vault/A.md", "");
    fs.files.set("/vault/sub/Bar.md", "");
    await idx.buildAll([]);
    expect(idx.allStems().sort()).toEqual(["a", "bar"]);
  });
});

describe("sourcesLinkingToStem", () => {
  it("finds sources by stem, including path-qualified targets, case-insensitively", async () => {
    const fs = new InMemoryFs();
    fs.files.set("/v/a.md", "[[Target]]");
    fs.files.set("/v/b.md", "[[dir/target]]");
    fs.files.set("/v/c.md", "[[Unrelated]]");
    fs.files.set("/v/Target.md", "hi");
    const idx = new WorkspaceIndex("/v", fs);
    await idx.buildAll([]);
    expect(idx.sourcesLinkingToStem("target").sort()).toEqual(["/v/a.md", "/v/b.md"]);
  });
});

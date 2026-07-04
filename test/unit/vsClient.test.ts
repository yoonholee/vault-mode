import { describe, it, expect } from "vitest";
import { VsClient, vsBinaryAvailable, type Spawner } from "../../src/vsClient";

// Stub spawner: returns a fake child-process-like object with predetermined stdout/stderr/exit.
function fakeSpawn(opts: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  delayMs?: number;
}): Spawner {
  return (_cmd: string, _args: string[]) => {
    const listeners = new Map<string, ((...a: unknown[]) => void)[]>();
    const fire = (ev: string, ...a: unknown[]) => {
      (listeners.get(ev) ?? []).forEach((cb) => cb(...a));
    };
    const child = {
      stdout: {
        on: (ev: string, cb: (chunk: Buffer) => void) => {
          listeners.set("stdout." + ev, [
            ...(listeners.get("stdout." + ev) ?? []),
            cb as unknown as (...a: unknown[]) => void,
          ]);
        },
      },
      stderr: {
        on: (ev: string, cb: (chunk: Buffer) => void) => {
          listeners.set("stderr." + ev, [
            ...(listeners.get("stderr." + ev) ?? []),
            cb as unknown as (...a: unknown[]) => void,
          ]);
        },
      },
      on: (ev: string, cb: (...a: unknown[]) => void) => {
        listeners.set(ev, [...(listeners.get(ev) ?? []), cb]);
      },
      kill: () => fire("exit", 137),
    };
    setTimeout(() => {
      if (opts.stdout)
        (listeners.get("stdout.data") ?? []).forEach((cb) => cb(Buffer.from(opts.stdout!)));
      if (opts.stderr)
        (listeners.get("stderr.data") ?? []).forEach((cb) => cb(Buffer.from(opts.stderr!)));
      fire("exit", opts.exitCode ?? 0);
    }, opts.delayMs ?? 0);
    return child as unknown as ReturnType<Spawner>;
  };
}

describe("VsClient.search", () => {
  it("returns parsed paths from --paths-only output", async () => {
    const client = new VsClient({
      binary: "vs",
      timeoutMs: 1000,
      vaultRoot: "/vault",
      spawner: fakeSpawn({ stdout: "/vault/a.md\n/vault/b.md\n" }),
    });
    const out = await client.search("query");
    expect(out).toEqual(["/vault/a.md", "/vault/b.md"]);
  });

  it("trims empty lines", async () => {
    const client = new VsClient({
      binary: "vs",
      timeoutMs: 1000,
      vaultRoot: "/vault",
      spawner: fakeSpawn({ stdout: "\n/vault/a.md\n\n/vault/b.md\n\n" }),
    });
    const out = await client.search("query");
    expect(out).toEqual(["/vault/a.md", "/vault/b.md"]);
  });

  it("respects the limit option", async () => {
    let receivedArgs: string[] = [];
    const spawner: Spawner = (cmd: string, args: string[]) => {
      receivedArgs = args;
      return fakeSpawn({ stdout: "/vault/a.md\n" })(cmd, args);
    };
    const client = new VsClient({ binary: "vs", timeoutMs: 1000, vaultRoot: "/vault", spawner });
    await client.search("q", { limit: 3 });
    expect(receivedArgs).toContain("--limit");
    expect(receivedArgs).toContain("3");
    expect(receivedArgs).toContain("--paths-only");
  });

  it("times out on slow processes", async () => {
    const client = new VsClient({
      binary: "vs",
      timeoutMs: 50,
      vaultRoot: "/vault",
      spawner: fakeSpawn({ stdout: "x", delayMs: 200 }),
    });
    await expect(client.search("q")).rejects.toThrow(/timed out/i);
  });

  it("rejects on non-zero exit", async () => {
    const client = new VsClient({
      binary: "vs",
      timeoutMs: 1000,
      vaultRoot: "/vault",
      spawner: fakeSpawn({ stdout: "", stderr: "boom", exitCode: 2 }),
    });
    await expect(client.search("q")).rejects.toThrow(/vs exited 2/);
  });

  it("propagates stderr in the error message", async () => {
    const client = new VsClient({
      binary: "vs",
      timeoutMs: 1000,
      vaultRoot: "/vault",
      spawner: fakeSpawn({ stdout: "", stderr: "API timeout", exitCode: 1 }),
    });
    await expect(client.search("q")).rejects.toThrow(/API timeout/);
  });
});

describe("vsBinaryAvailable", () => {
  it("finds an executable on PATH by bare name", () => {
    expect(vsBinaryAvailable("ls", { PATH: "/bin" })).toBe(true);
  });
  it("rejects a bare name absent from PATH", () => {
    expect(vsBinaryAvailable("definitely-not-a-real-binary-xyz", { PATH: "/bin" })).toBe(false);
  });
  it("accepts an absolute executable path and rejects a missing one", () => {
    expect(vsBinaryAvailable("/bin/ls")).toBe(true);
    expect(vsBinaryAvailable("/bin/definitely-not-a-real-binary-xyz")).toBe(false);
  });
  it("rejects when PATH is unset", () => {
    expect(vsBinaryAvailable("ls", {})).toBe(false);
  });
});

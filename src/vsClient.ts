// Wraps the user's `vs` CLI. Time-bounded, captures stderr, parses stdout.

import { spawn as childProcessSpawn } from "node:child_process";

export interface SpawnedProcess {
  stdout: { on(event: "data", cb: (chunk: Buffer) => void): void } | null;
  stderr: { on(event: "data", cb: (chunk: Buffer) => void): void } | null;
  on(event: "error", cb: (err: Error) => void): void;
  on(event: "exit", cb: (code: number | null) => void): void;
  kill(): boolean | void;
}

export type Spawner = (cmd: string, args: string[], opts?: { cwd?: string }) => SpawnedProcess;

const defaultSpawn: Spawner = (cmd, args, opts) => childProcessSpawn(cmd, args, opts);

export interface VsClientOptions {
  binary: string;
  timeoutMs: number;
  vaultRoot: string;
  /** Override for tests. */
  spawner?: Spawner;
}

export interface VsSearchOptions {
  limit?: number;
  weight?: number;
  lexicalOnly?: boolean;
  noUpdate?: boolean;
}

export class VsClient {
  private binary: string;
  private timeoutMs: number;
  private vaultRoot: string;
  private spawner: Spawner;

  constructor(opts: VsClientOptions) {
    this.binary = opts.binary;
    this.timeoutMs = opts.timeoutMs;
    this.vaultRoot = opts.vaultRoot;
    this.spawner = opts.spawner ?? defaultSpawn;
  }

  async search(query: string, options: VsSearchOptions = {}): Promise<string[]> {
    const args: string[] = ["--paths-only"];
    // Bypass slow incremental updates by default when called from the extension hot path
    if (options.noUpdate !== false) args.push("--no-update");
    if (options.limit !== undefined) args.push("--limit", String(options.limit));
    if (options.weight !== undefined) args.push("--weight", String(options.weight));
    if (options.lexicalOnly) args.push("--lexical-only");
    args.push(query);

    const stdout = await this.runRaw(args);
    return stdout
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  private runRaw(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const child = this.spawner(this.binary, args, { cwd: this.vaultRoot });
      const timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill();
        } catch {
          // ignore
        }
        reject(new Error(`vs timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", (err: Error) => {
        clearTimeout(timer);
        if (!timedOut) reject(err);
      });
      child.on("exit", (code: number | null) => {
        clearTimeout(timer);
        if (timedOut) return;
        if (code === 0) {
          resolve(stdout);
        } else {
          const msg = stderr.trim() || `(no stderr)`;
          reject(new Error(`vs exited ${code}: ${msg}`));
        }
      });
    });
  }
}

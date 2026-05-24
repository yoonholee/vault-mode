import { describe, it, expect } from "vitest";
import { PerfLogger } from "../../src/perfLogger";

describe("PerfLogger", () => {
  it("returns the value from time()", async () => {
    const log = new PerfLogger(() => {});
    const v = await log.time("op", async () => 42);
    expect(v).toBe(42);
  });

  it("emits a log line with duration when enabled", async () => {
    const lines: string[] = [];
    const log = new PerfLogger((s) => lines.push(s));
    await log.time("op", async () => 1);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/op\s+\d+ms/);
  });

  it("does not log when disabled", async () => {
    const lines: string[] = [];
    const log = new PerfLogger((s) => lines.push(s), { enabled: false });
    await log.time("op", async () => 1);
    expect(lines).toHaveLength(0);
  });

  it("supports synchronous timeSync", () => {
    const lines: string[] = [];
    const log = new PerfLogger((s) => lines.push(s));
    const v = log.timeSync("op", () => 7);
    expect(v).toBe(7);
    expect(lines[0]).toMatch(/op\s+\d+ms/);
  });

  it("reports thrown errors but still logs duration", async () => {
    const lines: string[] = [];
    const log = new PerfLogger((s) => lines.push(s));
    await expect(
      log.time("op", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/op\s+\d+ms\s+\[error: boom\]/);
  });

  it("rounds ms to integer", async () => {
    const lines: string[] = [];
    const log = new PerfLogger((s) => lines.push(s));
    await log.time("op", async () => 1);
    const ms = parseInt(lines[0].match(/(\d+)ms/)?.[1] ?? "-1", 10);
    expect(Number.isInteger(ms)).toBe(true);
    expect(ms).toBeGreaterThanOrEqual(0);
  });
});

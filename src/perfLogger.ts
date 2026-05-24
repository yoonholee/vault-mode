// Minimal timing logger. Wraps async/sync calls, captures duration + errors,
// emits one line per call to the supplied sink (typically an OutputChannel).

export interface PerfLoggerOptions {
  enabled?: boolean;
}

export class PerfLogger {
  private enabled: boolean;
  constructor(
    private sink: (line: string) => void,
    options: PerfLoggerOptions = {},
  ) {
    this.enabled = options.enabled ?? true;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) return fn();
    const t0 = performance.now();
    try {
      const v = await fn();
      this.sink(`${label}  ${Math.round(performance.now() - t0)}ms`);
      return v;
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      const msg = e instanceof Error ? e.message : String(e);
      this.sink(`${label}  ${ms}ms  [error: ${msg}]`);
      throw e;
    }
  }

  timeSync<T>(label: string, fn: () => T): T {
    if (!this.enabled) return fn();
    const t0 = performance.now();
    try {
      const v = fn();
      this.sink(`${label}  ${Math.round(performance.now() - t0)}ms`);
      return v;
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      const msg = e instanceof Error ? e.message : String(e);
      this.sink(`${label}  ${ms}ms  [error: ${msg}]`);
      throw e;
    }
  }
}

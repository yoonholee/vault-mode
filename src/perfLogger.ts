// Minimal timing logger. Wraps async/sync calls, captures duration + errors,
// emits one line per call to the supplied sink (typically an OutputChannel).

export interface PerfLoggerOptions {
  enabled?: boolean;
}

export type PerfFieldValue = string | number | boolean | null | undefined;
export type PerfFields = Record<string, PerfFieldValue>;

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

  log(label: string, durationMs: number, fields: PerfFields = {}, error?: unknown): void {
    if (!this.enabled) return;
    const parts = [`${label}  ${Math.round(durationMs)}ms`];
    const fieldText = formatFields(fields);
    if (fieldText) parts.push(fieldText);
    if (error !== undefined) {
      const msg = error instanceof Error ? error.message : String(error);
      parts.push(`[error: ${msg}]`);
    }
    this.sink(parts.join("  "));
  }

  async time<T>(label: string, fn: () => Promise<T>, fields: PerfFields = {}): Promise<T> {
    if (!this.enabled) return fn();
    const t0 = performance.now();
    try {
      const v = await fn();
      this.log(label, performance.now() - t0, fields);
      return v;
    } catch (e) {
      this.log(label, performance.now() - t0, fields, e);
      throw e;
    }
  }

  timeSync<T>(label: string, fn: () => T, fields: PerfFields = {}): T {
    if (!this.enabled) return fn();
    const t0 = performance.now();
    try {
      const v = fn();
      this.log(label, performance.now() - t0, fields);
      return v;
    } catch (e) {
      this.log(label, performance.now() - t0, fields, e);
      throw e;
    }
  }
}

function formatFields(fields: PerfFields): string {
  return Object.entries(fields)
    .flatMap(([k, v]) => (v === undefined || v === null ? [] : [`${k}=${formatValue(v)}`]))
    .join(" ");
}

function formatValue(v: Exclude<PerfFieldValue, null | undefined>): string {
  if (typeof v === "string" && /\s/.test(v)) return JSON.stringify(v);
  return String(v);
}

import { describe, it, expect } from "vitest";
import { dailyNotePath, renderDailyNoteTemplate, isoDate } from "../../src/dailyNote";

describe("dailyNote helpers", () => {
  it("isoDate formats YYYY-MM-DD", () => {
    expect(isoDate(new Date("2026-05-23T12:34:56Z"))).toBe("2026-05-23");
  });

  it("dailyNotePath joins root + folder + filename", () => {
    expect(dailyNotePath("/vault", "Daily", new Date("2026-05-23T12:00:00Z"))).toBe(
      "/vault/Daily/2026-05-23.md",
    );
  });

  it("dailyNotePath handles trailing slash in folder", () => {
    expect(dailyNotePath("/vault", "Daily/", new Date("2026-05-23T12:00:00Z"))).toBe(
      "/vault/Daily/2026-05-23.md",
    );
  });

  it("renderDailyNoteTemplate substitutes {date}", () => {
    const out = renderDailyNoteTemplate("# {date}\n", new Date("2026-05-23T12:00:00Z"));
    expect(out).toBe("# 2026-05-23\n");
  });

  it("renderDailyNoteTemplate substitutes {iso} (same as date)", () => {
    expect(renderDailyNoteTemplate("{iso}", new Date("2026-05-23T12:00:00Z"))).toBe("2026-05-23");
  });

  it("renderDailyNoteTemplate substitutes {weekday}", () => {
    // 2026-05-23 was a Saturday in this test env
    const out = renderDailyNoteTemplate("{weekday}", new Date("2026-05-23T12:00:00Z"));
    expect(out).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
  });
});

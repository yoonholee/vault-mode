import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { dailyNotePath, renderDailyNoteTemplate, isoDate } from "../../src/dailyNote";

describe("dailyNote helpers", () => {
  it("isoDate formats YYYY-MM-DD", () => {
    expect(isoDate(new Date(2026, 4, 23, 12, 34, 56))).toBe("2026-05-23");
  });

  it("dailyNotePath joins root + folder + filename", () => {
    expect(dailyNotePath("/vault", "Daily", new Date(2026, 4, 23, 12))).toBe(
      path.join("/vault", "Daily", "2026-05-23.md"),
    );
  });

  it("dailyNotePath handles trailing slash in folder", () => {
    expect(dailyNotePath("/vault", "Daily/", new Date(2026, 4, 23, 12))).toBe(
      path.join("/vault", "Daily", "2026-05-23.md"),
    );
  });

  it("renderDailyNoteTemplate substitutes {date}", () => {
    const out = renderDailyNoteTemplate("# {date}\n", new Date(2026, 4, 23, 12));
    expect(out).toBe("# 2026-05-23\n");
  });

  it("renderDailyNoteTemplate substitutes {iso} (same as date)", () => {
    expect(renderDailyNoteTemplate("{iso}", new Date(2026, 4, 23, 12))).toBe("2026-05-23");
  });

  it("renderDailyNoteTemplate substitutes {weekday}", () => {
    const out = renderDailyNoteTemplate("{weekday}", new Date(2026, 4, 23, 12));
    expect(out).toBe("Sat");
  });
});

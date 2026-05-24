// Daily-note utilities. Pure functions only; file IO done by the command wrapper.

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isoDate(d: Date): string {
  // YYYY-MM-DD in UTC to avoid surprises across DST / timezone borders.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dailyNotePath(vaultRoot: string, folder: string, d: Date): string {
  const trimmedFolder = folder.replace(/\/+$/, "");
  return `${vaultRoot}/${trimmedFolder}/${isoDate(d)}.md`;
}

export function renderDailyNoteTemplate(template: string, d: Date): string {
  const iso = isoDate(d);
  return template
    .replace(/\{date\}/g, iso)
    .replace(/\{iso\}/g, iso)
    .replace(/\{weekday\}/g, WEEKDAY[d.getUTCDay()]);
}

// Each medicine is a journal behaviour: a logged dose answers it "yes" for the day.
// From its first dose, an unanswered day counts as "no", since nobody answers "no" for every pill skipped.
import { addDays } from "./time";

/** A medicine's behaviour key: "med_" and the name as snake_case ("Vitamin D" → "med_vitamin_d"); "" without a letter or digit. */
export function medicineTag(name: string): string {
  const key = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return key ? `med_${key}` : "";
}

export const isMedicineTag = (tag: string) => tag.startsWith("med_");

/** `entries` with each medicine's unanswered days, from its first "yes" through `lastDay`, filled in as "no" (0). */
export function withMedicineNoDays<T extends { day: string; tags: Record<string, boolean | number> }>(entries: readonly T[], lastDay: string): { day: string; tags: Record<string, boolean | number> }[] {
  const first = new Map<string, string>();
  for (const e of entries)
    for (const [tag, v] of Object.entries(e.tags)) if (isMedicineTag(tag) && Number(v) > 0 && (!first.has(tag) || e.day < first.get(tag)!)) first.set(tag, e.day);
  if (!first.size) return entries.map((e) => ({ day: e.day, tags: e.tags }));
  const byDay = new Map(entries.map((e) => [e.day, { day: e.day, tags: { ...e.tags } }]));
  for (const [tag, from] of first) {
    for (let d = from; d <= lastDay; d = addDays(d, 1)) {
      const row = byDay.get(d) ?? { day: d, tags: {} };
      if (!(tag in row.tags)) row.tags[tag] = 0;
      byDay.set(d, row);
    }
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

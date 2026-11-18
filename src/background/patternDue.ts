// When a pattern notification is due (background/patterns.ts sends it). Pure, for the tests.
import type { Pattern } from "@/queries/patterns";

export const PATTERN_EVERY_S = 7 * 86_400;
export const PATTERN_HOURS = { from: 9 * 60, to: 20 * 60 } as const;

export type Sent = { at: number; keys: string[] };

/** The pattern to send now, or null: pure, for the tests. */
export function patternDue(i: { patterns: readonly Pattern[]; sent: Sent; dismissed: Record<string, number>; now: number; minuteOfDay: number }): Pattern | null {
  if (i.minuteOfDay < PATTERN_HOURS.from || i.minuteOfDay >= PATTERN_HOURS.to) return null;
  if (i.now - i.sent.at < PATTERN_EVERY_S) return null;
  return i.patterns.find((p) => !i.sent.keys.includes(p.key) && !(p.key in i.dismissed)) ?? null;
}

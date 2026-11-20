// Some check-in behaviours aren't yes/no: how much is the point. Alcohol is the first — one drink with dinner and a
// long night out land very differently on the next morning, and a bare Yes loses that. A counted behaviour stores
// the amount as its entry value (saveJournalEntry already takes an integer there); Yes means "one", and the count is
// shown wherever the behaviour is. This lives in plain TS so the queries and the check-in UI share one definition.
import { armDiff } from "@/core/algorithms/journalImpact";

export type Counted = {
  /** The sub-row's question, e.g. "How many drinks?". */
  question: string;
  /** The unit, singular and plural, for "3 drinks". */
  noun: string;
  nounPlural: string;
  /** The most it will count up to. */
  max: number;
  /** Up to this many is "light"; more is "heavy" (the impact's split). */
  lightMax: number;
  /**
   * The first day a count could be logged. Before it a Yes was stored as 1 whatever the amount, so an earlier 1 is
   * "some, amount unknown" and stays out of the by-amount split rather than posing as one drink.
   */
  since: string;
};

export const COUNTED_TAGS: Record<string, Counted> = {
  alcohol: { question: "How many drinks?", noun: "drink", nounPlural: "drinks", max: 30, lightMax: 2, since: "2026-11-12" },
};

export const countedTag = (tag: string): Counted | null => COUNTED_TAGS[tag] ?? null;
export const isCountedTag = (tag: string): boolean => tag in COUNTED_TAGS;

/** "3 drinks", "1 drink". */
export function countPhrase(tag: string, n: number): string {
  const c = COUNTED_TAGS[tag];
  if (!c) return String(n);
  return `${n} ${n === 1 ? c.noun : c.nounPlural}`;
}

/**
 * A yes behaviour's label as it reads in a badge or a history row: a counted one carries its amount ("Alcohol · 3"),
 * so the number the check-in captured is visible at a glance; every other behaviour is just its name.
 */
/**
 * Behaviours answered on a scale instead of yes/no: muscle soreness, asked in the check-in the day after training. The
 * value is the level (0 none … 3 very sore); Insights read any level above none as "yes".
 */
export const SORENESS_TAG = "muscle_soreness";
export const SORENESS_LABEL = "Muscle soreness";
export const SORENESS_LEVELS = ["None", "Mild", "Moderate", "Very sore"] as const;
export const isScaleTag = (tag: string) => tag === SORENESS_TAG;

export function yesLabel(tag: string, label: string, value: number, day?: string): string {
  if (isScaleTag(tag)) return value > 0 ? `${label} · ${SORENESS_LEVELS[Math.min(3, value)].toLowerCase()}` : label;
  const spec = COUNTED_TAGS[tag];
  if (!spec || value < 1) return label;
  // Before counting began a Yes was stored as 1 whatever the amount: that 1 is not "one drink".
  if (day !== undefined && day < spec.since && value === 1) return label;
  return `${label} · ${value}`;
}

/** How few days an amount needs before its average is shown. */
export const AMOUNT_MIN_DAYS = 3;

/** `vsNone`: whether this amount's next day is clearly above or below none's (95 % bootstrap CI clear of zero). */
export type AmountArm = { label: string; n: number; avg: number | null; vsNone?: "higher" | "lower" | null };
export type AmountSplit = { tag: string; none: AmountArm; light: AmountArm; heavy: AmountArm; unknown: number };

/**
 * A counted behaviour's next-day outcome by how much: none, light (up to `lightMax`) and heavy. One drink with dinner
 * and a night out are different behaviours, and the yes/no impact averages them into one. `answers` are the days it
 * was answered with their value; `outcome` gives the next day's figure. A Yes from before counting began is
 * `unknown`. An arm under AMOUNT_MIN_DAYS has no average yet.
 */
export function amountSplit(tag: string, answers: readonly { day: string; value: number }[], outcome: (day: string) => number | null | undefined): AmountSplit | null {
  const spec = COUNTED_TAGS[tag];
  if (!spec) return null;
  const arms = { none: [] as number[], light: [] as number[], heavy: [] as number[] };
  let unknown = 0;
  for (const a of answers) {
    const arm = a.value <= 0 ? "none" : a.day < spec.since && a.value === 1 ? null : a.value <= spec.lightMax ? "light" : "heavy";
    if (!arm) {
      unknown++;
      continue;
    }
    const y = outcome(a.day);
    if (y != null && Number.isFinite(y)) arms[arm].push(y);
  }
  const vsNone = (ys: number[], key: string): AmountArm["vsNone"] => {
    if (ys.length < AMOUNT_MIN_DAYS || arms.none.length < AMOUNT_MIN_DAYS) return null;
    const { ciLow, ciHigh } = armDiff(ys, arms.none, `${tag}:${key}`);
    return ciLow > 0 ? "higher" : ciHigh < 0 ? "lower" : null;
  };
  const arm = (label: string, ys: number[], key?: string): AmountArm => ({
    label,
    n: ys.length,
    avg: ys.length >= AMOUNT_MIN_DAYS ? ys.reduce((s, y) => s + y, 0) / ys.length : null,
    ...(key ? { vsNone: vsNone(ys, key) } : {}),
  });
  const light = spec.lightMax === 1 ? `1 ${spec.noun}` : `1–${spec.lightMax} ${spec.nounPlural}`;
  return { tag, none: arm("None", arms.none), light: arm(light, arms.light, "light"), heavy: arm(`${spec.lightMax + 1}+ ${spec.nounPlural}`, arms.heavy, "heavy"), unknown };
}

// Some check-in behaviours aren't yes/no: how much is the point. Alcohol is the first — one drink with dinner and a
// long night out land very differently on the next morning, and a bare Yes loses that. A counted behaviour stores
// the amount as its entry value (saveJournalEntry already takes an integer there); Yes means "one", and the count is
// shown wherever the behaviour is. This lives in plain TS so the queries and the check-in UI share one definition.

export type Counted = {
  /** The sub-row's question, e.g. "How many drinks?". */
  question: string;
  /** The unit, singular and plural, for "3 drinks". */
  noun: string;
  nounPlural: string;
  /** The most it will count up to. */
  max: number;
};

export const COUNTED_TAGS: Record<string, Counted> = {
  alcohol: { question: "How many drinks?", noun: "drink", nounPlural: "drinks", max: 30 },
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
export function yesLabel(tag: string, label: string, value: number): string {
  return isCountedTag(tag) && value >= 1 ? `${label} · ${value}` : label;
}

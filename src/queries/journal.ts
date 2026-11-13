// Journal `/journal`, Behaviour insights `/journal/insights` and More › Behaviours, ported from Halo's
// src/server/queries/journal.ts, with the tag-table helpers of src/server/journalTags.ts. Every Postgres read is a
// Store read; the VM shapes are the web's (types.ts).
import { armDiff, type ImpactMetric, type TagImpact } from "@/core/algorithms/journalImpact";
import type { JournalEntry } from "@/data/types";
import type { JournalTagRow, Store } from "@/data/store";
import { yesLabel } from "@/lib/behaviours";
import { isMedicineTag, medicineTag, withMedicineNoDays } from "@/lib/medicine";
import { addDays, localMinutes } from "@/lib/time";
import type { JournalImpactRow } from "@/pipeline/types";
import { finite, loadDays, meanSd, type QueryCtx, todayOf } from "./common";
import type { BehavioursVM, ImpactMetricKey, JournalInsightsVM, JournalTag, JournalVM } from "./types";


// journalTags.ts

/** The Journal's default behaviours, shared by both data sources (and the demo generator's DEFAULT_JOURNAL_TAGS). */
export const DEFAULT_JOURNAL_TAGS = [
  { tag: "alcohol", label: "Alcohol" },
  { tag: "late_caffeine", label: "Late caffeine" },
  { tag: "late_meal", label: "Late meal" },
  { tag: "screen_in_bed", label: "Screen in bed" },
  { tag: "meditation", label: "Meditation" },
  { tag: "stretching", label: "Stretching" },
  { tag: "sauna", label: "Sauna" },
  { tag: "travel", label: "Travel" },
  { tag: "illness", label: "Illness" },
] as const;

/** Inserts any missing default tag; existing rows (and custom tags) are left alone. Returns rows inserted. */
export async function ensureDefaultTags(store: Store): Promise<number> {
  const added = await store.insertJournalTags(DEFAULT_JOURNAL_TAGS.map(({ tag, label }) => ({ tag, label, isDefault: true, hidden: false, position: 0 })));
  return added.length;
}

/** A custom tag's key: the label as snake_case ("Cold plunge" → "cold_plunge"); "" when it has no letter or digit. */
export const tagKey = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/** Most tags (defaults included) a person can have. Insights bootstrap every tag on every recompute, so this bounds that work. */
export const MAX_TAGS = 60;

/**
 * The tag rows, the defaults first ensured. The web inserts them at sign-up and on the worker's first run; on the
 * phone they are inserted the first time anything reads the tags (and again after `clearAll`), a no-op afterwards.
 */
export async function tagRows(store: Store): Promise<JournalTagRow[]> {
  const rows = await store.journalTags();
  const have = new Set(rows.map((r) => r.tag));
  if (DEFAULT_JOURNAL_TAGS.every((t) => have.has(t.tag))) return rows;
  await ensureDefaultTags(store);
  return store.journalTags();
}

/** Adds a custom tag at the end of its group. "exists" when the key is taken, "full" at MAX_TAGS. */
export async function addTag(store: Store, tag: string, label: string): Promise<"added" | "exists" | "full"> {
  const rows = await tagRows(store);
  if (rows.some((r) => r.tag === tag)) return "exists";
  if (rows.length >= MAX_TAGS) return "full";
  const position = rows.reduce((m, r) => Math.max(m, r.position), 0) + 1;
  const added = await store.insertJournalTags([{ tag, label, isDefault: false, hidden: false, position }]);
  return added.length ? "added" : "exists";
}

/** Hides a tag from the check-in sheet or shows it again. Its answers are untouched. False for an unknown tag. */
export async function setTagHidden(store: Store, tag: string, hidden: boolean): Promise<boolean> {
  if (!(await tagRows(store)).some((r) => r.tag === tag)) return false;
  await store.updateJournalTags([{ tag, hidden }]);
  return true;
}

/**
 * Orders `tags` (one check-in group, in its new order) by writing their positions 0..n-1. Other groups keep
 * theirs: groups render apart, so only the order inside a group matters. False, writing nothing, if any tag is unknown.
 */
export async function reorderTags(store: Store, tags: string[]): Promise<boolean> {
  if (new Set(tags).size !== tags.length) return false;
  if (!tags.length) return true;
  const known = new Set((await tagRows(store)).map((r) => r.tag));
  if (!tags.every((t) => known.has(t))) return false;
  await store.updateJournalTags(tags.map((tag, position) => ({ tag, position })));
  return true;
}

// queries/journal.ts

const GROUP: Record<string, JournalTag["group"]> = {
  alcohol: "evening",
  late_caffeine: "evening",
  late_meal: "evening",
  screen_in_bed: "evening",
  meditation: "recovery",
  stretching: "recovery",
  sauna: "recovery",
  travel: "context",
  illness: "context",
};

/** Every tag, hidden ones included, in check-in order (position inside a group, then insertion order). */
async function tagsOf(ctx: QueryCtx): Promise<JournalTag[]> {
  const rows = await tagRows(ctx.store);
  return rows.map((r) => ({ tag: r.tag, label: r.label, isDefault: r.isDefault, hidden: r.hidden, group: GROUP[r.tag] ?? (isMedicineTag(r.tag) ? "medicine" : "custom") }));
}

/** More › Behaviours: every tag, hidden ones included, with how many days answered it. */
export async function getBehaviours(ctx: QueryCtx): Promise<BehavioursVM> {
  const [tags, entries] = await Promise.all([tagsOf(ctx), ctx.store.allJournal()]);
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.tag, (counts.get(e.tag) ?? 0) + 1);
  return { tags: tags.map((t) => ({ ...t, answers: counts.get(t.tag) ?? 0 })) };
}

const byteOrder = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Entries with from <= day <= to, by day then tag. */
async function entriesBetween(ctx: QueryCtx, from: string, to: string): Promise<JournalEntry[]> {
  return (await ctx.store.allJournal()).filter((e) => e.day >= from && e.day <= to).sort((a, b) => byteOrder(a.day, b.day) || byteOrder(a.tag, b.tag));
}

/**
 * The newest stored journal impact on or before today. Stage 2 writes one for every scored day, so the last fortnight
 * nearly always has it; otherwise every stored day is searched.
 */
async function latestImpact(ctx: QueryCtx): Promise<{ asOf: string; impacts: TagImpact[] } | null> {
  const today = todayOf(ctx);
  const pick = (rows: { day: string; journal_impact: JournalImpactRow | null }[]) => {
    let best: { asOf: string; impacts: TagImpact[] } | null = null;
    for (const r of rows) if (r.journal_impact && r.day <= today && (!best || r.day > best.asOf)) best = { asOf: r.day, impacts: r.journal_impact.impacts };
    return best;
  };
  return (
    pick(await ctx.store.scoresIn({ from: addDays(today, -13), to: today })) ??
    pick(await ctx.store.scoresIn({ from: ctx.sync.firstDay ?? "0000-01-01", to: addDays(today, -14) }))
  );
}

/** Journal `/journal` for `day` (spec §7.11). */
export async function getJournal(day: string, ctx: QueryCtx): Promise<JournalVM> {
  const today = todayOf(ctx);
  const stripStart = day < addDays(today, -29) ? day : addDays(today, -29);
  const [tags, entries, impact] = await Promise.all([tagsOf(ctx), entriesBetween(ctx, stripStart, today), latestImpact(ctx)]);
  const label = new Map(tags.map((t) => [t.tag, t.label]));
  const byDay = new Map<string, typeof entries>();
  for (const e of entries) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);

  const strip: JournalVM["strip"] = [];
  for (let d = stripStart; d <= today; d = addDays(d, 1)) strip.push({ day: d, done: byDay.has(d) });
  const mine = byDay.get(day) ?? [];
  const yesOf = (es: typeof entries) =>
    es.filter((e) => e.value > 0).map((e) => ({ tag: e.tag, label: yesLabel(e.tag, label.get(e.tag) ?? e.tag, e.value) }));

  const strongest = impact?.impacts.find((t) => t.effects.recovery.label === "positive" || t.effects.recovery.label === "negative");
  const teaser = strongest
    ? {
        ready: true,
        text: `Your strongest effect so far: ${(label.get(strongest.tag) ?? strongest.tag).toLowerCase()} ${strongest.effects.recovery.delta! < 0 ? "lowers" : "raises"} next-day Recovery by ${Math.abs(Math.round(strongest.effects.recovery.delta!))}%.`,
      }
    : { ready: false, text: "Insights appear after 5 days with and 5 without a behaviour." };

  const history: JournalVM["history"] = [];
  for (let d = today; d >= addDays(today, -29); d = addDays(d, -1)) {
    const es = byDay.get(d);
    if (es) history.push({ day: d, yes: yesOf(es).map((y) => y.label) });
  }

  return {
    day,
    today,
    strip,
    // Hidden behaviours leave the check-in sheet; their answers stay, still label History and still count in insights.
    tags: tags.filter((t) => !t.hidden),
    checkIn: { done: mine.length > 0, entries: Object.fromEntries(mine.map((e) => [e.tag, e.value])), yes: yesOf(mine) },
    teaser,
    history,
  };
}

const METRIC: Record<ImpactMetricKey, ImpactMetric> = { recovery: "recovery", hrv: "hrvZ", sleep: "sleepPerf" };

/** Journal Insights `/journal/insights?m=` (spec §7.12): effects on next-day Recovery, HRV (SD) or sleep. */
export async function getJournalInsights(metric: ImpactMetricKey = "recovery", ctx: QueryCtx): Promise<JournalInsightsVM> {
  const key = METRIC[metric];
  const unit = metric === "hrv" ? "SD" : "%";
  const impact = await latestImpact(ctx);
  if (!impact) return { metric, unit, items: [], needsMore: [] };
  const from = addDays(impact.asOf, -90);
  const [tags, entries, rows] = await Promise.all([tagsOf(ctx), entriesBetween(ctx, from, addDays(impact.asOf, -1)), loadDays(ctx, addDays(from, 1), impact.asOf)]);
  const label = new Map(tags.map((t) => [t.tag, t.label]));
  const outcome = (day: string) => {
    const r = rows.get(day);
    return key === "recovery" ? r?.recovery?.value : key === "hrvZ" ? r?.recovery?.hrvZ : r?.sleep?.performance;
  };
  const byDay = new Map<string, Record<string, number>>();
  for (const e of entries) byDay.set(e.day, { ...byDay.get(e.day), [e.tag]: e.value });
  const answers = withMedicineNoDays(
    [...byDay].map(([day, tags]) => ({ day, tags })),
    addDays(impact.asOf, -1),
  );
  const arms = (tag: string) => {
    const yes: (number | null | undefined)[] = [];
    const no: (number | null | undefined)[] = [];
    for (const a of answers) if (tag in a.tags) (Number(a.tags[tag]) > 0 ? yes : no).push(outcome(addDays(a.day, 1)));
    return { avgWith: meanSd(yes.filter(finite)).mean, avgWithout: meanSd(no.filter(finite)).mean };
  };

  const items: JournalInsightsVM["items"] = [];
  const needsMore: JournalInsightsVM["needsMore"] = [];
  for (const t of impact.impacts) {
    const e = t.effects[key];
    const name = label.get(t.tag) ?? t.tag;
    if (e.label === "not_enough_data" || e.delta == null) {
      needsMore.push({ key: t.tag, label: name, yes: e.nYes, no: e.nNo });
      continue;
    }
    items.push({
      key: t.tag,
      label: name,
      delta: e.delta,
      effect: e.label === "positive" ? "positive" : e.label === "negative" ? "negative" : "none",
      yes: e.nYes,
      no: e.nNo,
      ci: [e.ciLow!, e.ciHigh!],
      ...arms(t.tag),
    });
  }
  items.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.key.localeCompare(b.key));
  return { metric, unit, items, needsMore };
}

/** A medicine's dose timing against the next day's outcome: its earlier half of days against its later half. */
export type MedTimingRow = {
  tag: string;
  label: string;
  /** The split, "21:15": earlier days took their first dose before it. */
  split: string;
  early: { n: number; avg: number };
  late: { n: number; avg: number };
};

/** Days with a timed dose needed, and per side; the earlier and later halves must sit at least this far apart. */
export const MED_TIMING = { minDays: 10, minSide: 4, minGapMin: 30 } as const;

/** Minutes of the day as "HH:MM"; a late dose counted past midnight (1 470 = 00:30) wraps back onto the clock. */
const hhmm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;

/** A dose before this minute of the day belongs to the evening before (a bedtime medicine taken at 00:20 is "late", not "early"). */
const NIGHT_END_MIN = 4 * 60;

type LoggedDose = { type: string; day: string; ts: number; data: unknown };
/**
 * The timed medicine doses in `entries` since `from`, by medicine tag: the local day and the minute of that day. A dose
 * in the small hours counts as the previous day's, 24 h on, so a bedtime dose just after midnight sorts after 23:30
 * rather than as the earliest of the next day.
 */
export function timedDoses(entries: readonly LoggedDose[], from: string, timeZone: string) {
  const nameByTag = new Map<string, string>();
  const doses = entries.flatMap((e) => {
    if (e.type !== "medication") return [];
    const name = String((e.data as { name?: unknown } | null)?.name ?? "");
    const tag = medicineTag(name);
    if (!tag) return [];
    const clock = localMinutes(e.ts, timeZone);
    const late = clock < NIGHT_END_MIN;
    const day = late ? addDays(e.day, -1) : e.day;
    if (day < from) return [];
    if (!nameByTag.has(tag)) nameByTag.set(tag, name);
    return [{ tag, day, minute: late ? clock + 1440 : clock }];
  });
  return { doses, nameByTag };
}

/**
 * "When you take it" (mobile): for each medicine with at least 10 timed doses in 90 days, the days split at the median
 * time of their first dose, and the next day's outcome (Recovery, HRV or Sleep, as Insights' metric) averaged on each
 * side. Medicines whose doses all fall within half an hour of each other are left out: there's no "when" to compare.
 */
export function medTiming(
  doses: { tag: string; day: string; minute: number }[],
  outcome: (day: string) => number | null | undefined,
  labelOf: (tag: string) => string,
): MedTimingRow[] {
  const first = new Map<string, Map<string, number>>();
  for (const d of doses) {
    const days = first.get(d.tag) ?? new Map<string, number>();
    days.set(d.day, Math.min(days.get(d.day) ?? Infinity, d.minute));
    first.set(d.tag, days);
  }
  const out: MedTimingRow[] = [];
  for (const [tag, days] of first) {
    const rows = [...days].map(([day, minute]) => ({ minute, next: outcome(addDays(day, 1)) })).filter((r): r is { minute: number; next: number } => finite(r.next));
    if (rows.length < MED_TIMING.minDays) continue;
    const sorted = [...rows].sort((a, b) => a.minute - b.minute);
    const mid = sorted[Math.floor(sorted.length / 2)].minute;
    const early = sorted.filter((r) => r.minute < mid);
    const late = sorted.filter((r) => r.minute >= mid);
    if (early.length < MED_TIMING.minSide || late.length < MED_TIMING.minSide) continue;
    const median = (xs: { minute: number }[]) => xs[Math.floor(xs.length / 2)].minute;
    if (median(late) - median(early) < MED_TIMING.minGapMin) continue;
    out.push({
      tag,
      label: labelOf(tag),
      split: hhmm(mid),
      early: { n: early.length, avg: meanSd(early.map((r) => r.next)).mean! },
      late: { n: late.length, avg: meanSd(late.map((r) => r.next)).mean! },
    });
  }
  return out.sort((a, b) => Math.abs(b.early.avg - b.late.avg) - Math.abs(a.early.avg - a.late.avg) || a.label.localeCompare(b.label));
}

/** Insights' "When you take it" for `metric`, from the last 90 days of logged doses. */
export async function getMedicineTiming(metric: ImpactMetricKey = "recovery", ctx: QueryCtx): Promise<MedTimingRow[]> {
  const key = METRIC[metric];
  const from = addDays(ctx.today, -90);
  const [entries, tags, rows] = await Promise.all([
    ctx.store.loggedEntries(ctx.now - 91 * 86_400, 5000),
    tagsOf(ctx),
    loadDays(ctx, addDays(from, 1), ctx.today),
  ]);
  const label = new Map(tags.map((t) => [t.tag, t.label]));
  const { doses, nameByTag } = timedDoses(entries, from, ctx.timeZone);
  const outcome = (day: string) => {
    const r = rows.get(day);
    return key === "recovery" ? r?.recovery?.value : key === "hrvZ" ? r?.recovery?.hrvZ : r?.sleep?.performance;
  };
  return medTiming(doses, outcome, (t) => label.get(t) ?? nameByTag.get(t) ?? t);
}

export type DoseTimingItem = {
  tag: string;
  label: string;
  /** The split, "08:30": earlier days took their first dose before it. */
  split: string;
  early: { n: number; avg: number; from: string; to: string };
  late: { n: number; avg: number; from: string; to: string };
  /** mean(late) − mean(early) in the metric's unit, with a 90% bootstrap CI. */
  delta: number;
  ci: [number, number];
  effect: "positive" | "negative" | "none";
};
/** Why a medicine can't be split by time: too few days with a logged dose time, or doses too close together. */
export type DoseTimingReason = { tag: string; label: string; reason: "few_timed_days" | "no_spread"; timedDays: number; spreadMin: number };
export type DoseTimingVM = { metric: ImpactMetricKey; unit: string; items: DoseTimingItem[]; needsMore: DoseTimingReason[] };

/**
 * Like medTiming, but keeps the medicines it can't split and says why (for the Coach's "when" answer), and adds a
 * bootstrap CI so the early-vs-late difference carries the same uncertainty as the yes/no impacts. The split is each
 * day's first dose; a medicine needs enough timed days, enough on each side, and the two halves at least half an hour
 * apart — doses all around one time have no "when" to compare.
 */
export function doseTiming(
  doses: { tag: string; day: string; minute: number }[],
  outcome: (day: string) => number | null | undefined,
  labelOf: (tag: string) => string,
): { items: DoseTimingItem[]; needsMore: DoseTimingReason[] } {
  const first = new Map<string, Map<string, number>>();
  for (const d of doses) {
    const days = first.get(d.tag) ?? new Map<string, number>();
    days.set(d.day, Math.min(days.get(d.day) ?? Infinity, d.minute));
    first.set(d.tag, days);
  }
  const items: DoseTimingItem[] = [];
  const needsMore: DoseTimingReason[] = [];
  for (const [tag, days] of first) {
    const label = labelOf(tag);
    const rows = [...days].map(([day, minute]) => ({ minute, next: outcome(addDays(day, 1)) })).filter((r): r is { minute: number; next: number } => finite(r.next));
    const spread = rows.length ? Math.max(...rows.map((r) => r.minute)) - Math.min(...rows.map((r) => r.minute)) : 0;
    if (rows.length < MED_TIMING.minDays) {
      needsMore.push({ tag, label, reason: "few_timed_days", timedDays: rows.length, spreadMin: spread });
      continue;
    }
    const sorted = [...rows].sort((a, b) => a.minute - b.minute);
    const mid = sorted[Math.floor(sorted.length / 2)].minute;
    const early = sorted.filter((r) => r.minute < mid);
    const late = sorted.filter((r) => r.minute >= mid);
    const median = (xs: { minute: number }[]) => xs[Math.floor(xs.length / 2)].minute;
    if (early.length < MED_TIMING.minSide || late.length < MED_TIMING.minSide || median(late) - median(early) < MED_TIMING.minGapMin) {
      needsMore.push({ tag, label, reason: "no_spread", timedDays: rows.length, spreadMin: spread });
      continue;
    }
    const { delta, ciLow, ciHigh } = armDiff(
      late.map((r) => r.next),
      early.map((r) => r.next),
      `${tag}:timing`,
    );
    const side = (xs: { minute: number; next: number }[]) => ({ n: xs.length, avg: meanSd(xs.map((r) => r.next)).mean!, from: hhmm(Math.min(...xs.map((r) => r.minute))), to: hhmm(Math.max(...xs.map((r) => r.minute))) });
    items.push({ tag, label, split: hhmm(mid), early: side(early), late: side(late), delta, ci: [ciLow, ciHigh], effect: ciLow > 0 ? "positive" : ciHigh < 0 ? "negative" : "none" });
  }
  items.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.label.localeCompare(b.label));
  return { items, needsMore };
}

/** The Coach's dose-timing answer for `metric`: early-vs-late next-day outcome for each timed medicine, over 90 days. */
export async function getDoseTiming(metric: ImpactMetricKey = "recovery", ctx: QueryCtx): Promise<DoseTimingVM> {
  const key = METRIC[metric];
  const unit = metric === "hrv" ? "SD" : "%";
  const from = addDays(ctx.today, -90);
  const [entries, tags, rows] = await Promise.all([ctx.store.loggedEntries(ctx.now - 91 * 86_400, 5000), tagsOf(ctx), loadDays(ctx, addDays(from, 1), ctx.today)]);
  const label = new Map(tags.map((t) => [t.tag, t.label]));
  const { doses, nameByTag } = timedDoses(entries, from, ctx.timeZone);
  const outcome = (day: string) => {
    const r = rows.get(day);
    return key === "recovery" ? r?.recovery?.value : key === "hrvZ" ? r?.recovery?.hrvZ : r?.sleep?.performance;
  };
  return { metric, unit, ...doseTiming(doses, outcome, (t) => label.get(t) ?? nameByTag.get(t) ?? t) };
}

// Patterns: the findings the Coach offers on its own, from the band's nights and the journal. Each one is a plain
// comparison on the person's own days with a seeded bootstrap CI (journalImpact.ts's armDiff), kept only when the CI
// clears zero and the gap is big enough to act on:
//   weekday   one weekday's Recovery runs low, and what the night before it does differently (bedtime, sleep, strain);
//   bedtime   nights in bed earlier against later, and the Recovery that follows;
//   timing    a medicine or supplement taken earlier or later in the day, against that night's deep sleep, Sleep or Recovery;
//   behaviour a journal behaviour with a clear effect on next-day Recovery or Sleep.
// Pure (findPatterns) over the rows getPatterns reads, so the thresholds are tested on synthetic months.
import { armDiff } from "@/core/algorithms/journalImpact";
import { addDays, localMinutes } from "@/lib/time";
import { finite, loadDays, meanSd, type DayRow, type QueryCtx, toStrain } from "./common";
import { doseTiming, getJournalInsights, timedDoses, type DoseTimingItem } from "./journal";
import type { JournalInsightsVM } from "./types";

export type PatternKind = "weekday" | "bedtime" | "timing" | "behaviour";
export type Pattern = {
  /** Stable across days while the finding holds ("weekday:3", "timing:med_l_theanine"): dismissals key on it. */
  key: string;
  kind: PatternKind;
  /** What it is about, for the card's colour. */
  subject: "recovery" | "sleep" | "strain";
  title: string;
  body: string;
  /** Where the evidence lives. */
  href: string;
  /** The question the card's "Ask Coach" puts in the composer. */
  ask: string;
  /** For ranking: the effect in Recovery points (deep sleep % counts half). */
  weight: number;
};

/** A night and the day it starts: the row `day`'s sleep ended that morning, so its bedtime is the evening before. */
export type PatternNight = {
  day: string;
  recovery: number | null;
  sleepPerf: number | null;
  deepMin: number | null;
  asleepMin: number | null;
  /** Getting into bed, minutes after the previous midnight (23:30 = 1 410, 00:30 = 1 470); null without a main sleep. */
  bedMin: number | null;
  /** The day's own Strain (0–21). */
  strain: number | null;
};

export const PATTERNS = {
  /** Days of history read. */
  days: 120,
  /** Nights with a Recovery before any weekday is compared, and of that weekday. */
  minNights: 42,
  minWeekday: 6,
  /** A weekday this many Recovery points under the rest. */
  minWeekdayDrop: 8,
  /** What the night before must differ by to name it: minutes later to bed or shorter asleep, or Strain points. */
  minBedShift: 20,
  minSleepShift: 20,
  minStrainShift: 2,
  /** Bedtime split: nights per side, the two halves' medians apart, Recovery points between them. */
  minBedSide: 8,
  minBedGap: 30,
  minBedGain: 5,
  /** Timing: deep sleep % between the halves, or Sleep / Recovery points. */
  minDeepPct: 8,
  minPoints: 4,
  /** Behaviour: next-day points with and without. */
  minBehaviour: 5,
  /** Cards shown at once. */
  max: 3,
} as const;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
/** 0 = Sunday, from the calendar date itself (no zone involved). */
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** "21:00" from minutes after midnight (wrapping past 24 h), rounded to 5 minutes. */
export function clockOf(min: number): string {
  const m = Math.round(min / 5) * 5;
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "40 min", "1 h 10 min". */
export function minutesText(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const avg = (xs: number[]) => meanSd(xs).mean ?? NaN;
const r0 = (x: number) => Math.round(x);

// Weekday

/** The weekday whose Recovery runs lowest against the rest, clearly (CI under zero), and what its eve does differently. */
export function weekdayPattern(nights: readonly PatternNight[]): Pattern | null {
  const rec = nights.filter((n): n is PatternNight & { recovery: number } => finite(n.recovery));
  if (rec.length < PATTERNS.minNights) return null;
  let worst: { w: number; delta: number; on: typeof rec; off: typeof rec } | null = null;
  for (let w = 0; w < 7; w++) {
    const on = rec.filter((n) => weekdayOf(n.day) === w);
    const off = rec.filter((n) => weekdayOf(n.day) !== w);
    if (on.length < PATTERNS.minWeekday) continue;
    const { delta, ciHigh } = armDiff(
      on.map((n) => n.recovery),
      off.map((n) => n.recovery),
      `weekday:${w}`,
    );
    if (ciHigh >= 0 || -delta < PATTERNS.minWeekdayDrop) continue;
    if (!worst || delta < worst.delta) worst = { w, delta, on, off };
  }
  if (!worst) return null;
  const { w, on, off } = worst;
  const day = WEEKDAYS[w];
  const eve = WEEKDAYS[(w + 6) % 7];
  const onAvg = r0(avg(on.map((n) => n.recovery)));
  const drop = r0(avg(off.map((n) => n.recovery))) - onAvg;
  const lead = `Your Recovery on ${day}s averages ${onAvg}%, ${drop} points below your other days.`;
  const base = { key: `weekday:${w}`, kind: "weekday" as const, href: "/recovery", weight: drop + 2, ask: `Why is my Recovery lower on ${day}s, and what should I change on ${eve}s?` };

  const beds = (xs: typeof rec) => xs.map((n) => n.bedMin).filter(finite);
  const [bedOn, bedOff] = [beds(on), beds(off)];
  const later = bedOn.length >= 4 && bedOff.length >= 4 ? median(bedOn) - median(bedOff) : 0;
  if (later >= PATTERNS.minBedShift) {
    return {
      ...base,
      subject: "sleep",
      title: `Get to bed earlier on ${eve}s`,
      body: `${lead} On ${eve} nights you tend to get to bed around ${clockOf(median(bedOn))}, ${minutesText(later)} later than usual.`,
    };
  }
  const slept = (xs: typeof rec) => xs.map((n) => n.asleepMin).filter(finite);
  const [slOn, slOff] = [slept(on), slept(off)];
  const shorter = slOn.length >= 4 && slOff.length >= 4 ? avg(slOff) - avg(slOn) : 0;
  if (shorter >= PATTERNS.minSleepShift) {
    return { ...base, subject: "sleep", title: `Protect your ${eve} night`, body: `${lead} You sleep about ${minutesText(shorter)} less on ${eve} nights.` };
  }
  // The day before each night: its own Strain.
  const byDay = new Map(nights.map((n) => [n.day, n]));
  const eveStrain = (xs: typeof rec) => xs.map((n) => byDay.get(addDays(n.day, -1))?.strain).filter(finite);
  const [stOn, stOff] = [eveStrain(on), eveStrain(off)];
  const harder = stOn.length >= 4 && stOff.length >= 4 ? avg(stOn) - avg(stOff) : 0;
  if (harder >= PATTERNS.minStrainShift) {
    const [a, b] = [avg(stOn).toFixed(1), avg(stOff).toFixed(1)];
    return { ...base, subject: "strain", href: "/strain", title: `Ease off on ${eve}s`, body: `${lead} ${eve}s are your hardest days, Strain ${a} against ${b} on the others.` };
  }
  return { ...base, subject: "recovery", title: `${day}s run low`, body: `${lead} An earlier night on ${eve}s is the simplest thing to try.` };
}

// Bedtime

/** Nights in bed before the median against after it, and the Recovery that followed. */
export function bedtimePattern(nights: readonly PatternNight[]): Pattern | null {
  const rows = nights.filter((n): n is PatternNight & { recovery: number; bedMin: number } => finite(n.recovery) && finite(n.bedMin));
  if (rows.length < PATTERNS.minBedSide * 2) return null;
  const mid = median(rows.map((n) => n.bedMin));
  const early = rows.filter((n) => n.bedMin < mid);
  const late = rows.filter((n) => n.bedMin >= mid);
  if (early.length < PATTERNS.minBedSide || late.length < PATTERNS.minBedSide) return null;
  if (median(late.map((n) => n.bedMin)) - median(early.map((n) => n.bedMin)) < PATTERNS.minBedGap) return null;
  const { ciLow } = armDiff(
    early.map((n) => n.recovery),
    late.map((n) => n.recovery),
    "bedtime",
  );
  const [a, b] = [r0(avg(early.map((n) => n.recovery))), r0(avg(late.map((n) => n.recovery)))];
  if (ciLow <= 0 || a - b < PATTERNS.minBedGain) return null;
  const at = clockOf(mid);
  return {
    key: "bedtime",
    kind: "bedtime",
    subject: "sleep",
    title: `In bed by ${at}`,
    body: `On nights you get to bed before ${at}, your Recovery averages ${a}% against ${b}% when it’s later.`,
    href: "/sleep",
    ask: `How much does going to bed before ${at} help my Recovery?`,
    weight: a - b,
  };
}

// Timing

export type TimingOutcome = "deep" | "sleep" | "recovery";
/** One medicine's early-vs-late split against one outcome (journal.ts doseTiming). */
export type TimingFinding = DoseTimingItem & { outcome: TimingOutcome };

const OUTCOME_NAME: Record<Exclude<TimingOutcome, "deep">, string> = { sleep: "Sleep score", recovery: "Recovery" };

/** A medicine's clearest timing effect, phrased as when to take it; null below the thresholds. */
export function timingPattern(findings: readonly TimingFinding[]): Pattern | null {
  let best: Pattern | null = null;
  for (const f of findings) {
    if (f.effect === "none") continue;
    const earlier = f.delta < 0;
    const [good, bad] = earlier ? [f.early.avg, f.late.avg] : [f.late.avg, f.early.avg];
    const when = earlier ? `before ${f.split}` : `after ${f.split}`;
    const base = { key: `timing:${f.tag}`, kind: "timing" as const, title: `Take ${f.label} ${when}`, ask: `Does the time I take ${f.label} change my sleep and Recovery?` };
    let p: Pattern | null = null;
    if (f.outcome === "deep") {
      if (!(bad > 0)) continue;
      const pct = r0(((good - bad) / bad) * 100);
      if (pct < PATTERNS.minDeepPct) continue;
      p = { ...base, subject: "sleep", href: "/sleep", weight: pct / 2, body: `Your deep sleep runs ${pct}% higher (${r0(good)} against ${r0(bad)} min) on nights you take it ${when}.` };
    } else {
      const pts = r0(good - bad);
      if (pts < PATTERNS.minPoints) continue;
      const name = OUTCOME_NAME[f.outcome];
      p = {
        ...base,
        subject: f.outcome,
        href: f.outcome === "sleep" ? "/sleep" : "/recovery",
        weight: pts,
        body: `Your ${name} averages ${r0(good)}% when you take it ${when}, against ${r0(bad)}% otherwise.`,
      };
    }
    if (!best || p.weight > best.weight) best = p;
  }
  return best;
}

// Behaviour

/** Tags that say what happened to you rather than what you chose: nothing to act on. */
const NOT_A_CHOICE = new Set(["illness", "travel"]);

/** The journal behaviours with a clear next-day effect, one per tag (its larger outcome). */
export function behaviourPatterns(byOutcome: { recovery: JournalInsightsVM["items"]; sleep: JournalInsightsVM["items"] }): Pattern[] {
  const best = new Map<string, Pattern>();
  for (const outcome of ["recovery", "sleep"] as const) {
    for (const it of byOutcome[outcome]) {
      if (NOT_A_CHOICE.has(it.key) || it.effect === "none" || !it.effect) continue;
      if (!finite(it.avgWith) || !finite(it.avgWithout)) continue;
      const [w, wo] = [r0(it.avgWith), r0(it.avgWithout)];
      const gap = Math.abs(w - wo);
      if (gap < PATTERNS.minBehaviour) continue;
      const name = outcome === "recovery" ? "Recovery" : "Sleep score";
      const hurts = w < wo;
      const p: Pattern = {
        key: `behaviour:${it.key}`,
        kind: "behaviour",
        subject: outcome,
        title: hurts ? `${it.label} costs you ${outcome === "recovery" ? "Recovery" : "sleep"}` : `${it.label} helps your ${name}`,
        body: `The day after you log ${it.label}, your ${name} averages ${w}% against ${wo}% without it (${it.yes ?? 0} days logged).`,
        href: "/journal/insights",
        ask: `How much does ${it.label} affect my ${name}?`,
        weight: gap,
      };
      const had = best.get(it.key);
      if (!had || p.weight > had.weight) best.set(it.key, p);
    }
  }
  return [...best.values()];
}

// All of them

export type PatternInput = {
  nights: readonly PatternNight[];
  timing: readonly TimingFinding[];
  behaviours: { recovery: JournalInsightsVM["items"]; sleep: JournalInsightsVM["items"] };
};

/** The strongest findings first, at most PATTERNS.max; the weekday's and timing's ahead of a tie (they're the most specific). */
export function findPatterns(input: PatternInput): Pattern[] {
  const byTag = new Map<string, TimingFinding[]>();
  for (const f of input.timing) byTag.set(f.tag, [...(byTag.get(f.tag) ?? []), f]);
  const timing = [...byTag.values()].map(timingPattern).filter((p): p is Pattern => !!p);
  const all = [weekdayPattern(input.nights), bedtimePattern(input.nights), ...timing, ...behaviourPatterns(input.behaviours)].filter((p): p is Pattern => !!p);
  // A behaviour that is also a timed medicine says the same thing twice: the timing card is the more useful one.
  const timed = new Set(timing.map((p) => p.key.slice("timing:".length)));
  const kept = all.filter((p) => !(p.kind === "behaviour" && timed.has(p.key.slice("behaviour:".length))));
  const rank: Record<PatternKind, number> = { weekday: 0, timing: 1, bedtime: 2, behaviour: 3 };
  return kept.sort((a, b) => b.weight - a.weight || rank[a.kind] - rank[b.kind] || a.key.localeCompare(b.key)).slice(0, PATTERNS.max);
}

/** A night from the day's stored row. */
export function nightOf(row: DayRow, timeZone: string): PatternNight {
  const main = row.sleep?.main ?? null;
  let bedMin: number | null = null;
  if (main) {
    const clock = localMinutes(main.start, timeZone);
    // Before noon counts as past midnight of the evening before.
    bedMin = clock < 12 * 60 ? clock + 1440 : clock;
  }
  return {
    day: row.day,
    recovery: row.recovery?.value ?? null,
    sleepPerf: row.sleep?.performance ?? null,
    deepMin: main?.deepMin ?? null,
    asleepMin: main?.asleepMin ?? null,
    bedMin,
    strain: row.s1?.effort != null ? toStrain(row.s1.effort) : null,
  };
}

/** Today's patterns from the last PATTERNS.days days. */
export async function getPatterns(ctx: QueryCtx): Promise<Pattern[]> {
  const from = addDays(ctx.today, -PATTERNS.days);
  const [rows, entries, tags, recovery, sleep] = await Promise.all([
    loadDays(ctx, from, ctx.today),
    ctx.store.loggedEntries(ctx.now - 91 * 86_400, 5000),
    ctx.store.journalTags(),
    getJournalInsights("recovery", ctx),
    getJournalInsights("sleep", ctx),
  ]);
  const nights = [...rows.values()].sort((a, b) => (a.day < b.day ? -1 : 1)).map((r) => nightOf(r, ctx.timeZone));
  const byDay = new Map(nights.map((n) => [n.day, n]));
  const label = new Map(tags.map((t) => [t.tag, t.label]));
  const { doses, nameByTag } = timedDoses(entries, addDays(ctx.today, -90), ctx.timeZone);
  const labelOf = (t: string) => label.get(t) ?? nameByTag.get(t) ?? t;
  const outcomes: Record<TimingOutcome, (day: string) => number | null | undefined> = {
    deep: (d) => byDay.get(d)?.deepMin,
    sleep: (d) => byDay.get(d)?.sleepPerf,
    recovery: (d) => byDay.get(d)?.recovery,
  };
  const timing = (Object.keys(outcomes) as TimingOutcome[]).flatMap((o) => doseTiming(doses, outcomes[o], labelOf).items.map((it) => ({ ...it, outcome: o })));
  return findPatterns({ nights, timing, behaviours: { recovery: recovery.items, sleep: sleep.items } });
}

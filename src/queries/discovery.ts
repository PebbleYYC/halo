// Discovery: the measurements and journal laid out as one table of daily variables, and one generic test that any
// pairing of them can be put to. Nothing here knows what a "good" finding looks like: the screen tests every
// combination of a thing you do (a day's Strain, steps or stress, an evening's bedtime or dose time, a journal answer,
// the weekday) against the night that follows, and every night against the day it starts, and the Coach's model may
// ask for any other test, narrowed to one weekday if it likes (src/coach/discover.ts). Whatever is shown must have
// survived the same bar across every test run that day: Welch's t with the Benjamini–Hochberg correction (q ≤ 0.1),
// an effect of at least 0.3 SD, and 8 days on each side.
//
// Alignment: a variable's value on day D means
//   night    the night that ended on the morning of D (that day's stored Recovery and sleep);
//   day      what happened during D (Strain, steps, stress);
//   evening  the evening of D (getting into bed that night, a medicine's evening dose, from 15:00);
//   journal  D's check-in answers (yes/no, or a count);
//   weekday  D is that weekday.
// A test pairs x on D with y on D + lag (lag 1: the night after; lag 0: the same day).
import { addDays, localMinutes } from "@/lib/time";
import { withMedicineNoDays } from "@/lib/medicine";
import { finite, loadDays, type DayRow, type QueryCtx, toStrain } from "./common";
import { eveningDoses, tagRows, timedDoses } from "./journal";

export type VarGroup = "night" | "day" | "evening" | "journal" | "weekday";
export type Variable = {
  key: string;
  label: string;
  /** "%", "SD", "bpm", "min", "clock", "strain", "steps", "count", "flag". */
  unit: string;
  group: VarGroup;
  /** Yes/no: tests compare yes days against no days; else days above the median against below. */
  flag: boolean;
  values: Map<string, number>;
};

export const DISCOVERY = {
  days: 120,
  minArm: 8,
  minD: 0.3,
  q: 0.1,
  /** Screen results shown to the model as a starting point. */
  shortlist: 30,
  /** Extra tests the model may run. */
  maxModelTests: 25,
} as const;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
export const weekdayName = (w: number) => WEEKDAYS[w];

/** "21:00" from minutes after midnight (wrapping past 24 h), to 5 minutes. */
export function clockOf(min: number): string {
  const m = ((Math.round(min / 5) * 5) % 1440 + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** A value as the person reads it: the unit's rounding, clocks as HH:MM, no thousands separators. */
export function fmt(v: number, unit: string): string {
  if (unit === "clock") return clockOf(v);
  if (unit === "SD" || unit === "strain") return v.toFixed(1);
  return String(Math.round(v));
}

// The table

const NIGHT_VARS: { key: string; label: string; unit: string; of: (r: DayRow) => number | null | undefined }[] = [
  { key: "recovery", label: "Recovery", unit: "%", of: (r) => r.recovery?.value },
  { key: "hrv", label: "HRV against your baseline", unit: "SD", of: (r) => r.recovery?.hrvZ },
  { key: "rhr", label: "Resting heart rate", unit: "bpm", of: (r) => r.recovery?.inputs.rhr },
  { key: "sleep", label: "Sleep score", unit: "%", of: (r) => r.sleep?.performance },
  { key: "asleep", label: "Time asleep", unit: "min", of: (r) => r.sleep?.main?.asleepMin },
  { key: "deep", label: "Deep sleep", unit: "min", of: (r) => r.sleep?.main?.deepMin },
  { key: "rem", label: "REM sleep", unit: "min", of: (r) => r.sleep?.main?.remMin },
  { key: "efficiency", label: "Sleep efficiency", unit: "%", of: (r) => r.sleep?.main?.efficiency },
  { key: "latency", label: "Time to fall asleep", unit: "min", of: (r) => r.sleep?.main?.latencyMin },
];

/** Minutes after the previous midnight: a clock before noon counts as past midnight (00:30 = 1 470). */
const eveningMin = (ts: number, tz: string) => {
  const m = localMinutes(ts, tz);
  return m < 12 * 60 ? m + 1440 : m;
};

export type DiscoveryData = {
  rows: readonly DayRow[];
  journal: readonly { day: string; tag: string; value: number }[];
  tagLabel: (tag: string) => string;
  doses: readonly { tag: string; day: string; minute: number }[];
  doseLabel: (tag: string) => string;
  timeZone: string;
  /** The last finished day: the medicine no-days end here, and a day's own totals count up to it. */
  lastDay: string;
};

/** Every variable with at least a fortnight of values. */
export function buildVariables(d: DiscoveryData): Variable[] {
  const byDay = new Map(d.rows.map((r) => [r.day, r]));
  const out: Variable[] = [];
  const add = (v: Omit<Variable, "values">, values: Map<string, number>) => {
    if (values.size >= 14) out.push({ ...v, values });
  };
  const map = (f: (r: DayRow) => number | null | undefined) => {
    const m = new Map<string, number>();
    for (const r of d.rows) {
      const v = f(r);
      if (finite(v)) m.set(r.day, v);
    }
    return m;
  };
  // A day still under way has partial Strain, steps and stress: only finished days count.
  const done = (m: Map<string, number>) => new Map([...m].filter(([day]) => day <= d.lastDay));
  for (const n of NIGHT_VARS) add({ key: n.key, label: n.label, unit: n.unit, group: "night", flag: false }, map(n.of));
  add({ key: "wake", label: "Wake-up time", unit: "clock", group: "night", flag: false }, map((r) => (r.sleep?.main ? localMinutes(r.sleep.main.end, d.timeZone) : null)));
  add({ key: "strain", label: "Day Strain", unit: "strain", group: "day", flag: false }, done(map((r) => (r.s1?.effort != null ? toStrain(r.s1.effort) : null))));
  add({ key: "steps", label: "Steps", unit: "steps", group: "day", flag: false }, done(map((r) => r.metrics?.steps)));
  add({ key: "stress", label: "Average stress", unit: "%", group: "day", flag: false }, done(map((r) => r.stress?.average)));
  // The evening of D gets into bed for the night stored on D + 1.
  add(
    { key: "bedtime", label: "Bedtime", unit: "clock", group: "evening", flag: false },
    map((r) => {
      const next = byDay.get(addDays(r.day, 1))?.sleep?.main;
      return next ? eveningMin(next.start, d.timeZone) : null;
    }),
  );
  // A medicine's evening dose (journal.ts eveningDoses): a morning one is too far from the night to judge it on.
  for (const [tag, m] of eveningDoses(d.doses)) add({ key: `dose:${tag}`, label: `${d.doseLabel(tag)} evening dose time`, unit: "clock", group: "evening", flag: false }, m);
  // Journal answers: the days a behaviour was answered, yes (or a count) against no; a medicine's no-days filled in.
  const answers = new Map<string, Record<string, number>>();
  for (const e of d.journal) answers.set(e.day, { ...answers.get(e.day), [e.tag]: e.value });
  const filled = withMedicineNoDays(
    [...answers].map(([day, tags]) => ({ day, tags })),
    d.lastDay,
  );
  const tags = new Map<string, Map<string, number>>();
  for (const a of filled) {
    for (const [tag, v] of Object.entries(a.tags)) {
      const m = tags.get(tag) ?? new Map<string, number>();
      m.set(a.day, Number(v));
      tags.set(tag, m);
    }
  }
  for (const [tag, m] of tags) {
    const yes = [...m.values()].filter((v) => v > 0).length;
    if (yes >= DISCOVERY.minArm && m.size - yes >= DISCOVERY.minArm) add({ key: `tag:${tag}`, label: d.tagLabel(tag), unit: "flag", group: "journal", flag: true }, m);
  }
  const days = d.rows.map((r) => r.day);
  for (let w = 0; w < 7; w++) add({ key: `weekday:${w}`, label: `${WEEKDAYS[w]}`, unit: "flag", group: "weekday", flag: true }, new Map(days.map((day) => [day, weekdayOf(day) === w ? 1 : 0])));
  return out;
}

// The test

export type Arm = { n: number; mean: number; x: number };
export type TestResult = {
  id: string;
  x: string;
  y: string;
  lag: 0 | 1;
  /** Only days of x on this weekday, or null for all. */
  weekday: number | null;
  /** Numeric x: the median it was split at; null for a yes/no x. */
  split: number | null;
  /** Yes days / days at or above the split, and the rest. `x` is the arm's mean x. */
  hi: Arm;
  lo: Arm;
  /** mean(y | hi) − mean(y | lo), in y's unit; `d` the same over the pooled SD. */
  delta: number;
  d: number;
  p: number;
  /** Set once every test of the run is in: the BH-adjusted p. */
  q?: number;
};

const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
const variance = (xs: number[], m: number) => xs.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, xs.length - 1);

/** ln Γ (Lanczos). */
function lnGamma(z: number): number {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const c of g) ser += c / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** The regularised incomplete beta I_x(a, b) by its continued fraction (Numerical Recipes betacf). */
function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (xx: number, aa: number, bb: number) => {
    const tiny = 1e-30;
    let c = 1;
    let d = 1 - ((aa + bb) * xx) / (aa + 1);
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 200; m++) {
      const m2 = 2 * m;
      let num = (m * (bb - m) * xx) / ((aa + m2 - 1) * (aa + m2));
      d = 1 + num * d;
      if (Math.abs(d) < tiny) d = tiny;
      c = 1 + num / c;
      if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      h *= d * c;
      num = (-(aa + m) * (aa + bb + m) * xx) / ((aa + m2) * (aa + m2 + 1));
      d = 1 + num * d;
      if (Math.abs(d) < tiny) d = tiny;
      c = 1 + num / c;
      if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 3e-12) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2) ? (front * cf(x, a, b)) / a : 1 - (front * cf(1 - x, b, a)) / b;
}

/** Two-sided p of Student's t with `df` degrees of freedom. */
export function tTwoSided(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0;
  return betaInc(df / (df + t * t), df / 2, 0.5);
}

/** Welch's two-sample t-test's two-sided p. */
export function welchP(a: number[], b: number[]): number {
  const [ma, mb] = [mean(a), mean(b)];
  const [va, vb] = [variance(a, ma) / a.length, variance(b, mb) / b.length];
  const se = Math.sqrt(va + vb);
  if (se === 0) return ma === mb ? 1 : 0;
  const df = (va + vb) ** 2 / (va ** 2 / Math.max(1, a.length - 1) + vb ** 2 / Math.max(1, b.length - 1));
  return tTwoSided((ma - mb) / se, df);
}

/** Benjamini–Hochberg: each result's q, in place. */
export function adjust(results: TestResult[]): TestResult[] {
  const m = results.length;
  const order = [...results].sort((a, b) => a.p - b.p);
  let next = 1;
  for (let i = m - 1; i >= 0; i--) {
    next = Math.min(next, (order[i].p * m) / (i + 1));
    order[i].q = next;
  }
  return results;
}

export const testId = (x: string, y: string, lag: 0 | 1, weekday: number | null) => `${x}>${y}@${lag}${weekday == null ? "" : `/${weekday}`}`;

/** x on D against y on D + lag; null when either side has fewer than DISCOVERY.minArm days or x doesn't split. */
export function runTest(vars: ReadonlyMap<string, Variable>, x: string, y: string, lag: 0 | 1, weekday: number | null = null): TestResult | null {
  const vx = vars.get(x);
  const vy = vars.get(y);
  if (!vx || !vy || (x === y && lag === 0)) return null;
  const pairs: { x: number; y: number }[] = [];
  for (const [day, xv] of vx.values) {
    if (weekday != null && weekdayOf(day) !== weekday) continue;
    const yv = vy.values.get(lag ? addDays(day, lag) : day);
    if (yv != null) pairs.push({ x: xv, y: yv });
  }
  let hi: typeof pairs;
  let lo: typeof pairs;
  let split: number | null = null;
  if (vx.flag) {
    hi = pairs.filter((p) => p.x > 0);
    lo = pairs.filter((p) => p.x <= 0);
  } else {
    const xs = pairs.map((p) => p.x).sort((a, b) => a - b);
    if (!xs.length) return null;
    split = xs[Math.floor(xs.length / 2)];
    hi = pairs.filter((p) => p.x >= split!);
    lo = pairs.filter((p) => p.x < split!);
  }
  if (hi.length < DISCOVERY.minArm || lo.length < DISCOVERY.minArm) return null;
  const [ya, yb] = [hi.map((p) => p.y), lo.map((p) => p.y)];
  const [ma, mb] = [mean(ya), mean(yb)];
  const pooled = Math.sqrt(((ya.length - 1) * variance(ya, ma) + (yb.length - 1) * variance(yb, mb)) / (ya.length + yb.length - 2));
  const delta = ma - mb;
  return {
    id: testId(x, y, lag, weekday),
    x,
    y,
    lag,
    weekday,
    split,
    hi: { n: hi.length, mean: ma, x: mean(hi.map((p) => p.x)) },
    lo: { n: lo.length, mean: mb, x: mean(lo.map((p) => p.x)) },
    delta,
    d: pooled > 0 ? delta / pooled : 0,
    p: welchP(ya, yb),
  };
}

/** Every pairing the screen tests: what you do against the night after, and each night against the day it starts. */
export function screenPairs(vars: readonly Variable[]): { x: string; y: string; lag: 0 | 1 }[] {
  const outcomesNight = vars.filter((v) => v.group === "night" && v.key !== "wake");
  const outcomesDay = vars.filter((v) => v.key === "stress" || v.key === "strain");
  const out: { x: string; y: string; lag: 0 | 1 }[] = [];
  for (const x of vars) {
    if (x.group === "day" || x.group === "evening" || x.group === "journal" || x.group === "weekday") for (const y of outcomesNight) out.push({ x: x.key, y: y.key, lag: 1 });
    if (x.group === "night" || x.group === "weekday") for (const y of outcomesDay) out.push({ x: x.key, y: y.key, lag: 0 });
  }
  return out;
}

/** Whether a result clears the bar to be shown (its q from the whole day's family). */
export const passes = (r: TestResult) => r.q != null && r.q <= DISCOVERY.q && Math.abs(r.d) >= DISCOVERY.minD && r.hi.n >= DISCOVERY.minArm && r.lo.n >= DISCOVERY.minArm;

/** A result as the model reads it, every number already in the form the person may be shown. */
export function describeResult(r: TestResult, vars: ReadonlyMap<string, Variable>) {
  const vx = vars.get(r.x)!;
  const vy = vars.get(r.y)!;
  const pct = r.lo.mean !== 0 && (vy.unit === "min" || vy.unit === "steps") ? Math.round((Math.abs(r.delta) / Math.abs(r.lo.mean)) * 100) : null;
  return {
    id: r.id,
    x: vx.label,
    y: vy.label,
    when: r.lag === 1 ? "x on a day, y on the night after it (the next morning's scores)" : vx.group === "night" ? "x on a night, y on the day it starts" : "x on a day, y the same day",
    onlyWeekday: r.weekday == null ? null : weekdayName(r.weekday),
    compare: vx.flag ? { yes: `${r.hi.n} days`, no: `${r.lo.n} days` } : { atOrAbove: `${fmt(r.split!, vx.unit)} (${r.hi.n} days)`, below: `${fmt(r.split!, vx.unit)} (${r.lo.n} days)` },
    yAverages: { [vx.flag ? "yes" : "atOrAbove"]: `${fmt(r.hi.mean, vy.unit)} ${vy.unit}`, [vx.flag ? "no" : "below"]: `${fmt(r.lo.mean, vy.unit)} ${vy.unit}` },
    difference: `${fmt(Math.abs(r.delta), vy.unit)} ${vy.unit}${pct != null ? ` (${pct}%)` : ""} ${r.delta >= 0 ? "higher" : "lower"} on the ${vx.flag ? "yes" : "at-or-above"} side`,
    effectSize: Math.round(r.d * 100) / 100,
    q: r.q == null ? null : Math.round(r.q * 1000) / 1000,
    clearsBar: passes(r),
  };
}

/** The numbers a finding citing `r` may state. */
export function numbersOf(r: TestResult, vars: ReadonlyMap<string, Variable>): string[] {
  const vx = vars.get(r.x)!;
  const vy = vars.get(r.y)!;
  const out = [fmt(r.hi.mean, vy.unit), fmt(r.lo.mean, vy.unit), fmt(Math.abs(r.delta), vy.unit), String(r.hi.n), String(r.lo.n)];
  if (r.split != null) out.push(fmt(r.split, vx.unit));
  if (!vx.flag) out.push(fmt(r.hi.x, vx.unit), fmt(r.lo.x, vx.unit));
  // The same percentage describeResult offers, only where it does.
  if (r.lo.mean !== 0 && (vy.unit === "min" || vy.unit === "steps")) out.push(String(Math.round((Math.abs(r.delta) / Math.abs(r.lo.mean)) * 100)));
  // Signs are words in the text ("lower", "below"): compare magnitudes.
  return out.map((n) => n.replace(/^-/, ""));
}

/** The day's variables from the store. */
export async function loadDiscovery(ctx: QueryCtx): Promise<Variable[]> {
  const from = addDays(ctx.today, -DISCOVERY.days);
  const [rows, journal, tags, entries] = await Promise.all([loadDays(ctx, from, ctx.today), ctx.store.allJournal(), tagRows(ctx.store), ctx.store.loggedEntries(ctx.now - (DISCOVERY.days + 1) * 86_400, 8000)]);
  const label = new Map(tags.map((t) => [t.tag, t.label]));
  const { doses, nameByTag } = timedDoses(entries, from, ctx.timeZone);
  return buildVariables({
    rows: [...rows.values()].sort((a, b) => (a.day < b.day ? -1 : 1)),
    journal: journal.filter((e) => e.day >= from && e.day <= ctx.today),
    tagLabel: (t) => label.get(t) ?? t,
    doses,
    doseLabel: (t) => label.get(t) ?? nameByTag.get(t) ?? t,
    timeZone: ctx.timeZone,
    lastDay: addDays(ctx.today, -1),
  });
}

/** Every screen test, BH-adjusted together. */
export function screen(vars: readonly Variable[]): TestResult[] {
  const byKey = new Map(vars.map((v) => [v.key, v]));
  const results = screenPairs(vars)
    .map((p) => runTest(byKey, p.x, p.y, p.lag))
    .filter((r): r is TestResult => !!r);
  return adjust(results);
}

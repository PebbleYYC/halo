// Headache risk: weather triggers (pressure change, humidity, temperature or wind jump) plus body factors (short sleep,
// low Recovery, stress, alcohol) add points to Low, Medium or High, each point keeping its reason. Your own pattern
// (which of these your logged headaches follow) adds a point to each trigger linked to yours.
import { addDays } from "@/lib/time";
import type { WeatherDay } from "./openMeteo";

export type RiskLevel = "low" | "medium" | "high";
export type RiskFactor = (
  | { key: "pressure_drop" | "pressure_rise"; hPa: number; points: number }
  | { key: "high_pressure" | "low_pressure"; hPa: number; points: number }
  | { key: "humidity"; pct: number; points: number }
  | { key: "temp_jump"; celsius: number; points: number }
  | { key: "wind_jump"; kmh: number; points: number }
  | { key: "short_sleep"; minutes: number; points: number }
  | { key: "low_recovery" | "alcohol"; points: number }
  | { key: "stress"; minutes: number; points: number }
) & {
  /** Your own pattern links this trigger to your headaches: it counts a point more. */
  personal?: boolean;
};
export type DayRisk = { day: string; level: RiskLevel; points: number; factors: RiskFactor[] };

export type Body = { sleepShortMin: number | null; recoveryRed: boolean; highStressMin: number | null; alcoholYesterday: boolean };

/** Thresholds (Kimoto 2011: a 5 hPa day-to-day pressure fall; Martin 2018: humidity of 79 % or more, a 7 mph wind rise). */
export const RISK = { dropHPa: 5, bigDropHPa: 8, riseHPa: 5, humidityPct: 79, tempJumpC: 5.5, windJumpKmh: 11, sleepShortMin: 60, stressMin: 60, mediumFrom: 2, highFrom: 4 };

export function weatherFactors(days: readonly WeatherDay[], day: string): RiskFactor[] {
  const by = new Map(days.map((d) => [d.day, d]));
  const d = by.get(day);
  const prev = by.get(addDays(day, -1));
  if (!d) return [];
  const out: RiskFactor[] = [];
  if (prev) {
    const dp = d.pressure - prev.pressure;
    if (dp <= -RISK.dropHPa) out.push({ key: "pressure_drop", hPa: -dp, points: dp <= -RISK.bigDropHPa ? 3 : 2 });
    else if (dp >= RISK.riseHPa) out.push({ key: "pressure_rise", hPa: dp, points: 1 });
    const dt = d.tempMax - prev.tempMax;
    if (Math.abs(dt) >= RISK.tempJumpC) out.push({ key: "temp_jump", celsius: dt, points: 1 });
    const dw = d.windMax - prev.windMax;
    if (dw >= RISK.windJumpKmh) out.push({ key: "wind_jump", kmh: dw, points: 1 });
  }
  if (d.humidity >= RISK.humidityPct) out.push({ key: "humidity", pct: d.humidity, points: 1 });
  return out;
}

export function bodyFactors(b: Body): RiskFactor[] {
  const out: RiskFactor[] = [];
  if (b.sleepShortMin != null && b.sleepShortMin >= RISK.sleepShortMin) out.push({ key: "short_sleep", minutes: b.sleepShortMin, points: 1 });
  if (b.recoveryRed) out.push({ key: "low_recovery", points: 1 });
  if (b.highStressMin != null && b.highStressMin >= RISK.stressMin) out.push({ key: "stress", minutes: b.highStressMin, points: 1 });
  if (b.alcoholYesterday) out.push({ key: "alcohol", points: 1 });
  return out;
}

/** The risk factor a pattern trigger stands for (the pattern's temperature swing is the risk's temperature jump). */
const FACTOR_OF: Record<TriggerKey, RiskFactor["key"]> = {
  pressure_drop: "pressure_drop",
  pressure_rise: "pressure_rise",
  high_pressure: "high_pressure",
  low_pressure: "low_pressure",
  humidity: "humidity",
  temp_swing: "temp_jump",
  wind_jump: "wind_jump",
  short_sleep: "short_sleep",
  stress: "stress",
  alcohol: "alcohol",
};

/** What your own pattern adds to the day's risk: the triggers linked to your headaches, and your pressure levels. */
export type Personal = { linked: ReadonlySet<TriggerKey>; levels: { hi: number; lo: number } | null };

export function dayRisk(days: readonly WeatherDay[], day: string, body: Body | null, personal?: Personal): DayRisk | null {
  const d = days.find((x) => x.day === day);
  if (!d) return null;
  let factors = [...weatherFactors(days, day), ...(body ? bodyFactors(body) : [])];
  if (personal && personal.linked.size) {
    const linked = new Set([...personal.linked].map((k) => FACTOR_OF[k]));
    factors = factors.map((f) => (linked.has(f.key) ? { ...f, points: f.points + 1, personal: true } : f));
    // High or low pressure only counts for someone whose headaches follow it.
    const lv = personal.levels;
    if (lv && linked.has("high_pressure") && d.pressure >= lv.hi) factors.push({ key: "high_pressure", hPa: d.pressure, points: 1, personal: true });
    if (lv && linked.has("low_pressure") && d.pressure <= lv.lo) factors.push({ key: "low_pressure", hPa: d.pressure, points: 1, personal: true });
  }
  factors.sort((a, b) => b.points - a.points);
  const points = factors.reduce((n, f) => n + f.points, 0);
  return { day, points, factors, level: points >= RISK.highFrom ? "high" : points >= RISK.mediumFrom ? "medium" : "low" };
}

/** A trigger the personal pattern checks, each against your own logged headaches. */
export type TriggerKey = "pressure_drop" | "pressure_rise" | "high_pressure" | "low_pressure" | "humidity" | "temp_swing" | "wind_jump" | "short_sleep" | "stress" | "alcohol";
/** What the app knows of your own day, per past day (null: not measured that day). */
export type DayBody = { shortSleep: boolean | null; highStress: boolean | null; alcoholBefore: boolean };
export type Verdict = "more" | "no_link" | "unclear";
/** Headaches on the days a trigger was there (`hits` of them, on `onDays` days), against your rate on the other days. */
export type TriggerLink = { key: TriggerKey; verdict: Verdict; hits: number; onDays: number; ratio: number | null };
export type Pattern = { kind: "not_enough"; headacheDays: number; needed: number } | { kind: "ready"; headacheDays: number; links: TriggerLink[] };

/**
 * Looser than the risk's thresholds, so a few months hold enough trigger days to compare. "High" and "low" pressure
 * are your own top and bottom fifth: surface pressure depends on altitude, so a fixed number would mean nothing.
 */
export const PATTERN = { dropHPa: 3, riseHPa: 3, levelShare: 0.2, humidityPct: 79, tempSwingC: 4, windJumpKmh: 11, minHeadaches: 5, minDays: 5, minHits: 3, moreRatio: 1.5, noLinkRatio: 1.25 };
const ORDER: TriggerKey[] = ["pressure_drop", "pressure_rise", "high_pressure", "low_pressure", "humidity", "temp_swing", "wind_jump", "short_sleep", "stress", "alcohol"];

function quantile(sorted: readonly number[], q: number): number {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
}

/** Which triggers were there on a past day (null: can't tell that day). */
function triggersOn(d: WeatherDay, prev: WeatherDay | undefined, hiP: number, loP: number, body: DayBody | undefined): Partial<Record<TriggerKey, boolean | null>> {
  const dp = prev ? d.pressure - prev.pressure : null;
  return {
    pressure_drop: dp == null ? null : dp <= -PATTERN.dropHPa,
    pressure_rise: dp == null ? null : dp >= PATTERN.riseHPa,
    high_pressure: d.pressure >= hiP,
    low_pressure: d.pressure <= loP,
    humidity: d.humidity >= PATTERN.humidityPct,
    temp_swing: prev ? Math.abs(d.tempMax - prev.tempMax) >= PATTERN.tempSwingC : null,
    wind_jump: prev ? d.windMax - prev.windMax >= PATTERN.windJumpKmh : null,
    short_sleep: body?.shortSleep ?? null,
    stress: body?.highStress ?? null,
    alcohol: body?.alcoholBefore ?? false,
  };
}

/**
 * How often logged headaches fall on the days each trigger was there against the days it wasn't, over the weather
 * history (past days only). A trigger with too few days to compare is left out. "more": at least 3 headaches on its
 * days and 1.5× your rate on other days; "no_link": under 1.25×.
 */
export function headachePattern(days: readonly WeatherDay[], headacheDays: ReadonlySet<string>, today: string, body: ReadonlyMap<string, DayBody> = new Map()): Pattern {
  const past = days.filter((d) => d.day <= today);
  const by = new Map(past.map((d) => [d.day, d]));
  const total = past.filter((d) => headacheDays.has(d.day)).length;
  if (total < PATTERN.minHeadaches) return { kind: "not_enough", headacheDays: total, needed: PATTERN.minHeadaches };
  const sorted = past.map((d) => d.pressure).sort((a, b) => a - b);
  const hiP = quantile(sorted, 1 - PATTERN.levelShare);
  const loP = quantile(sorted, PATTERN.levelShare);
  const tally = new Map<TriggerKey, { on: number; onHit: number; off: number; offHit: number }>(ORDER.map((k) => [k, { on: 0, onHit: 0, off: 0, offHit: 0 }]));
  for (const d of past) {
    const had = headacheDays.has(d.day);
    const on = triggersOn(d, by.get(addDays(d.day, -1)), hiP, loP, body.get(d.day));
    for (const k of ORDER) {
      const v = on[k];
      if (v == null) continue;
      const t = tally.get(k)!;
      if (v) {
        t.on++;
        if (had) t.onHit++;
      } else {
        t.off++;
        if (had) t.offHit++;
      }
    }
  }
  const links: TriggerLink[] = [];
  for (const k of ORDER) {
    const t = tally.get(k)!;
    if (t.on < PATTERN.minDays || t.off < PATTERN.minDays) continue;
    const rOn = t.onHit / t.on;
    const rOff = t.offHit / t.off;
    const ratio = rOff > 0 ? rOn / rOff : null;
    const verdict: Verdict = t.onHit >= PATTERN.minHits && (ratio === null || ratio >= PATTERN.moreRatio) ? "more" : ratio !== null && ratio < PATTERN.noLinkRatio ? "no_link" : "unclear";
    links.push({ key: k, verdict, hits: t.onHit, onDays: t.on, ratio });
  }
  const rank: Record<Verdict, number> = { more: 0, unclear: 1, no_link: 2 };
  links.sort((a, b) => rank[a.verdict] - rank[b.verdict] || (b.ratio ?? 99) - (a.ratio ?? 99));
  return { kind: "ready", headacheDays: total, links };
}

/** The pressure your own top and bottom fifth start at, over the history (for "high" and "low" pressure today). */
export function pressureLevels(days: readonly WeatherDay[], today: string): { hi: number; lo: number } | null {
  const sorted = days.filter((d) => d.day <= today).map((d) => d.pressure).sort((a, b) => a - b);
  if (sorted.length < 20) return null;
  return { hi: quantile(sorted, 1 - PATTERN.levelShare), lo: quantile(sorted, PATTERN.levelShare) };
}

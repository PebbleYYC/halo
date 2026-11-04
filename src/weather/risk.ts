// Headache risk for a day: weather changes the studies link to new headaches (a day-to-day pressure change, high
// humidity, a temperature or wind jump) plus the body's own lowered threshold (short sleep, low Recovery, stress,
// alcohol). Points add up to Low, Medium or High, and every point keeps its reason.
import { addDays } from "@/lib/time";
import type { WeatherDay } from "./openMeteo";

export type RiskLevel = "low" | "medium" | "high";
export type RiskFactor =
  | { key: "pressure_drop" | "pressure_rise"; hPa: number; points: number }
  | { key: "humidity"; pct: number; points: number }
  | { key: "temp_jump"; celsius: number; points: number }
  | { key: "wind_jump"; kmh: number; points: number }
  | { key: "short_sleep"; minutes: number; points: number }
  | { key: "low_recovery" | "alcohol"; points: number }
  | { key: "stress"; minutes: number; points: number };
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

export function dayRisk(days: readonly WeatherDay[], day: string, body: Body | null): DayRisk | null {
  if (!days.some((d) => d.day === day)) return null;
  const factors = [...weatherFactors(days, day), ...(body ? bodyFactors(body) : [])].sort((a, b) => b.points - a.points);
  const points = factors.reduce((n, f) => n + f.points, 0);
  return { day, points, factors, level: points >= RISK.highFrom ? "high" : points >= RISK.mediumFrom ? "medium" : "low" };
}

export type Pattern =
  | { kind: "not_enough"; headacheDays: number; needed: number }
  | { kind: "more" | "no_link" | "unclear"; headacheDays: number; ratio: number | null; onDropDays: number; dropDays: number };

/** A smaller fall marks a "pressure-drop day" here than in the risk, so a few months hold enough of them to compare. */
const PATTERN_DROP_HPA = 3;
const PATTERN_MIN = 5;

/** How often logged headaches fall on pressure-drop days against other days, over the weather history (past days only). */
export function headachePattern(days: readonly WeatherDay[], headacheDays: ReadonlySet<string>, today: string): Pattern {
  const by = new Map(days.map((d) => [d.day, d]));
  let drop = 0, other = 0, hDrop = 0, hOther = 0;
  for (const d of days) {
    if (d.day > today) continue;
    const prev = by.get(addDays(d.day, -1));
    if (!prev) continue;
    const isDrop = d.pressure - prev.pressure <= -PATTERN_DROP_HPA;
    const had = headacheDays.has(d.day);
    if (isDrop) {
      drop++;
      if (had) hDrop++;
    } else {
      other++;
      if (had) hOther++;
    }
  }
  const total = hDrop + hOther;
  if (total < PATTERN_MIN || drop < PATTERN_MIN) return { kind: "not_enough", headacheDays: total, needed: PATTERN_MIN };
  const rDrop = hDrop / drop;
  const rOther = other ? hOther / other : 0;
  const ratio = rOther > 0 ? rDrop / rOther : null;
  const kind = (ratio === null && hDrop >= 3) || (ratio !== null && ratio >= 1.5 && hDrop >= 3) ? "more" : ratio !== null && ratio < 1.25 ? "no_link" : "unclear";
  return { kind, headacheDays: total, ratio, onDropDays: hDrop, dropDays: drop };
}

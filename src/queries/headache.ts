// Headache risk `/health/headache` and Today's card: the stored weather (weather/sync.ts) scored with the day's own
// signals (weather/risk.ts), and how logged headaches line up with each trigger.
import { recoveryBand } from "@/lib/bands";
import { addDays, localMidnight, wall } from "@/lib/time";
import { cDeltaToF, type Units } from "@/lib/units";
import { readWeatherSettings } from "@/state/weather";
import type { PressureHour } from "@/weather/openMeteo";
import { RISK, dayRisk, headachePattern, pressureLevels, type DayBody, type DayRisk, type Pattern, type Personal, type RiskFactor } from "@/weather/risk";
import { readWeather } from "@/weather/sync";
import { loadDays, nightNeedMin, type QueryCtx, todayOf } from "./common";
import { minutesText } from "./outlook";
import { unitsOf } from "./units";

export type HeadacheRisk = DayRisk & { reasons: string[] };
export type HeadacheVM = {
  enabled: boolean;
  /** Why there's no weather yet: no location permission or reading, or no city chosen. */
  missing: "place" | "data" | null;
  place: string | null;
  fetchedAt: number | null;
  today: HeadacheRisk | null;
  tomorrow: HeadacheRisk | null;
  pattern: Pattern | null;
  /** Hourly pressure from yesterday through tomorrow, for the chart. */
  hours: PressureHour[];
  today_: string;
  /** The local hour now, "YYYY-MM-DDTHH", to mark on the chart. */
  nowHour: string;
};

export function factorText(f: RiskFactor, units: Units): string {
  const text = baseText(f, units);
  return f.personal ? `${text}, one of your triggers` : text;
}

function baseText(f: RiskFactor, units: Units): string {
  const r1 = (x: number) => Math.round(Math.abs(x) * 10) / 10;
  switch (f.key) {
    case "pressure_drop":
      return `Pressure falling ${r1(f.hPa)} hPa from the day before`;
    case "pressure_rise":
      return `Pressure rising ${r1(f.hPa)} hPa from the day before`;
    case "high_pressure":
      return "Pressure high for where you are";
    case "low_pressure":
      return "Pressure low for where you are";
    case "humidity":
      return `Humid, ${Math.round(f.pct)}% on average`;
    case "temp_jump": {
      const v = units.temperature === "f" ? cDeltaToF(f.celsius) : f.celsius;
      return `Temperature ${f.celsius > 0 ? "up" : "down"} ${Math.round(Math.abs(v))} ${units.temperature === "f" ? "°F" : "°C"} from the day before`;
    }
    case "wind_jump":
      return units.distance === "mi" ? `Wind picking up by ${Math.round(f.kmh / 1.609344)} mph` : `Wind picking up by ${Math.round(f.kmh)} km/h`;
    case "short_sleep":
      return `You slept ${minutesText(f.minutes)} less than you needed`;
    case "low_recovery":
      return "Your Recovery is low";
    case "stress":
      return `${minutesText(f.minutes)} of high stress today`;
    case "alcohol":
      return "Alcohol yesterday";
  }
}

export async function getHeadache(ctx: QueryCtx): Promise<HeadacheVM> {
  const today = todayOf(ctx);
  const [settings, weather] = await Promise.all([readWeatherSettings(), readWeather()]);
  const w = wall(ctx.now, ctx.timeZone);
  const base = { enabled: settings.enabled, place: weather?.place.label ?? null, fetchedAt: weather?.fetchedAt ?? null, today_: today, nowHour: `${w.day}T${w.time.slice(0, 2)}` };
  if (!settings.enabled || !weather) {
    const missing = !settings.enabled ? null : settings.source === "city" ? (settings.city ? "data" : "place") : settings.lastLocation ? "data" : "place";
    return { ...base, missing, today: null, tomorrow: null, pattern: null, hours: [] };
  }
  const units = unitsOf(ctx);
  const from = addDays(today, -92);
  const [rows, journal, logged] = await Promise.all([
    loadDays(ctx, from, today),
    ctx.store.allJournal(),
    ctx.store.loggedEntries(localMidnight(from, ctx.timeZone), 10_000),
  ]);
  const alcoholDays = new Set(journal.filter((e) => e.tag === "alcohol" && e.value > 0).map((e) => e.day));
  const shortOf = (day: string): number | null => {
    const r = rows.get(day);
    const asleep = r?.sleep?.main?.asleepMin ?? null;
    const need = nightNeedMin(r?.sleep);
    return asleep != null && need ? need - asleep : null;
  };
  const row = rows.get(today);
  const body = {
    sleepShortMin: shortOf(today),
    recoveryRed: row?.recovery?.value != null && recoveryBand(row.recovery.value) === "red",
    highStressMin: row?.stress?.highMin ?? null,
    alcoholYesterday: alcoholDays.has(addDays(today, -1)),
  };
  const withReasons = (r: DayRisk | null): HeadacheRisk | null => (r ? { ...r, reasons: r.factors.map((f) => factorText(f, units)) } : null);
  const days = weather.data.days;
  const headacheDays = new Set(
    logged.filter((e) => e.type === "symptoms" && ((e.data as { symptoms?: string[] }).symptoms ?? []).includes("HEADACHE")).map((e) => e.day),
  );
  // Your own day, per past day, for the pattern: short sleep, high stress, alcohol the evening before.
  const history = new Map<string, DayBody>();
  for (const d of days) {
    if (d.day > today) continue;
    const short = shortOf(d.day);
    const stress = rows.get(d.day)?.stress?.highMin ?? null;
    history.set(d.day, { shortSleep: short == null ? null : short >= RISK.sleepShortMin, highStress: stress == null ? null : stress >= RISK.stressMin, alcoholBefore: alcoholDays.has(addDays(d.day, -1)) });
  }
  const pattern = headachePattern(days, headacheDays, today, history);
  const personal: Personal | undefined =
    pattern.kind === "ready" ? { linked: new Set(pattern.links.filter((l) => l.verdict === "more").map((l) => l.key)), levels: pressureLevels(days, today) } : undefined;
  const lo = `${addDays(today, -1)}T00:00`;
  const hi = `${addDays(today, 2)}T00:00`;
  return {
    ...base,
    missing: null,
    today: withReasons(dayRisk(days, today, body, personal)),
    tomorrow: withReasons(dayRisk(days, addDays(today, 1), null, personal)),
    pattern,
    hours: weather.data.hours.filter((h) => h.t >= lo && h.t < hi),
  };
}

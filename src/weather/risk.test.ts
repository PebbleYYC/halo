import { describe, expect, it } from "vitest";
import type { WeatherDay } from "./openMeteo";
import { foldDays } from "./openMeteo";
import { addDays } from "@/lib/time";
import { bodyFactors, dayRisk, headachePattern } from "./risk";

const w = (day: string, pressure: number, o: Partial<WeatherDay> = {}): WeatherDay => ({ day, pressure, humidity: 60, tempMax: 10, tempMin: 2, windMax: 15, ...o });
const calm = { sleepShortMin: 0, recoveryRed: false, highStressMin: 0, alcoholYesterday: false };

describe("dayRisk", () => {
  it("is low on a steady day", () => {
    expect(dayRisk([w("2026-11-02", 1015), w("2026-11-03", 1014)], "2026-11-03", calm)).toMatchObject({ level: "low", points: 0, factors: [] });
  });

  it("counts a pressure fall of 5 hPa as 2 points and 8 hPa as 3", () => {
    expect(dayRisk([w("2026-11-02", 1015), w("2026-11-03", 1009.5)], "2026-11-03", null)?.factors[0]).toMatchObject({ key: "pressure_drop", points: 2 });
    expect(dayRisk([w("2026-11-02", 1015), w("2026-11-03", 1006)], "2026-11-03", null)).toMatchObject({ level: "medium", points: 3 });
  });

  it("adds humidity, a temperature jump and the body's signals, reaching high", () => {
    const r = dayRisk([w("2026-11-02", 1015, { tempMax: 4 }), w("2026-11-03", 1009, { humidity: 85, tempMax: 11 })], "2026-11-03", { ...calm, sleepShortMin: 90 });
    expect(r?.level).toBe("high");
    expect(r?.factors.map((f) => f.key)).toEqual(["pressure_drop", "temp_jump", "humidity", "short_sleep"]);
  });

  it("is null for a day without weather", () => {
    expect(dayRisk([w("2026-11-02", 1015)], "2026-11-05", null)).toBeNull();
  });
});

describe("bodyFactors", () => {
  it("counts each body signal past its threshold once", () => {
    expect(bodyFactors({ sleepShortMin: 59, recoveryRed: true, highStressMin: 75, alcoholYesterday: true }).map((f) => f.key)).toEqual(["low_recovery", "stress", "alcohol"]);
  });
});

describe("headachePattern", () => {
  // 40 days: steady at 1010, with a 4 hPa fall every 4th day (and the rise back the day after).
  const days = Array.from({ length: 40 }, (_, i) => w(addDays("2026-09-01", i), i % 4 === 0 ? 1006 : 1010));
  const dropDays = days.filter((_, i) => i > 0 && i % 4 === 0).map((d) => d.day);
  const riseDays = days.filter((_, i) => i % 4 === 1).map((d) => d.day);
  const link = (p: ReturnType<typeof headachePattern>, key: string) => (p.kind === "ready" ? p.links.find((l) => l.key === key) : undefined);

  it("needs 5 logged headaches", () => {
    expect(headachePattern(days, new Set(dropDays.slice(0, 3)), "2026-10-31")).toMatchObject({ kind: "not_enough", headacheDays: 3 });
  });

  it("finds headaches clustered on pressure-drop days, and ranks that link first", () => {
    const p = headachePattern(days, new Set(dropDays.slice(0, 6)), "2026-10-31");
    expect(link(p, "pressure_drop")?.verdict).toBe("more");
    expect(p.kind === "ready" && p.links[0].key).toBe("pressure_drop");
    expect(link(p, "pressure_rise")?.verdict).toBe("no_link");
  });

  it("finds headaches that follow pressure rises", () => {
    expect(link(headachePattern(days, new Set(riseDays.slice(0, 6)), "2026-10-31"), "pressure_rise")?.verdict).toBe("more");
  });

  it("reports no link when headaches ignore the pressure", () => {
    const steady = days.filter((_, i) => i % 4 !== 0 && i % 4 !== 1).map((d) => d.day);
    expect(link(headachePattern(days, new Set([...steady.slice(0, 12), dropDays[0]]), "2026-10-31"), "pressure_drop")?.verdict).toBe("no_link");
  });

  it("checks your own day: headaches after short nights", () => {
    const short = new Set(days.filter((_, i) => i % 5 === 2).map((d) => d.day));
    const body = new Map(days.map((d) => [d.day, { shortSleep: short.has(d.day), highStress: null, alcoholBefore: false }]));
    const p = headachePattern(days, new Set([...short].slice(0, 6)), "2026-10-31", body);
    expect(link(p, "short_sleep")?.verdict).toBe("more");
    // Not measured: left out rather than counted as calm.
    expect(link(p, "stress")).toBeUndefined();
  });

  it("leaves out a trigger with too few days to compare", () => {
    expect(link(headachePattern(days, new Set(dropDays.slice(0, 6)), "2026-10-31"), "humidity")).toBeUndefined();
  });
});

describe("dayRisk with your pattern", () => {
  const days = [w("2026-11-02", 1015), w("2026-11-03", 1009)];
  it("counts a linked trigger a point more", () => {
    const r = dayRisk(days, "2026-11-03", calm, { linked: new Set(["pressure_rise", "pressure_drop"]), levels: null });
    expect(r?.factors[0]).toMatchObject({ key: "pressure_drop", points: 3, personal: true });
  });
  it("adds high pressure only for someone whose headaches follow it", () => {
    const hi = [w("2026-11-02", 1015), w("2026-11-03", 1016)];
    expect(dayRisk(hi, "2026-11-03", calm, { linked: new Set(), levels: { hi: 1014, lo: 1004 } })?.factors).toEqual([]);
    expect(dayRisk(hi, "2026-11-03", calm, { linked: new Set(["high_pressure"]), levels: { hi: 1014, lo: 1004 } })?.factors).toEqual([{ key: "high_pressure", hPa: 1016, points: 1, personal: true }]);
  });
});

describe("foldDays", () => {
  it("folds hourly readings into one row per local day", () => {
    const h = { time: ["2026-11-03T00:00", "2026-11-03T12:00", "2026-11-04T00:00"], surface_pressure: [1010, 1012, 1000], relative_humidity_2m: [80, 60, 50], temperature_2m: [1, 9, 3], wind_speed_10m: [10, 20, 5] };
    expect(foldDays(h)).toEqual([
      { day: "2026-11-03", pressure: 1011, humidity: 70, tempMax: 9, tempMin: 1, windMax: 20 },
      { day: "2026-11-04", pressure: 1000, humidity: 50, tempMax: 3, tempMin: 3, windMax: 5 },
    ]);
  });
});

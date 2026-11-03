import { describe, expect, it } from "vitest";
import type { WeatherDay } from "./openMeteo";
import { foldDays } from "./openMeteo";
import { bodyFactors, dayRisk, headachePattern } from "./risk";

const w = (day: string, pressure: number, o: Partial<WeatherDay> = {}): WeatherDay => ({ day, pressure, humidity: 60, tempMax: 10, tempMin: 2, windMax: 15, ...o });
const calm = { sleepShortMin: 0, recoveryRed: false, highStressMin: 0, alcoholYesterday: false };

describe("dayRisk", () => {
  it("is low on a steady day", () => {
    expect(dayRisk([w("2026-11-02", 1015), w("2026-11-03", 1014)], "2026-11-03", calm)).toMatchObject({ level: "low", points: 0, factors: [] });
  });

  it("counts a pressure fall of 5 hPa as 2 points and 8 hPa as 3", () => {
    expect(dayRisk([w("2026-11-02", 1015), w("2026-11-03", 1009.5)], "2026-11-03", null)?.factors[0]).toMatchObject({ key: "pressure_drop", points: 2 });
    expect(dayRisk([w("2026-11-02", 1015), w("2026-11-03", 1006)], "2026-11-03", null)).toMatchObject({ level: "moderate", points: 3 });
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
  // 40 days alternating steady and a 4 hPa fall every 4th day.
  const days = Array.from({ length: 40 }, (_, i) => {
    const day = `2026-09-${String(i + 1).padStart(2, "0")}`.replace(/-09-(3[1-9]|4\d)$/, (m, d) => `-10-${String(Number(d) - 30).padStart(2, "0")}`);
    return w(day, i % 4 === 0 ? 1006 : 1010);
  });
  const dropDays = days.filter((_, i) => i > 0 && i % 4 === 0).map((d) => d.day);

  it("needs 5 logged headaches", () => {
    expect(headachePattern(days, new Set(dropDays.slice(0, 3)), "2026-10-31")).toMatchObject({ kind: "not_enough", headacheDays: 3 });
  });

  it("finds headaches clustered on pressure-drop days", () => {
    expect(headachePattern(days, new Set(dropDays.slice(0, 6)), "2026-10-31").kind).toBe("more");
  });

  it("reports no link when headaches ignore the pressure", () => {
    const steady = days.filter((_, i) => i % 4 !== 0 && i % 4 !== 1).map((d) => d.day);
    expect(headachePattern(days, new Set([...steady.slice(0, 12), dropDays[0]]), "2026-10-31").kind).toBe("no_link");
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

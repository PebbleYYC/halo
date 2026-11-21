import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/time";
import type { DayRow } from "./common";
import { buildVariables, clockOf, passes, runTest, screen, screenPairs, tTwoSided, weekdayOf, type DiscoveryData } from "./discovery";

const START = "2026-06-01"; // a Monday
const TZ = "UTC";
/** A seeded uniform in [0, 1). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const normal = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const ts = (day: string, min: number) => Date.parse(`${day}T00:00:00Z`) / 1000 + min * 60;

type Day = { recovery: number; deep: number; bedMin: number; strain: number };
function rows(n: number, f: (day: string, i: number) => Day): DayRow[] {
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(START, i);
    const d = f(day, i);
    // The night stored on `day` started the evening before, at d.bedMin of that evening.
    const start = ts(addDays(day, -1), d.bedMin);
    return {
      day,
      s1: { effort: (d.strain / 21) * 100 },
      recovery: { value: d.recovery, hrvZ: 0, inputs: { rhr: 55 } },
      sleep: { performance: 80, main: { start, end: start + 8 * 3600, asleepMin: 440, deepMin: d.deep, remMin: 100, efficiency: 90, latencyMin: 10 } },
      metrics: { steps: 8000 },
      stress: { average: 30 },
    } as unknown as DayRow;
  });
}

const data = (rs: DayRow[], journal: DiscoveryData["journal"] = []): DiscoveryData => ({ rows: rs, journal, tagLabel: (t) => t, doses: [], doseLabel: (t) => t, timeZone: TZ, lastDay: rs[rs.length - 1].day });

describe("statistics", () => {
  it("Student's t p", () => {
    expect(tTwoSided(2, 10)).toBeCloseTo(0.0734, 3);
    expect(tTwoSided(0, 30)).toBeCloseTo(1, 6);
  });
  it("clock", () => expect(clockOf(1470)).toBe("00:30"));
});

describe("screen", () => {
  it("finds a planted pattern it was never told about: late Tuesday bedtimes, low Wednesdays", () => {
    const r = rng(1);
    const rs = rows(112, (day) => {
      const tueEve = weekdayOf(day) === 3; // the night stored on Wednesday started Tuesday evening
      return { recovery: (tueEve ? 48 : 66) + normal(r) * 8, deep: 80 + normal(r) * 10, bedMin: (tueEve ? 1470 : 1380) + normal(r) * 15, strain: 10 + normal(r) * 2 };
    });
    const results = screen(buildVariables(data(rs)));
    const shown = results.filter(passes).map((x) => x.id);
    expect(shown).toContain("weekday:2>recovery@1");
    expect(shown).toContain("bedtime>recovery@1");
  });

  it("finds a custom journal tag's effect on deep sleep", () => {
    const r = rng(2);
    const yes = new Set<string>();
    const rs = rows(100, (day, i) => {
      const prev = addDays(day, -1);
      if (i % 3 === 0) yes.add(day);
      return { recovery: 65 + normal(r) * 8, deep: (yes.has(prev) ? 100 : 78) + normal(r) * 10, bedMin: 1380 + normal(r) * 20, strain: 10 + normal(r) * 2 };
    });
    const journal = rs.map((x) => ({ day: x.day, tag: "cold_plunge", value: yes.has(x.day) ? 1 : 0 }));
    const shown = screen(buildVariables(data(rs, journal))).filter(passes);
    expect(shown.map((x) => x.id)).toContain("tag:cold_plunge>deep@1");
    expect(shown.find((x) => x.id === "tag:cold_plunge>deep@1")!.delta).toBeGreaterThan(10);
  });

  it("shows nothing (or next to nothing) on pure noise", () => {
    let total = 0;
    for (let seed = 10; seed < 20; seed++) {
      const r = rng(seed);
      const rs = rows(112, () => ({ recovery: 65 + normal(r) * 10, deep: 80 + normal(r) * 12, bedMin: 1380 + normal(r) * 30, strain: 10 + normal(r) * 3 }));
      total += screen(buildVariables(data(rs))).filter(passes).length;
    }
    // Ten noise histories, ~150 tests each: the correction keeps false findings rare.
    expect(total).toBeLessThanOrEqual(2);
  });

  it("narrows a test to one weekday", () => {
    const r = rng(3);
    const rs = rows(112, () => ({ recovery: 65 + normal(r) * 8, deep: 80, bedMin: 1380 + normal(r) * 20, strain: 10 }));
    const vars = new Map(buildVariables(data(rs)).map((v) => [v.key, v]));
    const t = runTest(vars, "bedtime", "recovery", 1, 2);
    expect(t?.id).toBe("bedtime>recovery@1/2");
    expect(t!.hi.n + t!.lo.n).toBeLessThanOrEqual(16);
  });
});

describe("workouts as variables", () => {
  it("turns a recurring workout into a yes/no day and tests it against that evening's bedtime", () => {
    const add = addDays;
    const build = buildVariables;
    const rows = Array.from({ length: 70 }, (_, i) => {
      const day = add("2026-06-01", i);
      const start = Date.parse(`${add(day, -1)}T23:00:00Z`) / 1000;
      return { day, recovery: { value: 60, hrvZ: 0, inputs: { rhr: 55 } }, sleep: { performance: 80, main: { start, end: start + 28800, asleepMin: 440 } } } as never;
    });
    const workouts = rows.filter((_, i) => i % 7 === 2).map((r: { day: string }) => ({ day: r.day, name: "Basketball" }));
    const vars = build({ rows, journal: [], tagLabel: (t) => t, doses: [], doseLabel: (t) => t, workouts, timeZone: "UTC", lastDay: add("2026-06-01", 68) });
    const v = vars.find((x) => x.key === "workout:basketball");
    expect(v).toMatchObject({ label: "Basketball day", group: "day", flag: true });
    expect(screenPairs(vars)).toContainEqual({ x: "workout:basketball", y: "bedtime", lag: 0 });
    expect(screenPairs(vars)).toContainEqual({ x: "workout:basketball", y: "recovery", lag: 1 });
  });
});

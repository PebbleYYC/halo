import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/time";
import type { DayRow } from "@/queries/common";
import { buildVariables, fmt, screen, weekdayOf } from "@/queries/discovery";
import { checkFindings, discoverPrompt, findingTiming, shortlistOf, TestFamily } from "./discoverText";

const START = "2026-06-01";
function family() {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const rows = Array.from({ length: 112 }, (_, i) => {
    const day = addDays(START, i);
    const low = weekdayOf(day) === 3;
    const start = Date.parse(`${addDays(day, -1)}T23:00:00Z`) / 1000 + (low ? 90 : 0) * 60;
    return { day, s1: { effort: 50 }, recovery: { value: (low ? 48 : 66) + (r() - 0.5) * 20, hrvZ: 0, inputs: { rhr: 55 } }, sleep: { performance: 80, main: { start, end: start + 28800, asleepMin: 440, deepMin: 80 + (r() - 0.5) * 20, remMin: 100, efficiency: 90, latencyMin: 10 } }, metrics: { steps: 8000 }, stress: { average: 30 } } as unknown as DayRow;
  });
  const vars = buildVariables({ rows, journal: [], tagLabel: (t) => t, doses: [], doseLabel: (t) => t, timeZone: "UTC", lastDay: rows[111].day });
  const screened = screen(vars);
  return { vars, screened, fam: new TestFamily(vars, screened) };
}

describe("checkFindings", () => {
  const { vars, screened, fam } = family();
  const main = fam.get("weekday:2>recovery@1")!;
  const [hi, lo] = [fmt(main.hi.mean, "%"), fmt(main.lo.mean, "%")];

  it("keeps a finding that cites a passing test with its own numbers", () => {
    const raw = `Here you go:\n[{"tests":["weekday:2>recovery@1"],"title":"Wind down early on Tuesdays","body":"After Tuesdays your Recovery averages ${hi}% against ${lo}% on other days.","ask":"Why are Wednesdays hard?"}]`;
    const out = checkFindings(raw, fam);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ key: "weekday:2>recovery@1", subject: "recovery", href: "/recovery" });
  });

  it("drops invented numbers, unknown tests and tests that don't clear the bar", () => {
    expect(checkFindings(`[{"tests":["weekday:2>recovery@1"],"title":"x","body":"Recovery is 99% lower."}]`, fam)).toEqual([]);
    expect(checkFindings(`[{"tests":["made>up@1"],"title":"x","body":"Recovery ${hi}%."}]`, fam)).toEqual([]);
    const weak = screened.find((r) => r.q != null && r.q > 0.5)!;
    expect(checkFindings(`[{"tests":["${weak.id}"],"title":"x","body":"${fmt(weak.hi.mean, "%")}"}]`, fam)).toEqual([]);
    expect(checkFindings("no json", fam)).toEqual([]);
  });

  it("lets the model run its own tests, counted in the correction", () => {
    const before = fam.results.length;
    const t = fam.test("recovery", "deep", 1, null);
    expect("id" in t && t.id).toBe("recovery>deep@1");
    expect(fam.results.length).toBe(before + 1);
    expect(fam.test("nope", "deep", 1, null)).toHaveProperty("error");
  });

  it("puts the variables and the shortlist in the prompt", () => {
    const p = discoverPrompt(vars, shortlistOf(screened));
    expect(p).toContain('"key":"bedtime"');
    expect(p).toContain("weekday:2>recovery@1");
  });
});

describe("findingTiming", () => {
  // 2026-11-24 is a Tuesday (2), 25 Wednesday, 26 Thursday.
  const wd = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
  const ball = { timing: { weekdays: [3], lag: 1, label: "Basketball", weekday: false } };
  it("shows a regular day's finding the day before and the morning after, not on the day", () => {
    expect(findingTiming(ball, "2026-11-24", wd)).toEqual({ show: true, eyebrow: "Basketball tomorrow" });
    expect(findingTiming(ball, "2026-11-25", wd).show).toBe(false);
    expect(findingTiming(ball, "2026-11-26", wd)).toEqual({ show: true, eyebrow: "After basketball" });
    expect(findingTiming(ball, "2026-11-28", wd).show).toBe(false);
  });
  it("shows everything else every day", () => {
    expect(findingTiming({}, "2026-11-25", wd)).toEqual({ show: true, eyebrow: "Coach spotted" });
  });
});

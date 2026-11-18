import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/time";
import { bedtimePattern, behaviourPatterns, clockOf, findPatterns, minutesText, timingPattern, weekdayOf, weekdayPattern, type PatternNight, type TimingFinding } from "./patterns";

// 2026-06-01 is a Monday.
const START = "2026-06-01";
const wobble = (i: number) => ((i * 7919) % 11) - 5;

function nights(n: number, f: (day: string, i: number) => Partial<PatternNight>): PatternNight[] {
  return Array.from({ length: n }, (_, i) => {
    const day = addDays(START, i);
    return { day, recovery: 65 + wobble(i), sleepPerf: 80, deepMin: 80, asleepMin: 450, bedMin: 1380 + wobble(i), strain: 10, ...f(day, i) };
  });
}

describe("helpers", () => {
  it("weekdays and clocks", () => {
    expect(weekdayOf(START)).toBe(1);
    expect(clockOf(1260)).toBe("21:00");
    expect(clockOf(1472)).toBe("00:30");
    expect(minutesText(40)).toBe("40 min");
    expect(minutesText(70)).toBe("1 h 10 min");
  });
});

describe("weekdayPattern", () => {
  it("names the late Tuesday bedtime behind low Wednesdays", () => {
    const xs = nights(84, (day) => (weekdayOf(day) === 3 ? { recovery: 45, bedMin: 1470 } : {}));
    const p = weekdayPattern(xs)!;
    expect(p.key).toBe("weekday:3");
    expect(p.title).toBe("Get to bed earlier on Tuesdays");
    expect(p.body).toContain("Wednesdays averages 45%");
    expect(p.body).toContain("00:30");
  });

  it("falls back to the eve's Strain", () => {
    const xs = nights(84, (day) => (weekdayOf(day) === 3 ? { recovery: 45 } : weekdayOf(day) === 2 ? { strain: 16 } : {}));
    expect(weekdayPattern(xs)!.title).toBe("Ease off on Tuesdays");
  });

  it("stays quiet without a clear gap or enough nights", () => {
    expect(weekdayPattern(nights(84, () => ({})))).toBeNull();
    expect(weekdayPattern(nights(30, (day) => (weekdayOf(day) === 3 ? { recovery: 40 } : {})))).toBeNull();
  });
});

describe("bedtimePattern", () => {
  it("finds earlier nights paying off", () => {
    const xs = nights(60, (_, i) => (i % 2 ? { bedMin: 1290, recovery: 75 + wobble(i) } : { bedMin: 1410, recovery: 60 + wobble(i) }));
    const p = bedtimePattern(xs)!;
    expect(p.title).toBe("In bed by 23:30");
    expect(p.body).toMatch(/averages 7\d% against 6\d%/);
  });

  it("nothing when bedtime makes no difference", () => {
    expect(bedtimePattern(nights(60, (_, i) => ({ bedMin: i % 2 ? 1290 : 1410 })))).toBeNull();
  });
});

const finding = (p: Partial<TimingFinding>): TimingFinding => ({
  tag: "med_l_theanine",
  label: "L-theanine",
  split: "21:00",
  early: { n: 8, avg: 92, from: "20:00", to: "20:55" },
  late: { n: 8, avg: 80, from: "21:00", to: "22:30" },
  delta: -12,
  ci: [-18, -6],
  effect: "negative",
  outcome: "deep",
  ...p,
});

describe("timingPattern", () => {
  it("says to take it earlier when early nights sleep deeper", () => {
    const p = timingPattern([finding({})])!;
    expect(p.title).toBe("Take L-theanine before 21:00");
    expect(p.body).toContain("15% higher (92 against 80 min)");
  });

  it("ignores unclear or small effects", () => {
    expect(timingPattern([finding({ effect: "none" })])).toBeNull();
    expect(timingPattern([finding({ early: { n: 8, avg: 83, from: "", to: "" }, delta: -3 })])).toBeNull();
  });

  it("phrases a later-is-better Recovery split", () => {
    const p = timingPattern([finding({ outcome: "recovery", early: { n: 8, avg: 60, from: "", to: "" }, late: { n: 8, avg: 68, from: "", to: "" }, delta: 8, effect: "positive" })])!;
    expect(p.title).toBe("Take L-theanine after 21:00");
    expect(p.body).toBe("Your Recovery averages 68% when you take it after 21:00, against 60% otherwise.");
  });
});

describe("behaviourPatterns", () => {
  const item = (key: string, label: string, avgWith: number, avgWithout: number, effect: "positive" | "negative" | "none" = "negative") => ({ key, label, delta: avgWith - avgWithout, effect, yes: 12, no: 40, ci: [-1, 1] as [number, number], avgWith, avgWithout });
  it("keeps clear, actionable effects", () => {
    const ps = behaviourPatterns({ recovery: [item("alcohol", "Alcohol", 52, 66), item("illness", "Illness", 30, 66), item("sauna", "Sauna", 66, 64, "positive")], sleep: [] });
    expect(ps.map((p) => p.key)).toEqual(["behaviour:alcohol"]);
    expect(ps[0].title).toBe("Alcohol costs you Recovery");
  });
});

describe("findPatterns", () => {
  it("ranks and caps, and drops a behaviour that is also a timed medicine", () => {
    const xs = nights(84, (day) => (weekdayOf(day) === 3 ? { recovery: 45, bedMin: 1470 } : {}));
    const ps = findPatterns({
      nights: xs,
      timing: [finding({})],
      behaviours: { recovery: [{ key: "med_l_theanine", label: "L-theanine", delta: 9, effect: "positive", yes: 20, no: 20, ci: [3, 12], avgWith: 70, avgWithout: 61 }], sleep: [] },
    });
    expect(ps.length).toBeLessThanOrEqual(3);
    expect(ps.map((p) => p.key)).toContain("weekday:3");
    expect(ps.map((p) => p.key)).toContain("timing:med_l_theanine");
    expect(ps.map((p) => p.key)).not.toContain("behaviour:med_l_theanine");
  });
});

import { describe, expect, it } from "vitest";
import { amountSplit, countPhrase, countedTag, isCountedTag, yesLabel } from "./behaviours";

describe("counted behaviours", () => {
  it("knows alcohol is counted and plain tags are not", () => {
    expect(isCountedTag("alcohol")).toBe(true);
    expect(isCountedTag("sauna")).toBe(false);
    expect(countedTag("alcohol")?.question).toBe("How many drinks?");
    expect(countedTag("sauna")).toBeNull();
  });

  it("words the amount, singular and plural", () => {
    expect(countPhrase("alcohol", 1)).toBe("1 drink");
    expect(countPhrase("alcohol", 3)).toBe("3 drinks");
  });

  it("carries the count in a counted behaviour's badge, and leaves other behaviours alone", () => {
    expect(yesLabel("alcohol", "Alcohol", 3)).toBe("Alcohol · 3");
    expect(yesLabel("alcohol", "Alcohol", 1)).toBe("Alcohol · 1");
    expect(yesLabel("sauna", "Sauna", 1)).toBe("Sauna");
  });
});

describe("amountSplit", () => {
  const next = (ys: Record<string, number>) => (day: string) => ys[day];
  it("splits a counted behaviour into none, light and heavy, and averages an arm once it has three nights", () => {
    const answers = [
      { day: "2026-11-12", value: 0 },
      { day: "2026-11-13", value: 0 },
      { day: "2026-11-14", value: 0 },
      { day: "2026-11-15", value: 1 },
      { day: "2026-11-16", value: 2 },
      { day: "2026-11-17", value: 2 },
      { day: "2026-11-18", value: 3 },
      { day: "2026-11-19", value: 6 },
    ];
    const ys = { "2026-11-12": 70, "2026-11-13": 80, "2026-11-14": 60, "2026-11-15": 66, "2026-11-16": 60, "2026-11-17": 54, "2026-11-18": 40, "2026-11-19": 20 };
    const s = amountSplit("alcohol", answers, next(ys))!;
    expect(s.none).toEqual({ label: "None", n: 3, avg: 70 });
    expect(s.light).toEqual({ label: "1–2 drinks", n: 3, avg: 60 });
    // Two heavy nights are counted but not yet averaged.
    expect(s.heavy).toEqual({ label: "3+ drinks", n: 2, avg: null });
    expect(s.unknown).toBe(0);
  });

  it("leaves out a Yes from before counting began, and a night with no next-day score", () => {
    const s = amountSplit(
      "alcohol",
      [
        { day: "2026-11-01", value: 1 },
        { day: "2026-11-13", value: 1 },
        { day: "2026-11-14", value: 4 },
      ],
      (day) => (day === "2026-11-14" ? null : 50),
    )!;
    expect(s.unknown).toBe(1);
    expect(s.light.n).toBe(1);
    expect(s.heavy.n).toBe(0);
  });

  it("is nothing for a behaviour that is not counted", () => {
    expect(amountSplit("sauna", [], () => 1)).toBeNull();
  });
});

describe("a logged headache", () => {
  it("reads with its severity in the log", async () => {
    const { describeEntry } = await import("@/queries/log");
    expect(describeEntry("symptoms", { symptoms: ["HEADACHE", "NAUSEA"], headache: "SEVERE" }).detail).toBe("Severe headache, Nausea");
    expect(describeEntry("symptoms", { symptoms: ["HEADACHE"] }).detail).toBe("Headache");
  });
});

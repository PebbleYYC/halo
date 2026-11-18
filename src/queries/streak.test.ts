import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/time";
import { MemoryStore } from "@/data/memory";
import { STREAK_TODAY_MIN, streakOf, wearStreak } from "./streak";

const TODAY = "2026-11-17";
const worn = (day: string, minutes = 900) => ({ day, hrCount: 100, hrMinutes: minutes });
const bare = (day: string) => ({ day, hrCount: 0, hrMinutes: 0 });
/** `n` worn days ending `end`. */
const run = (end: string, n: number) => Array.from({ length: n }, (_, i) => worn(addDays(end, -(n - 1 - i))));

describe("streakOf", () => {
  it("counts the run up to today, and finds the longest and the milestones it passed", () => {
    const days = [...run("2026-09-30", 40), bare("2026-10-01"), ...run(TODAY, 47)];
    const s = streakOf(days, TODAY, days[0].day);
    expect(s.current).toEqual({ days: 47, from: "2026-10-02", to: TODAY });
    expect(s.longest).toEqual(s.current);
    expect(s.next).toBe(50);
    expect(s.reached.map((r) => r.days)).toEqual([7, 14, 30]);
    // The day it reached 30: its 30th day.
    expect(s.reached[2].on).toBe("2026-10-31");
    expect(s.total).toEqual({ worn: 87, of: 88 });
  });

  it("does not count or break on today until it has six hours, or before it is scored", () => {
    const before = run(addDays(TODAY, -1), 12);
    for (const today of [undefined, worn(TODAY, STREAK_TODAY_MIN - 1), bare(TODAY)]) {
      const s = streakOf(today ? [...before, today] : before, TODAY, before[0].day);
      expect(s.todayPending).toBe(true);
      expect(s.current?.days).toBe(12);
      // Today is left out of the counts while it is pending, not counted as a miss.
      expect(s.last30).toEqual({ worn: 12, of: 12 });
    }
    expect(streakOf([...before, worn(TODAY, STREAK_TODAY_MIN)], TODAY, before[0].day).current?.days).toBe(13);
  });

  it("has no current run after a missed day, and keeps the longest", () => {
    const days = [...run("2026-11-10", 20), bare("2026-11-11"), bare("2026-11-12")];
    const s = streakOf(days, "2026-11-12", days[0].day);
    expect(s.current).toBeNull();
    expect(s.longest?.days).toBe(20);
    expect(s.next).toBe(7);
    expect(s.reached).toEqual([]);
  });

  it("treats a day with no scores before today as missed", () => {
    const days = [...run("2026-11-14", 5), ...run(TODAY, 2)];
    const s = streakOf(days, TODAY, days[0].day);
    expect(s.wear["2026-11-15"]).toBe("missed");
    expect(s.current?.days).toBe(2);
  });
});

describe("wearStreak", () => {
  it("is the page's current run", async () => {
    const store = new MemoryStore();
    for (const d of run(addDays(TODAY, -1), 9)) await store.putScores({ day: d.day, strain: { hrCount: 10, hrMinutesAm: 600, hrMinutesPm: 600 } } as never);
    const ctx = { store, today: TODAY, sync: { firstDay: addDays(TODAY, -9) } } as never;
    // Today has no scores yet (early morning): the run to yesterday stands.
    expect(await wearStreak(ctx)).toEqual({ days: 9, asOf: addDays(TODAY, -1) });
  });
});

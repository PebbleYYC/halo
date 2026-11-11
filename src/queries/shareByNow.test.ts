import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/data/memory";
import { addDays, fromWall, localMidnight } from "@/lib/time";
import { priorStatsByNow, shareByNow } from "./common";

const TZ = "America/Regina";
const TODAY = "2026-11-11";

describe("shareByNow", () => {
  it("gives each past day the share of its steps taken by this time of day", async () => {
    const store = new MemoryStore();
    // Yesterday: 1,000 steps at 07:00 and 3,000 at 18:00. Two days ago: all 2,000 at 20:00. Three days ago: none logged.
    const y = addDays(TODAY, -1);
    const y2 = addDays(TODAY, -2);
    await store.putSteps([
      { ts: fromWall(`${y}T07:00`, TZ), v: 1000 },
      { ts: fromWall(`${y}T18:00`, TZ), v: 3000 },
      { ts: fromWall(`${y2}T20:00`, TZ), v: 2000 },
    ]);
    const ctx = { store, timeZone: TZ, today: TODAY, now: localMidnight(TODAY, TZ) + 8 * 3600 } as never;
    const share = await shareByNow(ctx, TODAY);
    expect(share.get(y)).toBeCloseTo(0.25);
    expect(share.get(y2)).toBe(0);
    expect(share.has(addDays(TODAY, -3))).toBe(false);
  });
});

describe("priorStatsByNow", () => {
  const rows = new Map(Array.from({ length: 30 }, (_, k) => [addDays(TODAY, -k - 1), { day: addDays(TODAY, -k - 1), metrics: { steps: 10_000 } } as never]));
  const pick = (r: { metrics?: { steps?: number } }) => r.metrics?.steps ?? null;

  it("scales each day to this hour when enough days have minute data", () => {
    const share = new Map(Array.from({ length: 10 }, (_, k) => [addDays(TODAY, -k - 1), 0.1]));
    const r = priorStatsByNow(rows, TODAY, pick, share);
    expect(r.scaled).toBe(true);
    expect(r.mean).toBeCloseTo(1000);
  });

  it("falls back to the whole-day average when too few days have minute data", () => {
    const share = new Map([[addDays(TODAY, -1), 0.1]]);
    const r = priorStatsByNow(rows, TODAY, pick, share);
    expect(r.scaled).toBe(false);
    expect(r.mean).toBeCloseTo(10_000);
  });
});

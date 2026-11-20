import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/time";
import type { DayRow } from "./common";
import { incompleteNight } from "./sleep";

const T = "2026-11-19";
const rows = (tonight: number, prior: number[]) =>
  new Map<string, DayRow>([[T, { sleep: { main: { asleepMin: tonight } } } as unknown as DayRow], ...prior.map((m, k) => [addDays(T, -(k + 1)), { sleep: { main: { asleepMin: m } } } as unknown as DayRow] as const)]);

describe("incompleteNight", () => {
  it("flags last night under 70% of the typical one", () => {
    expect(incompleteNight(rows(149, [430, 440, 420, 450, 445, 435]), T, T)).toEqual({ asleepMin: 149, typicalMin: 440 });
    expect(incompleteNight(rows(400, [430, 440, 420, 450, 445, 435]), T, T)).toBeNull();
  });
  it("under 4 h before there are 5 nights; never an older day", () => {
    expect(incompleteNight(rows(200, [430]), T, T)).not.toBeNull();
    expect(incompleteNight(rows(260, [430]), T, T)).toBeNull();
    expect(incompleteNight(rows(149, [430, 440, 420, 450, 445]), T, addDays(T, 1))).toBeNull();
  });
});

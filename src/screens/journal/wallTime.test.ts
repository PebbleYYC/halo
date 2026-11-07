import { describe, expect, it } from "vitest";
import { dayWord, wallMinutes, wallOf } from "./wallTime";

describe("time stepper", () => {
  it("steps wall-clock times across midnight and names the day", () => {
    expect(wallOf(wallMinutes("2026-11-06 00:10")! - 15)).toBe("2026-11-05 23:55");
    expect(dayWord("2026-11-05 23:55", "2026-11-06 08:00")).toBe("Yesterday");
    expect(dayWord("2026-11-06 07:00", "2026-11-06 08:00")).toBe("Today");
    expect(dayWord("2026-11-03 07:00", "2026-11-06 08:00")).toBe("Nov 3");
  });
});

describe("typed times", () => {
  it("read 24-hour, compact and am/pm forms, and refuse the rest", async () => {
    const { parseClock } = await import("./wallTime");
    expect(["21:40", "2140", "9:40", "940", "9", "9:40 pm", "9:40PM", "12am", "12:30 pm", "0:05"].map(parseClock)).toEqual(["21:40", "21:40", "09:40", "09:40", "09:00", "21:40", "21:40", "00:00", "12:30", "00:05"]);
    expect(["24:00", "9:60", "13pm", "abc", "", "1:2"].map(parseClock)).toEqual([null, null, null, null, null, null]);
  });
});

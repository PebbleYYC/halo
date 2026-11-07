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

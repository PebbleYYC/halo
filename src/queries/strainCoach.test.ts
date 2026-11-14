import { describe, expect, it } from "vitest";
import type { DayRow } from "./common";
import type { Metric } from "@/lib/reasons";
import { coach, coachTitle } from "./strain";

const m = (value: number): Metric<number> => ({ value, reason: null }) as Metric<number>;
const row = (recovery: number) => ({ recovery: { value: recovery } }) as unknown as DayRow;
const target = { low: 5.5, high: 8.2 };

describe("Strain Coach on a low-Recovery day", () => {
  it("asks for a light day only while that is still possible", () => {
    expect(coachTitle(m(2), target, row(17))).toBe("Keep strain light");
    expect(coach(m(2), target, row(17))).toBe("Your body needs rest today. Keep strain between 5.5 and 8.2.");
    expect(coach(m(6), target, row(17))).toContain("already inside the target of 5.5 to 8.2");
  });

  it("says so once the day is past its target, rather than asking to stay inside it", () => {
    expect(coachTitle(m(8.9), target, row(17))).toBe("Past your target");
    expect(coach(m(8.9), target, row(17))).toBe("Your body needed rest today and you are past the target of 5.5 to 8.2. Prioritise sleep tonight to recover.");
  });

  it("is unchanged on a normal day", () => {
    expect(coachTitle(m(2), target, row(70))).toBe("Room for more strain");
    expect(coachTitle(m(7), target, row(70))).toBe("In your optimal range");
    expect(coachTitle(m(9), target, row(70))).toBe("Past your target");
  });
});

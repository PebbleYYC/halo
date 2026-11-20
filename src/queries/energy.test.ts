import { describe, expect, it } from "vitest";
import { balanceWords, dayBalance, todayBalance } from "./energy";

describe("energy balance", () => {
  it("a finished day", () => {
    expect(dayBalance(1900, 2400)).toMatchObject({ verdict: "deficit", balance: -500 });
    expect(dayBalance(2350, 2400)!.verdict).toBe("maintenance");
    expect(dayBalance(null, 2400)).toBeNull();
    expect(balanceWords(dayBalance(1900, 2400)!)).toBe("a deficit of about 500 kcal");
  });
  it("today by what it's on course to burn, too early while it could go either way", () => {
    // 14:00, 1,300 burned, a usual day of 2,400: on course for ~2,300.
    expect(todayBalance(1500, 1300, 2400, 14 / 24)!.verdict).toBe("deficit");
    expect(todayBalance(2280, 1300, 2400, 14 / 24)!.verdict).toBe("early");
    expect(todayBalance(3000, 1300, 2400, 14 / 24)!.verdict).toBe("surplus");
  });
});

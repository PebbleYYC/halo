import { describe, expect, it } from "vitest";
import type { ChargeDriver } from "@/core/scoring/drivers";
import { minutesText, outlookText, type OutlookInput } from "./outlook";

const driver = (label: ChargeDriver["label"], deltaPoints: number): ChargeDriver => ({ label, deltaPoints, value: 0, baseline: 0, unit: "PERCENT", verdict: "ABOVE_BASELINE_SUPPORTING" });
const base: OutlookInput = { review: false, isToday: true, recovery: null, drivers: [], asleepMin: null, needMin: null, strain: null, target: null, activities: [], stress: null, bedtime: null };

describe("outlookText, morning", () => {
  it("leads with the verdict and its main reason, then sleep, then what to do", () => {
    const o = outlookText({ ...base, recovery: 78, drivers: [driver("HEART_RATE_VARIABILITY", 9), driver("RESTING_HEART_RATE", -2)], asleepMin: 452, needMin: 470, target: [12, 14.5] });
    expect(o).toEqual({
      kind: "outlook",
      title: "Your daily outlook",
      body: "You’re well recovered (78%): your HRV is above your normal. You got the 7 h 32 min of sleep you needed. A good day for a harder session: aim for a Strain of 12.0 to 14.5.",
    });
  });

  it("on a red day says why, how much sleep was missing, and to keep it light with a bedtime", () => {
    const o = outlookText({ ...base, recovery: 28, drivers: [driver("RESTING_HEART_RATE", -12)], asleepMin: 360, needMin: 480, target: [4, 8], bedtime: "22:15" });
    expect(o?.body).toBe("Your body is still recovering (28%): your resting heart rate is higher than usual. You slept 6 h, 2 h less than you needed. Keep it light, under a Strain of 8.0, and be asleep by 22:15.");
  });

  it("leaves out a reason that barely moved the score", () => {
    expect(outlookText({ ...base, recovery: 50, drivers: [driver("HEART_RATE_VARIABILITY", 1)] })?.body).toBe("You’re about at your usual level (50%).");
  });

  it("says nothing with no data", () => {
    expect(outlookText(base)).toBeNull();
  });
});

describe("outlookText, evening", () => {
  const ev = { ...base, review: true, target: [9.3, 11.7] as [number, number] };
  it("compares Strain with the target and names the longest activity", () => {
    expect(outlookText({ ...ev, strain: 11.2, activities: [{ name: "Run", minutes: 42 }] })?.body).toBe("You landed in your target: Strain 11.2 of 9.3 to 11.7, including run (42 min).");
    expect(outlookText({ ...ev, strain: 14.1 })?.body).toBe("You pushed past your target: Strain 14.1 against 9.3 to 11.7.");
    expect(outlookText({ ...ev, strain: 5, isToday: false })?.body).toBe("A lighter day: Strain 5.0, under your 9.3 to 11.7 target.");
  });

  it("describes the stress mix and its peak, then tonight's bedtime", () => {
    const o = outlookText({ ...ev, strain: 10, stress: { lowMin: 300, mediumMin: 70, highMin: 25, longestHigh: { at: "14:10", minutes: 20 } }, bedtime: "22:40" });
    expect(o?.body).toBe(
      "You landed in your target: Strain 10.0 of 9.3 to 11.7. While you were still, the day has been mostly calm: 5 h calm, 1 h 10 min focused, 25 min stressed. Your most stressful stretch was 20 min around 14:10. To recover for tomorrow, aim to be asleep by 22:40.",
    );
  });

  it("calls a day stressful at a quarter of still time in high stress, and skips a thin stress record", () => {
    expect(outlookText({ ...ev, stress: { lowMin: 100, mediumMin: 50, highMin: 60, longestHigh: null } })?.body).toContain("the day has been stressful");
    expect(outlookText({ ...ev, stress: { lowMin: 10, mediumMin: 5, highMin: 5, longestHigh: null } })).toBeNull();
  });
});

describe("minutesText", () => {
  it("reads hours and minutes", () => {
    expect([minutesText(45), minutesText(60), minutesText(70)]).toEqual(["45 min", "1 h", "1 h 10 min"]);
  });
});

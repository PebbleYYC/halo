import { describe, expect, it } from "vitest";
import { strainRingFill } from "./bands";

describe("strainRingFill", () => {
  const target = [8.4, 10.5] as const; // middle 9.45
  it("fills toward the middle of the target and is full there", () => {
    expect(strainRingFill(0, target)).toBe(0);
    expect(strainRingFill(4.725, target)).toBeCloseTo(0.5);
    expect(strainRingFill(9.45, target)).toBeCloseTo(1);
  });
  it("falls away past the middle at the same rate, never below empty", () => {
    expect(strainRingFill(10.5, target)).toBeCloseTo(strainRingFill(8.4, target));
    expect(strainRingFill(14.175, target)).toBeCloseTo(0.5);
    expect(strainRingFill(21, target)).toBe(0);
  });
  it("is a share of 21 without a target", () => {
    expect(strainRingFill(10.5, null)).toBeCloseTo(0.5);
  });
});

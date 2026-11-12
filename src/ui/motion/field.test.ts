import { describe, expect, it } from "vitest";
import { starField, STAR_COUNT } from "./field";

describe("starField", () => {
  it("draws the same sky every time", () => {
    expect(starField(136)).toEqual(starField(136));
  });

  it("keeps every star inside the hole and clear of the number", () => {
    const size = 136;
    const r = size / 2;
    const stars = starField(size);
    expect(stars.length).toBe(STAR_COUNT);
    for (const s of stars) {
      expect(Math.hypot(s.x, s.y)).toBeLessThanOrEqual(r);
      expect(Math.abs(s.y) < r * 0.24 && Math.abs(s.x) < r * 0.58).toBe(false);
      expect(s.base).toBeLessThan(0.76);
      expect(s.d).toBeGreaterThanOrEqual(1);
    }
  });
});

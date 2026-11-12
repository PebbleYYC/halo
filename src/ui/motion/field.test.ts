import { describe, expect, it } from "vitest";
import { LAYER_DRIFT, LAYER_TURN, starField, STAR_COUNT, STAR_LAYERS, WAVES } from "./field";

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
      expect(Math.abs(s.y) < r * 0.23 && Math.abs(s.x) < r * 0.56).toBe(false);
      expect(s.base).toBeLessThanOrEqual(1);
      expect(s.layer).toBeGreaterThanOrEqual(0);
      expect(s.layer).toBeLessThan(STAR_LAYERS);
    }
  });

  it("spreads the stars over every layer, and the near ones are the larger", () => {
    const stars = starField(136);
    const sizeOf = (l: number) => {
      const xs = stars.filter((s) => s.layer === l);
      expect(xs.length).toBeGreaterThan(2);
      return xs.reduce((a, s) => a + s.d, 0) / xs.length;
    };
    expect(sizeOf(STAR_LAYERS - 1)).toBeGreaterThan(sizeOf(0));
  });

  it("turns and drifts the near layers further than the far ones", () => {
    expect([...LAYER_TURN]).toEqual([...LAYER_TURN].sort((a, b) => a - b));
    expect([...LAYER_DRIFT]).toEqual([...LAYER_DRIFT].sort((a, b) => a - b));
    expect(LAYER_TURN.length).toBe(STAR_LAYERS);
  });
});

describe("WAVES", () => {
  it("crosses at its own rates, tallest and clearest first", () => {
    expect(WAVES.length).toBe(3);
    for (const w of WAVES) expect(w.amp).toBeGreaterThan(0);
    expect(WAVES[0].amp).toBe(1);
    for (let i = 1; i < WAVES.length; i++) {
      expect(WAVES[i].amp).toBeLessThan(WAVES[i - 1].amp);
      expect(WAVES[i].opacity).toBeLessThan(WAVES[i - 1].opacity);
      expect(WAVES[i].cycles).toBeGreaterThan(WAVES[i - 1].cycles);
      expect(Math.abs(WAVES[i].speed)).not.toBe(Math.abs(WAVES[i - 1].speed));
    }
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { forgetLooks, freshLook, FRESH_MS } from "./freshLook";

describe("freshLook", () => {
  beforeEach(forgetLooks);

  it("is fresh the first time, then not again until the window passes", () => {
    const t = 1_000_000;
    expect(freshLook("rings", FRESH_MS, t)).toBe(true);
    expect(freshLook("rings", FRESH_MS, t + 1000)).toBe(false);
    // Every look resets the window, so it is measured from the last one, not the first.
    expect(freshLook("rings", FRESH_MS, t + 1000 + FRESH_MS)).toBe(true);
  });

  it("keeps each screen's looks apart, and a look resets the window", () => {
    const t = 2_000_000;
    expect(freshLook("a", FRESH_MS, t)).toBe(true);
    expect(freshLook("b", FRESH_MS, t)).toBe(true);
    expect(freshLook("a", FRESH_MS, t + FRESH_MS)).toBe(true);
    // "b" has not been looked at since t, so it is fresh on its own clock.
    expect(freshLook("b", FRESH_MS, t + FRESH_MS)).toBe(true);
  });
});

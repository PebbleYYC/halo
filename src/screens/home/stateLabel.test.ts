import { describe, expect, it } from "vitest";
import { stateCardLabel } from "./stateLabel";

describe("Stress card spoken label", () => {
  it("says Today only on today", () => {
    expect(stateCardLabel("Stress so far today", "Low 2 h", true)).toBe("Stress so far today. Today: Low 2 h. Opens Stress.");
    expect(stateCardLabel("Stress", "Low 2 h, Medium 30 min", false)).toBe("Stress. Low 2 h, Medium 30 min. Opens Stress.");
  });

  it("has no empty minutes part before any minutes", () => {
    expect(stateCardLabel("Right now: Low stress", "", true)).toBe("Right now: Low stress. Opens Stress.");
    expect(stateCardLabel("Stress", "", false)).toBe("Stress. Opens Stress.");
  });
});

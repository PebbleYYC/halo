import { describe, expect, it } from "vitest";
import { MILESTONES } from "@/queries/streak";
import { FLAME_TIERS, flameTier, nextTier } from "./tiers";

describe("flame tiers", () => {
  it("burns hotter as the streak runs, each change at a milestone", () => {
    expect(flameTier(1).name).toBe("orange");
    expect(flameTier(6).name).toBe("orange");
    expect(flameTier(7).name).toBe("red");
    expect(flameTier(190).name).toBe("violet");
    expect(flameTier(500).name).toBe("blue");
    expect(flameTier(1568).name).toBe("white-blue");
    for (const t of FLAME_TIERS.slice(1)) expect(MILESTONES as readonly number[]).toContain(t.from);
  });

  it("names the next colour, and none past the last", () => {
    expect(nextTier(190)).toMatchObject({ name: "blue", from: 365 });
    expect(nextTier(1000)).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("react-native-svg", () => ({ default: () => null, Circle: () => null, Ellipse: () => null, Path: () => null }));
vi.mock("lucide-react-native", () => Object.fromEntries(["Accessibility", "Activity", "Bike", "BicepsFlexed", "Disc", "Dumbbell", "Fish", "Flame", "Footprints", "HandFist", "Mountain", "MountainSnow", "Music", "RugbyBall", "Sailboat", "Snowflake", "Swords", "Timer", "Trophy", "Volleyball", "WavesLadder", "Wind"].map((n) => [n, `lucide:${n}`])));

describe("activity icons", () => {
  it("pick by type, then by name for what Health Connect has no type for", async () => {
    const { glyphForType, Basketball, Racket, Broom, Rake } = await import("./activityGlyphs");
    expect(glyphForType("BASKETBALL")).toBe(Basketball);
    expect(glyphForType("SQUASH")).toBe(Racket);
    expect(glyphForType("OTHER_WORKOUT", "Housework")).toBe(Broom);
    expect(glyphForType("OTHER_WORKOUT", "Mowing the lawn")).toBe(Rake);
    expect(glyphForType("OTHER_WORKOUT", "Workout")).toBeNull();
  });
});

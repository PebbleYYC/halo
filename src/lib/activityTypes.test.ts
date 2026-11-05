import { describe, expect, it } from "vitest";
import { typeLabel, workoutName } from "./activityTypes";

describe("workout names", () => {
  it("use the workout's own title, else Fitbit's name for its type, else the type in words", () => {
    expect(workoutName({ type: "WEIGHTLIFTING", name: "Morning lift" })).toBe("Morning lift");
    expect(workoutName({ type: "HIGH_INTENSITY_INTERVAL_TRAINING", name: "  " })).toBe("Interval Workout");
    expect(typeLabel("FOOTBALL_AUSTRALIAN")).toBe("Football australian");
  });
});

describe("named exercises", () => {
  it("match Housework and Yard Work by name, and the plain type otherwise", async () => {
    const { exerciseEntry } = await import("./activityTypes");
    expect(exerciseEntry("OTHER_WORKOUT", "housework")?.label).toBe("Housework");
    expect(exerciseEntry("OTHER_WORKOUT", "Yard Work")?.label).toBe("Yard Work");
    expect(exerciseEntry("OTHER_WORKOUT", "Leg day")?.label).toBe("Workout");
    expect(exerciseEntry("TENNIS", null)?.label).toBe("Tennis");
  });
});

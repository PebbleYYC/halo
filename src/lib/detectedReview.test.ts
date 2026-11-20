import { describe, expect, it } from "vitest";
import type { DetectedActivity } from "@/core/algorithms/autoWorkout";
import { applyReviews, likeDismissed, type Review } from "./detectedReview";

const d = (start: number, minutes = 20, kind: DetectedActivity["kind"] = "cardio"): DetectedActivity => ({ start, end: start + minutes * 60, avgHr: 110, maxHr: 130, minutes, kind, steps: null, effort: 20 });
// 2026-11-19 07:00 UTC.
const T = Date.parse("2026-11-19T07:00:00Z") / 1000;

describe("detected reviews", () => {
  it("drops dismissed ones and relabels confirmed ones", () => {
    const reviews: Record<string, Review> = { [T]: { verdict: "not", detected: "cardio", startMin: 420, minutes: 20 }, [T + 7200]: { verdict: "workout", kind: "strength" } };
    const out = applyReviews([d(T), d(T + 7200), d(T + 20000)], reviews, "UTC");
    expect(out.map((x) => [x.start, x.sport, x.reviewed])).toEqual([
      [T + 7200, "strength", true],
      [T + 20000, "cardio", false],
    ]);
  });

  it("sets aside a new one like two already dismissed (a morning shower)", () => {
    const reviews: Record<string, Review> = {
      a: { verdict: "not", detected: "cardio", startMin: 420, minutes: 15 },
      b: { verdict: "not", detected: "cardio", startMin: 440, minutes: 18 },
    };
    expect(likeDismissed({ kind: "cardio", minutes: 16 }, 430, reviews)).toBe(true);
    expect(likeDismissed({ kind: "run", minutes: 16 }, 430, reviews)).toBe(false);
    expect(likeDismissed({ kind: "cardio", minutes: 60 }, 430, reviews)).toBe(false);
    expect(likeDismissed({ kind: "cardio", minutes: 16 }, 900, reviews)).toBe(false);
  });
});

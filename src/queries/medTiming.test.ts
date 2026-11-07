import { describe, expect, it } from "vitest";
import { medTiming } from "./journal";

const day = (i: number) => `2026-10-${String(i + 1).padStart(2, "0")}`;

describe("medicine timing", () => {
  it("splits doses at the median time and averages the next day on each side", () => {
    // 12 days: 6 doses near 20:00 (next-day sleep 85), 6 near 23:00 (next-day sleep 75); a second dose a day is ignored.
    const doses = Array.from({ length: 12 }, (_, i) => ({ tag: "med_melatonin", day: day(i), minute: i % 2 ? 23 * 60 : 20 * 60 }));
    doses.push({ tag: "med_melatonin", day: day(0), minute: 23 * 60 + 30 });
    const next = new Map(Array.from({ length: 12 }, (_, i) => [day(i + 1), i % 2 ? 75 : 85]));
    const rows = medTiming(doses, (d) => next.get(d), () => "Melatonin");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: "Melatonin", split: "23:00", early: { n: 6, avg: 85 }, late: { n: 6, avg: 75 } });
  });

  it("leaves out a medicine without enough days or without a spread of times", () => {
    const few = Array.from({ length: 6 }, (_, i) => ({ tag: "med_a", day: day(i), minute: i % 2 ? 1200 : 1380 }));
    const same = Array.from({ length: 14 }, (_, i) => ({ tag: "med_b", day: day(i), minute: 8 * 60 + (i % 3) * 5 }));
    expect(medTiming([...few, ...same], () => 70, (t) => t)).toEqual([]);
  });
});

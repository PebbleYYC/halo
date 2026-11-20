import { describe, expect, it } from "vitest";
import { medTiming } from "./journal";

const day = (i: number) => `2026-10-${String(i + 1).padStart(2, "0")}`;

describe("medicine timing", () => {
  it("splits doses at the median time and averages the next day on each side", () => {
    // 12 days: 6 doses near 20:00 (next-day sleep 85), 6 near 23:00 (next-day sleep 75); a morning dose is ignored.
    const doses = Array.from({ length: 12 }, (_, i) => ({ tag: "med_melatonin", day: day(i), minute: i % 2 ? 23 * 60 : 20 * 60 }));
    doses.push({ tag: "med_melatonin", day: day(1), minute: 8 * 60 });
    const next = new Map(Array.from({ length: 12 }, (_, i) => [day(i + 1), i % 2 ? 75 : 85]));
    const rows = medTiming(doses, (d) => next.get(d), () => "Melatonin");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: "Melatonin", split: "23:00", early: { n: 6, avg: 85 }, late: { n: 6, avg: 75 } });
  });

  it("leaves out a medicine without enough days or without a spread of times", () => {
    const few = Array.from({ length: 6 }, (_, i) => ({ tag: "med_a", day: day(i), minute: i % 2 ? 1200 : 1380 }));
    const same = Array.from({ length: 14 }, (_, i) => ({ tag: "med_b", day: day(i), minute: 21 * 60 + (i % 3) * 5 }));
    expect(medTiming([...few, ...same], () => 70, (t) => t)).toEqual([]);
  });
});

describe("medTiming grouping and clarity", () => {
  it("merges medicines logged together, and says when the gap isn't clear", () => {
    const doses = Array.from({ length: 14 }, (_, i) => {
      const day = `2026-06-${String(i + 1).padStart(2, "0")}`;
      const minute = i % 2 ? 1260 : 1320;
      return [
        { tag: "a", day, minute },
        { tag: "b", day, minute },
      ];
    }).flat();
    const rows = medTiming(doses, (d) => 60 + (Number(d.slice(-2)) % 3), (t) => t.toUpperCase());
    expect(rows).toHaveLength(1);
    expect([rows[0].label, ...rows[0].with].sort()).toEqual(["A", "B"]);
    expect(rows[0].clear).toBeNull();
  });
});

describe("evening doses only", () => {
  it("leaves a morning-only medicine out, and reads a twice-daily one's evening dose", () => {
    const am = Array.from({ length: 14 }, (_, i) => ({ tag: "med_am", day: `2026-06-${String(i + 1).padStart(2, "0")}`, minute: i % 2 ? 420 : 540 }));
    const pm = am.map((d, i) => ({ ...d, tag: "med_twice", minute: i % 2 ? 1230 : 1350 }));
    const rows = medTiming([...am, ...pm, ...am.map((d) => ({ ...d, tag: "med_twice" }))], () => 60, (t) => t);
    expect(rows.map((r) => r.tag)).toEqual(["med_twice"]);
    expect(rows[0].split).toBe("22:30");
  });
});

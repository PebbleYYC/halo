import { describe, expect, it } from "vitest";
import { doseTiming } from "./journal";

const day = (i: number) => `2026-10-${String(i + 1).padStart(2, "0")}`;

describe("doseTiming", () => {
  it("splits at the median dose time, compares next-day outcome and carries a CI", () => {
    // 12 days: early doses (~08:00) → next-day recovery 80; late doses (~11:00) → 60. A big, clear gap.
    const doses = Array.from({ length: 12 }, (_, i) => ({ tag: "med_bupropion_xl", day: day(i), minute: i % 2 ? 11 * 60 : 8 * 60 }));
    const next = new Map(Array.from({ length: 12 }, (_, i) => [day(i + 1), i % 2 ? 60 : 80]));
    const { items, needsMore } = doseTiming(doses, (d) => next.get(d), () => "Bupropion XL");
    expect(needsMore).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ label: "Bupropion XL", split: "11:00", early: { n: 6, avg: 80 }, late: { n: 6, avg: 60 }, delta: -20, effect: "negative" });
    expect(items[0].ci[0]).toBeLessThan(0);
    expect(items[0].ci[1]).toBeLessThan(0);
  });

  it("explains a medicine it can't split: too few timed days, or doses all at one time", () => {
    const few = Array.from({ length: 6 }, (_, i) => ({ tag: "med_a", day: day(i), minute: i % 2 ? 1200 : 1380 }));
    const same = Array.from({ length: 14 }, (_, i) => ({ tag: "med_b", day: day(i), minute: 8 * 60 + (i % 3) * 5 }));
    const { items, needsMore } = doseTiming([...few, ...same], () => 70, (t) => (t === "med_a" ? "A" : "B"));
    expect(items).toEqual([]);
    expect(needsMore.find((n) => n.tag === "med_a")).toMatchObject({ reason: "few_timed_days", timedDays: 6 });
    expect(needsMore.find((n) => n.tag === "med_b")).toMatchObject({ reason: "no_spread", timedDays: 14 });
  });
});

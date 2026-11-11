import { describe, expect, it } from "vitest";
import { fromWall } from "@/lib/time";
import { doseTiming, timedDoses } from "./journal";

const TZ = "America/Regina";
const dose = (day: string, hm: string, name = "Magnesium") => ({ type: "medication", day, ts: fromWall(`${day}T${hm}`, TZ), data: { name } });

describe("timedDoses", () => {
  it("counts a dose in the small hours as the evening before, after 23:59", () => {
    const { doses } = timedDoses([dose("2026-10-05", "23:30"), dose("2026-10-07", "00:20"), dose("2026-10-07", "08:00")], "2026-10-01", TZ);
    expect(doses).toEqual([
      { tag: "med_magnesium", day: "2026-10-05", minute: 23 * 60 + 30 },
      { tag: "med_magnesium", day: "2026-10-06", minute: 24 * 60 + 20 },
      { tag: "med_magnesium", day: "2026-10-07", minute: 8 * 60 },
    ]);
  });

  it("ignores other log entries and doses before the window", () => {
    const { doses, nameByTag } = timedDoses([{ type: "hydration-log", day: "2026-10-05", ts: 0, data: { ml: 250 } }, dose("2026-09-20", "21:00"), dose("2026-10-05", "21:00")], "2026-10-01", TZ);
    expect(doses).toHaveLength(1);
    expect(nameByTag.get("med_magnesium")).toBe("Magnesium");
  });

  it("splits a bedtime medicine on the clock, a late dose past midnight shown as 00:xx", () => {
    // 12 nights: six at 22:00 (next day 80), six at 00:30 (next day 60), logged on the calendar day they happened.
    const entries = Array.from({ length: 12 }, (_, i) => {
      const night = `2026-10-${String(i + 1).padStart(2, "0")}`;
      const next = `2026-10-${String(i + 2).padStart(2, "0")}`;
      return i % 2 ? dose(next, "00:30") : dose(night, "22:00");
    });
    const { doses } = timedDoses(entries, "2026-09-01", TZ);
    const out = new Map(Array.from({ length: 12 }, (_, i) => [`2026-10-${String(i + 2).padStart(2, "0")}`, i % 2 ? 60 : 80]));
    const { items } = doseTiming(doses, (d) => out.get(d), () => "Magnesium");
    expect(items[0]).toMatchObject({ split: "00:30", early: { n: 6, avg: 80, from: "22:00" }, late: { n: 6, avg: 60, to: "00:30" } });
  });
});

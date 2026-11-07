import { describe, expect, it, vi } from "vitest";
import { MemoryStore } from "./memory";

vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: async () => null, setItem: async () => {} } }));

const dose = (id: string, day: string, hour: number, name: string, dose?: string) => ({
  id,
  type: "medication",
  ts: Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00Z`) / 1000,
  day,
  data: { name, ...(dose && { dose }) },
  createdAt: 0,
  source: "pulse" as const,
});

describe("merging L-theanine and magnesium", () => {
  it("renames doses (times kept), merges each day's answer, and hides the variant rows", async () => {
    const { mergeLTheanine } = await import("./cleanups");
    const store = new MemoryStore();
    await store.addLoggedEntries([
      dose("a", "2026-11-05", 14, "L-Theanine & Magnesium"),
      dose("b", "2026-11-05", 3, "L-Theanine & Magnesium PM"),
      dose("c", "2026-11-07", 14, "L-Theanine + Mg", "250 mg + 20 mg"),
      dose("d", "2026-11-05", 14, "Intuniv", "2 mg"),
    ]);
    await store.insertJournalTags([
      { tag: "med_l_theanine_magnesium", label: "L-Theanine & Magnesium", isDefault: false, hidden: false, position: 1 },
      { tag: "med_l_theanine_magnesium_pm", label: "L-Theanine & Magnesium PM", isDefault: false, hidden: false, position: 2 },
      { tag: "med_l_theanine_mg", label: "L-Theanine + Mg", isDefault: false, hidden: false, position: 3 },
      { tag: "med_intuniv", label: "Intuniv", isDefault: false, hidden: false, position: 4 },
    ]);
    await store.setJournal({ day: "2026-11-05", tag: "med_l_theanine_magnesium", value: 1 });
    await store.setJournal({ day: "2026-11-06", tag: "med_l_theanine_magnesium_pm", value: 1 });
    await store.setJournal({ day: "2026-11-07", tag: "med_l_theanine_mg", value: 1 });
    await store.setJournal({ day: "2026-11-05", tag: "med_intuniv", value: 1 });

    const days = await mergeLTheanine(store);
    expect(days).toEqual(["2026-11-05", "2026-11-06"]);
    const logged = await store.loggedEntries(0, 100);
    expect(logged.filter((e) => e.id !== "d").map((e) => [e.id, (e.data as { name: string }).name, e.ts])).toEqual(
      expect.arrayContaining([
        ["a", "L-Theanine + Mg", dose("a", "2026-11-05", 14, "").ts],
        ["b", "L-Theanine + Mg", dose("b", "2026-11-05", 3, "").ts],
        ["c", "L-Theanine + Mg", dose("c", "2026-11-07", 14, "").ts],
      ]),
    );
    const journal = (await store.allJournal()).filter((e) => e.tag.startsWith("med_l_"));
    expect(journal.map((e) => [e.day, e.tag]).sort()).toEqual([
      ["2026-11-05", "med_l_theanine_mg"],
      ["2026-11-06", "med_l_theanine_mg"],
      ["2026-11-07", "med_l_theanine_mg"],
    ]);
    const shown = (await store.journalTags()).filter((t) => !t.hidden).map((t) => t.tag);
    expect(shown).toEqual(["med_l_theanine_mg", "med_intuniv"]);
    expect(await mergeLTheanine(store)).toEqual([]);
  });

  it("merges the schedules into one with the morning and night times", async () => {
    const { mergeSchedules } = await import("./cleanups");
    const r = mergeSchedules([
      { id: "x", name: "L-Theanine & Magnesium PM", dose: "", times: ["21:30"], days: [], remind: true },
      { id: "y", name: "L-Theanine + Mg", dose: "250 mg + 20 mg", times: ["08:00"], days: [], remind: false },
      { id: "z", name: "Intuniv", dose: "2 mg", times: ["08:00"], days: [], remind: true },
    ]);
    expect(r).toEqual({ keep: { id: "y", name: "L-Theanine + Mg", dose: "250 mg + 20 mg", times: ["08:00", "21:30"], days: [], remind: true }, drop: ["x"] });
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: async () => null, setItem: async () => {} } }));

describe("medicine schedules", () => {
  it("keep clean times and days, and read back in words", async () => {
    const { parseMedicines, scheduleText } = await import("./medicines");
    const [m] = parseMedicines(JSON.stringify([{ id: "a", name: " Melatonin ", dose: "3 mg", times: ["21:00", "bad", "08:00", "21:00"], days: [0, 1, 2, 3, 4, 5, 6], remind: true }]));
    expect(m).toEqual({ id: "a", name: "Melatonin", dose: "3 mg", times: ["08:00", "21:00"], days: [], remind: true });
    expect(scheduleText(m)).toBe("08:00 and 21:00, every day");
    expect(scheduleText({ times: ["07:30"], days: [1, 2, 3, 4, 5] })).toBe("07:30, weekdays");
    expect(parseMedicines("not json")).toEqual([]);
  });
});

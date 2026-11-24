import { describe, expect, it, vi } from "vitest";
import { coveredBy, reminderSlots } from "./medReminders";

vi.mock("expo-notifications", () => ({}));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
vi.mock("./runSync", () => ({ backgroundStore: vi.fn() }));
vi.mock("./notify", () => ({ CHANNEL_ID: "c", ensureChannel: vi.fn() }));
vi.mock("@/screens/journal/actions", () => ({ logEntry: vi.fn() }));
vi.mock("@/state/medicines", () => ({ readMedicines: vi.fn() }));

const med = (over: object = {}) => ({ id: "m1", name: "L-theanine", dose: "200 mg", times: ["21:00"], days: [], remind: true, ...over });

describe("medicine reminders", () => {
  it("sets each reminder on its own for the next days, after now, on chosen weekdays only", () => {
    const now = new Date(2026, 10, 24, 22, 0); // Tuesday 22:00: tonight's 21:00 has passed
    expect(reminderSlots([med()], now, 3).map((s) => s.day)).toEqual(["2026-11-25", "2026-11-26"]);
    // Wednesdays only (3).
    expect(reminderSlots([med({ days: [3] })], now, 10).map((s) => s.day)).toEqual(["2026-11-25", "2026-12-02"]);
    expect(reminderSlots([med({ remind: false })], now, 3)).toEqual([]);
  });

  it("skips a reminder answered by a dose logged up to three hours before it", () => {
    const at = new Date(2026, 10, 24, 21, 0).getTime();
    const s = (h: number, m = 0) => Math.floor(new Date(2026, 10, 24, h, m).getTime() / 1000);
    expect(coveredBy([{ name: "L-Theanine", ts: s(19, 30) }], "L-theanine", at)).toBe(true);
    expect(coveredBy([{ name: "L-theanine", ts: s(17, 30) }], "L-theanine", at)).toBe(false);
    expect(coveredBy([{ name: "L-theanine", ts: s(21, 5) }], "L-theanine", at)).toBe(false);
    expect(coveredBy([{ name: "Magnesium", ts: s(20) }], "L-theanine", at)).toBe(false);
  });
});

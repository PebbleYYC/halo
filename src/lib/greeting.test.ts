import { describe, expect, it } from "vitest";
import { dayPart, greeting } from "./greeting";

const TZ = "America/Regina"; // UTC−6 all year
const at = (hhmm: string) => Date.parse(`2026-11-02T${hhmm}:00-06:00`) / 1000;

describe("greeting", () => {
  it("follows the local part of the day", () => {
    expect(dayPart(at("05:00"), TZ)).toBe("morning");
    expect(dayPart(at("11:59"), TZ)).toBe("morning");
    expect(dayPart(at("12:00"), TZ)).toBe("afternoon");
    expect(dayPart(at("17:00"), TZ)).toBe("evening");
    expect(dayPart(at("22:00"), TZ)).toBe("night");
    expect(dayPart(at("04:59"), TZ)).toBe("night");
  });

  it("adds the first name when there is one, and says evening late at night", () => {
    expect(greeting(at("08:30"), TZ, "Ian")).toBe("Good morning, Ian");
    expect(greeting(at("14:00"), TZ, null)).toBe("Good afternoon");
    expect(greeting(at("23:30"), TZ, "Ian")).toBe("Good evening, Ian");
  });
});

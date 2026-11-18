import { describe, expect, it } from "vitest";

import { patternDue } from "./patternDue";
describe("patternDue", () => {
  const p = (key: string) => ({ key, kind: "bedtime" as const, subject: "sleep" as const, title: "t", body: "b", href: "/sleep", ask: "a", weight: 1 });
  const base = { patterns: [p("a"), p("b")], sent: { at: 0, keys: [] as string[] }, dismissed: {}, now: 10 * 86_400, minuteOfDay: 600 };
  it("sends the first new one in the day, weekly", () => {
    expect(patternDue(base)?.key).toBe("a");
    expect(patternDue({ ...base, sent: { at: 0, keys: ["a"] } })?.key).toBe("b");
    expect(patternDue({ ...base, dismissed: { a: 1 } })?.key).toBe("b");
    expect(patternDue({ ...base, minuteOfDay: 22 * 60 })).toBeNull();
    expect(patternDue({ ...base, sent: { at: 9 * 86_400, keys: [] } })).toBeNull();
  });
});

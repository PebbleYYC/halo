import { describe, expect, it } from "vitest";
import { checkParsed, parseLog, type ParseCtx } from "./logParse";

// 2026-11-19 23:00 in Regina (UTC-6).
const NOW = Date.parse("2026-11-20T05:00:00Z") / 1000;
const ctx: ParseCtx = {
  now: NOW,
  timeZone: "America/Regina",
  medicines: [{ name: "L-Theanine + Mg", dose: "200 mg" }, { name: "Intuniv" }, { name: "Bupropion XL" }],
  tags: [
    { tag: "alcohol", label: "Alcohol" },
    { tag: "late_caffeine", label: "Late caffeine" },
    { tag: "sauna", label: "Sauna" },
    { tag: "meditation", label: "Meditation" },
    { tag: "cold_plunge", label: "Cold plunge" },
  ],
  weightUnit: "lb",
};
const p = (s: string) => parseLog(s, ctx);

describe("parseLog", () => {
  it("reads a medicine with a + in its name and a time without am/pm", () => {
    expect(p("took L-Theanine + Mg at 9:55")).toEqual([{ kind: "medicine", name: "L-Theanine + Mg", dose: "200 mg", at: "2026-11-19T21:55" }]);
  });

  it("reads several things, sharing the one time said", () => {
    const out = p("2 beers and a bad headache last night");
    expect(out).toContainEqual({ kind: "behaviour", tag: "alcohol", label: "Alcohol", value: 2, day: "2026-11-18" });
    expect(out).toContainEqual({ kind: "symptoms", symptoms: ["HEADACHE"], headache: "MODERATE", at: "2026-11-18T22:00" });
  });

  it("water, weight and blood oxygen", () => {
    expect(p("500 ml water")).toEqual([{ kind: "water", ml: 500, at: "2026-11-19T23:00" }]);
    expect(p("2 glasses of water")[0]).toMatchObject({ kind: "water", ml: 500 });
    expect(p("weighed 178.6")[0]).toMatchObject({ kind: "weight", kg: 81 });
    expect(p("weight 80 kg")[0]).toMatchObject({ kind: "weight", kg: 80 });
    expect(p("spo2 96%")[0]).toMatchObject({ kind: "spo2", pct: 96 });
  });

  it("behaviours by label (custom ones too), late caffeine by the clock, mood", () => {
    const out = p("sauna, cold plunge, a coffee at 4pm, feeling stressed");
    expect(out.map((x) => (x.kind === "behaviour" ? x.tag : x.kind))).toEqual(["sauna", "cold_plunge", "late_caffeine", "mood"]);
    expect(p("coffee at 8am")).toEqual([{ kind: "unknown", text: "coffee" }]);
  });

  it("notes workouts, hands food on, and leaves the rest unknown", () => {
    expect(p("30 min run")).toEqual([{ kind: "workout", text: "30 min run" }]);
    expect(p("had a burger for lunch")[0]).toMatchObject({ kind: "food" });
    expect(p("played the guitar")).toEqual([{ kind: "unknown", text: "played the guitar" }]);
  });

  it("several medicines in one breath", () => {
    const out = p("Intuniv and Bupropion XL this morning");
    expect(out.map((x) => x.kind === "medicine" && x.name)).toEqual(["Intuniv", "Bupropion XL"]);
    expect(out[0]).toMatchObject({ at: "2026-11-19T08:00" });
  });
});

describe("checkParsed", () => {
  it("keeps known medicines and behaviours, drops the rest", () => {
    const raw = 'Here: [{"kind":"medicine","name":"intuniv","at":"2026-11-19T08:00"},{"kind":"medicine","name":"Aspirin"},{"kind":"behaviour","tag":"sauna","day":"2026-11-19"},{"kind":"behaviour","tag":"made_up"},{"kind":"water","ml":99999},{"kind":"mood","moods":["HAPPY","NOPE"]}]';
    const out = checkParsed(raw, ctx);
    expect(out).toEqual([
      { kind: "medicine", name: "Intuniv", at: "2026-11-19T08:00" },
      { kind: "behaviour", tag: "sauna", label: "Sauna", value: 1, day: "2026-11-19" },
      { kind: "mood", moods: ["HAPPY"], at: "2026-11-19T23:00" },
    ]);
  });
});

describe("parseLog times and amounts (review fixes)", () => {
  // 07:00 and 20:00 in Regina.
  const at = (h: number) => ({ ...ctx, now: Date.parse("2026-11-19T06:00:00Z") / 1000 + h * 3600 });
  it("'this morning' and 'tonight' stay today, capped at now", () => {
    expect(parseLog("Intuniv this morning", at(7))[0]).toMatchObject({ at: "2026-11-19T07:00" });
    expect(parseLog("Intuniv tonight", at(13))[0]).toMatchObject({ at: "2026-11-19T13:00" });
  });
  it("a part of the day picks am or pm", () => {
    expect(parseLog("Intuniv this morning at 7", at(14))[0]).toMatchObject({ at: "2026-11-19T07:00" });
    expect(parseLog("Intuniv yesterday morning at 7", at(14))).toEqual([{ kind: "medicine", name: "Intuniv", at: "2026-11-18T07:00" }]);
    expect(parseLog("Intuniv at 9 a.m.", at(16))[0]).toMatchObject({ at: "2026-11-19T09:00" });
  });
  it("coffee in oz isn't water; 'a couple' is two", () => {
    expect(parseLog("12 oz coffee", at(9)).some((x) => x.kind === "water")).toBe(false);
    expect(parseLog("a couple of beers", at(20))[0]).toMatchObject({ kind: "behaviour", value: 2 });
  });
});

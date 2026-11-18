import { describe, expect, it } from "vitest";
import { parsePatternWords, patternPrompt } from "./patternText";

const p = { key: "timing:med_l_theanine", title: "Take L-theanine before 21:00", body: "Your deep sleep runs 15% higher (92 against 80 min) on nights you take it before 21:00." };

describe("parsePatternWords", () => {
  it("keeps an honest rewrite", () => {
    const raw = 'Sure:\n[{"key":"timing:med_l_theanine","title":"Take L-theanine before 21:00","body":"Nights you take it before 21:00 bring 15% more deep sleep. Try setting a reminder."}]';
    expect(parsePatternWords(raw, [p])[p.key].body).toContain("15% more deep sleep");
  });

  it("drops invented or missing numbers, unknown keys and junk", () => {
    expect(parsePatternWords('[{"key":"timing:med_l_theanine","title":"Take it by 20:30","body":"15% more deep sleep."}]', [p])).toEqual({});
    expect(parsePatternWords('[{"key":"timing:med_l_theanine","title":"Take it earlier","body":"You sleep deeper before 21:00."}]', [p])).toEqual({});
    expect(parsePatternWords('[{"key":"other","title":"x","body":"y"}]', [p])).toEqual({});
    expect(parsePatternWords("not json", [p])).toEqual({});
  });

  it("puts the findings and notes in the prompt", () => {
    expect(patternPrompt([p], "I work nights")).toContain("I work nights");
    expect(patternPrompt([p])).toContain(p.key);
  });
});

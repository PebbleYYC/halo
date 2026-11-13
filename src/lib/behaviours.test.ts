import { describe, expect, it } from "vitest";
import { countPhrase, countedTag, isCountedTag, yesLabel } from "./behaviours";

describe("counted behaviours", () => {
  it("knows alcohol is counted and plain tags are not", () => {
    expect(isCountedTag("alcohol")).toBe(true);
    expect(isCountedTag("sauna")).toBe(false);
    expect(countedTag("alcohol")?.question).toBe("How many drinks?");
    expect(countedTag("sauna")).toBeNull();
  });

  it("words the amount, singular and plural", () => {
    expect(countPhrase("alcohol", 1)).toBe("1 drink");
    expect(countPhrase("alcohol", 3)).toBe("3 drinks");
  });

  it("carries the count in a counted behaviour's badge, and leaves other behaviours alone", () => {
    expect(yesLabel("alcohol", "Alcohol", 3)).toBe("Alcohol · 3");
    expect(yesLabel("alcohol", "Alcohol", 1)).toBe("Alcohol · 1");
    expect(yesLabel("sauna", "Sauna", 1)).toBe("Sauna");
  });
});

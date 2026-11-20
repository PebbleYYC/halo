import { describe, expect, it } from "vitest";
import { cleanNotes } from "./notes";

describe("cleanNotes", () => {
  it("drops the old build boilerplate and keeps the changes as lines", () => {
    expect(cleanNotes("Built from 280a961. Install Halo.apk, or tap Update in Halo.")).toEqual([]);
    expect(cleanNotes("• Dose timing reads the evening dose only\n• Insights: shorter copy")).toEqual(["Dose timing reads the evening dose only", "Insights: shorter copy"]);
  });
});

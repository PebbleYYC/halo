import { describe, expect, it } from "vitest";
import { medicineTag, withMedicineNoDays } from "./medicine";

describe("medicineTag", () => {
  it("prefixes the snake-cased name", () => {
    expect(medicineTag("Vitamin D")).toBe("med_vitamin_d");
    expect(medicineTag("  Ibuprofen 200mg ")).toBe("med_ibuprofen_200mg");
    expect(medicineTag("!!")).toBe("");
  });
});

describe("withMedicineNoDays", () => {
  it("fills a medicine's unanswered days from its first dose as no", () => {
    const out = withMedicineNoDays(
      [
        { day: "2026-10-02", tags: { med_melatonin: 1, alcohol: 1 } },
        { day: "2026-10-04", tags: { med_melatonin: 1 } },
      ],
      "2026-10-05",
    );
    expect(out).toEqual([
      { day: "2026-10-02", tags: { med_melatonin: 1, alcohol: 1 } },
      { day: "2026-10-03", tags: { med_melatonin: 0 } },
      { day: "2026-10-04", tags: { med_melatonin: 1 } },
      { day: "2026-10-05", tags: { med_melatonin: 0 } },
    ]);
  });

  it("leaves other behaviours and days before the first dose alone", () => {
    const out = withMedicineNoDays([{ day: "2026-10-01", tags: { alcohol: 0 } }, { day: "2026-10-03", tags: { med_x: 1 } }], "2026-10-03");
    expect(out).toEqual([{ day: "2026-10-01", tags: { alcohol: 0 } }, { day: "2026-10-03", tags: { med_x: 1 } }]);
  });

  it("keeps an answered no and doesn't touch entries without medicines", () => {
    expect(withMedicineNoDays([{ day: "2026-10-01", tags: { med_x: 1 } }, { day: "2026-10-02", tags: { med_x: 0 } }], "2026-10-02")[1].tags).toEqual({ med_x: 0 });
    expect(withMedicineNoDays([{ day: "2026-10-01", tags: { sauna: 1 } }], "2026-10-09")).toHaveLength(1);
  });
});

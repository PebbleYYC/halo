import { describe, expect, it } from "vitest";
import { emptyScoreRow } from "@/pipeline/stage1";
import { openMemoryStore } from "./memory";

describe("bodySignalsIn", () => {
  it("returns short-sleep and high-stress minutes per day, parsing only those columns", async () => {
    const store = openMemoryStore();
    await store.putScores({ ...emptyScoreRow("2026-10-01"), sleep: { needMin: 480, main: { asleepMin: 400 } } as never, stress: { highMin: 70 } as never });
    await store.putScores({ ...emptyScoreRow("2026-10-02"), sleep: { needHours: 8, main: { asleepMin: 500 } } as never });
    await store.putScores({ ...emptyScoreRow("2026-09-01"), sleep: { needMin: 480, main: { asleepMin: 300 } } as never });
    const rows = await store.bodySignalsIn({ from: "2026-10-01", to: "2026-10-31" });
    expect(rows).toEqual([
      { day: "2026-10-01", shortMin: 80, highStressMin: 70 },
      { day: "2026-10-02", shortMin: -20, highStressMin: null },
    ]);
  });

  it("gives null short sleep when a day has no sleep row", async () => {
    const store = openMemoryStore();
    await store.putScores({ ...emptyScoreRow("2026-10-01"), stress: { highMin: 20 } as never });
    expect(await store.bodySignalsIn({ from: "2026-10-01", to: "2026-10-01" })).toEqual([{ day: "2026-10-01", shortMin: null, highStressMin: 20 }]);
  });
});

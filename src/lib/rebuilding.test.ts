import { describe, expect, it, afterEach } from "vitest";
import { isRebuilding, REBUILDING_COPY, setRebuilding, subscribeRebuilding } from "./rebuilding";
import { reasonCopy } from "./reasons";

afterEach(() => setRebuilding(false));

describe("rebuilding", () => {
  it("says a rebuild is running in place of every missing-value reason", () => {
    expect(reasonCopy("awaiting_sleep_sync").long).toBe("Waiting for last night’s sleep to sync");
    setRebuilding(true);
    for (const code of ["awaiting_sleep_sync", "band_not_worn", "no_data", "no_hrv_last_night", "insufficient_hr_data"]) {
      expect(reasonCopy(code)).toMatchObject({ code, short: REBUILDING_COPY.short, long: REBUILDING_COPY.long });
    }
  });

  it("leaves calibrating alone: its nights are not what a rebuild changes", () => {
    setRebuilding(true);
    expect(reasonCopy("calibrating", 3).long).toBe("Calibrating: 3 nights left");
  });

  it("tells its subscribers when it starts and stops, once each", () => {
    let n = 0;
    const off = subscribeRebuilding(() => n++);
    setRebuilding(true);
    setRebuilding(true);
    expect([isRebuilding(), n]).toEqual([true, 1]);
    setRebuilding(false);
    expect([isRebuilding(), n]).toEqual([false, 2]);
    off();
    setRebuilding(true);
    expect(n).toBe(2);
  });
});

describe("syncing", () => {
  it("says a missing value is still being read while a run is in flight, and a rebuild outranks it", async () => {
    const { setSyncing } = await import("./rebuilding");
    setSyncing(true);
    expect(reasonCopy("awaiting_sleep_sync").long).toBe("Syncing your latest data");
    expect(reasonCopy("no_data").short).toBe("Syncing");
    expect(reasonCopy("calibrating", 2).long).toBe("Calibrating: 2 nights left");
    setRebuilding(true);
    expect(reasonCopy("no_data").long).toBe(REBUILDING_COPY.long);
    setRebuilding(false);
    setSyncing(false);
    expect(reasonCopy("no_data").short).not.toBe("Syncing");
  });
});

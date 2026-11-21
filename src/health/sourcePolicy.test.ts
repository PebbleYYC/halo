// The source policy on plain record objects: which Health Connect records the import keeps.
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => storage.get(k) ?? null,
    setItem: async (k: string, v: string) => void storage.set(k, v),
    multiRemove: async (ks: string[]) => ks.forEach((k) => storage.delete(k)),
  },
}));
vi.mock("react-native-health-connect", () => ({}));

const { applySourcePolicy, DEFAULT_SOURCE_POLICY, FITBIT_PACKAGES, getSourcePolicy, isFitbit, originBreakdown, originFilter, setSourcePolicy, SOURCE_POLICY_KEY } =
  await import("./sourcePolicy");
const { IMPORT_STATE_KEY, TOKEN_KEY } = await import("./importState");

const FITBIT = "com.fitbit.FitbitMobile";
const WATCH = 1;
const PHONE = 2;
const BAND = 6;
const MANUAL = 3;
const rec = (id: string, origin: string, deviceType: number | null, start: string, extra: object = {}) => ({
  metadata: { id, dataOrigin: origin, ...(deviceType != null && { device: { type: deviceType } }), ...extra },
  startTime: start,
  endTime: start.replace(/T(\d\d)/, (_, h) => `T${String(Number(h) + 1).padStart(2, "0")}`),
});

describe("device classification", () => {
  it("counts the Fitbit app's band, watch and device-less records as Fitbit, and its phone-measured ones not", () => {
    expect(FITBIT_PACKAGES).toEqual([FITBIT]);
    expect(isFitbit("Steps", rec("a", FITBIT, BAND, "2026-10-06T10:00:00Z"))).toBe(true);
    expect(isFitbit("Steps", rec("b", FITBIT, WATCH, "2026-10-06T10:00:00Z"))).toBe(true);
    expect(isFitbit("Steps", rec("c", FITBIT, null, "2026-10-06T10:00:00Z"))).toBe(true);
    expect(isFitbit("Steps", rec("d", FITBIT, 0, "2026-10-06T10:00:00Z"))).toBe(true);
    expect(isFitbit("Steps", rec("e", FITBIT, PHONE, "2026-10-06T10:00:00Z"))).toBe(false);
    expect(isFitbit("Steps", rec("f", "com.sec.android.app.shealth", BAND, "2026-10-06T10:00:00Z"))).toBe(false);
  });

  it("keeps the Fitbit app's typed-in entries and log-like types whatever device they were entered on", () => {
    expect(isFitbit("ExerciseSession", rec("m", FITBIT, PHONE, "2026-10-06T10:00:00Z", { recordingMethod: MANUAL }))).toBe(true);
    expect(isFitbit("Weight", rec("w", FITBIT, PHONE, "2026-10-06T10:00:00Z"))).toBe(true);
    expect(isFitbit("Hydration", rec("h", FITBIT, PHONE, "2026-10-06T10:00:00Z"))).toBe(true);
    // Measured on the phone, not typed in: left out.
    expect(isFitbit("ExerciseSession", rec("g", FITBIT, PHONE, "2026-10-06T10:00:00Z", { recordingMethod: 1 }))).toBe(false);
  });
});

describe("applySourcePolicy", () => {
  const records = [
    rec("band-6", FITBIT, BAND, "2026-10-06T10:00:00Z"),
    rec("phone-6", FITBIT, PHONE, "2026-10-06T10:00:00Z"),
    rec("other-6", "com.sec.android.app.shealth", null, "2026-10-06T12:00:00Z"),
    rec("phone-5", FITBIT, PHONE, "2026-10-05T10:00:00Z"),
    rec("other-5", "com.sec.android.app.shealth", null, "2026-10-05T12:00:00Z"),
  ];
  const ids = (xs: { metadata: { id: string } }[]) => xs.map((r) => r.metadata.id);

  it("fitbit_only keeps the Fitbit records alone", () => {
    expect(ids(applySourcePolicy("Steps", records, "fitbit_only", "UTC"))).toEqual(["band-6"]);
  });

  it("fitbit_first keeps a day's Fitbit records when it has any of the type, else everything that day", () => {
    expect(ids(applySourcePolicy("Steps", records, "fitbit_first", "UTC"))).toEqual(["band-6", "phone-5", "other-5"]);
    // Per type: weight from the other app stays on a day the band has steps.
    expect(ids(applySourcePolicy("Weight", [rec("scale", "com.other.scale", 3, "2026-10-06T07:00:00Z")], "fitbit_first", "UTC"))).toEqual(["scale"]);
  });

  it("fitbit_first puts a sleep session on its wake day", () => {
    const night = { ...rec("band-night", FITBIT, BAND, "2026-10-05T23:00:00Z"), endTime: "2026-10-06T07:00:00Z" };
    const phoneNight = { ...rec("phone-night", "com.sleep.app", PHONE, "2026-10-05T22:30:00Z"), endTime: "2026-10-06T06:30:00Z" };
    const phoneNap = { ...rec("phone-nap", "com.sleep.app", PHONE, "2026-10-05T14:00:00Z"), endTime: "2026-10-05T15:00:00Z" };
    expect(ids(applySourcePolicy("SleepSession", [night, phoneNight, phoneNap], "fitbit_first", "UTC"))).toEqual(["band-night", "phone-nap"]);
  });

  it("all keeps everything", () => {
    expect(applySourcePolicy("Steps", records, "all", "UTC")).toBe(records);
  });

  it("asks Health Connect for the Fitbit app's records only under fitbit_only", () => {
    expect(originFilter("fitbit_only")).toEqual([FITBIT]);
    expect(originFilter("fitbit_first")).toBeUndefined();
    expect(originFilter("all")).toBeUndefined();
  });
});

describe("originBreakdown", () => {
  it("counts records per app and device type, most first", () => {
    const xs = [
      rec("1", FITBIT, WATCH, "2026-10-06T10:00:00Z"),
      rec("2", FITBIT, WATCH, "2026-10-06T10:00:00Z"),
      rec("3", FITBIT, PHONE, "2026-10-06T10:00:00Z"),
      rec("4", "com.sec.android.app.shealth", null, "2026-10-06T10:00:00Z"),
    ];
    expect(originBreakdown(xs)).toEqual([`${FITBIT}/watch: 2`, `${FITBIT}/phone: 1`, "com.sec.android.app.shealth/no device: 1"]);
  });
});

describe("the stored choice", () => {
  beforeEach(() => storage.clear());

  it("defaults to fitbit_only and ignores a value it doesn't know", async () => {
    expect(DEFAULT_SOURCE_POLICY).toBe("fitbit_only");
    expect(await getSourcePolicy()).toBe("fitbit_only");
    storage.set(SOURCE_POLICY_KEY, "phones_please");
    expect(await getSourcePolicy()).toBe("fitbit_only");
  });

  it("a change forgets the changes token and the import state, so the next sync re-imports", async () => {
    storage.set(TOKEN_KEY, "tok");
    storage.set(IMPORT_STATE_KEY, JSON.stringify({ version: 2, policy: "fitbit_only" }));
    await setSourcePolicy("fitbit_only"); // no change
    expect(storage.get(TOKEN_KEY)).toBe("tok");
    await setSourcePolicy("all");
    expect(await getSourcePolicy()).toBe("all");
    expect(storage.has(TOKEN_KEY)).toBe(false);
    expect(storage.has(IMPORT_STATE_KEY)).toBe(false);
  });
});

describe("today's tail (steps)", () => {
  const now = Date.parse("2026-11-21T03:20:00Z") / 1000; // 21:20 in Regina
  const tz = "America/Regina";
  const rec = (origin: string, device: number, start: string, end: string, count: number) => ({ metadata: { dataOrigin: origin, device: { type: device } }, startTime: start, endTime: end, count });
  const fitbit = (s: string, e: string, n: number) => rec("com.fitbit.FitbitMobile", 0, s, e, n);
  it("fills after the band's last record from the larger phone source, once", () => {
    const records = [
      fitbit("2026-11-20T15:00:00Z", "2026-11-20T15:10:00Z", 500),
      fitbit("2026-11-20T20:30:00Z", "2026-11-20T20:42:00Z", 300), // 14:42 local
      rec("com.google.android.apps.fitness", 2, "2026-11-20T20:00:00Z", "2026-11-20T20:10:00Z", 400), // before: dropped
      rec("com.google.android.apps.fitness", 2, "2026-11-20T22:00:00Z", "2026-11-20T23:00:00Z", 5000),
      rec("android", 2, "2026-11-20T22:00:00Z", "2026-11-20T23:00:00Z", 4800),
    ];
    const kept = applySourcePolicy("Steps", records, "fitbit_only", tz, now);
    expect(kept.map((r) => r.count)).toEqual([500, 300, 5000]);
    // Filed under the band, so the day's total adds them.
    expect(kept[2].metadata.dataOrigin).toBe("com.fitbit.FitbitMobile");
  });
  it("leaves other days and types alone", () => {
    const yesterday = [fitbit("2026-11-19T20:30:00Z", "2026-11-19T20:42:00Z", 300), rec("com.google.android.apps.fitness", 2, "2026-11-19T22:00:00Z", "2026-11-19T23:00:00Z", 5000)];
    expect(applySourcePolicy("Steps", yesterday, "fitbit_only", tz, now).map((r) => r.count)).toEqual([300]);
  });
});

import { stepsPerDay } from "./import";
describe("today's tail adds to the band's day", () => {
  it("sums band and tail into one day total", () => {
    const now = Date.parse("2026-11-21T03:20:00Z") / 1000;
    const tz = "America/Regina";
    const band = { metadata: { dataOrigin: "com.fitbit.FitbitMobile", device: null }, startTime: "2026-11-20T20:30:00Z", endTime: "2026-11-20T20:42:00Z", count: 4519 };
    const phone = { metadata: { dataOrigin: "com.google.android.apps.fitness", device: { type: 2 } }, startTime: "2026-11-20T22:00:00Z", endTime: "2026-11-20T23:00:00Z", count: 5703 };
    const kept = applySourcePolicy("Steps", [band, phone], "fitbit_only", tz, now);
    expect(stepsPerDay(kept as never, tz).get("2026-11-20")).toBeCloseTo(10222, 3);
  });
});

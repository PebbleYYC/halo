import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => storage.get(k) ?? null,
    setItem: async (k: string, v: string) => void storage.set(k, v),
    multiRemove: async (ks: string[]) => ks.forEach((k) => storage.delete(k)),
  },
}));

const { MemoryStore } = await import("@/data/memory");
const { metricsWithLoggedBody, SPO2_KEY } = await import("@/data/body");
const { emptyMetrics } = await import("@/data/types");
const { GoogleSignInError } = await import("../../modules/pulse-google/errors");
const { syncGoogleSpo2 } = await import("./spo2");

const TZ = "Asia/Kolkata";
const NOW = Date.parse("2026-10-02T06:00:00Z");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const point = (y: number, m: number, d: number, pct: number) => ({ dailyOxygenSaturation: { date: { year: y, month: m, day: d }, averagePercentage: pct } });

let store: InstanceType<typeof MemoryStore>;
beforeEach(() => {
  storage.clear();
  store = new MemoryStore();
});

function google(points: unknown[], status = 200) {
  const filters: string[] = [];
  const fetch = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    filters.push(url.searchParams.get("filter") ?? "");
    return status === 200 ? json({ dataPoints: points }) : json({ error: { code: status, status: "INTERNAL" } }, status);
  }) as unknown as typeof globalThis.fetch;
  return { fetch, filters };
}

const opts = (fetch: typeof globalThis.fetch, token = async () => "at") => ({ timeZone: TZ, token, fetch, now: () => NOW, sleep: async () => {}, log: { warn: vi.fn() } });

describe("syncGoogleSpo2", () => {
  it("backfills 180 days on the first run and stores each night's average", async () => {
    const g = google([point(2026, 10, 1, 96.4), point(2026, 9, 30, 95.1)]);
    const r = await syncGoogleSpo2(store, opts(g.fetch));
    expect(r.warnings).toEqual([]);
    expect(g.filters).toHaveLength(2); // 180 days in 90-day windows
    expect((await store.valuesForKey(SPO2_KEY)).map((v) => [v.day, v.value])).toEqual([
      ["2026-09-30", 95.1],
      ["2026-10-01", 96.4],
    ]);
  });

  it("reads only the last few days once something is stored", async () => {
    await syncGoogleSpo2(store, opts(google([point(2026, 10, 1, 96.4)]).fetch));
    const g = google([]);
    await syncGoogleSpo2(store, opts(g.fetch));
    expect(g.filters).toHaveLength(1);
    expect(g.filters[0]).toContain('>= "2026-09-29"');
  });

  it("backfills again after Health Connect's re-import cleared the rows", async () => {
    await syncGoogleSpo2(store, opts(google([point(2026, 10, 1, 96.4)]).fetch));
    await store.clearImported({ from: "0000-01-01", to: "9999-12-31" }, 0, 2 ** 31);
    const g = google([point(2026, 10, 1, 96.4)]);
    await syncGoogleSpo2(store, opts(g.fetch));
    expect(g.filters).toHaveLength(2);
  });

  it("turns a sign-in or API failure into a warning, never a throw", async () => {
    const signIn = await syncGoogleSpo2(store, opts(google([]).fetch, async () => Promise.reject(new GoogleSignInError("needs_sign_in"))));
    expect(signIn.warnings).toEqual(["spo2_sign_in"]);
    const failed = await syncGoogleSpo2(store, opts(google([], 400).fetch));
    expect(failed.warnings).toEqual(["spo2_failed"]);
  });
});

describe("SpO2 precedence", () => {
  it("uses Google only where Health Connect and the journal have nothing", async () => {
    await store.upsertMetrics([{ ...emptyMetrics("2026-09-30"), spo2Pct: 97 }, { ...emptyMetrics("2026-10-01"), rhrBpm: 55 }]);
    await store.upsertDailyValues([
      { day: "2026-09-30", key: SPO2_KEY, value: 93 },
      { day: "2026-10-01", key: SPO2_KEY, value: 95.5 },
      { day: "2026-10-02", key: SPO2_KEY, value: 94 },
    ]);
    const m = new Map((await metricsWithLoggedBody(store)).map((x) => [x.day, x]));
    expect(m.get("2026-09-30")?.spo2Pct).toBe(97);
    expect(m.get("2026-10-01")).toMatchObject({ spo2Pct: 95.5, rhrBpm: 55 });
    expect(m.get("2026-10-02")?.spo2Pct).toBe(94);
  });
});

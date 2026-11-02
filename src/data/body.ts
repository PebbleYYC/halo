// Every reader of daily metrics goes through here, so weight, body fat and blood oxygen logged in the Journal count
// like imported readings. Blood oxygen comes last from the Google Health API (google/spo2.ts), since Health Connect
// never gets it from the Google Health app. Order: the latest journal entry, then Health Connect, then Google.
import type { Store } from "./store";
import { emptyMetrics, type Metrics } from "./types";

const ALL = Number.MAX_SAFE_INTEGER;

/** The daily-values key google/spo2.ts writes Google's nightly SpO2 under. */
export const SPO2_KEY = "google_spo2_pct";

/** `store.allMetrics()` with logged weight, body fat and blood oxygen, and Google's SpO2, applied; sorted by day like the store's own list. */
export async function metricsWithLoggedBody(store: Store): Promise<Metrics[]> {
  const [metrics, logged, google] = await Promise.all([store.allMetrics(), store.loggedEntries(0, ALL), store.valuesForKey(SPO2_KEY)]);
  const latest = new Map<string, { kg?: { v: number; ts: number }; pct?: { v: number; ts: number }; spo2?: { v: number; ts: number } }>();
  for (const e of logged) {
    const data = e.data as { kg?: unknown; pct?: unknown } | null;
    const day = latest.get(e.day) ?? {};
    if (e.type === "weight" && typeof data?.kg === "number" && (!day.kg || e.ts > day.kg.ts)) day.kg = { v: data.kg, ts: e.ts };
    else if (e.type === "body-fat" && typeof data?.pct === "number" && (!day.pct || e.ts > day.pct.ts)) day.pct = { v: data.pct, ts: e.ts };
    else if (e.type === "oxygen-saturation" && typeof data?.pct === "number" && (!day.spo2 || e.ts > day.spo2.ts)) day.spo2 = { v: data.pct, ts: e.ts };
    else continue;
    latest.set(e.day, day);
  }
  if (!latest.size && !google.length) return metrics;

  const byDay = new Map(metrics.map((m) => [m.day, m]));
  for (const g of google) {
    const m = byDay.get(g.day) ?? emptyMetrics(g.day);
    if (m.spo2Pct == null) byDay.set(g.day, { ...m, spo2Pct: g.value });
  }
  for (const [day, l] of latest) {
    const m = byDay.get(day) ?? emptyMetrics(day);
    byDay.set(day, { ...m, weightKg: l.kg?.v ?? m.weightKg, bodyFatPct: l.pct?.v ?? m.bodyFatPct, spo2Pct: l.spo2?.v ?? m.spo2Pct });
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

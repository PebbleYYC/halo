// SpO2 from the Google Health API, which the Google Health app never shares with Health Connect.
// Stored as daily values under SPO2_KEY; data/body.ts uses one only where Health Connect and the journal have none.
import { isSignInError } from "../../modules/pulse-google/errors";
import { SPO2_KEY } from "@/data/body";
import type { Store } from "@/data/store";
import { addDays, localDay, localMidnight } from "@/lib/time";
import { DATA_TYPES } from "./catalogue";
import { createGoogleClient, GoogleError, localWindows, type TokenProvider } from "./client";
import { mapDaily } from "./map";
import { readConnection, readSyncDoc, writeSyncDoc } from "./state";

const TYPE = "daily-oxygen-saturation";
const JOB_KEY = "spo2-supplement";
const BACKFILL_DAYS = 180;
const OVERLAP_DAYS = 3;

const health = (s: string) => `https://www.googleapis.com/auth/googlehealth.${s}`;
/** SpO2 lives under health metrics; profile.readonly is only for the identity check at Connect. */
export const SPO2_SCOPE = health("health_metrics_and_measurements.readonly");
export const SPO2_SCOPES = [SPO2_SCOPE, health("profile.readonly"), "https://www.googleapis.com/auth/userinfo.email"];

export type Spo2SyncOptions = {
  timeZone: string;
  token: TokenProvider;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: Pick<Console, "warn">;
};

/** Never throws, so a Google failure can't fail the Health Connect run; it returns a warning instead. */
// With nothing stored (first run, or a Health Connect re-import cleared it), reads all 180 days again.
export async function syncGoogleSpo2(store: Store, opts: Spo2SyncOptions): Promise<{ written: number; warnings: string[] }> {
  const tz = opts.timeZone;
  const nowMs = opts.now ?? Date.now;
  const log = opts.log ?? console;
  const t = Math.floor(nowMs() / 1000);
  const today = localDay(t, tz);
  try {
    await opts.token(false);
    const client = createGoogleClient({ token: opts.token, timeZone: tz, fetch: opts.fetch, sleep: opts.sleep, now: nowMs });
    const doc = await readSyncDoc();
    const through = doc.jobs[JOB_KEY]?.syncedThrough ?? null;
    const stored = await store.valuesForKey(SPO2_KEY);
    const from =
      through == null || stored.length === 0
        ? localMidnight(addDays(today, 1 - BACKFILL_DAYS), tz)
        : localMidnight(addDays(localDay(through, tz), -OVERLAP_DAYS), tz);
    let written = 0;
    for (const win of localWindows(from, t, DATA_TYPES[TYPE].maxDays, tz)) {
      const rows = mapDaily(TYPE, await client.list(TYPE, win.start, win.end), tz)
        .filter((r) => typeof r.spo2Pct === "number")
        .map((r) => ({ day: r.day, key: SPO2_KEY, value: r.spo2Pct as number }));
      if (rows.length) await store.upsertDailyValues(rows);
      written += rows.length;
    }
    doc.jobs[JOB_KEY] = { syncedThrough: t, backfillDone: BACKFILL_DAYS, backfillTotal: BACKFILL_DAYS, lastAttemptAt: t, lastSuccessAt: t, lastError: null };
    await writeSyncDoc(doc);
    return { written, warnings: [] };
  } catch (e) {
    if (isSignInError(e)) return { written: 0, warnings: ["spo2_sign_in"] };
    log.warn(e instanceof GoogleError ? e.message : "[google] spo2: internal error");
    return { written: 0, warnings: ["spo2_failed"] };
  }
}

/** Whether a Google account is connected for SpO2 (or as the full source, whose grant covers it too). */
export const hasGoogleSpo2 = async () => (await readConnection())?.scopes.includes(SPO2_SCOPE) ?? false;

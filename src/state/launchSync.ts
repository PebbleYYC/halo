// Whether a launch needs the launch sync (an import and a rescore, seconds of JS work). Pure, for the tests.
import { localDay } from "@/lib/time";

/** A launch or a return this soon after the last import skips the sync: Health Connect gets new data every few minutes. */
export const FRESH_SYNC_S = 2 * 60;

/** With the app open, an import this old is redone. */
export const OPEN_SYNC_S = 5 * 60;

/** Imported under FRESH_SYNC_S ago (by the app or the background task) and still the same local day. */
export const syncedRecently = (lastSyncTs: number | null, timeZone: string, now = Date.now() / 1000): boolean =>
  lastSyncTs != null && now >= lastSyncTs && now - lastSyncTs < FRESH_SYNC_S && localDay(lastSyncTs, timeZone) === localDay(now, timeZone);

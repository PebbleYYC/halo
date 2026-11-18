// Home's header state that the web reads from its ShellStatus (src/server/queries/settings.ts): the sync status for
// the battery slot and the wear streak, rebuilt from the app state and the Store.
import * as React from "react";
import { useApp } from "@/state/app";
import type { SyncShellStatus } from "@/ui";

/** Sync is "behind" after two hours without a successful import (the web's STALE_MS). */
const STALE_MS = 2 * 3600_000;

/** The current time, ticking every `everyMs` so relative labels ("12m") stay fresh. */
export function useNow(everyMs = 60_000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

/** The header's sync status: demo data never goes stale; a failed run reads as "Sync failed" until the next one. */
export function useSyncShell(): { status: SyncShellStatus; now: number } {
  const app = useApp();
  const now = useNow();
  const demo = app.source === "demo";
  const last = app.sync.lastSyncTs !== null ? app.sync.lastSyncTs * 1000 : null;
  const error = !!app.error || !!app.sync.lastError;
  const stale = !demo && (last === null || now - last > STALE_MS);
  const state: SyncShellStatus["sync"]["state"] = app.status === "syncing" ? "syncing" : error ? "error" : stale ? "stale" : "ok";
  return {
    status: {
      mode: demo ? "demo" : "google",
      sync: { state, lastSuccessAt: last },
      connection: app.source ? (app.status === "syncing" && last === null ? "importing" : "connected") : "not_connected",
      timeZone: app.timeZone,
    },
    now: Math.max(now, last ?? 0),
  };
}

/** The capsule's count: the same rules as the streak page (src/queries/streak.ts). */
export { wearStreak } from "@/queries/streak";

const STEP_LABEL: Record<string, string> = {
  write: "Saving your data",
  done: "Imported",
  stage1: "Scoring your days",
  stage2: "Scoring Recovery, Sleep and Strain",
  journal: "Matching your journal",
};

/** A sync or scoring step ("read:HeartRate", "stage2"…) as a short line for the first-import screen. */
export function progressLabel(p: { step: string; done: number; total: number }): string {
  const step = p.step.startsWith("read:day:")
    ? "Reading Health Connect"
    : p.step.startsWith("read:")
      ? `Reading ${p.step.slice(5).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}`
      : (STEP_LABEL[p.step] ?? p.step);
  return p.total > 0 ? `${step} · ${p.done}/${p.total}` : step;
}

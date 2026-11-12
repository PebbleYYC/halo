// Whether a re-import is rebuilding days right now. A re-import clears each day before it writes the day's records
// back, so for as long as it runs every score on screen is missing — and the usual copy blames the band for a night
// that is only mid-flight ("Waiting for last night's sleep to sync"), which reads as lost data. The sync raises this
// flag while it rebuilds; the copy and the empty states say so instead.
import * as React from "react";

let rebuilding = false;
const subs = new Set<() => void>();

/** What every missing value says while the rebuild runs. */
export const REBUILDING_COPY = { short: "Re-importing", long: "Re-importing your history" } as const;

export function setRebuilding(v: boolean): void {
  if (v === rebuilding) return;
  rebuilding = v;
  subs.forEach((fn) => fn());
}

export const isRebuilding = (): boolean => rebuilding;

export function subscribeRebuilding(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

/** True while the rebuild runs: a card reading this re-renders when it starts and when it ends. */
export function useRebuilding(): boolean {
  return React.useSyncExternalStore(subscribeRebuilding, isRebuilding, isRebuilding);
}

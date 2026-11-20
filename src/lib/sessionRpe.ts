// How hard a strength session felt (session RPE, 1–10), asked only where heart rate undercounts the work: a lift's
// heart rate stays low between sets however hard the sets were (NOOP Forge: "ask where the answer adds something heart
// rate cannot"). Kept on this phone by session ("w:<workout id>" or "d:<detected start>"); shown on the session and
// read by the Coach. It doesn't change Strain.
import * as React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "halo.sessionRpe";
let cache: Record<string, number> | null = null;
const subs = new Set<() => void>();

/** The five answers, each a point on the 1–10 scale. */
export const RPE_LEVELS: readonly (readonly [value: number, label: string])[] = [
  [3, "Easy"],
  [5, "Moderate"],
  [7, "Hard"],
  [9, "Very hard"],
  [10, "All out"],
];
export const rpeLabel = (v: number) => RPE_LEVELS.find(([x]) => x === v)?.[1] ?? `${v}/10`;

export async function loadRpe(): Promise<Record<string, number>> {
  if (cache) return cache;
  try {
    const v: unknown = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "{}");
    cache = v && typeof v === "object" ? (v as Record<string, number>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

let queue: Promise<unknown> = Promise.resolve();
export function setRpe(session: string, value: number | null): Promise<void> {
  const run = queue.then(() => write(session, value));
  queue = run.catch(() => {});
  return run;
}

async function write(session: string, value: number | null): Promise<void> {
  const next = { ...(await loadRpe()) };
  if (value == null) delete next[session];
  else next[session] = Math.max(1, Math.min(10, Math.round(value)));
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - 500))) delete next[k];
  cache = next;
  subs.forEach((f) => f());
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

export function useRpe(session: string): number | null {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    subs.add(bump);
    if (!cache) void loadRpe().then(bump);
    return () => void subs.delete(bump);
  }, []);
  return cache?.[session] ?? null;
}

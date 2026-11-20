// Cards swiped away on Home, remembered by their content: a card stays gone until what it says changes (a new insight,
// an updated outlook), then it comes back. The last 200 kept.
import * as React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "halo.dismissed";
let cache: string[] | null = null;
const subs = new Set<() => void>();

/** What identifies a card's content: its subject, title and words. */
export const contentKey = (...parts: (string | null | undefined)[]) => parts.map((p) => p ?? "").join("␟");

async function load(): Promise<string[]> {
  if (cache) return cache;
  try {
    const v: unknown = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "[]");
    cache = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    cache = [];
  }
  return cache;
}

export async function dismissContent(key: string): Promise<void> {
  const all = await load();
  cache = [...all.filter((k) => k !== key), key].slice(-200);
  subs.forEach((f) => f());
  await AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => {});
}

/** Whether a content key was swiped away (false until the list is read), and the function that dismisses one. */
export function useDismissed(): [(key: string) => boolean, (key: string) => void] {
  const [n, bump] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    subs.add(bump);
    if (!cache) void load().then(bump);
    return () => void subs.delete(bump);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const has = React.useCallback((key: string) => !!cache?.includes(key), [n]);
  const off = React.useCallback((key: string) => void dismissContent(key), []);
  return [has, off];
}

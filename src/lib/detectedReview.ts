// Detected activities, reviewed: each one confirmed (perhaps as another sport) or dismissed as not a workout ("a hot
// shower"), kept on the phone by its start. Learning from the answers: a new detection like two or more dismissed ones
// (the same label, starting within an hour of the same clock time, lasting within half again as long) is set aside
// without asking. Read through `applyReviews` wherever detected activities are read (queries/common.ts loadDays).
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DetectedActivity } from "@/core/algorithms/autoWorkout";
import { localMinutes } from "./time";

export type ReviewKind = "walk" | "run" | "ride" | "strength" | "cardio";
export type Review = { verdict: "workout"; kind: ReviewKind } | { verdict: "not"; detected: DetectedActivity["kind"]; startMin: number; minutes: number };
export type Reviewed = DetectedActivity & { reviewed: boolean; sport: ReviewKind };

const KEY = "halo.detectedReviews";
let cache: Record<string, Review> | null = null;
const subs = new Set<() => void>();

export async function loadReviews(): Promise<Record<string, Review>> {
  if (cache) return cache;
  try {
    const v: unknown = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "{}");
    cache = v && typeof v === "object" ? (v as Record<string, Review>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export async function setReview(start: number, review: Review | null): Promise<void> {
  const all = { ...(await loadReviews()) };
  if (review) all[String(start)] = review;
  else delete all[String(start)];
  // Keep the last 400 answers.
  const keys = Object.keys(all).sort((a, b) => Number(a) - Number(b));
  for (const k of keys.slice(0, Math.max(0, keys.length - 400))) delete all[k];
  cache = all;
  subs.forEach((f) => f());
  await AsyncStorage.setItem(KEY, JSON.stringify(all)).catch(() => {});
}

export function subscribeReviews(fn: () => void): () => void {
  subs.add(fn);
  return () => void subs.delete(fn);
}

/** Whether `d` looks like two or more activities already dismissed. Pure. */
export function likeDismissed(d: Pick<DetectedActivity, "kind" | "minutes">, startMin: number, reviews: Record<string, Review>): boolean {
  let n = 0;
  for (const r of Object.values(reviews)) {
    if (r.verdict !== "not" || r.detected !== d.kind) continue;
    const gap = Math.abs(r.startMin - startMin);
    const clock = Math.min(gap, 1440 - gap);
    const ratio = d.minutes / Math.max(1, r.minutes);
    if (clock <= 60 && ratio >= 1 / 1.5 && ratio <= 1.5) n++;
  }
  return n >= 2;
}

/** A day's detections with the answers applied: dismissed ones (and ones like them) gone, the rest with their sport. Pure. */
export function applyReviews(ds: readonly DetectedActivity[], reviews: Record<string, Review>, timeZone: string): Reviewed[] {
  const out: Reviewed[] = [];
  for (const d of ds) {
    const r = reviews[String(d.start)];
    if (r?.verdict === "not") continue;
    if (r?.verdict === "workout") {
      out.push({ ...d, reviewed: true, sport: r.kind });
      continue;
    }
    if (likeDismissed(d, localMinutes(d.start, timeZone), reviews)) continue;
    out.push({ ...d, reviewed: false, sport: d.kind });
  }
  return out;
}

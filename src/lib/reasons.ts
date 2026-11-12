// Ported from Halo's src/lib/reasons.ts (icons dropped: the mobile app maps a ReasonCode to a lucide icon itself).
import { isRebuilding, REBUILDING_COPY } from "./rebuilding";
export const REASON_CODES = [
  "calibrating",
  "no_hrv_last_night",
  "awaiting_sleep_sync",
  "insufficient_hr_data",
  "band_not_worn",
  "no_data",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export type MetricTag = "stale_baseline" | "updated";

/** One nullable metric in a view model. `undefined` (the whole metric) means still loading. */
export type Metric<T> = {
  value: T | null;
  reason: ReasonCode | null;
  provisional: boolean;
  tags?: MetricTag[];
  /** For `calibrating`. */
  nightsLeft?: number;
};

type ReasonEntry = { short: string; long: (nightsLeft?: number) => string };

export const REASONS: Record<ReasonCode, ReasonEntry> = {
  calibrating: {
    short: "Calibrating",
    long: (n) => (n === undefined ? "Calibrating" : `Calibrating: ${n} ${n === 1 ? "night" : "nights"} left`),
  },
  no_hrv_last_night: { short: "No HRV last night", long: () => "No HRV last night (needs about 3 h of sleep)" },
  awaiting_sleep_sync: { short: "Waiting for sleep", long: () => "Waiting for last night’s sleep to sync" },
  insufficient_hr_data: { short: "Not enough data", long: () => "Not enough heart-rate data" },
  band_not_worn: { short: "Not worn", long: () => "No data: band not worn" },
  no_data: { short: "--", long: () => "No data" },
};

/** Any unknown or missing code falls back to `no_data`. */
export function normalizeReason(code: string | null | undefined): ReasonCode {
  return (REASON_CODES as readonly string[]).includes(code ?? "") ? (code as ReasonCode) : "no_data";
}

export function reasonCopy(code: string | null | undefined, nightsLeft?: number) {
  const key = normalizeReason(code);
  // A re-import clears each day before writing it back, so while one runs every value is missing at once. Saying the
  // night has not synced would blame the band for Halo's own housekeeping, and reads as lost data. Calibrating is
  // about nights of baseline, which a re-import does not change, so it still speaks for itself.
  if (key !== "calibrating" && isRebuilding()) return { code: key, short: REBUILDING_COPY.short, long: REBUILDING_COPY.long };
  const r = REASONS[key];
  return { code: key, short: r.short, long: r.long(nightsLeft) };
}

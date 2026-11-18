// The wear streak (the web's getWearStreak, spec §4.3) and its page `/streak`: the run of days the band was worn, up to
// today. One set of rules for both, so the count on Today's capsule and the page it opens always agree.
//
// A day is worn when it has any heart rate. Today neither counts nor breaks the streak until it has six hours of it
// (STREAK_TODAY_MIN), or while it has not been scored yet: at 07:00 the night is on the band and the day has barely
// begun, and a streak that read 0 every morning would be wrong. Any other day without a reading ends the run.
import { addDays, daysBetween } from "@/lib/time";
import type { WearDay } from "@/data/store";
import type { QueryCtx } from "./ctx";

/** Today counts toward the streak once it has this many minutes of heart rate; until then the streak ends yesterday. */
export const STREAK_TODAY_MIN = 6 * 60;

/** Lengths worth marking. The next one up is what the page counts toward. */
export const MILESTONES = [7, 14, 30, 50, 100, 150, 200, 250, 300, 365, 500, 730, 1000, 1500, 2000] as const;

/** How far back the page reads when the history has no first day: two years. */
const HISTORY_DAYS = 730;

export type DayWear = "worn" | "missed" | "pending";

export type Run = { days: number; from: string; to: string };

export type StreakVM = {
  today: string;
  /** The first day with data: the calendar starts here. */
  firstDay: string;
  /** Each day from firstDay to today. "pending": today, not yet counted or broken. */
  wear: Record<string, DayWear>;
  /** The run up to today (or to yesterday while today is pending); null when there is none. */
  current: Run | null;
  /** The longest run on record; the current one when it is the longest. */
  longest: Run | null;
  /** Worn days in the last 30 and 365 days, and in all, each against the days there were (today only once it counts). */
  last30: { worn: number; of: number };
  last365: { worn: number; of: number };
  total: { worn: number; of: number };
  /** Today is not counted yet: the count runs to yesterday. */
  todayPending: boolean;
  /** The milestone being counted toward; null past the last one. */
  next: number | null;
  /** Milestones the current run has passed, each with the day it reached it. */
  reached: { days: number; on: string }[];
};

/** A day's state from its scores. `isToday` gets the grace described above. */
export function dayWear(w: WearDay | undefined, isToday: boolean): DayWear {
  if (isToday && (!w || w.hrMinutes < STREAK_TODAY_MIN)) return "pending";
  return w && w.hrCount > 0 ? "worn" : "missed";
}

/** Everything the page shows, from the days' wear. Pure, so the rules are tested in one place. */
export function streakOf(days: readonly WearDay[], today: string, firstDay?: string | null): StreakVM {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const first = firstDay && firstDay <= today ? firstDay : (days[0]?.day ?? today);
  const wear: Record<string, DayWear> = {};
  for (let d = first; d <= today; d = addDays(d, 1)) wear[d] = dayWear(byDay.get(d), d === today);
  const todayPending = wear[today] === "pending";

  // Runs of worn days, oldest first; a pending today neither extends nor ends the last one.
  const runs: Run[] = [];
  let open: Run | null = null;
  for (let d = first; d <= today; d = addDays(d, 1)) {
    const s = wear[d];
    if (s === "worn") {
      if (open) {
        open.days++;
        open.to = d;
      } else open = { days: 1, from: d, to: d };
    } else if (s === "missed") {
      if (open) runs.push(open);
      open = null;
    }
  }
  if (open) runs.push(open);
  const lastCounted = todayPending ? addDays(today, -1) : today;
  const tail = runs[runs.length - 1];
  const current = tail && tail.to === lastCounted ? tail : null;
  const longest = runs.reduce<Run | null>((a, r) => (!a || r.days > a.days ? r : a), null);

  const count = (from: string) => {
    let worn = 0;
    let of = 0;
    for (let d = from < first ? first : from; d <= today; d = addDays(d, 1)) {
      if (wear[d] === "pending") continue;
      of++;
      if (wear[d] === "worn") worn++;
    }
    return { worn, of };
  };

  const days0 = current?.days ?? 0;
  return {
    today,
    firstDay: first,
    wear,
    current,
    longest,
    last30: count(addDays(today, -29)),
    last365: count(addDays(today, -364)),
    total: count(first),
    todayPending,
    next: MILESTONES.find((m) => m > days0) ?? null,
    reached: current ? MILESTONES.filter((m) => m <= days0).map((m) => ({ days: m, on: addDays(current.from, m - 1) })) : [],
  };
}

/** The streak page `/streak`. */
export async function getStreak(ctx: QueryCtx): Promise<StreakVM> {
  const from = ctx.sync.firstDay ?? addDays(ctx.today, -HISTORY_DAYS);
  // Older than two years is not drawn, and a run that long is counted from there.
  const start = daysBetween(from, ctx.today) > HISTORY_DAYS ? addDays(ctx.today, -HISTORY_DAYS) : from;
  const days = await ctx.store.wearDaysIn({ from: start, to: ctx.today });
  return streakOf(days, ctx.today, start);
}

/** The count on Today's capsule: the current run, null when there is none. */
export async function wearStreak(ctx: QueryCtx): Promise<{ days: number; asOf: string } | null> {
  const from = ctx.sync.firstDay ?? addDays(ctx.today, -365);
  const days = await ctx.store.wearDaysIn({ from, to: ctx.today });
  const s = streakOf(days, ctx.today, from);
  return s.current ? { days: s.current.days, asOf: s.current.to } : null;
}

// The greeting that heads Today: the part of the day in the person's own time zone, and their first name when set.
import { localMinutes } from "./time";

export type DayPart = "morning" | "afternoon" | "evening" | "night";

/** 05:00–11:59 morning, 12:00–16:59 afternoon, 17:00–21:59 evening, otherwise night. */
export function dayPart(nowS: number, tz: string): DayPart {
  const h = Math.floor(localMinutes(nowS, tz) / 60);
  return h >= 5 && h < 12 ? "morning" : h >= 12 && h < 17 ? "afternoon" : h >= 17 && h < 22 ? "evening" : "night";
}

/** "Good morning, Ian", or "Good morning" without a name. Late at night it's "Good evening": "good night" is a goodbye. */
export function greeting(nowS: number, tz: string, firstName: string | null): string {
  const part = dayPart(nowS, tz);
  const words = `Good ${part === "night" ? "evening" : part}`;
  return firstName ? `${words}, ${firstName}` : words;
}

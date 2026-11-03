// Today's "daily outlook" (morning) and "day in review" (evening): a verdict with its main reason, then one thing to do.
// Pure, so the wording is tested; home.ts gathers the inputs from the stored day.
import type { ChargeDriver } from "@/core/scoring/drivers";
import { recoveryBand } from "@/lib/bands";

export type OutlookInput = {
  review: boolean;
  isToday: boolean;
  recovery: number | null;
  drivers: ChargeDriver[];
  asleepMin: number | null;
  needMin: number | null;
  strain: number | null;
  target: [number, number] | null;
  /** The day's workouts and activities, longest first. */
  activities: { name: string; minutes: number }[];
  stress: { lowMin: number; mediumMin: number; highMin: number; longestHigh: { at: string; minutes: number } | null } | null;
  /** Tonight's "Perform" bedtime, "22:40". */
  bedtime: string | null;
};

const f1 = (x: number) => x.toFixed(1);
const range = (t: [number, number]) => `${f1(t[0])} to ${f1(t[1])}`;

/** "1 h 10 min", "45 min". */
export function minutesText(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  return h ? (m % 60 ? `${h} h ${m % 60} min` : `${h} h`) : `${m} min`;
}

const PHRASE: Record<ChargeDriver["label"], [good: string, bad: string]> = {
  HEART_RATE_VARIABILITY: ["your HRV is above your normal", "your HRV is below your normal"],
  RESTING_HEART_RATE: ["your resting heart rate is lower than usual", "your resting heart rate is higher than usual"],
  RESPIRATORY_RATE: ["your breathing rate is steady", "your breathing rate is up"],
  SLEEP_QUALITY: ["you slept well", "your sleep fell short"],
  SKIN_TEMPERATURE: ["your skin temperature is normal", "your skin temperature is off your normal"],
};

/** The driver that moved Recovery most in the direction of the verdict, as a phrase; null when nothing stands out. */
function mainReason(drivers: ChargeDriver[], good: boolean): string | null {
  const pick = drivers.filter((d) => (good ? d.deltaPoints > 0 : d.deltaPoints < 0)).sort((a, b) => Math.abs(b.deltaPoints) - Math.abs(a.deltaPoints))[0];
  return pick && Math.abs(pick.deltaPoints) >= 3 ? PHRASE[pick.label][good ? 0 : 1] : null;
}

function morning(i: OutlookInput): string[] {
  const out: string[] = [];
  if (i.recovery != null) {
    const band = recoveryBand(i.recovery);
    const why = mainReason(i.drivers, band !== "red");
    const lead = band === "green" ? "You’re well recovered" : band === "yellow" ? "You’re about at your usual level" : "Your body is still recovering";
    out.push(`${lead} (${Math.round(i.recovery)}%)${why ? `: ${why}` : ""}.`);
  }
  if (i.asleepMin != null && i.needMin) {
    const short = i.needMin - i.asleepMin;
    out.push(short >= 30 ? `You slept ${minutesText(i.asleepMin)}, ${minutesText(short)} less than you needed.` : `You got the ${minutesText(i.asleepMin)} of sleep you needed.`);
  }
  if (i.recovery != null && i.target) {
    const band = recoveryBand(i.recovery);
    if (band === "green") out.push(`A good day for a harder session: aim for a Strain of ${range(i.target)}.`);
    else if (band === "yellow") out.push(`Moderate effort suits today, a Strain of ${range(i.target)}.`);
    else out.push(`Keep it light, under a Strain of ${f1(i.target[1])}${i.bedtime ? `, and be asleep by ${i.bedtime}` : ""}.`);
  }
  return out;
}

function evening(i: OutlookInput): string[] {
  const out: string[] = [];
  if (i.strain != null) {
    const top = i.activities[0];
    const act = top ? `, including ${top.name.toLowerCase()} (${minutesText(top.minutes)})` : "";
    if (!i.target) out.push(`Your Strain ${i.isToday ? "is" : "was"} ${f1(i.strain)}${act}.`);
    else if (i.strain > i.target[1]) out.push(`You pushed past your target: Strain ${f1(i.strain)} against ${range(i.target)}${act}.`);
    else if (i.strain >= i.target[0]) out.push(`You landed in your target: Strain ${f1(i.strain)} of ${range(i.target)}${act}.`);
    else out.push(`A lighter day: Strain ${f1(i.strain)}, under your ${range(i.target)} target${act}.`);
  }
  const s = i.stress;
  if (s && s.lowMin + s.mediumMin + s.highMin >= 30) {
    const total = s.lowMin + s.mediumMin + s.highMin;
    const mood = s.highMin / total >= 0.25 ? "stressful" : s.lowMin / total >= 0.6 ? "mostly calm" : "a mix of calm and busy";
    const peak = s.longestHigh && s.longestHigh.minutes >= 15 ? ` Your most stressful stretch was ${minutesText(s.longestHigh.minutes)} around ${s.longestHigh.at}.` : "";
    out.push(`While you were still, the day ${i.isToday ? "has been" : "was"} ${mood}: ${minutesText(s.lowMin)} calm, ${minutesText(s.mediumMin)} focused, ${minutesText(s.highMin)} stressed.${peak}`);
  }
  if (i.isToday && i.bedtime) out.push(`To recover for tomorrow, aim to be asleep by ${i.bedtime}.`);
  return out;
}

/** The banner's title and body, or null with nothing to say. */
export function outlookText(i: OutlookInput): { kind: "outlook" | "review"; title: string; body: string } | null {
  const parts = i.review ? evening(i) : morning(i);
  if (!parts.length) return null;
  return { kind: i.review ? "review" : "outlook", title: i.review ? "Your day in review" : "Your daily outlook", body: parts.join(" ") };
}

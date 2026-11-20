// "Log anything": a sentence the way you'd say it ("2 beers and a headache last night", "took L-Theanine + Mg at
// 9:55") read into the entries Halo already keeps: water, medicines, weight, blood oxygen, symptoms, mood and the
// journal's behaviours. Done on the phone by rules, so it works offline and says only what it found; what it can't
// place comes back as `unknown` (the Coach may read those, src/coach/logAnything.ts) and food as `food` (Halo's food
// estimate takes it from there). Workouts come from the band, so a "30 min run" is noted, not logged. Pure.
import { addDays, wall } from "@/lib/time";
import type { Mood, Severity, Symptom } from "@/queries/log";

export type ParseCtx = {
  /** Unix seconds and the person's zone: times without a day are the latest that isn't in the future. */
  now: number;
  timeZone: string;
  /** Medicines by name (Settings › Medicines and the ones logged before), with their usual dose. */
  medicines: readonly { name: string; dose?: string }[];
  /** The journal's behaviours (tag key and label). */
  tags: readonly { tag: string; label: string }[];
  /** How weight is typed when no unit is given. */
  weightUnit: "kg" | "lb";
};

/** When: a local wall time "YYYY-MM-DDTHH:mm" (what the log's actions take). */
type At = { at: string };
export type Parsed =
  | ({ kind: "water"; ml: number } & At)
  | ({ kind: "medicine"; name: string; dose?: string } & At)
  | ({ kind: "weight"; kg: number } & At)
  | ({ kind: "spo2"; pct: number } & At)
  | ({ kind: "symptoms"; symptoms: Symptom[]; headache?: Severity } & At)
  | ({ kind: "mood"; moods: Mood[] } & At)
  /** A journal answer for `day`: yes, or a count (alcohol). */
  | { kind: "behaviour"; tag: string; label: string; value: number; day: string }
  | ({ kind: "food"; text: string } & At)
  | { kind: "workout"; text: string }
  | { kind: "unknown"; text: string };

const KG_PER_LB = 0.45359237;

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, single: 1, two: 2, couple: 2, pair: 2, three: 3, few: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

const SYMPTOM_WORDS: [RegExp, Symptom][] = [
  [/\b(headache|head ache|migraine)\b/, "HEADACHE"],
  [/\b(fatigue|fatigued|exhausted|wiped out)\b/, "FATIGUE"],
  [/\b(nausea|nauseous|queasy)\b/, "NAUSEA"],
  [/\b(dizzy|dizziness|lightheaded|light-headed)\b/, "DIZZINESS"],
  [/\b(cough|coughing)\b/, "COUGH"],
  [/\b(fever|feverish)\b/, "FEVER"],
  [/\b(sick|unwell|ill)\b/, "SICK"],
  [/\b(brain fog|foggy)\b/, "BRAIN_FOG"],
  [/\b(back pain|sore back|back hurts)\b/, "BACK_PAIN"],
  [/\b(joint pain|sore joints|joints hurt)\b/, "JOINT_PAIN"],
  [/\b(insomnia|couldn'?t sleep|could not sleep)\b/, "INSOMNIA"],
  [/\b(heartburn|reflux)\b/, "HEARTBURN"],
  [/\b(bloated|bloating)\b/, "BLOATED"],
  [/\b(diarrh(o)?ea)\b/, "DIARRHEA"],
  [/\b(constipated|constipation)\b/, "CONSTIPATION"],
  [/\b(cramps|cramping)\b/, "CRAMPS"],
];

const MOOD_WORDS: [RegExp, Mood][] = [
  [/\bhappy\b/, "HAPPY"],
  [/\bcalm\b/, "CALM"],
  [/\b(energi[sz]ed|energetic)\b/, "ENERGIZED"],
  [/\bcontent\b/, "CONTENT"],
  [/\bgrateful\b/, "GRATEFUL"],
  [/\bexcited\b/, "EXCITED"],
  [/\b(tired|sleepy|drained)\b/, "FATIGUED"],
  [/\bstressed\b/, "STRESSED"],
  [/\b(anxious|nervous)\b/, "ANXIOUS"],
  [/\b(irritated|annoyed|grumpy)\b/, "IRRITATED"],
  [/\b(sad|low|blue)\b/, "SAD"],
  [/\boverwhelmed\b/, "OVERWHELMED"],
  [/\blonely\b/, "LONELY"],
];

/** Words for the default behaviours beyond their labels. */
const TAG_WORDS: Record<string, RegExp> = {
  meditation: /\b(meditat(e|ed|ion|ing))\b/,
  stretching: /\b(stretch(ed|es|ing)?|yoga)\b/,
  sauna: /\bsauna\b/,
  late_meal: /\b(late (meal|dinner|snack)|ate late)\b/,
  screen_in_bed: /\b(screens?|phone|ipad|tablet|laptop) in bed\b/,
  travel: /\b(travel(l?ed|l?ing)?|flew|flight)\b/,
  illness: /\b(illness|got sick|came down with)\b/,
};

const ALCOHOL = /\b(beers?|pints?|wines?|glass(es)? of wine|cocktails?|drinks?|shots?|whiske?y|vodka|gin|tequila|rum|ciders?|seltzers?|alcohol)\b/;
const CAFFEINE = /\b(coffees?|espresso(s)?|lattes?|cappuccinos?|americanos?|caffeine|energy drinks?|red bull|tea)\b/;
const WATER = /\b(water|waters)\b/;
const WORKOUT = /\b(run|ran|running|jog(ged|ging)?|walk(ed|ing)?|hike(d)?|hiking|ride|rode|cycl(ed|ing)|bike(d)?|biking|swim(ming)?|swam|gym|lift(ed|ing)?|weights|workout|worked out|training|trained|row(ed|ing)?|climb(ed|ing)?)\b/;
const FOOD = /\b(ate|eat|eating|breakfast|lunch|dinner|snack|meal|sandwich|burger|pizza|salad|pasta|rice|chicken|steak|fish|eggs?|toast|oatmeal|cereal|fruit|apple|banana|yogh?urt|soup|tacos?|sushi|fries)\b/;
/** Late caffeine is a behaviour from this hour. */
const LATE_CAFFEINE_FROM = 14 * 60;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pad = (n: number) => String(n).padStart(2, "0");

/** The clause's count: a digit, a number word, or 1. */
function countIn(s: string): number {
  const d = /\b(\d{1,2})\s*(x\b|×)?/.exec(s);
  if (d) return Number(d[1]);
  // "a couple", "a few": the number word before the article.
  const words = Object.entries(NUMBER_WORDS).sort(([a], [b]) => Number(a.length <= 2) - Number(b.length <= 2));
  for (const [w, n] of words) if (new RegExp(`\\b${w}\\b`).test(s)) return n;
  return 1;
}

type When = { day: string; min: number | null };

/** The day and clock a clause names, if any: "at 9:55", "21:55", "9pm", "this morning", "last night", "yesterday". */
function whenIn(s: string, now: { day: string; min: number }): { when: When | null; rest: string } {
  let rest = s;
  let day: string | null = null;
  let min: number | null = null;
  const take = (re: RegExp) => {
    const m = re.exec(rest);
    if (m) rest = (rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length)).trim();
    return m;
  };
  if (take(/\blast night\b/)) {
    day = addDays(now.day, -1);
    min = 22 * 60;
  } else if (take(/\byesterday\b/)) day = addDays(now.day, -1);
  else take(/\btoday\b/);
  // A part of the day: it sets the hour's half for a clock without am/pm, and a time of its own without one.
  const part = take(/\b(this morning|in the morning|morning|this afternoon|in the afternoon|afternoon|this evening|in the evening|evening|tonight|at lunch|at noon|at midnight)\b/)?.[1] ?? null;
  const half = part ? (/morning/.test(part) ? "am" : /afternoon|evening|tonight/.test(part) ? "pm" : null) : null;
  const clock = take(/\b(?:at|around|@)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?![a-z])/) ?? take(/\b(?:at|around|@)\s*(\d{1,2})(?::(\d{2}))?\b/) ?? take(/\b(\d{1,2}):(\d{2})\b/);
  // "this morning", "tonight": today, never later than now.
  const thisPart = !!part && !day && !/^(in the |morning$|afternoon$|evening$)/.test(part);
  if (clock) {
    let h = Number(clock[1]);
    const m = Number(clock[2] ?? 0);
    const ap = clock[3] ?? half;
    if (h <= 24 && m < 60) {
      if (ap === "pm" && h < 12) h += 12;
      if (ap === "am" && h === 12) h = 0;
      if (!ap && h <= 12) {
        // No am/pm: the latest of h and h + 12 that isn't in the future (a few minutes' slack).
        const later = (h % 12) + 12;
        const earlier = h % 12;
        if ((day ?? now.day) !== now.day) h = later;
        else h = later * 60 + m <= now.min + 5 ? later : earlier * 60 + m <= now.min + 5 ? earlier : later;
      }
      min = (h % 24) * 60 + m;
    }
  } else if (part && min == null) {
    min = /morning/.test(part) ? 8 * 60 : /afternoon/.test(part) ? 15 * 60 : /lunch|noon/.test(part) ? 12 * 60 + 30 : /midnight/.test(part) ? 0 : 20 * 60;
    if (thisPart) min = Math.min(min, now.min);
  }
  if (day == null && min == null) return { when: null, rest };
  // A clock later than now without a day was yesterday's; "this …" stays today.
  const d = day ?? (min != null && min > now.min + 5 && !thisPart ? addDays(now.day, -1) : now.day);
  return { when: { day: d, min }, rest };
}

/**
 * Reads `text` into entries, in the order they were said. A medicine is found by its name anywhere (names may hold
 * "+" or "and"); the rest is split into clauses at commas, "and", "then", "plus".
 */
export function parseLog(text: string, ctx: ParseCtx): Parsed[] {
  const w = wall(ctx.now, ctx.timeZone);
  const now = { day: w.day, min: Number(w.time.slice(0, 2)) * 60 + Number(w.time.slice(3, 5)) };
  let s = ` ${text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\b([ap])\.m\.?/g, "$1m")
    .replace(/\s+/g, " ")} `;
  // Medicine names first, longest first, swapped for markers so their own "+" or "and" doesn't split them.
  const meds = [...ctx.medicines].filter((m) => m.name.trim()).sort((a, b) => b.name.length - a.name.length);
  meds.forEach((m, i) => {
    s = s.replace(new RegExp(`(^|[^a-z0-9])${escapeRe(m.name.toLowerCase())}(?![a-z0-9])`, "g"), `$1 §${i}§ `);
  });
  // A sentence-wide time ("… at 9:55") applies to every clause that names none.
  const clauses = s
    .split(/,|;|\.\s|\band then\b|\bthen\b|\balso\b|\bplus\b|\band\b|&|\+/)
    .map((c) => c.trim())
    .filter(Boolean);
  const read = clauses.map((c) => whenIn(c, now));
  const shared = read.filter((r) => r.when).length === 1 ? read.find((r) => r.when)!.when : null;
  const out: Parsed[] = [];
  read.forEach(({ when, rest }) => {
    const at = when ?? shared;
    const day = at?.day ?? now.day;
    const minute = at?.min ?? (day === now.day ? now.min : 12 * 60);
    const stamp = `${day}T${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
    const c = rest.replace(/\b(i|i've|ive|had|have|took|take|taken|drank|drink|drinking|feel|feeling|felt|got|did|some|my|of|the|just|was|am|a bit|kind of|pretty|very|really)\b/g, " ").replace(/\s+/g, " ").trim();
    if (!c) return;
    const found = parseClause(c, rest, ctx, meds, { at: stamp, day, minute });
    out.push(...found);
  });
  return merge(out);
}

function parseClause(c: string, raw: string, ctx: ParseCtx, meds: readonly { name: string; dose?: string }[], when: { at: string; day: string; minute: number }): Parsed[] {
  const out: Parsed[] = [];
  let left = c;
  const used = (re: RegExp) => {
    left = left.replace(re, " ").replace(/\s+/g, " ").trim();
  };
  // Medicines (markers).
  for (const m of c.matchAll(/§(\d+)§/g)) {
    const med = meds[Number(m[1])];
    const dose = /\b(\d+(?:\.\d+)?\s?(?:mg|mcg|µg|g|ml|iu|tablets?|pills?|capsules?))\b/.exec(c)?.[1];
    out.push({ kind: "medicine", name: med.name, ...(dose ? { dose } : med.dose ? { dose: med.dose } : {}), at: when.at });
    used(/§\d+§/g);
    if (dose) used(new RegExp(escapeRe(dose)));
  }
  if (out.length) return leftovers(out, left);

  // Weight: "weighed 178.6 lb", "weight 81 kg".
  const wt = /\b(?:weigh(?:ed|s|ing)?|weight)\b[^\d]*(\d{2,3}(?:\.\d)?)\s*(kg|kgs|kilos?|lbs?|pounds?)?\b/.exec(c) ?? /\b(\d{2,3}(?:\.\d)?)\s*(kg|kgs|kilos?|lbs?|pounds?)\b/.exec(c);
  if (wt) {
    const v = Number(wt[1]);
    const lb = wt[2] ? /^(lb|lbs|pound|pounds)$/.test(wt[2]) : ctx.weightUnit === "lb";
    const kg = Math.round((lb ? v * KG_PER_LB : v) * 10) / 10;
    if (kg >= 25 && kg <= 300) return [{ kind: "weight", kg, at: when.at }];
  }
  // Blood oxygen: "spo2 96", "oxygen 97%".
  const ox = /\b(?:spo2|sp02|oxygen|o2|blood oxygen)\b[^\d]*(\d{2,3})\s*%?/.exec(c);
  if (ox && Number(ox[1]) >= 70 && Number(ox[1]) <= 100) return [{ kind: "spo2", pct: Number(ox[1]), at: when.at }];

  // Water: "500 ml", "1.5 l", "2 glasses", "a bottle", "16 oz".
  if (WATER.test(c) || /\b\d+(\.\d+)?\s*(ml|l|litres?|liters?|fl ?oz|oz)\b/.test(c)) {
    const ml = /\b(\d+(?:\.\d+)?)\s*ml\b/.exec(c);
    const l = /\b(\d+(?:\.\d+)?)\s*(l|litres?|liters?)\b/.exec(c);
    const oz = /\b(\d+(?:\.\d+)?)\s*(fl ?oz|oz|ounces?)\b/.exec(c);
    const vessel = /\b(glass(es)?|cups?|bottles?)\b/.exec(c);
    const amount = ml ? Number(ml[1]) : l ? Number(l[1]) * 1000 : oz ? Number(oz[1]) * 29.5735 : countIn(c) * (vessel && /bottle/.test(vessel[1]) ? 500 : 250);
    // An amount of coffee, a drink or food isn't water.
    if (WATER.test(c) || !(ALCOHOL.test(c) || CAFFEINE.test(c) || FOOD.test(c))) {
      if (amount >= 30 && amount <= 5000) return [{ kind: "water", ml: Math.round(amount), at: when.at }];
    }
  }
  // Alcohol: a count of drinks.
  if (ALCOHOL.test(c)) {
    const tag = ctx.tags.find((t) => t.tag === "alcohol");
    if (tag) {
      out.push({ kind: "behaviour", tag: tag.tag, label: tag.label, value: Math.min(30, countIn(c)), day: when.day });
      used(ALCOHOL);
      used(/\b\d{1,2}\b/);
    }
  }
  // Caffeine late in the day is a behaviour; earlier it's left to a behaviour of your own.
  if (CAFFEINE.test(c) && when.minute >= LATE_CAFFEINE_FROM) {
    const tag = ctx.tags.find((t) => t.tag === "late_caffeine");
    if (tag) {
      out.push({ kind: "behaviour", tag: tag.tag, label: tag.label, value: 1, day: when.day });
      used(CAFFEINE);
      used(/\b\d{1,2}\b/);
    }
  }
  // Symptoms, a headache's severity with it.
  const symptoms = SYMPTOM_WORDS.filter(([re]) => re.test(c)).map(([, s]) => s);
  if (symptoms.length) {
    const headache: Severity | undefined = symptoms.includes("HEADACHE")
      ? /\b(severe|terrible|awful|bad|splitting|migraine)\b/.test(c)
        ? /\b(severe|terrible|awful|splitting|migraine)\b/.test(c)
          ? "SEVERE"
          : "MODERATE"
        : /\b(moderate)\b/.test(c)
          ? "MODERATE"
          : "MILD"
      : undefined;
    out.push({ kind: "symptoms", symptoms: [...new Set(symptoms)], ...(headache ? { headache } : {}), at: when.at });
    SYMPTOM_WORDS.forEach(([re]) => used(re));
    used(/\b(severe|terrible|awful|bad|splitting|mild|moderate|slight|light)\b/);
  }
  // Mood.
  const moods = MOOD_WORDS.filter(([re]) => re.test(left)).map(([, m]) => m);
  if (moods.length) {
    out.push({ kind: "mood", moods: [...new Set(moods)], at: when.at });
    MOOD_WORDS.forEach(([re]) => used(re));
  }
  // Behaviours by their own names, then the defaults' other words.
  for (const t of ctx.tags) {
    if (t.tag === "alcohol" || t.tag === "late_caffeine") continue;
    const own = new RegExp(`\\b${escapeRe(t.label.toLowerCase())}\\b`);
    const extra = TAG_WORDS[t.tag];
    if (own.test(left) || (extra && extra.test(left))) {
      out.push({ kind: "behaviour", tag: t.tag, label: t.label, value: 1, day: when.day });
      used(own);
      if (extra) used(extra);
    }
  }
  if (out.length) return leftovers(out, left);
  // Workouts come from the band; food goes to the food estimate.
  if (WORKOUT.test(c)) return [{ kind: "workout", text: raw.trim() }];
  if (FOOD.test(c)) return [{ kind: "food", text: raw.replace(/^(i |had |ate |for )+/, "").trim(), at: when.at }];
  return [{ kind: "unknown", text: raw.trim() }];
}

/** Words left over after a clause's entries, if they look like more than filler. */
function leftovers(out: Parsed[], left: string): Parsed[] {
  const words = left.replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((x) => x.length > 2 && !/^(and|with|for|too|also|day|today|night|some|bit|lot|much|after|before|about|around|drinks?|cups?|glass(es)?|times?|mg)$/.test(x));
  return words.length ? [...out, { kind: "unknown", text: words.join(" ") }] : out;
}

/** One answer per behaviour and day (a count adds up), one symptoms and one mood entry per time. */
function merge(xs: Parsed[]): Parsed[] {
  const out: Parsed[] = [];
  for (const x of xs) {
    if (x.kind === "behaviour") {
      const had = out.find((o): o is Extract<Parsed, { kind: "behaviour" }> => o.kind === "behaviour" && o.tag === x.tag && o.day === x.day);
      if (had) {
        if (x.tag === "alcohol") had.value = Math.min(30, had.value + x.value);
        continue;
      }
    }
    if (x.kind === "symptoms") {
      const had = out.find((o): o is Extract<Parsed, { kind: "symptoms" }> => o.kind === "symptoms" && o.at === x.at);
      if (had) {
        had.symptoms = [...new Set([...had.symptoms, ...x.symptoms])];
        if (x.headache) had.headache = x.headache;
        continue;
      }
    }
    if (x.kind === "mood") {
      const had = out.find((o): o is Extract<Parsed, { kind: "mood" }> => o.kind === "mood" && o.at === x.at);
      if (had) {
        had.moods = [...new Set([...had.moods, ...x.moods])];
        continue;
      }
    }
    out.push({ ...x });
  }
  return out;
}

// The Coach's reading of what the rules left (src/coach/logAnything.ts), checked here.

const SYMPTOM_SET = new Set<string>(SYMPTOM_WORDS.map(([, s]) => s));
const MOOD_SET = new Set<string>(MOOD_WORDS.map(([, m]) => m));
const AT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The entries in a model's JSON answer that Halo can keep: known medicines and behaviours only, values in range, times
 * not in the future and within a week. Anything else is dropped.
 */
export function checkParsed(raw: string, ctx: ParseCtx): Parsed[] {
  const end = raw.lastIndexOf("]");
  let arr: unknown = null;
  for (let i = raw.indexOf("["); i >= 0 && i < end; i = raw.indexOf("[", i + 1)) {
    try {
      arr = JSON.parse(raw.slice(i, end + 1));
      if (Array.isArray(arr)) break;
    } catch {}
  }
  if (!Array.isArray(arr)) return [];
  const w = wall(ctx.now, ctx.timeZone);
  const nowAt = `${w.day}T${w.time.slice(0, 5)}`;
  const weekAgo = addDays(w.day, -7);
  const okAt = (v: unknown): v is string => typeof v === "string" && AT_RE.test(v) && v <= nowAt && v.slice(0, 10) >= weekAgo;
  const okDay = (v: unknown): v is string => typeof v === "string" && DAY_RE.test(v) && v <= w.day && v >= weekAgo;
  const out: Parsed[] = [];
  for (const x of arr as Record<string, unknown>[]) {
    if (!x || typeof x !== "object") continue;
    const at = okAt(x.at) ? x.at : nowAt;
    switch (x.kind) {
      case "water":
        if (typeof x.ml === "number" && x.ml >= 30 && x.ml <= 5000) out.push({ kind: "water", ml: Math.round(x.ml), at });
        break;
      case "medicine": {
        const med = ctx.medicines.find((m) => typeof x.name === "string" && m.name.toLowerCase() === x.name.toLowerCase());
        if (med) out.push({ kind: "medicine", name: med.name, ...(typeof x.dose === "string" && x.dose.length <= 40 ? { dose: x.dose } : med.dose ? { dose: med.dose } : {}), at });
        break;
      }
      case "symptoms": {
        const s = Array.isArray(x.symptoms) ? (x.symptoms.filter((v) => typeof v === "string" && SYMPTOM_SET.has(v)) as Symptom[]) : [];
        const h = x.headache === "MILD" || x.headache === "MODERATE" || x.headache === "SEVERE" ? (x.headache as Severity) : undefined;
        if (s.length) out.push({ kind: "symptoms", symptoms: s, ...(h && s.includes("HEADACHE") ? { headache: h } : {}), at });
        break;
      }
      case "mood": {
        const m = Array.isArray(x.moods) ? (x.moods.filter((v) => typeof v === "string" && MOOD_SET.has(v)) as Mood[]) : [];
        if (m.length) out.push({ kind: "mood", moods: m, at });
        break;
      }
      case "behaviour": {
        const t = ctx.tags.find((t) => t.tag === x.tag);
        const v = typeof x.value === "number" && Number.isInteger(x.value) && x.value >= 1 && x.value <= 30 ? x.value : 1;
        if (t) out.push({ kind: "behaviour", tag: t.tag, label: t.label, value: t.tag === "alcohol" ? v : 1, day: okDay(x.day) ? x.day : w.day });
        break;
      }
      case "food":
        if (typeof x.text === "string" && x.text.trim() && x.text.length <= 200) out.push({ kind: "food", text: x.text.trim(), at });
        break;
    }
  }
  return merge(out);
}

/** The lists the Coach may choose from, for its prompt. */
export const PARSE_VOCAB = { symptoms: [...SYMPTOM_SET], moods: [...MOOD_SET] };

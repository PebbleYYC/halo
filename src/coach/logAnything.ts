// "Log anything", the Coach's part: what the phone's rules (src/lib/logParse.ts) couldn't place, read by the person's
// own model into the same entries, then checked by checkParsed (known medicines and behaviours only). Only the
// leftover words are sent, with the lists to choose from; nothing is saved until the person adds it. Never throws.
import { generateText } from "ai";
import { checkParsed, PARSE_VOCAB, type ParseCtx, type Parsed } from "@/lib/logParse";
import { wall } from "@/lib/time";
import { deviceFetch } from "./net";
import { modelFor } from "./providers";
import { apiKey, coachSetup } from "./storage";

const INSTRUCTIONS = [
  "You turn what a person says they did into health log entries for the Halo app.",
  'Reply with JSON only: an array of entries, each one of {"kind":"water","ml":n,"at":"YYYY-MM-DDTHH:mm"}, {"kind":"medicine","name":"<exact name from the list>","dose"?:"…","at":…}, {"kind":"symptoms","symptoms":[…],"headache"?:"MILD"|"MODERATE"|"SEVERE","at":…}, {"kind":"mood","moods":[…],"at":…}, {"kind":"behaviour","tag":"<tag from the list>","value":1 (or a drink count for alcohol),"day":"YYYY-MM-DD"}, {"kind":"food","text":"<what was eaten>","at":…}.',
  "Use only medicines, behaviours, symptoms and moods from the lists. Skip anything that fits none of them (workouts come from the person's band). Never invent amounts the person didn't say. Reply [] if nothing fits.",
].join(" ");

export async function coachParse(text: string, ctx: ParseCtx): Promise<Parsed[]> {
  try {
    const s = await coachSetup();
    const key = s.consent && s.provider && s.model ? await apiKey() : null;
    const model = key && s.provider && s.model ? modelFor(s.provider, s.model, key, deviceFetch) : null;
    if (!model) return [];
    const w = wall(ctx.now, ctx.timeZone);
    const prompt = [
      `Now: ${w.day}T${w.time.slice(0, 5)}`,
      `Medicines: ${JSON.stringify(ctx.medicines.map((m) => m.name))}`,
      `Behaviours: ${JSON.stringify(ctx.tags.map((t) => ({ tag: t.tag, label: t.label })))}`,
      `Symptoms: ${JSON.stringify(PARSE_VOCAB.symptoms)}`,
      `Moods: ${JSON.stringify(PARSE_VOCAB.moods)}`,
      `They said: ${JSON.stringify(text.slice(0, 400))}`,
    ].join("\n");
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20_000);
    try {
      const r = await generateText({ model, instructions: INSTRUCTIONS, prompt, maxOutputTokens: 1500, maxRetries: 0, abortSignal: ctl.signal });
      return checkParsed(r.text, ctx);
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    console.warn("[log-anything]", e instanceof Error ? e.name : "error");
    return [];
  }
}

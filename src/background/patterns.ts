// After a scoring run, when the Coach is set up: the day's patterns (src/queries/patterns.ts) found, put in the Coach's
// words ahead of the next Home open (src/coach/patterns.ts), and, with Settings › Notifications' "Patterns" on, a new
// one sent as a notification: at most one a week, in the day (09:00–20:00), never one already sent or dismissed.
// Never throws.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { coachReady, dismissedPatterns, patternWords } from "@/coach/patterns";
import type { Store } from "@/data/store";
import type { Profile } from "@/data/types";
import { localDay, localMinutes } from "@/lib/time";
import type { QueryCtx } from "@/queries/ctx";
import { getPatterns } from "@/queries/patterns";
import { patternDue, type Sent } from "./patternDue";
import { isOwnData } from "./decide";
import { readSource } from "./alerts";
import { notificationPermission, sendNow } from "./notify";
import { readSettings } from "./settings";

const SENT_KEY = "pulse.patterns.sent";

export async function patternsAfterRun(store: Store, profile: Profile, timeZone: string): Promise<void> {
  try {
    if (!(await coachReady())) return;
    const now = Math.floor(Date.now() / 1000);
    const ctx: QueryCtx = { store, profile, timeZone, today: localDay(now, timeZone), now, sync: await store.getSyncState() };
    const patterns = await getPatterns(ctx);
    if (!patterns.length) return;
    const words = await patternWords(patterns);
    const settings = await readSettings();
    if (!settings.patterns || !isOwnData(await readSource()) || (await notificationPermission()) !== "granted") return;
    let sent: Sent = { at: 0, keys: [] };
    try {
      const raw = await AsyncStorage.getItem(SENT_KEY);
      if (raw) sent = { ...sent, ...(JSON.parse(raw) as Partial<Sent>) };
    } catch {}
    const p = patternDue({ patterns, sent, dismissed: await dismissedPatterns(now), now, minuteOfDay: localMinutes(now, timeZone) });
    if (!p) return;
    const w = words[p.key];
    if (await sendNow({ title: w?.title ?? p.title, body: w?.body ?? p.body, url: `pulse://${p.href.replace(/^\//, "")}` })) {
      await AsyncStorage.setItem(SENT_KEY, JSON.stringify({ at: now, keys: [...sent.keys, p.key].slice(-50) } satisfies Sent)).catch(() => {});
    }
  } catch (e) {
    console.warn("[patterns]", e instanceof Error ? e.message : String(e));
  }
}

// One-time clean-ups of the owner's own data, each run once per install (an AsyncStorage flag) right after the store
// opens. Kept small and explicit: each names exactly what it changes.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isMedicineTag, medicineTag } from "@/lib/medicine";
import { readMedicines, removeMedicine, saveMedicine, type MedSchedule } from "@/state/medicines";
import type { Store } from "./store";

/** The one name L-theanine and magnesium goes by from now on (the name the morning dose already uses). */
export const LTHEANINE = "L-Theanine + Mg";
const LTHEANINE_FLAG = "halo.cleanup.ltheanine.v1";

/** "L-Theanine & Magnesium", "L-Theanine & Magnesium PM", "L-theanine + Mg"… */
export const isLTheanine = (name: string) => /l-?\s*theanine/i.test(name) && /magnesium|\bmg\b/i.test(name);

/** Merges every L-theanine and magnesium variant into one medicine; returns the days whose answers changed. */
export async function mergeLTheanine(store: Store): Promise<string[]> {
  const canon = medicineTag(LTHEANINE);
  const days = new Set<string>();

  // Doses keep their time and dose, under the one name.
  const doses = (await store.loggedEntries(0, 100_000)).filter((e) => {
    const name = String((e.data as { name?: unknown } | null)?.name ?? "");
    return e.type === "medication" && e.source === "pulse" && isLTheanine(name) && name !== LTHEANINE;
  });
  const variants = new Set(doses.map((e) => medicineTag(String((e.data as { name: string }).name))));
  if (doses.length) {
    await store.addLoggedEntries(doses.map((e) => ({ ...e, data: { ...(e.data as object), name: LTHEANINE } })));
    for (const e of doses) days.add(e.day);
  }

  // Behaviours: the variants' check-in rows go, the one row stays.
  const tags = await store.journalTags();
  for (const t of tags) if (isMedicineTag(t.tag) && t.tag !== canon && isLTheanine(t.label)) variants.add(t.tag);
  variants.delete(canon);
  if (!tags.some((t) => t.tag === canon) && (variants.size || doses.length)) {
    await store.insertJournalTags([{ tag: canon, label: LTHEANINE, isDefault: false, hidden: false, position: Math.max(0, ...tags.map((t) => t.position)) + 1 }]);
  }
  const hide = tags.filter((t) => variants.has(t.tag) && !t.hidden).map((t) => ({ tag: t.tag, hidden: true }));
  if (hide.length) await store.updateJournalTags(hide);
  if (tags.some((t) => t.tag === canon && t.hidden)) await store.updateJournalTags([{ tag: canon, hidden: false }]);

  // Each day's answers: one, "yes" if any variant (or the one) was yes.
  const answers = new Map<string, number>();
  const gone: { day: string; tag: string }[] = [];
  for (const e of await store.allJournal()) {
    if (e.tag !== canon && !variants.has(e.tag)) continue;
    answers.set(e.day, Math.max(answers.get(e.day) ?? 0, e.value));
    if (e.tag !== canon) gone.push(e);
  }
  for (const [day, value] of answers) await store.setJournal({ day, tag: canon, value });
  for (const e of gone) {
    await store.deleteJournal(e.day, e.tag);
    days.add(e.day);
  }

  if (days.size) await store.markIntradayDirty([...days]);
  return [...days].sort();
}

/** The variants' schedules as one: the morning's and the night's times, reminders on if any had them. */
export function mergeSchedules(list: MedSchedule[]): { keep: MedSchedule; drop: string[] } | null {
  const hits = list.filter((m) => isLTheanine(m.name));
  if (!hits.length || (hits.length === 1 && hits[0].name === LTHEANINE)) return null;
  const base = hits.find((m) => m.name === LTHEANINE) ?? hits[0];
  const keep: MedSchedule = {
    id: base.id,
    name: LTHEANINE,
    dose: base.dose || hits.find((m) => m.dose)?.dose || "",
    times: [...new Set(hits.flatMap((m) => m.times))].sort(),
    days: hits.some((m) => !m.days.length) ? [] : [...new Set(hits.flatMap((m) => m.days))].sort(),
    remind: hits.some((m) => m.remind),
  };
  return { keep, drop: hits.filter((m) => m.id !== base.id).map((m) => m.id) };
}

/** Runs the clean-ups not yet run on this install. True when one changed the scores' inputs (rescore now). */
export async function runOneTimeCleanups(store: Store): Promise<boolean> {
  if (await AsyncStorage.getItem(LTHEANINE_FLAG).catch(() => "1")) return false;
  try {
    const days = await mergeLTheanine(store);
    const merged = mergeSchedules(await readMedicines());
    if (merged) {
      for (const id of merged.drop) await removeMedicine(id);
      await saveMedicine(merged.keep);
      // The reminders follow the merged schedule (lazy: notifications aren't needed to clean the log).
      const { syncMedReminders } = await import("@/background/medReminders");
      await syncMedReminders();
    }
    await AsyncStorage.setItem(LTHEANINE_FLAG, new Date().toISOString());
    return days.length > 0;
  } catch (e) {
    // Left unflagged: tried again at the next launch.
    console.warn("[cleanup] L-theanine", e instanceof Error ? e.message : String(e));
    return false;
  }
}

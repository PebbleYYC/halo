// Medicine schedules on this phone (name, dose, times, days, reminder); the doses themselves are journal entries.
// The store half has no React, so the background task can read it.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as React from "react";

export const MEDICINES_KEY = "halo.medicines";

export type MedSchedule = {
  id: string;
  name: string;
  /** As typed ("3 mg", "1 tablet"); "" for none. */
  dose: string;
  /** Local times "HH:MM", sorted, at most 6. */
  times: string[];
  /** Days of the week, 0 Sunday to 6 Saturday; empty is every day. */
  days: number[];
  remind: boolean;
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseMedicines(raw: string | null): MedSchedule[] {
  try {
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list.flatMap((o): MedSchedule[] => {
      if (!o || typeof o !== "object") return [];
      const m = o as Partial<MedSchedule>;
      if (typeof m.id !== "string" || typeof m.name !== "string" || !m.name.trim()) return [];
      const times = Array.isArray(m.times) ? [...new Set(m.times.filter((t): t is string => typeof t === "string" && TIME.test(t)))].sort().slice(0, 6) : [];
      const days = Array.isArray(m.days) ? [...new Set(m.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
      return [{ id: m.id, name: m.name.trim(), dose: typeof m.dose === "string" ? m.dose.trim() : "", times, days: days.length === 7 ? [] : days, remind: m.remind === true }];
    });
  } catch {
    return [];
  }
}

let saved: MedSchedule[] | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const loaded: Promise<void> = AsyncStorage.getItem(MEDICINES_KEY)
  .then((raw) => {
    if (saved === undefined) saved = parseMedicines(raw);
  })
  .catch(() => {
    if (saved === undefined) saved = [];
  })
  .finally(emit);

/** For code outside React (reminders, the background task). */
export async function readMedicines(): Promise<MedSchedule[]> {
  await loaded;
  return saved ?? [];
}

async function write(next: MedSchedule[]): Promise<MedSchedule[]> {
  saved = next;
  emit();
  await AsyncStorage.setItem(MEDICINES_KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

/** Adds `m`, or replaces the schedule with its id. */
export async function saveMedicine(m: MedSchedule): Promise<MedSchedule[]> {
  const list = await readMedicines();
  const clean = parseMedicines(JSON.stringify([m]))[0];
  if (!clean) return list;
  const i = list.findIndex((x) => x.id === m.id);
  return write(i < 0 ? [...list, clean] : list.map((x, k) => (k === i ? clean : x)));
}

export async function removeMedicine(id: string): Promise<MedSchedule[]> {
  return write((await readMedicines()).filter((x) => x.id !== id));
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const EMPTY: MedSchedule[] = [];
export function useMedicines(): MedSchedule[] {
  return React.useSyncExternalStore(subscribe, () => saved ?? EMPTY);
}

/** A new schedule's id. */
export const newMedId = () => `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "08:00 and 21:00, every day", "08:00, Mon Wed Fri"; "No set time" without times. */
export function scheduleText(m: Pick<MedSchedule, "times" | "days">): string {
  const when = m.times.length ? (m.times.length > 1 ? `${m.times.slice(0, -1).join(", ")} and ${m.times[m.times.length - 1]}` : m.times[0]) : "No set time";
  const days = !m.days.length ? "every day" : m.days.length === 5 && [1, 2, 3, 4, 5].every((d) => m.days.includes(d)) ? "weekdays" : m.days.map((d) => DAY_SHORT[d]).join(" ");
  return `${when}, ${days}`;
}

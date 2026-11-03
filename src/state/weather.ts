// Headache risk's settings, kept on this phone (AsyncStorage): on or off, where the weather comes from (the phone's
// location rounded to about 10 km, or a city typed once), and the evening alert. On, by location, by default.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as React from "react";

export const WEATHER_SETTINGS_KEY = "halo.weather.settings";

export type City = { name: string; lat: number; lon: number };
export type WeatherSettings = {
  enabled: boolean;
  source: "location" | "city";
  city: City | null;
  /** The evening-before notification when tomorrow's risk is High. */
  notify: boolean;
  /** The last location read, already rounded: the background sync uses it, as it can't ask for a new one. */
  lastLocation: { lat: number; lon: number } | null;
};

export const DEFAULT_WEATHER_SETTINGS: WeatherSettings = { enabled: true, source: "location", city: null, notify: false, lastLocation: null };

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function parseWeatherSettings(raw: string | null): WeatherSettings {
  try {
    const o = raw ? (JSON.parse(raw) as Partial<WeatherSettings>) : {};
    const city = o.city && typeof o.city.name === "string" && num(o.city.lat) && num(o.city.lon) ? o.city : null;
    const last = o.lastLocation && num(o.lastLocation.lat) && num(o.lastLocation.lon) ? o.lastLocation : null;
    return {
      enabled: typeof o.enabled === "boolean" ? o.enabled : DEFAULT_WEATHER_SETTINGS.enabled,
      source: o.source === "city" ? "city" : "location",
      city,
      notify: o.notify === true,
      lastLocation: last,
    };
  } catch {
    return { ...DEFAULT_WEATHER_SETTINGS };
  }
}

let saved: WeatherSettings | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const loaded: Promise<void> = AsyncStorage.getItem(WEATHER_SETTINGS_KEY)
  .then((raw) => {
    if (saved === undefined) saved = parseWeatherSettings(raw);
  })
  .catch(() => {
    if (saved === undefined) saved = { ...DEFAULT_WEATHER_SETTINGS };
  })
  .finally(emit);

/** For code outside React (the sync, the background task). */
export async function readWeatherSettings(): Promise<WeatherSettings> {
  await loaded;
  return saved ?? { ...DEFAULT_WEATHER_SETTINGS };
}

export async function updateWeatherSettings(patch: Partial<WeatherSettings>): Promise<WeatherSettings> {
  const next = { ...(await readWeatherSettings()), ...patch };
  saved = next;
  emit();
  await AsyncStorage.setItem(WEATHER_SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useWeatherSettings(): WeatherSettings {
  return React.useSyncExternalStore(subscribe, () => saved ?? DEFAULT_WEATHER_SETTINGS);
}

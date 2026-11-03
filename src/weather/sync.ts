// Keeps the weather on the phone fresh (AsyncStorage, apart from the health Store, so no Health Connect re-import
// touches it). At most every 3 hours, or when the place moves; a failure is a warning, never a failed sync.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchWeather, type WeatherData } from "./openMeteo";
import type { Place } from "./place";

export const WEATHER_DATA_KEY = "halo.weather.data";
const FRESH_MS = 3 * 3600_000;

export type WeatherDoc = { fetchedAt: number; place: Place; data: WeatherData };

export async function readWeather(): Promise<WeatherDoc | null> {
  try {
    const raw = await AsyncStorage.getItem(WEATHER_DATA_KEY);
    const d = raw ? (JSON.parse(raw) as WeatherDoc) : null;
    return d && Array.isArray(d.data?.days) ? d : null;
  } catch {
    return null;
  }
}

export async function clearWeather(): Promise<void> {
  await AsyncStorage.multiRemove([WEATHER_DATA_KEY]).catch(() => {});
}

export type WeatherSyncDeps = { place: () => Promise<Place | null>; fetchFn?: typeof fetch; now?: () => number };

/** "fetched", "fresh" (recent enough), "no_place" or "failed". */
export async function syncWeather(deps: WeatherSyncDeps): Promise<"fetched" | "fresh" | "no_place" | "failed"> {
  const now = deps.now ?? Date.now;
  try {
    const place = await deps.place();
    if (!place) return "no_place";
    const prev = await readWeather();
    if (prev && prev.place.lat === place.lat && prev.place.lon === place.lon && now() - prev.fetchedAt < FRESH_MS) return "fresh";
    const data = await fetchWeather(place.lat, place.lon, deps.fetchFn);
    await AsyncStorage.setItem(WEATHER_DATA_KEY, JSON.stringify({ fetchedAt: now(), place, data } satisfies WeatherDoc));
    return "fetched";
  } catch (e) {
    console.warn(`[weather] ${e instanceof Error ? e.message : "failed"}`);
    return "failed";
  }
}

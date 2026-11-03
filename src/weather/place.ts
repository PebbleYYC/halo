// Where the weather is for: the saved city, or the phone's coarse location rounded to about 10 km. Only the app asks
// for the permission; the background sync reuses the last location it saved.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { readWeatherSettings, updateWeatherSettings } from "@/state/weather";
import { roundCoord } from "./openMeteo";

export type Place = { lat: number; lon: number; label: string };

export type LocationAccess = "granted" | "denied" | "undetermined";

export async function locationAccess(): Promise<LocationAccess> {
  try {
    const p = await Location.getForegroundPermissionsAsync();
    return p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
  } catch {
    return "denied";
  }
}

/** Android's prompt (approximate location only: the app declares no precise permission). */
export async function askLocation(): Promise<LocationAccess> {
  try {
    const p = await Location.requestForegroundPermissionsAsync();
    return p.granted ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

/** The place to fetch for, or null (off, no city chosen, or no location yet). `interactive`: may read a fresh location. */
export async function resolvePlace(interactive: boolean): Promise<Place | null> {
  const s = await readWeatherSettings();
  if (!s.enabled) return null;
  if (s.source === "city") return s.city ? { lat: s.city.lat, lon: s.city.lon, label: s.city.name } : null;
  if (interactive && (await locationAccess()) === "granted") {
    try {
      const pos = (await Location.getLastKnownPositionAsync({ maxAge: 3 * 3600_000 })) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }));
      if (pos) {
        const last = { lat: roundCoord(pos.coords.latitude), lon: roundCoord(pos.coords.longitude) };
        await updateWeatherSettings({ lastLocation: last });
        return { ...last, label: "Your location" };
      }
    } catch {
      // Fall back to the last saved location below.
    }
  }
  return s.lastLocation ? { ...s.lastLocation, label: "Your location" } : null;
}

const ASKED = "halo.weather.askedLocation";

/** Once per install, on Today: headache risk is on and set to Location by default, so ask for approximate location
 *  the first time (never again after an answer; Settings › Headache risk can ask later). True when newly granted. */
export async function askLocationOnce(): Promise<boolean> {
  try {
    const s = await readWeatherSettings();
    if (!s.enabled || s.source !== "location") return false;
    if (await AsyncStorage.getItem(ASKED)) return false;
    if ((await locationAccess()) !== "undetermined") return false;
    await AsyncStorage.setItem(ASKED, "1");
    return (await askLocation()) === "granted";
  } catch {
    return false;
  }
}

// Weather from Open-Meteo (open-meteo.com, CC BY 4.0, no key): 92 past days and 3 ahead, hourly, folded into one row
// per local day. Only a rounded latitude and longitude are sent; no health data ever is.
export const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
export const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

export type WeatherDay = {
  day: string;
  /** Mean surface pressure, hPa. */
  pressure: number;
  /** Mean relative humidity, %. */
  humidity: number;
  tempMax: number;
  tempMin: number;
  /** Highest hourly wind speed, km/h. */
  windMax: number;
};
/** Hourly pressure, for the detail chart. */
export type PressureHour = { t: string; hPa: number };
export type WeatherData = { days: WeatherDay[]; hours: PressureHour[] };

/** About 10 km: one decimal of latitude and longitude. */
export const roundCoord = (v: number) => Math.round(v * 10) / 10;

type Hourly = { time: string[]; surface_pressure: (number | null)[]; relative_humidity_2m: (number | null)[]; temperature_2m: (number | null)[]; wind_speed_10m: (number | null)[] };

/** The hourly series as one row per local day (the location's own time zone); a day missing a series is skipped. */
export function foldDays(h: Hourly): WeatherDay[] {
  const by = new Map<string, { p: number[]; rh: number[]; t: number[]; w: number[] }>();
  h.time.forEach((time, i) => {
    const day = time.slice(0, 10);
    const d = by.get(day) ?? { p: [], rh: [], t: [], w: [] };
    const push = (xs: number[], v: number | null) => v != null && Number.isFinite(v) && xs.push(v);
    push(d.p, h.surface_pressure[i]);
    push(d.rh, h.relative_humidity_2m[i]);
    push(d.t, h.temperature_2m[i]);
    push(d.w, h.wind_speed_10m[i]);
    by.set(day, d);
  });
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const out: WeatherDay[] = [];
  for (const [day, d] of [...by].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (!d.p.length || !d.rh.length || !d.t.length || !d.w.length) continue;
    out.push({ day, pressure: mean(d.p), humidity: mean(d.rh), tempMax: Math.max(...d.t), tempMin: Math.min(...d.t), windMax: Math.max(...d.w) });
  }
  return out;
}

export async function fetchWeather(lat: number, lon: number, fetchFn: typeof fetch = fetch): Promise<WeatherData> {
  const q = new URLSearchParams({
    latitude: String(roundCoord(lat)),
    longitude: String(roundCoord(lon)),
    hourly: "surface_pressure,relative_humidity_2m,temperature_2m,wind_speed_10m",
    past_days: "92",
    forecast_days: "3",
    timezone: "auto",
  });
  const res = await fetchFn(`${FORECAST_URL}?${q}`);
  if (!res.ok) throw new Error(`weather: HTTP ${res.status}`);
  const j = (await res.json()) as { hourly?: Hourly };
  if (!j.hourly?.time?.length) throw new Error("weather: no hourly data");
  const hours = j.hourly.time.flatMap((t, i) => {
    const v = j.hourly!.surface_pressure[i];
    return v != null && Number.isFinite(v) ? [{ t, hPa: v }] : [];
  });
  return { days: foldDays(j.hourly), hours };
}

export type CityMatch = { name: string; region: string | null; country: string | null; lat: number; lon: number };

/** Up to 5 places for a typed name, for Settings' city search. */
export async function searchCities(name: string, fetchFn: typeof fetch = fetch): Promise<CityMatch[]> {
  if (name.trim().length < 2) return [];
  const q = new URLSearchParams({ name: name.trim(), count: "5", language: "en", format: "json" });
  const res = await fetchFn(`${GEOCODE_URL}?${q}`);
  if (!res.ok) throw new Error(`geocoding: HTTP ${res.status}`);
  const j = (await res.json()) as { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] };
  return (j.results ?? []).map((r) => ({ name: r.name, region: r.admin1 ?? null, country: r.country ?? null, lat: r.latitude, lon: r.longitude }));
}

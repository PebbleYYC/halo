// The optional evening alert (Settings › Headache risk): after 18:00, once per day, when tomorrow's weather alone puts
// the risk at High. Off by default.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { notificationPermission, sendNow } from "@/background/notify";
import { addDays, localDay, localMinutes } from "@/lib/time";
import { factorText } from "@/queries/headache";
import { readUnits } from "@/state/units";
import { readWeatherSettings } from "@/state/weather";
import { dayRisk } from "./risk";
import { readWeather } from "./sync";

const SENT_KEY = "halo.weather.alerted";
const FROM_MIN = 18 * 60;

export async function notifyHeadache(timeZone: string, nowS = Math.floor(Date.now() / 1000)): Promise<boolean> {
  try {
    const s = await readWeatherSettings();
    if (!s.enabled || !s.notify || localMinutes(nowS, timeZone) < FROM_MIN) return false;
    const tomorrow = addDays(localDay(nowS, timeZone), 1);
    if ((await AsyncStorage.getItem(SENT_KEY)) === tomorrow) return false;
    const w = await readWeather();
    const risk = w ? dayRisk(w.data.days, tomorrow, null) : null;
    if (risk?.level !== "high" || (await notificationPermission()) !== "granted") return false;
    const units = await readUnits();
    const sent = await sendNow({ title: "Headache risk is high tomorrow", body: `${risk.factors.map((f) => factorText(f, units)).join(". ")}.`, url: "/health/headache" });
    if (sent) await AsyncStorage.setItem(SENT_KEY, tomorrow);
    return sent;
  } catch {
    return false;
  }
}

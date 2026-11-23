// The Fitbit Air over Bluetooth (android/…/app/halo/air): fitbit-air's transport (MIT, github.com/ThoreKoritzius/
// fitbit-air, with Golden Gate under Apache-2.0; see THIRD_PARTY_NOTICES.md) driven from Halo. It shares the Air's secure
// channel with Google Health, which stays the band's owner. Everything here is safe without the native module (tests,
// web): calls reject with UNAVAILABLE and the relay reads as off.
import { requireOptionalNativeModule } from "expo-modules-core";

export type RelayConfig = { halo: boolean; packages: string[]; quietStart: number; quietEnd: number };
export type AppInfo = { package: string; label: string };
export type AirBattery = { percent: number; onCharger?: boolean | null; voltageMillivolts?: number | null };
/** The Air's vibration strength: 2 low, 3 high. */
export type Intensity = 2 | 3;

type Native = {
  call(method: string, args: Record<string, unknown> | null): Promise<unknown>;
  relayConfig(): RelayConfig;
  setRelayConfig(halo: boolean, packages: string[], quietStart: number, quietEnd: number): void;
  hasNotificationAccess(): boolean;
  openNotificationAccess(): void;
  apps(): Promise<AppInfo[]>;
};
const native = requireOptionalNativeModule<Native>("FitbitAir");

export const airAvailable = native != null;

function call<T>(method: string, args: Record<string, unknown> | null = null): Promise<T> {
  if (!native) return Promise.reject(Object.assign(new Error("Fitbit Air isn't available on this build."), { code: "UNAVAILABLE" }));
  return native.call(method, args) as Promise<T>;
}

export const isAirPaired = () => call<boolean>("isAirPaired");
export const readBattery = () => call<AirBattery>("readBattery");
export const getIntensity = async () => ((await call<{ intensity: number }>("getHapticIntensity")).intensity === 3 ? 3 : 2) as Intensity;
export const setIntensity = (intensity: Intensity) => call("setHapticIntensity", { intensity });
/** One pulse at the wearer's strength. */
export const tap = () => call("tap");

const OFF: RelayConfig = { halo: false, packages: [], quietStart: 0, quietEnd: 0 };
export function relayConfig(): RelayConfig {
  try {
    return native?.relayConfig() ?? OFF;
  } catch {
    return OFF;
  }
}
export function setRelayConfig(c: RelayConfig): void {
  native?.setRelayConfig(c.halo, c.packages, Math.round(c.quietStart), Math.round(c.quietEnd));
}
export function hasNotificationAccess(): boolean {
  try {
    return native?.hasNotificationAccess() ?? false;
  } catch {
    return false;
  }
}
export const openNotificationAccess = () => native?.openNotificationAccess();
export const installedApps = (): Promise<AppInfo[]> => native?.apps() ?? Promise.resolve([]);

/** A failed call's code and message, in a few words for the screen. */
export function airErrorWords(e: unknown): string {
  const code = (e as { code?: string } | null)?.code ?? "";
  if (code === "AIR_NOT_FOUND") return "No Air paired with this phone in Google Health.";
  if (code === "BLUETOOTH_PERMISSION" || code === "NO_ACTIVITY") return "Allow Nearby devices for Halo first.";
  if (code === "UNAVAILABLE") return "Not available on this build.";
  if (code === "BUSY") return "The Air is busy. Try again in a moment.";
  const msg = e instanceof Error ? e.message : String(e);
  return msg.length > 90 ? `${msg.slice(0, 87)}…` : msg;
}

// Settings › Fitbit Air (`/settings?s=air`): the band itself over Bluetooth, through fitbit-air's transport
// (modules/fitbit-air). Its battery, its vibration strength with a test buzz, and what buzzes it: Halo's own reminders
// and alerts, and apps the user picks, outside quiet hours. The buzzing is done by a notification listener, so it
// works with Halo closed once Android gives it notification access. Google Health stays the band's owner.
import * as React from "react";
import { AppState, PermissionsAndroid, Platform, Pressable, View } from "react-native";
import { BatteryMedium, Bell, Moon, Phone, Trash2, Vibrate, Watch } from "lucide-react-native";
import {
  airErrorWords,
  clearRelayActivity,
  getIntensity,
  hasNotificationAccess,
  installedApps,
  isAirPaired,
  openNotificationAccess,
  readBattery,
  relayActivity,
  relayConfig,
  setIntensity,
  setRelayConfig,
  tap,
  type AirBattery,
  type AppInfo,
  type Intensity,
  type RelayConfig,
  type RelayEvent,
} from "../../../modules/fitbit-air";
import { RiseEach } from "@/ui/motion/Rise";
import { Txt } from "@/ui";
import { CalmInput, useCalm } from "./calmKit";
import { ButtonRow, CheckRow, Disclosure, InfoRow, InsetGroup, MenuRow, RowBox, SearchField, SwitchRow } from "./list";
import { toast } from "./toast";

/** Nearby devices, which the Air's link needs; asked here so the native side never has to. */
async function nearby(): Promise<boolean> {
  if (Platform.OS !== "android" || (Platform.Version as number) < 31) return true;
  const p = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
  if (await PermissionsAndroid.check(p)) return true;
  return (await PermissionsAndroid.request(p)) === PermissionsAndroid.RESULTS.GRANTED;
}

const QUIET = [
  { value: "off", label: "Off", span: [0, 0] },
  { value: "21-7", label: "21:00 – 07:00", span: [21 * 60, 7 * 60] },
  { value: "22-7", label: "22:00 – 07:00", span: [22 * 60, 7 * 60] },
  { value: "23-7", label: "23:00 – 07:00", span: [23 * 60, 7 * 60] },
] as const;
type QuietId = (typeof QUIET)[number]["value"];
const clockOf = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const capital = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : "Skipped");
const quietOf = (c: RelayConfig): QuietId => QUIET.find((q) => q.span[0] === c.quietStart && q.span[1] === c.quietEnd)?.value ?? "off";

export function FitbitAirSection() {
  const c = useCalm();
  const [paired, setPaired] = React.useState<boolean | null>(null);
  const [battery, setBattery] = React.useState<AirBattery | null>(null);
  const [strength, setStrength] = React.useState<Intensity | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [relay, setRelay] = React.useState<RelayConfig>(relayConfig);
  const [access, setAccess] = React.useState(hasNotificationAccess);
  const [apps, setApps] = React.useState<AppInfo[] | null>(null);
  const [query, setQuery] = React.useState("");
  const [caller, setCaller] = React.useState("");
  const [activity, setActivity] = React.useState<RelayEvent[]>(relayActivity);

  // One command at a time: the Air serves one secure session.
  const run = React.useCallback(async <T,>(what: string, job: () => Promise<T>): Promise<T | null> => {
    setBusy(what);
    setError(null);
    try {
      if (!(await nearby())) throw Object.assign(new Error("Nearby devices"), { code: "BLUETOOTH_PERMISSION" });
      return await job();
    } catch (e) {
      setError(airErrorWords(e));
      return null;
    } finally {
      setBusy(null);
    }
  }, []);

  const read = React.useCallback(async () => {
    const ok = await run("read", isAirPaired);
    setPaired(ok);
    if (!ok) return;
    const b = await run("read", readBattery);
    if (b) setBattery(b);
    const s = await run("read", getIntensity);
    if (s) setStrength(s);
  }, [run]);

  React.useEffect(() => {
    // After the screen has opened: reading the band opens a short Bluetooth session.
    const id = setTimeout(() => void read(), 0);
    void installedApps().then(setApps);
    const sub = AppState.addEventListener("change", (st) => {
      if (st !== "active") return;
      setAccess(hasNotificationAccess());
      setActivity(relayActivity());
    });
    return () => {
      clearTimeout(id);
      sub.remove();
    };
  }, [read]);

  const save = (next: RelayConfig) => {
    setRelay(next);
    setRelayConfig(next);
    if ((next.halo || next.packages.length || next.calls) && !hasNotificationAccess()) toast("Allow notification access so Halo can buzz the Air");
  };

  const picked = new Set(relay.packages);
  const shown = (apps ?? [])
    .filter((a) => !query.trim() || a.label.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(picked.has(b.package)) - Number(picked.has(a.package)));
  const wanted = relay.halo || relay.packages.length > 0 || relay.calls;
  const addCaller = (name: string) => {
    const n = name.trim();
    if (!n || relay.callers.some((x) => x.toLowerCase() === n.toLowerCase())) return;
    save({ ...relay, callers: [...relay.callers, n] });
    setCaller("");
  };
  // Recent callers not on the list yet, to add with a tap.
  const recentCallers = [...new Set(activity.filter((e) => e.kind === "call" && e.from).map((e) => e.from))].filter((n) => !relay.callers.some((x) => x.toLowerCase() === n.toLowerCase())).slice(0, 4);

  return (
    <RiseEach start={0}>
      <InsetGroup title="Band" footer={error ?? "Google Health stays the Air's owner; Halo shares its connection for these commands."}>
        <InfoRow icon={Watch} system="blue" label="Fitbit Air" value={paired === null ? "Checking…" : paired ? "Paired" : "Not paired"} valueColor={paired ? c.system.green : undefined} />
        {paired && (
          <InfoRow
            icon={BatteryMedium}
            system="green"
            label="Battery"
            value={battery ? `${battery.percent}%${battery.onCharger ? " · charging" : ""}` : busy === "read" ? "Reading…" : "—"}
            numeric
          />
        )}
        {paired === false && <ButtonRow label="Check again" busy={busy === "read"} disabled={!!busy} onPress={() => void read()} />}
      </InsetGroup>
      {paired && (
        <InsetGroup title="Vibration">
          <MenuRow<"2" | "3">
            icon={Vibrate}
            system="purple"
            label="Strength"
            value={strength === 3 ? "3" : "2"}
            options={[
              { value: "2", label: "Low" },
              { value: "3", label: "High" },
            ]}
            disabled={!!busy || strength === null}
            onChange={(v) => {
              const next = Number(v) as Intensity;
              void run("strength", () => setIntensity(next)).then((r) => r !== null && setStrength(next));
            }}
          />
          <ButtonRow label="Test buzz" busy={busy === "tap"} disabled={!!busy} onPress={() => void run("tap", tap)} />
        </InsetGroup>
      )}
      <InsetGroup title="Calls" footer={relay.callers.length ? "Only these callers ring the band, quiet hours too. Matched on the name the call shows." : "Anyone who calls, outside quiet hours. Add callers to ring for them only, quiet hours too."}>
        <SwitchRow icon={Phone} system="green" label="Ring for calls" description="Phone, WhatsApp, Signal: every second until you answer" value={relay.calls} onChange={(v) => save({ ...relay, calls: v })} />
        {relay.calls &&
          relay.callers.map((n) => (
            <RowBox key={n} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 4, paddingVertical: 6 }}>
              <Txt size={16} lineHeight={21} numberOfLines={1} style={{ flex: 1, minWidth: 0, color: c.ink, paddingVertical: 6 }}>
                {n}
              </Txt>
              <Pressable
                onPress={() => save({ ...relay, callers: relay.callers.filter((x) => x !== n) })}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${n}`}
                style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? c.fill : "transparent" })}
              >
                <Trash2 size={18} color={c.sub} strokeWidth={2} />
              </Pressable>
            </RowBox>
          ))}
        {relay.calls && (
          <RowBox style={{ paddingVertical: 10, gap: 8 }}>
            <CalmInput value={caller} onChangeText={setCaller} placeholder="Add a caller, as their name shows" returnKeyType="done" onSubmitEditing={() => addCaller(caller)} autoCapitalize="words" />
            {recentCallers.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {recentCallers.map((n) => (
                  <Pressable key={n} onPress={() => addCaller(n)} accessibilityRole="button" accessibilityLabel={`Add ${n}`} style={({ pressed }) => ({ minHeight: 36, borderRadius: 18, paddingHorizontal: 14, justifyContent: "center", backgroundColor: c.fill, opacity: pressed ? 0.6 : 1 })}>
                    <Txt size={14} lineHeight={19} numberOfLines={1} style={{ color: c.ink }}>{`+ ${n}`}</Txt>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </RowBox>
        )}
      </InsetGroup>
      <InsetGroup title="Buzz the Air for" footer="Only notifications that would alert the phone: not promotions, likes or status updates. Do Not Disturb and quiet hours hold them back.">
        <SwitchRow icon={Bell} system="red" label="Halo's reminders" description="Medicines, bedtime and alerts: two pulses" value={relay.halo} onChange={(v) => save({ ...relay, halo: v })} />
        <MenuRow<QuietId>
          icon={Moon}
          system="indigo"
          label="Quiet hours"
          value={quietOf(relay)}
          options={QUIET.map((q) => ({ value: q.value, label: q.label }))}
          onChange={(v) => {
            const q = QUIET.find((x) => x.value === v)!;
            save({ ...relay, quietStart: q.span[0], quietEnd: q.span[1] });
          }}
        />
        {wanted && !access && <ButtonRow label="Allow notification access" onPress={() => openNotificationAccess()} />}
      </InsetGroup>
      <InsetGroup title="Messages" footer="One pulse per burst: a run of messages from one app within 15 seconds buzzes once.">
        <Disclosure label="Apps" summary={relay.packages.length ? `${relay.packages.length} chosen` : "None"}>
          {apps === null ? (
            <InfoRow label="Loading apps…" />
          ) : (
            <>
              <SearchField value={query} onChangeText={setQuery} placeholder="Search apps" />
              {shown.slice(0, 60).map((a) => (
                <CheckRow
                  key={a.package}
                  label={a.label}
                  selected={picked.has(a.package)}
                  onPress={() => save({ ...relay, packages: picked.has(a.package) ? relay.packages.filter((p) => p !== a.package) : [...relay.packages, a.package] })}
                />
              ))}
            </>
          )}
        </Disclosure>
      </InsetGroup>
      {activity.length > 0 && (
        <InsetGroup title="Recent" footer="On this phone only: who and from which app, never what was said.">
          {activity.slice(0, 8).map((e, i) => (
            <InfoRow
              key={`${e.at}-${i}`}
              label={e.from || e.app}
              detail={`${e.from ? `${e.app} · ` : ""}${clockOf(e.at)}`}
              value={e.buzzed ? (e.kind === "call" ? "Rang" : "Buzzed") : capital(e.why)}
              valueColor={e.buzzed ? c.system.green : undefined}
            />
          ))}
          <ButtonRow
            label="Clear"
            onPress={() => {
              clearRelayActivity();
              setActivity([]);
            }}
          />
        </InsetGroup>
      )}
    </RiseEach>
  );
}

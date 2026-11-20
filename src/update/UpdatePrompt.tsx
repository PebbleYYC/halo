// "Halo x.y.z is available": checks GitHub every time Halo comes to the front (check.ts), and while a newer version is
// out shows its release notes every time, with Update (download, then Android's installer) and Later (closes it until
// Halo is opened again). The first time, it asks Android for permission to notify, so the background check can say
// so while Halo is closed. Mounted once in the root layout, after onboarding.
import * as React from "react";
import { AppState, ScrollView, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { askNotificationPermission, notificationPermission } from "@/background/notify";
import { readSettings } from "@/background/settings";
import { Txt } from "@/ui";
import { useCalm } from "@/ui/calm";
import { AlertDialog } from "@/ui/components/Alert";
import { font } from "@/ui/fonts";
import { checkAndNotify, type Release } from "./check";
import { megabytes } from "./install";
import { cleanNotes } from "./notes";
import { useUpdate } from "./useUpdate";

/** Set once Halo has asked for the notification permission on behalf of updates, so it never asks twice. */
const ASKED_KEY = "pulse.update.askedNotify";

async function askOnce(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(ASKED_KEY)) return;
    if (!(await readSettings()).updates || (await notificationPermission()) !== "undetermined") return;
    await AsyncStorage.setItem(ASKED_KEY, "1");
    await askNotificationPermission();
  } catch {
    // Not asking is fine: the dialog still shows when Halo is open.
  }
}

/** The version "Later" was last tapped on, for this run of the app. */
let later: string | null = null;

export function UpdatePrompt() {
  const c = useCalm();
  const { install, progress } = useUpdate();
  const [offer, setOffer] = React.useState<Release | null>(null);

  React.useEffect(() => {
    let live = true;
    const run = () =>
      void checkAndNotify().then((s) => {
        console.log(`[update] on open: ${s.available ? `offering ${s.available.version}` : "up to date"}`);
        // "Later" holds for this run of the app: every return from the camera, a permission screen or the installer
        // counted as opening Halo, and asked again.
        if (live && s.available && s.available.version !== later) setOffer(s.available);
      });
    void askOnce().then(run);
    // Every return to Halo from another app or the home screen counts as opening it.
    let last = AppState.currentState;
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active" && last === "background") run();
      last = st;
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  const r = offer;
  const size = megabytes(r?.apkBytes ?? null);
  const notes = r ? cleanNotes(r.notes) : [];
  const downloading = progress != null;
  const pct = progress == null || Number.isNaN(progress) ? null : Math.round(progress * 100);

  return (
    <AlertDialog
      open={!!r}
      title={r ? `Halo ${r.version}` : ""}
      locked={false}
      message={
        r ? (
          downloading ? (
            <Progress pct={pct} />
          ) : (
            <View style={{ gap: 8, paddingTop: 2 }}>
              {notes.length ? (
                <ScrollView style={{ maxHeight: 220 }} bounces={false}>
                  <View style={{ gap: 4 }}>
                    {notes.map((n) => (
                      <Txt key={n} size={15} lineHeight={20} style={{ color: c.sub }}>
                        {`• ${n}`}
                      </Txt>
                    ))}
                  </View>
                </ScrollView>
              ) : null}
              {r.apkUrl && size ? (
                <Txt size={13} lineHeight={18} align="center" style={{ color: c.sub }}>
                  {`${size} download`}
                </Txt>
              ) : null}
            </View>
          )
        ) : null
      }
      layout="row"
      onClose={() => {
        if (r) later = r.version;
        setOffer(null);
      }}
      actions={
        downloading
          ? // The download carries on with the dialog closed; Android's installer opens when it's done.
            [{ label: "Hide", style: "cancel", onPress: () => setOffer(null) }]
          : [
              {
                label: "Later",
                style: "cancel",
                onPress: () => {
                  if (r) later = r.version;
                  setOffer(null);
                },
              },
              {
                label: r?.apkUrl ? "Update" : "Open GitHub",
                style: "default",
                onPress: () => {
                  if (!r) return;
                  void install(r).then((ok) => ok && setOffer(null));
                },
              },
            ]
      }
    />
  );
}

function Progress({ pct }: { pct: number | null }) {
  const c = useCalm();
  return (
    <View style={{ gap: 8, paddingTop: 6 }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.fill, overflow: "hidden" }}>
        <View style={{ height: 6, borderRadius: 3, width: `${pct ?? 4}%`, backgroundColor: c.teal }} />
      </View>
      <Txt size={13} lineHeight={18} align="center" style={[font.numeric(500), { color: c.sub }]}>
        {pct == null ? "Downloading…" : `Downloading · ${pct}%`}
      </Txt>
    </View>
  );
}

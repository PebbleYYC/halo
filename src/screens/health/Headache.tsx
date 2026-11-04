// Headache risk `/health/headache`: today's level and why, tomorrow's from the forecast, pressure from yesterday to
// tomorrow, and how your logged headaches line up with pressure drops. Weather from Open-Meteo (CC BY 4.0).
import * as React from "react";
import { Linking, View, type LayoutChangeEvent } from "react-native";
import { useRouter, type Href } from "expo-router";
import Svg, { Line, Polyline } from "react-native-svg";
import { getHeadache, type HeadacheRisk, type HeadacheVM } from "@/queries/headache";
import { useApp, useQuery } from "@/state/app";
import { useWeatherSettings } from "@/state/weather";
import { SectionShell, Txt } from "@/ui";
import type { InfoContent } from "@/ui/components/InfoButton";
import { useCalm, type CalmTint } from "@/ui/calm";
import { Card } from "@/ui/components/Card";
import { Sentence } from "@/screens/detail/calmKit";
import { DetailScreen, LoadError } from "@/screens/detail/DetailScreen";
import { useBack, useRefresh } from "@/screens/detail/nav";
import { CalmButton } from "@/screens/settings/calmKit";
import { askLocation } from "@/weather/place";
import type { RiskLevel } from "@/weather/risk";

export const LEVEL: Record<RiskLevel, { word: string; tint: CalmTint }> = {
  low: { word: "Low", tint: "mint" },
  moderate: { word: "Moderate", tint: "sand" },
  high: { word: "High", tint: "peach" },
};

const INFO: InfoContent = {
  title: "About headache risk",
  body:
    "Halo estimates your chance of a headache from the weather and your own day. Day-to-day pressure changes are the best-studied weather trigger, with high humidity and sudden temperature or wind changes also linked; short sleep, low Recovery, stress and alcohol lower the threshold. Weather affects some people and not others, so log your headaches in the Journal (Symptoms › Headache) and Halo will show whether they follow pressure drops for you. Weather data by Open-Meteo.com (CC BY 4.0). Only your location rounded to about 10 km is sent to it.",
};

function RiskBlock({ risk, label }: { risk: HeadacheRisk; label: string }) {
  const c = useCalm();
  const l = LEVEL[risk.level];
  return (
    <View accessible accessibilityLabel={`${label}: ${l.word}. ${risk.reasons.join(". ")}`} style={{ gap: 8 }}>
      <Txt size={13} lineHeight={18} weight={600} style={{ color: c.sub }}>
        {label.toUpperCase()}
      </Txt>
      <Txt size={34} lineHeight={41} weight={700} style={{ color: c.tintInk[l.tint] }}>
        {l.word}
      </Txt>
      {risk.reasons.length ? (
        risk.reasons.map((r) => (
          <Txt key={r} size={15} lineHeight={20} style={{ color: c.ink }}>
            {`• ${r}`}
          </Txt>
        ))
      ) : (
        <Txt size={15} lineHeight={20} style={{ color: c.sub }}>
          Steady weather, and nothing in your day that lowers the threshold.
        </Txt>
      )}
    </View>
  );
}

/** Hourly pressure, yesterday through tomorrow, with now marked. */
function PressureChart({ hours, nowHour }: { hours: HeadacheVM["hours"]; nowHour: string }) {
  const c = useCalm();
  const [w, setW] = React.useState(0);
  const H = 120;
  if (hours.length < 2) return <Sentence>No pressure readings yet.</Sentence>;
  const vals = hours.map((h) => h.hPa);
  const lo = Math.floor(Math.min(...vals) - 1);
  const hi = Math.ceil(Math.max(...vals) + 1);
  const x = (i: number) => (i / (hours.length - 1)) * w;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const nowIdx = hours.findIndex((h) => h.t.slice(0, 13) === nowHour);
  const first = hours[0].hPa;
  const last = hours[hours.length - 1].hPa;
  return (
    <View style={{ gap: 8 }}>
      <View onLayout={(e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width))} accessible accessibilityLabel={`Pressure from ${Math.round(first)} to ${Math.round(last)} hectopascals between yesterday and tomorrow`} style={{ height: H }}>
        {w > 0 && (
          <Svg width={w} height={H}>
            {nowIdx > 0 && <Line x1={x(nowIdx)} x2={x(nowIdx)} y1={0} y2={H} stroke={c.line} strokeWidth={1} strokeDasharray="3 4" />}
            <Polyline points={hours.map((h, i) => `${x(i)},${y(h.hPa)}`).join(" ")} fill="none" stroke={c.vivid.sky[0]} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {["Yesterday", "Today", "Tomorrow"].map((t) => (
          <Txt key={t} size={12} lineHeight={16} style={{ color: c.sub }}>
            {t}
          </Txt>
        ))}
      </View>
      <Txt size={13} lineHeight={18} style={{ color: c.sub }}>{`${lo}–${hi} hPa`}</Txt>
    </View>
  );
}

function PatternText({ p }: { p: NonNullable<HeadacheVM["pattern"]> }) {
  if (p.kind === "not_enough")
    return <Sentence>{`Log headaches in the Journal (Log › Symptoms › Headache). After ${p.needed} (you have ${p.headacheDays}), Halo shows whether yours follow pressure drops.`}</Sentence>;
  if (p.kind === "more")
    return <Sentence>{`Your headaches follow pressure drops: ${p.onDropDays} of your ${p.headacheDays} logged headaches fell on the ${p.dropDays} days pressure fell by 3 hPa or more${p.ratio ? `, about ${p.ratio.toFixed(1)}× your usual rate` : ""}.`}</Sentence>;
  if (p.kind === "no_link") return <Sentence>{`No clear weather link for you so far: across ${p.headacheDays} logged headaches, pressure drops made no difference. Other triggers may matter more.`}</Sentence>;
  return <Sentence>{`Not clear yet: ${p.onDropDays} of ${p.headacheDays} logged headaches fell on pressure-drop days. More logs will settle it.`}</Sentence>;
}

function Missing({ vm }: { vm: HeadacheVM }) {
  const c = useCalm();
  const router = useRouter();
  const app = useApp();
  const s = useWeatherSettings();
  if (!vm.enabled)
    return (
      <Card padding={16} style={{ gap: 10 }}>
        <Sentence>Headache risk is off.</Sentence>
        <CalmButton variant="secondary" size="md" onPress={() => router.push("/settings?s=headache" as Href)}>
          Turn it on in Settings
        </CalmButton>
      </Card>
    );
  return (
    <Card padding={16} style={{ gap: 10 }}>
      <Txt size={15} lineHeight={20} style={{ color: c.ink }}>
        {vm.missing === "place"
          ? s.source === "city"
            ? "Choose your city in Settings to get the weather."
            : "Allow approximate location so Halo can get your local weather."
          : "Getting the weather. Pull to refresh in a moment."}
      </Txt>
      {vm.missing === "place" && s.source === "location" && (
        <CalmButton
          size="md"
          onPress={async () => {
            if ((await askLocation()) === "granted") void app.refresh();
          }}
        >
          Allow location
        </CalmButton>
      )}
      <CalmButton variant="secondary" size="md" onPress={() => router.push("/settings?s=headache" as Href)}>
        {s.source === "city" ? "Choose a city" : "Use a city instead"}
      </CalmButton>
    </Card>
  );
}

export default function HeadacheScreen() {
  const onBack = useBack("/health");
  const { refreshing, onRefresh, retry } = useRefresh();
  const { data: vm, error } = useQuery((ctx) => getHeadache(ctx), [], "headache");
  const c = useCalm();
  const common = { title: "Headache risk", info: INFO, onBack, refreshing, onRefresh } as const;
  if (error && !vm) return <DetailScreen {...common} primary={<LoadError onRetry={retry} />} />;
  if (!vm) return <DetailScreen {...common} primary={<Card padding={16}><Sentence>Loading…</Sentence></Card>} />;
  if (!vm.today) return <DetailScreen {...common} primary={<Missing vm={vm} />} />;
  return (
    <DetailScreen
      {...common}
      subtitle={vm.place ?? undefined}
      primary={
        <SectionShell variant="card" title="Today">
          <RiskBlock risk={vm.today} label="From the weather and your day" />
        </SectionShell>
      }
      secondary={[
        vm.tomorrow ? (
          <SectionShell key="tomorrow" variant="card" title="Tomorrow">
            <RiskBlock risk={vm.tomorrow} label="From the forecast" />
          </SectionShell>
        ) : null,
        <SectionShell key="pressure" variant="card" title="Pressure">
          <PressureChart hours={vm.hours} nowHour={vm.nowHour} />
        </SectionShell>,
        vm.pattern ? (
          <SectionShell key="pattern" variant="card" title="Your pattern">
            <PatternText p={vm.pattern} />
          </SectionShell>
        ) : null,
        <View key="credit" style={{ paddingHorizontal: 4, gap: 4 }}>
          <Txt size={13} lineHeight={18} style={{ color: c.sub }} onPress={() => void Linking.openURL("https://open-meteo.com/")}>
            Weather data by Open-Meteo.com (CC BY 4.0). Only your location rounded to about 10 km is sent.
          </Txt>
        </View>,
      ].filter(Boolean) as React.ReactElement[]}
    />
  );
}

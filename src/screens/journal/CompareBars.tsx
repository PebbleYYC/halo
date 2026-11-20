// One finding as a sentence over its evidence: the headline says what to do with it ("Recovery is 19 points higher
// when you take it after 21:55"), and a bar per group shows the averages it rests on, side by side on one scale. A
// group that clearly differs is the only coloured one (green better, rose worse); the rest are grey, so a finding that
// isn't clear yet reads as grey bars under "No clear difference yet". Shared by Insights' By amount and When you take
// it, and meant for any comparison like them.
import * as React from "react";
import { StyleSheet, View } from "react-native";
import { Txt } from "@/ui";
import { useCalm } from "@/ui/calm";
import { font } from "@/ui/fonts";

export type CompareRow = {
  label: string;
  /** Under the label: how many days or nights. */
  sub: string;
  /** null: not enough days yet (an empty track, "–"). */
  value: number | null;
  display: string;
  mark?: "better" | "worse";
};

const LABEL_W = 108;
const VALUE_W = 64;

export function CompareBars({ title, headline, rows, domain, signed = false, first = false }: { title: string; headline: string; rows: CompareRow[]; domain: [number, number]; signed?: boolean; first?: boolean }) {
  const c = useCalm();
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  const ink = (m: CompareRow["mark"]) => (m === "better" ? c.tintInk.mint : m === "worse" ? c.tintInk.rose : null);
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${headline} ${rows.map((r) => `${r.label}: ${r.value == null ? "not enough days" : r.display}, ${r.sub}`).join("; ")}.`}
      style={[{ paddingVertical: 14, gap: 12 }, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }]}
    >
      <View style={{ gap: 2 }}>
        <Txt size={13} lineHeight={18} weight={600} style={{ color: c.sub }}>
          {title}
        </Txt>
        <Txt size={17} lineHeight={22} weight={600} style={{ color: c.ink }}>
          {headline}
        </Txt>
      </View>
      <View style={{ gap: 10 }}>
        {rows.map((r) => {
          const color = ink(r.mark);
          const share = r.value == null ? 0 : Math.max(0, Math.min(1, (r.value - lo) / span));
          // Signed values (HRV in SD) grow from the middle; the rest from the left.
          const zero = signed ? Math.max(0, Math.min(1, -lo / span)) : 0;
          const left = Math.min(share, zero);
          const width = Math.max(Math.abs(share - zero), r.value == null ? 0 : 0.015);
          return (
            <View key={r.label} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: LABEL_W }}>
                <Txt size={15} lineHeight={20} weight={500} numberOfLines={1} style={{ color: c.ink }}>
                  {r.label}
                </Txt>
                <Txt size={13} lineHeight={17} numberOfLines={1} style={[font.numeric(500), { color: c.sub }]}>
                  {r.sub}
                </Txt>
              </View>
              <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: c.fill, overflow: "hidden" }}>
                {signed && <View style={{ position: "absolute", left: `${zero * 100}%`, top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: c.tertiary }} />}
                <View style={{ position: "absolute", top: 0, bottom: 0, left: `${left * 100}%`, width: `${width * 100}%`, borderRadius: 5, backgroundColor: color ?? c.tertiary }} />
              </View>
              <Txt size={17} lineHeight={22} align="right" style={[font.numeric(600), { width: VALUE_W, color: r.value == null ? c.faint : (color ?? c.ink) }]}>
                {r.value == null ? "–" : r.display}
              </Txt>
            </View>
          );
        })}
      </View>
    </View>
  );
}

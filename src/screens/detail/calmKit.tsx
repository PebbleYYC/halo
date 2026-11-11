// Building blocks for the detail and Health screens, in Apple Health's look. Numbers and words never look alike: a
// number is Inter bold (tabular) in its metric's system colour with its unit half its size and grey beside it; the
// label under a number is small semibold capitals in grey; titles are 17/22 semibold; sentences 15/20 in the secondary
// grey, on a line of their own. Lead cards wear their family's soft fill, sections are flat cards, and rows sit in one
// grouped list per card with half-point hairlines between them.
import * as React from "react";
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import type { ChipTone, Tone } from "@/lib/bands";
import { alpha } from "@/lib/utils";
import { Txt } from "@/ui";
import { CalmCard, type CalmCardProps } from "@/ui/components/CalmSurface";
import { Caption, Hairline, IconTile as KitIconTile, MiniStat, Num, Sentence, Title } from "@/ui/components/calmKit";
import { useCalm, type CalmPalette } from "@/ui/calm";

/** A tone's ink: good in mint, bad in rose, neutral in the secondary grey. */
export function toneInk(c: CalmPalette, tone: Tone | ChipTone | null | undefined): string {
  switch (tone) {
    case "good":
    case "optimal":
      return c.tintInk.mint;
    case "bad":
    case "alert":
      return c.tintInk.rose;
    case "warning":
      return c.tintInk.sand;
    default:
      return c.sub;
  }
}

// The type, the icon square, the head-and-body card and the mini stat are the shared kit's (src/ui/components): one
// definition for every screen, re-exported here under the names these screens import.
export { Caption, MiniStat, Num, Sentence, Title };
export { CalmCard, type CalmCardProps };

/** The icon square at a card's or row's top left: `bg` under the icon in `color`, its corners a quarter of its size. */
export function IconTile({ icon, color, bg, size = 44 }: { icon: LucideIcon; color: string; bg: string; size?: number }) {
  return <KitIconTile icon={icon} tint={null} color={color} bg={bg} size={size} />;
}

/** Rows grouped in one list, a hairline between each (inset past the rows' icons with `inset`). */
export function Grouped({ children, inset = 0, lineColor }: { children: React.ReactNode; inset?: number; lineColor?: string }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Hairline inset={inset} color={lineColor} />}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

/** A choice pill, an iOS capsule: solid blue with white text when chosen, the card colour on the ground otherwise. */
export function ChoicePill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const c = useCalm();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => ({ height: 38, borderRadius: 19, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.teal : c.card, opacity: pressed ? 0.6 : 1 })}
    >
      <Txt size={15} lineHeight={20} weight={600} style={{ color: on ? "#ffffff" : c.ink }}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** A quiet action, iOS tinted capsule (blue at 15 %, blue text: "Show older"); a spinner while `loading`. */
export function TealButton({ label, onPress, loading, style }: { label: string; onPress: () => void; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useCalm();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ busy: !!loading }}
      style={({ pressed }) => [{ alignSelf: "center", height: 44, minWidth: 132, borderRadius: 22, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", backgroundColor: alpha(c.teal, 0.15), opacity: pressed ? 0.6 : 1 }, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={c.teal} />
      ) : (
        <Txt size={15} lineHeight={20} weight={600} style={{ color: c.teal }}>
          {label}
        </Txt>
      )}
    </Pressable>
  );
}

/** A group's heading over its cards on the ground ("Today", "Last 30 days"): 15/20 semibold, the aside on the right. */
export function GroupHead({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <View accessibilityRole="header" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 12, rowGap: 2, paddingHorizontal: 4 }}>
      <Title size={16}>{title}</Title>
      {aside}
    </View>
  );
}

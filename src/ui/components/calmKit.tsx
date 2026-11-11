// The shared parts of the kit's components, in the iOS look (the reference is Apple Health and Settings): the metric
// family → system colour map, the tone colours, the icon square, a number with its small grey unit, the small caps
// caption under a number, and the surface a control sits on (so a quiet fill reads on a white card, on the grey ground
// and on a sheet alike). Every colour comes from useCalm() (src/ui/calm.ts).
import * as React from "react";
import { View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { recoveryBand, type ChipTone, type Tone } from "@/lib/bands";
import type { AccentFamily } from "@/ui/accents";
import { useCalm, type CalmPalette, type CalmTint } from "@/ui/calm";
import { font } from "@/ui/fonts";
import { Txt } from "./Text";

/** One system colour per metric family (as its tint: mint green, lavender indigo, peach orange, sky blue…). */
export const FAMILY_TINT: Record<AccentFamily, CalmTint> = {
  recovery: "mint",
  sleep: "lavender",
  stress: "lavender",
  strain: "peach",
  activity: "sky",
  body: "sand",
  heart: "rose",
};

/**
 * A family's tint, or null. Recovery follows its band when `value` is a recovery score (0-100): green, yellow, red
 * (mint, sand, rose), as Home colours its Recovery number.
 */
export function familyTint(family: AccentFamily | null | undefined, value?: number | null): CalmTint | null {
  if (!family) return null;
  if (family === "recovery" && value !== null && value !== undefined && Number.isFinite(value) && value >= 0 && value <= 100) {
    const band = recoveryBand(value);
    return band === "green" ? "mint" : band === "yellow" ? "sand" : "rose";
  }
  return FAMILY_TINT[family];
}

/** A delta tone or a chip tone as a tint: good green, warning yellow, alert pink-red; neutral has none (a quiet grey). */
export function toneTint(tone: Tone | ChipTone): CalmTint | null {
  return tone === "good" || tone === "optimal" ? "mint" : tone === "bad" || tone === "warning" ? "sand" : tone === "alert" ? "rose" : null;
}

// The surface under a control

/** Where a control sits: the grouped ground, a card, or straight on a bottom sheet. */
export type CalmSurface = "ground" | "card" | "sheet";
const Surface = React.createContext<CalmSurface>("ground");

/** Marks everything under it as sitting on a card (Card provides it, and a card inside a sheet). */
export function OnCard({ children }: { children: React.ReactNode }) {
  return <Surface.Provider value="card">{children}</Surface.Provider>;
}

/** Marks everything under it as sitting straight on a bottom sheet (the sheet's content provides it). */
export function OnSheet({ children }: { children: React.ReactNode }) {
  return <Surface.Provider value="sheet">{children}</Surface.Provider>;
}

export const useSurface = (): CalmSurface => React.useContext(Surface);

/**
 * The quiet fill of a pill, a secondary button or a field: the card colour on the ground and on a sheet (white on the
 * light grey, the raised grey on the dark sheet); on a card the ground's grey (light) or the raised chip (dark), so it
 * never vanishes into the surface under it.
 */
export function softFill(c: CalmPalette, surface: CalmSurface): string {
  if (surface === "ground") return c.card;
  if (surface === "sheet") return c.sheetFill;
  return c.chip === c.card ? c.ground : c.chip;
}

/** `softFill` for the surface this component sits on. */
export function useSoftFill(): string {
  return softFill(useCalm(), useSurface());
}

// Icons

type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const isComponent = (x: unknown): x is IconComponent => typeof x === "function" || (typeof x === "object" && x !== null && "$$typeof" in x);

/**
 * The icon element redrawn in `color` (and at `size` when given): lucide elements take both as props; wrappers that
 * take the glyph as `icon` (`<StatIcon icon={Heart} />`) are unwrapped. Anything else (a swatch) is drawn as given.
 */
export function recolorIcon(node: React.ReactNode, color: string, size?: number): React.ReactNode {
  if (!React.isValidElement<Record<string, unknown>>(node)) return node;
  const props = node.props;
  if ("color" in props) return React.cloneElement(node, size !== undefined && typeof props.size === "number" ? { color, size } : { color });
  if (isComponent(props.icon)) {
    const Icon = props.icon;
    return <Icon size={size ?? (typeof props.size === "number" ? props.size : 20)} color={color} strokeWidth={typeof props.strokeWidth === "number" ? props.strokeWidth : 1.75} />;
  }
  return node;
}

/** An iOS icon square's corner radius at `size` (7 on the 29 px Settings square). */
export const iconRadius = (size: number) => Math.round(size * 0.24);

/**
 * The icon square, iOS Settings': the family's system colour with the icon in white. Given a `bg` it is a soft square
 * with the icon in the family's colour instead; without a tint, a quiet grey square with a grey icon. A swatch (not an
 * icon) is drawn as given, centred.
 */
export function IconTile({
  icon,
  tint,
  size = 44,
  radius,
  iconSize,
  bg,
  color,
  style,
}: {
  /** The glyph: a lucide component (`Heart`) or an element (`<Heart />`, a swatch). */
  icon?: IconComponent | React.ReactNode;
  tint: CalmTint | null;
  size?: number;
  radius?: number;
  iconSize?: number;
  bg?: string;
  /** The glyph's colour, when not the square's own (white on a solid square). */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useCalm();
  const solid = !!tint && !bg;
  const fill = bg ?? (tint ? c.tintInk[tint] : softFill(c, "card"));
  const ink = color ?? (solid ? "#ffffff" : tint ? c.tintInk[tint] : c.sub);
  const glyph = iconSize ?? Math.round(size * 0.55);
  return (
    <View style={[{ width: size, height: size, borderRadius: radius ?? iconRadius(size), backgroundColor: fill, alignItems: "center", justifyContent: "center", flexShrink: 0 }, style]}>
      {!React.isValidElement(icon) && isComponent(icon) ? React.createElement(icon, { size: glyph, color: ink, strokeWidth: 2 }) : recolorIcon(icon as React.ReactNode, ink, glyph)}
    </View>
  );
}

// List rows

/** The disclosure chevron's glyph size and weight: iOS's thin, tertiary chevron. */
export const CHEVRON = { size: 18, stroke: 2.4 } as const;

/**
 * A list row's trailing chevron (iOS's: thin, in the tertiary grey), or an empty box of the same size when the row opens
 * nothing: every row of a list keeps the column, so the values beside it share one right edge.
 */
export function ChevronSlot({ shown, size = CHEVRON.size, color, style }: { shown: boolean; size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const c = useCalm();
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[{ width: size, height: size, flexShrink: 0 }, style]}>
      {shown && <ChevronRight size={size} color={color ?? c.tertiary} strokeWidth={CHEVRON.stroke} />}
    </View>
  );
}

/**
 * The offset that centres a line `h` px tall on a row's lead band (`band`, the icon tile's size): list rows put the
 * icon, the first line of the name, the value and the chevron on that band, and hang everything else under it.
 */
export const onBand = (band: number, h: number) => Math.max(0, (band - h) / 2);

// Numbers

/**
 * A number with its unit beside it on the baseline, as Apple Health sets "80 BPM": Inter bold (tabular) in the number's
 * colour, the unit half its size, semibold and grey, so "43 ms" reads as a value with a unit, never as a phrase.
 */
export function Num({
  value,
  unit,
  size,
  color,
  unitColor,
  weight = 700,
  style,
  numberOfLines = 1,
}: {
  value: string;
  unit?: string;
  size: number;
  color?: string;
  unitColor?: string;
  weight?: 500 | 600 | 700;
  /** The row holding the number and its unit. */
  style?: StyleProp<ViewStyle>;
  numberOfLines?: number;
}) {
  const c = useCalm();
  return (
    <View style={[{ flexDirection: "row", alignItems: "baseline", flexShrink: 1 }, style]}>
      <Txt size={size} lineHeight={Math.round(size * 1.15)} numberOfLines={numberOfLines} style={[font.numberAt(size, weight), { color: color ?? c.ink }]}>
        {value}
      </Txt>
      {unit ? (
        <Txt size={unitSize(size)} lineHeight={Math.round(unitSize(size) * 1.3)} weight={600} style={{ color: unitColor ?? c.sub, marginLeft: unit === "%" ? 1 : 3, flexShrink: 1 }}>
          {unit}
        </Txt>
      ) : null}
    </View>
  );
}

/** The unit's size beside a number of `size` px: half of it, never under 12 px. */
export const unitSize = (size: number) => Math.max(12, Math.round(size * 0.5));

/**
 * The small caps caption under a number ("RESTING"): 12 px semibold capitals in the secondary grey. It wraps rather than
 * clip; a tile with room for one line passes `numberOfLines`.
 */
export function Caption({ children, color, align, numberOfLines, style }: { children: string; color?: string; align?: TextStyle["textAlign"]; numberOfLines?: number; style?: StyleProp<TextStyle> }) {
  const c = useCalm();
  return (
    <Txt size={12} lineHeight={16} weight={600} align={align} numberOfLines={numberOfLines} style={[{ color: color ?? c.sub, letterSpacing: 0.4 }, style]}>
      {children.toUpperCase()}
    </Txt>
  );
}

/** A card or row title: 17/22 semibold ink (iOS's headline); `size` 15 or 16 for a row inside a list. */
export function Title({
  children,
  size = 17,
  color,
  lines,
  numberOfLines,
  header = false,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  /** The most lines it takes (also `numberOfLines`); it wraps freely without. */
  lines?: number;
  numberOfLines?: number;
  /** A heading for screen readers. */
  header?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const c = useCalm();
  return (
    <Txt size={size} lineHeight={Math.round(size * 1.3)} weight={600} numberOfLines={numberOfLines ?? lines} accessibilityRole={header ? "header" : undefined} style={[{ color: color ?? c.ink, flexShrink: 1 }, style]}>
      {children}
    </Txt>
  );
}

/**
 * A sentence: 15/20 in the secondary grey (iOS's subhead), on a line of its own; `size` 13 for a note. In a colour of
 * its own (a warning in its tint's ink) it is semibold, so coloured words keep their contrast.
 */
export function Sentence({
  children,
  color,
  weight,
  size = 15,
  align,
  style,
  accessibilityRole,
}: {
  children: React.ReactNode;
  color?: string;
  weight?: 400 | 500 | 600;
  size?: number;
  align?: TextStyle["textAlign"];
  style?: StyleProp<TextStyle>;
  accessibilityRole?: "alert" | "text";
}) {
  const c = useCalm();
  return (
    <Txt size={size} lineHeight={size + 5} weight={weight ?? (color && color !== c.sub ? 600 : 400)} align={align} accessibilityRole={accessibilityRole} style={[{ color: color ?? c.sub }, style]}>
      {children}
    </Txt>
  );
}

/** A number with its small capitals label under it (and an optional note), for a row of two or three. */
export function MiniStat({ value, unit, label, color, size = 24, note, noteColor, align }: { value: string; unit?: string; label: string; color?: string; size?: number; note?: string | null; noteColor?: string; align?: "center" }) {
  return (
    <View style={{ flex: 1, minWidth: 0, alignItems: align === "center" ? "center" : "flex-start" }}>
      <Num value={value} unit={unit} size={size} color={color} />
      <Caption align={align} style={{ marginTop: 4 }}>
        {label}
      </Caption>
      {note ? (
        <Sentence size={13} color={noteColor} align={align} style={{ marginTop: 2 }}>
          {note}
        </Sentence>
      ) : null}
    </View>
  );
}

/** The hairline between rows of a grouped card (iOS's separator, half a point), inset past the icon square. */
export function Hairline({ inset = 0, color }: { inset?: number; color?: string }) {
  const c = useCalm();
  return <View style={{ height: 0.5, marginLeft: inset, backgroundColor: color ?? c.line }} />;
}

/** The kit's text styles, for places that build their own Text (ValueUnit's unit, the chart readouts). */
export const CALM_TYPE = {
  /** Titles: Inter 600 17/22 (iOS's headline). */
  title: { size: 17, line: 22, weight: 600 },
  /** Sentences: 15/20 (iOS's subhead). */
  sentence: { size: 15, line: 20, weight: 400 },
  /** Labels under numbers: 12/16 600 caps, 0.4 tracking. */
  caption: { size: 12, line: 16, weight: 600, tracking: 0.4 },
} as const;

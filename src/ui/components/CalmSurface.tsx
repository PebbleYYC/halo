// The card surface, one for every card in the app, iOS's: a flat face in the card colour (or a family's soft fill of
// its system colour, `tint`) with 20 px corners, no hairline, no shadow, no gradient. One view per card, so a screen of
// them costs nothing extra to scroll. A pressable card answers with the kit's press (it settles to 97 % and dims a
// little, springing back on release), on the UI thread.
import * as React from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import { useCalm, type CalmTint } from "@/ui/calm";
import { IconTile, OnCard, Sentence, Title } from "./calmKit";
import { Txt } from "./Text";
import { usePress, usePressStyle } from "./press";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A content card's corner radius (iOS's 20). */
export const SURFACE_RADIUS = 20;

export type CalmSurfaceProps = {
  tint?: CalmTint;
  /** Kept for API compatibility: iOS cards carry no watermark. */
  watermark?: LucideIcon;
  onPress?: () => void;
  /** A pressable card that can't be pressed now: dimmed, and announced as disabled. */
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "link";
  padding?: number;
  gap?: number;
  radius?: number;
  /** Kept for API compatibility: iOS cards are flat. */
  elevated?: boolean;
  /** Kept for API compatibility: no card breathes a light any more. */
  breathe?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function CalmSurface({ tint, onPress, disabled, accessibilityLabel, accessibilityRole, padding = 16, gap, radius = SURFACE_RADIUS, style, children }: CalmSurfaceProps) {
  const c = useCalm();
  const face: ViewStyle = { borderRadius: radius, backgroundColor: tint ? c.tint[tint] : c.card, padding, gap, overflow: "hidden" };
  const press = usePress();
  const pressed = usePressStyle(press, { rest: disabled ? 0.5 : 1, dim: 0.88 });
  if (!onPress) return <View style={[face, style]}>{children}</View>;
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={disabled}
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { disabled } : undefined}
      style={[face, style, pressed]}
    >
      {children}
    </AnimatedPressable>
  );
}

export type CalmCardProps = {
  /** The family's pastel; none for a card in the card colour. */
  tint?: CalmTint;
  /** The icon's family on a plain card (default: the card's own tint, else the action colour). */
  iconTint?: CalmTint;
  icon?: LucideIcon;
  title?: string;
  /** The sentence under the title, across the card's whole width. */
  subtitle?: string | null;
  subtitleColor?: string;
  /** Beside the title (a headline number, a chevron). */
  right?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Space between the head and the body. */
  gap?: number;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/**
 * A card with a head, the one every screen uses: a family's soft fill (or the card colour), 20 px corners, flat; the
 * icon square (the family's system colour with a white glyph, as iOS Health heads a card), the title and the sentence
 * under it, something on the right, then its body. Controls inside know they sit on a card.
 */
export function CalmCard({ tint, iconTint, icon, title, subtitle, subtitleColor, right, onPress, accessibilityLabel, gap = 16, padding = 16, style, children }: CalmCardProps) {
  const c = useCalm();
  const family = iconTint ?? tint;
  const head =
    title || icon ? (
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        {icon && <IconTile icon={icon} tint={null} color="#ffffff" bg={family ? c.tintInk[family] : c.teal} size={36} />}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          {title ? (
            // With no sentence the title centres on the square; a long title wraps.
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: icon ? (subtitle ? 22 : 36) : 22 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Title header>{title}</Title>
              </View>
              {right}
            </View>
          ) : null}
          {/* The whole width under the title row: a sentence is never cut short by the number beside the title. */}
          {subtitle ? <Sentence color={subtitleColor}>{subtitle}</Sentence> : null}
        </View>
      </View>
    ) : null;
  return (
    <CalmSurface tint={tint} onPress={onPress} accessibilityLabel={onPress ? (accessibilityLabel ?? [title, subtitle].filter(Boolean).join(". ")) : undefined} padding={padding} gap={gap} style={style}>
      <OnCard>
        {head}
        {children}
      </OnCard>
    </CalmSurface>
  );
}

/** A card header's action, iOS's: a blue link with a chevron ("Details ›"). `accessibilityLabel` names what it opens. */
export function PillAction({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel?: string }) {
  const c = useCalm();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={10}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 1, minHeight: 32, opacity: pressed ? 0.5 : 1 })}
    >
      <Txt size={15} lineHeight={20} weight={500} numberOfLines={1} style={{ color: c.teal }}>
        {label}
      </Txt>
      <ChevronRight size={17} color={c.teal} strokeWidth={2.4} />
    </Pressable>
  );
}

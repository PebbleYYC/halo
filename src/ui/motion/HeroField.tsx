// The field inside a hero ring: Sleep's starry sky and Activity's pulses. It comes up as the ring draws, moves for
// five seconds and settles to a dim rest — the same arrival the Halo Age orb has (DESIGN.md › Motion: "It swirls in,
// moves for 5 seconds, then rests"), so Sleep, Activity and Health read as one app. Nothing loops: one driver runs
// 0 → 1 over the five seconds and stops, and every layer is a function of it. Reduce motion shows the rest at once,
// and a glance within the quiet window (freshLook) does too, so flicking between tabs never restarts it.
import * as React from "react";
import { View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { useIsFocused } from "expo-router";
import { freshLook } from "./freshLook";
import { reduceMotionNow } from "./system";
import { starField, type Star } from "./field";

/** How long the whole arrival takes, settle included. */
export const FIELD_MS = 5000;
/** Where in that run the field starts settling to its resting state. */
const SETTLE_AT = 0.8;
/** Activity's pulses: how many go out, and how far apart they start. */
const WAVES = 3;
const WAVE_GAP = 0.26;

const clamp01 = (v: number) => {
  "worklet";
  return v < 0 ? 0 : v > 1 ? 1 : v;
};

/** How far the field has settled: 0 while it moves, 1 at rest. */
const restOf = (t: number) => {
  "worklet";
  return clamp01((t - SETTLE_AT) / (1 - SETTLE_AT));
};

/**
 * The run: 0 at arrival, 1 once it has settled, and 1 from the start when there is nothing to play. Leaving the
 * screen re-arms it, so coming back after a while plays it again.
 */
function useFieldRun(motionKey: string): SharedValue<number> {
  const t = useSharedValue(1);
  const focused = useIsFocused();
  const played = React.useRef(false);
  React.useEffect(() => {
    if (!focused) {
      played.current = false;
      return;
    }
    if (reduceMotionNow() || played.current) return;
    played.current = true;
    if (!freshLook(`field:${motionKey}`)) return;
    t.set(0);
    t.set(withTiming(1, { duration: FIELD_MS, easing: Easing.linear }));
    return () => cancelAnimation(t);
  }, [focused, motionKey, t]);
  return t;
}

function StarDot({ star, run, color, size }: { star: Star; run: SharedValue<number>; color: string; size: number }) {
  const style = useAnimatedStyle(() => {
    const t = run.value;
    const rest = restOf(t);
    // Up over the ring's own draw, a slow twinkle that dies away as it settles, and half the brightness at rest.
    const up = clamp01(t / 0.14);
    const twinkle = 1 - 0.3 * (1 - rest) * (0.5 + 0.5 * Math.sin(t * star.freq * 11 + star.phase));
    return { opacity: star.base * up * twinkle * (1 - 0.45 * rest), transform: [{ translateY: (t - 0.5) * 3 }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", left: size / 2 + star.x - star.d / 2, top: size / 2 + star.y - star.d / 2, width: star.d, height: star.d, borderRadius: star.d / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

function Wave({ i, run, color, size }: { i: number; run: SharedValue<number>; color: string; size: number }) {
  const style = useAnimatedStyle(() => {
    const t = run.value;
    // Each wave goes out once, a little after the one before it: three of them inside the five seconds.
    const phase = clamp01(t * 1.7 - i * WAVE_GAP);
    return { opacity: 0.34 * Math.sin(Math.PI * phase) * (1 - restOf(t)), transform: [{ scale: 0.3 + 0.7 * phase }] };
  });
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: color }, style]} />;
}

/** What the pulses leave behind: one quiet echo, concentric with the hero ring. */
function WaveRest({ run, color, size }: { run: SharedValue<number>; color: string; size: number }) {
  const style = useAnimatedStyle(() => ({ opacity: 0.11 * restOf(run.value) }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 1.25, borderColor: color, transform: [{ scale: 0.62 }] }, style]} />;
}

export type HeroFieldProps = {
  /** Sleep's sky, or Activity's pulses. */
  kind: "stars" | "pulse";
  /** The ring's hole, in px: the field fills it. */
  size: number;
  color: string;
  /** Its own name in the quiet window, so each hero plays once per arrival. */
  motionKey: string;
};

export function HeroField({ kind, size, color, motionKey }: HeroFieldProps) {
  const run = useFieldRun(motionKey);
  const stars = React.useMemo(() => (kind === "stars" ? starField(size) : []), [kind, size]);
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      {kind === "stars"
        ? stars.map((s, i) => <StarDot key={i} star={s} run={run} color={color} size={size} />)
        : [...Array(WAVES)].map((_, i) => <Wave key={i} i={i} run={run} color={color} size={size} />)}
      {kind === "pulse" ? <WaveRest run={run} color={color} size={size} /> : null}
    </View>
  );
}

// The streak's flame: three layered tongues (outer, middle, core) in the streak's colour (tiers.ts), a soft glow behind
// and a few sparks. Like the Halo Age orb and the Sleep and Activity fields, it arrives and then rests: it ignites from
// its base, flickers for five seconds with sparks lifting off, and settles still (DESIGN.md › Motion: nothing loops).
// One driver runs 0 → 1 and stops; every layer is a function of it. It plays on arriving at the screen and again on a
// tap; Reduce Motion shows it at rest.
import * as React from "react";
import { Pressable, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, RadialGradient, Stop, Circle } from "react-native-svg";
import { useIsFocused } from "expo-router";
import { haptic } from "@/ui/motion/haptics";
import { reduceMotionNow } from "@/ui/motion/system";
import type { FlameTier } from "./tiers";

/** The whole arrival, settle included. */
const RUN_MS = 5000;
/** Where in the run the flame starts settling. */
const SETTLE_AT = 0.72;

// The three tongues, in a 100 × 130 box with the base at the bottom.
const OUTER =
  "M50 2 C56 22 70 30 78 46 C82 40 82 34 80 28 C92 42 96 62 92 80 C88 104 72 122 50 126 C28 122 12 104 8 80 C5 62 12 46 22 36 C22 44 25 50 30 54 C30 34 40 18 50 2 Z";
const MIDDLE = "M50 34 C55 50 68 58 72 76 C76 96 66 114 50 118 C34 114 24 98 28 80 C30 70 36 64 40 58 C41 64 43 68 46 70 C45 58 46 46 50 34 Z";
const CORE = "M50 70 C54 80 62 86 62 98 C62 110 57 118 50 119 C43 118 38 110 38 99 C38 90 44 84 50 70 Z";

const clamp01 = (v: number) => {
  "worklet";
  return v < 0 ? 0 : v > 1 ? 1 : v;
};
const restOf = (t: number) => {
  "worklet";
  return clamp01((t - SETTLE_AT) / (1 - SETTLE_AT));
};
/** Quick at first, then easing in: the ignition. */
const glide = (t: number) => {
  "worklet";
  return 1 - (1 - t) ** 3;
};

/** Each tongue's flicker: how far it stretches, sways and leans, and its own rate, so the three never move together. */
const LAYERS = [
  { d: OUTER, stretch: 0.045, sway: 0.03, lean: 2.5, rate: 6.3, phase: 0, delay: 0 },
  { d: MIDDLE, stretch: 0.07, sway: 0.045, lean: 3.5, rate: 8.1, phase: 1.7, delay: 0.03 },
  { d: CORE, stretch: 0.1, sway: 0.06, lean: 4, rate: 10.4, phase: 3.1, delay: 0.06 },
] as const;

/** Sparks: when each lifts off (share of the run), how far it drifts sideways, and its size. */
const SPARKS = [
  { at: 0.12, dx: -14, r: 2.2 },
  { at: 0.26, dx: 10, r: 1.6 },
  { at: 0.38, dx: -6, r: 2 },
  { at: 0.5, dx: 16, r: 1.4 },
  { at: 0.6, dx: -18, r: 1.8 },
] as const;
const SPARK_LIFE = 0.3;

function useRun(): [SharedValue<number>, () => void] {
  const t = useSharedValue(1);
  const focused = useIsFocused();
  const play = React.useCallback(() => {
    if (reduceMotionNow()) {
      t.set(1);
      return;
    }
    t.set(0);
    t.set(withTiming(1, { duration: RUN_MS, easing: Easing.linear }));
  }, [t]);
  React.useEffect(() => {
    if (!focused) return;
    play();
    return () => cancelAnimation(t);
  }, [focused, play, t]);
  return [t, play];
}

/** One tongue, filled with its colour top to bottom (a pair) or one colour; each Svg keeps its own gradient. */
function Tongue({ i, run, size, fill, id }: { i: number; run: SharedValue<number>; size: { w: number; h: number }; fill: string | readonly [string, string]; id: string }) {
  const l = LAYERS[i];
  const style = useAnimatedStyle(() => {
    const t = run.value;
    const ignite = glide(clamp01((t - l.delay) / 0.16));
    const a = 1 - restOf(t);
    const w = t * Math.PI * 2;
    return {
      opacity: clamp01(ignite * 1.4),
      transform: [
        { scaleY: ignite * (1 + l.stretch * a * Math.sin(w * l.rate + l.phase)) },
        { scaleX: (0.6 + 0.4 * ignite) * (1 + l.sway * a * Math.sin(w * (l.rate * 0.8) + l.phase + 1)) },
        { skewX: `${l.lean * a * Math.sin(w * (l.rate * 0.45) + l.phase)}deg` },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, bottom: 0, width: size.w, height: size.h, transformOrigin: "50% 100%" }, style]}>
      <Svg width={size.w} height={size.h} viewBox="0 0 100 130">
        {typeof fill !== "string" && (
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={fill[0]} />
              <Stop offset="1" stopColor={fill[1]} />
            </LinearGradient>
          </Defs>
        )}
        <Path d={l.d} fill={typeof fill === "string" ? fill : `url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

function Spark({ k, run, size, color }: { k: number; run: SharedValue<number>; size: { w: number; h: number }; color: string }) {
  const s = SPARKS[k];
  const style = useAnimatedStyle(() => {
    const p = clamp01((run.value - s.at) / SPARK_LIFE);
    const live = p > 0 && p < 1;
    return {
      opacity: live ? Math.sin(Math.PI * p) : 0,
      transform: [{ translateX: s.dx * p + 3 * Math.sin(p * 9 + k) }, { translateY: -size.h * 0.55 * p }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: size.w / 2 - s.r, top: size.h * 0.32, width: s.r * 2, height: s.r * 2, borderRadius: s.r, backgroundColor: color }, style]}
    />
  );
}

/**
 * The flame in a `box` px square (the hero's ring size, so the lead card is the same height as every tab's). Tapping
 * it lights it again.
 */
export function Flame({ tier, box, accessibilityLabel }: { tier: FlameTier; box: number; accessibilityLabel: string }) {
  const [run, play] = useRun();
  const id = React.useId().replace(/:/g, "");
  const size = { w: box * 0.62, h: box * 0.8 };
  const glow = useAnimatedStyle(() => {
    const t = run.value;
    const ignite = glide(clamp01(t / 0.2));
    const a = 1 - restOf(t);
    return { opacity: ignite * (0.55 + 0.2 * a * Math.sin(t * Math.PI * 2 * 4.2)), transform: [{ scale: 0.85 + 0.15 * ignite }] };
  });
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        play();
      }}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Lights the flame again"
      style={{ width: box, height: box, alignItems: "center", justifyContent: "flex-end" }}
    >
      {/* The glow behind, in the flame's base colour, fading to nothing at its edge. */}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", width: box, height: box, top: box * 0.06 }, glow]}>
        <Svg width={box} height={box}>
          <Defs>
            <RadialGradient id={`g${id}`} cx="50%" cy="58%" r="50%">
              <Stop offset="0" stopColor={tier.outer[1]} stopOpacity={0.45} />
              <Stop offset="1" stopColor={tier.outer[1]} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={box / 2} cy={box / 2} r={box / 2} fill={`url(#g${id})`} />
        </Svg>
      </Animated.View>
      <View pointerEvents="none" style={{ width: size.w, height: size.h, marginBottom: box * 0.04 }}>
        <Tongue i={0} run={run} size={size} fill={tier.outer} id={`o${id}`} />
        <Tongue i={1} run={run} size={size} fill={tier.middle} id={`m${id}`} />
        <Tongue i={2} run={run} size={size} fill={tier.core} id={`c${id}`} />
        {SPARKS.map((_, k) => (
          <Spark key={k} k={k} run={run} size={size} color={tier.middle[0]} />
        ))}
      </View>
    </Pressable>
  );
}

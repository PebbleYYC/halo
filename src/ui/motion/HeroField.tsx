// The field inside a hero ring: Sleep's sky and Activity's waves. It comes up as the ring draws, moves for five
// seconds and settles — the same arrival the Halo Age orb has (DESIGN.md › Motion: "It swirls in, moves for 5
// seconds, then rests"), so Sleep, Activity and Health read as one app.
//
// Sleep: three layers of stars turning and drifting at their own rates (the parallax is what gives the hole depth),
// brighter ones twinkling, and a shooting star crossing twice. Activity: three waves travelling across each other,
// kicked off by one pulse going out, their height rising and then falling back to a low trace.
//
// Nothing loops. One driver runs 0 → 1 over the five seconds and stops; every layer is a function of it, and past
// four seconds each eases to its resting state. It plays when you arrive at the screen; Reduce motion shows the rest
// at once.
import * as React from "react";
import { View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useIsFocused } from "expo-router";
import { reduceMotionNow } from "./system";
import { LAYER_DRIFT, LAYER_TURN, starField, STAR_LAYERS, WAVE_STEPS, WAVES, type Star, type Wave } from "./field";

/** How long the whole arrival takes, settle included. */
export const FIELD_MS = 5000;
/** Where in that run the field starts settling. */
const SETTLE_AT = 0.76;

const AnimatedPath = Animated.createAnimatedComponent(Path);

const clamp01 = (v: number) => {
  "worklet";
  return v < 0 ? 0 : v > 1 ? 1 : v;
};

/** How far the field has settled: 0 while it moves, 1 at rest. */
const restOf = (t: number) => {
  "worklet";
  return clamp01((t - SETTLE_AT) / (1 - SETTLE_AT));
};

/** Fast at first, then slowing: what a turn or a drift follows, so the field eases to a stop instead of cutting out. */
const glide = (t: number) => {
  "worklet";
  return 1 - (1 - t) ** 3;
};

/** The run: 0 on arrival at the screen, 1 once it has settled. Coming back to the screen plays it again. */
function useFieldRun(): SharedValue<number> {
  const t = useSharedValue(1);
  const focused = useIsFocused();
  React.useEffect(() => {
    if (!focused || reduceMotionNow()) return;
    t.set(0);
    t.set(withTiming(1, { duration: FIELD_MS, easing: Easing.linear }));
    return () => cancelAnimation(t);
  }, [focused, t]);
  return t;
}

/** One layer of the sky: it turns and drifts as a whole, which is what reads as depth. */
function StarLayer({ layer, stars, run, color, size }: { layer: number; stars: Star[]; run: SharedValue<number>; color: string; size: number }) {
  const style = useAnimatedStyle(() => {
    const t = run.value;
    const g = glide(t);
    return { transform: [{ rotate: `${LAYER_TURN[layer] * g}deg` }, { translateY: LAYER_DRIFT[layer] * (g - 0.5) }, { scale: 0.94 + 0.06 * clamp01(t / 0.18) }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", width: size, height: size }, style]}>
      {stars.map((s, i) => (
        <StarDot key={i} star={s} run={run} color={color} size={size} />
      ))}
    </Animated.View>
  );
}

function StarDot({ star, run, color, size }: { star: Star; run: SharedValue<number>; color: string; size: number }) {
  const style = useAnimatedStyle(() => {
    const t = run.value;
    const rest = restOf(t);
    // Each star arrives in its own moment over the first second, twinkles while the field moves, and keeps most of
    // its brightness at rest.
    const up = clamp01((t - star.phase * 0.022) / 0.1);
    const twinkle = 1 - 0.5 * (1 - rest) * (0.5 + 0.5 * Math.sin(t * star.freq * 16 + star.phase));
    return { opacity: star.base * up * twinkle * (1 - 0.35 * rest) };
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

/** A streak crossing the sky: twice inside the run, each time in and out, and gone by the settle. */
function ShootingStar({ at, run, color, size }: { at: number; run: SharedValue<number>; color: string; size: number }) {
  const len = size * 0.34;
  const style = useAnimatedStyle(() => {
    const p = clamp01((run.value - at) / 0.2);
    const travel = size * 0.9;
    return {
      opacity: p > 0 && p < 1 ? 0.75 * Math.sin(Math.PI * p) : 0,
      transform: [{ translateX: -travel / 2 + travel * p }, { translateY: -size * 0.16 + size * 0.3 * p }, { rotate: "22deg" }, { scaleX: 0.4 + 0.6 * Math.sin(Math.PI * p) }],
    };
  });
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", width: len, height: 1.6, borderRadius: 1, backgroundColor: color }, style]} />;
}

/** The kick: one pulse going out as the waves start, gone before they reach their height. */
function Kick({ run, color, size }: { run: SharedValue<number>; color: string; size: number }) {
  const style = useAnimatedStyle(() => {
    const p = clamp01(run.value / 0.26);
    return { opacity: 0.5 * Math.sin(Math.PI * p) * (p < 1 ? 1 : 0), transform: [{ scale: 0.2 + 0.85 * p }] };
  });
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color }, style]} />;
}

/** One wave of the trace, its points built fresh each frame on the UI thread (as the rings' arcs are). */
function WaveLine({ wave, run, color, size }: { wave: Wave; run: SharedValue<number>; color: string; size: number }) {
  const props = useAnimatedProps(() => {
    const t = run.value;
    const rest = restOf(t);
    const up = clamp01(t / 0.12);
    // Up to full height over the first half, then back to a low trace: the line never stops moving mid-crest.
    const height = size * 0.3 * wave.amp * up * (1 - 0.74 * rest);
    const span = size * 0.88;
    const x0 = (size - span) / 2;
    let d = "";
    for (let i = 0; i <= WAVE_STEPS; i++) {
      const u = i / WAVE_STEPS;
      const x = x0 + span * u;
      // Tapered at both ends so the line fades into the ring instead of being cut off by it.
      const taper = Math.sin(Math.PI * u) ** 0.7;
      const y = size / 2 + Math.sin(u * wave.cycles * Math.PI * 2 + wave.phase + t * wave.speed * Math.PI * 2) * height * taper;
      d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return { d, strokeOpacity: wave.opacity * up * (1 - 0.55 * rest) };
  });
  return <AnimatedPath animatedProps={props} stroke={color} strokeWidth={wave.width} strokeLinecap="round" fill="none" />;
}

export type HeroFieldProps = {
  /** Sleep's sky, or Activity's waves. */
  kind: "stars" | "wave";
  /** The ring's hole, in px: the field fills it. */
  size: number;
  color: string;
};

export function HeroField({ kind, size, color }: HeroFieldProps) {
  const run = useFieldRun();
  const stars = React.useMemo(() => (kind === "stars" ? starField(size) : []), [kind, size]);
  const layers = React.useMemo(() => [...Array(STAR_LAYERS)].map((_, l) => stars.filter((s) => s.layer === l)), [stars]);
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      {kind === "stars" ? (
        <>
          {layers.map((ls, l) => (
            <StarLayer key={l} layer={l} stars={ls} run={run} color={color} size={size} />
          ))}
          <ShootingStar at={0.16} run={run} color={color} size={size} />
          <ShootingStar at={0.52} run={run} color={color} size={size} />
        </>
      ) : (
        <>
          <Kick run={run} color={color} size={size} />
          <Svg width={size} height={size} style={{ position: "absolute" }}>
            {WAVES.map((w, i) => (
              <WaveLine key={i} wave={w} run={run} color={color} size={size} />
            ))}
          </Svg>
        </>
      )}
    </View>
  );
}

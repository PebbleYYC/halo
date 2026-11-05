// An icon per exercise type (mobile), as Fitbit gives each of its exercises its own. Lucide's glyphs where it has one
// (bike, dumbbell, volleyball, rugby ball, mountain, fist…); the sports it lacks (basketball, soccer, tennis, swimming,
// yoga, hockey, golf, running, skating, stairs) are drawn here on Lucide's grid (24 px, 2 px round strokes), so they sit
// with the rest. Original drawings, not Fitbit's artwork.
import * as React from "react";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";
import {
  Accessibility,
  Activity,
  Bike,
  BicepsFlexed,
  Disc,
  Dumbbell,
  Fish,
  Flame,
  Footprints,
  HandFist,
  Mountain,
  MountainSnow,
  Music,
  RugbyBall,
  Sailboat,
  Snowflake,
  Swords,
  Timer,
  Trophy,
  Volleyball,
  WavesLadder,
  Wind,
} from "lucide-react-native";

/** What every activity icon takes: Lucide's own props. */
export type GlyphProps = { size?: number; color?: string; strokeWidth?: number };
export type Glyph = React.ComponentType<GlyphProps>;

function draw(name: string, body: React.ReactNode): Glyph {
  function G({ size = 24, color = "currentColor", strokeWidth = 2 }: GlyphProps) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {body}
      </Svg>
    );
  }
  G.displayName = name;
  return G;
}

export const Basketball = draw("Basketball", [
  <Circle key="o" cx={12} cy={12} r={10} />,
  <Path key="v" d="M12 2v20" />,
  <Path key="h" d="M2 12h20" />,
  <Path key="l" d="M5.3 4.6a10 10 0 0 1 0 14.8" />,
  <Path key="r" d="M18.7 4.6a10 10 0 0 0 0 14.8" />,
]);

export const SoccerBall = draw("SoccerBall", [
  <Circle key="o" cx={12} cy={12} r={10} />,
  <Path key="p" d="m12 7 4.3 3.1-1.6 5H9.3l-1.6-5Z" />,
  <Path key="s" d="M12 7V2.5M16.3 10.1l4.5-1.5M14.7 15.1l2.7 3.9M9.3 15.1l-2.7 3.9M7.7 10.1 3.2 8.6" />,
]);

export const Baseball = draw("Baseball", [
  <Circle key="o" cx={12} cy={12} r={10} />,
  <Path key="l" d="M6.5 3.7c2.4 2.3 3.1 5 3.1 8.3s-.7 6-3.1 8.3" />,
  <Path key="r" d="M17.5 3.7c-2.4 2.3-3.1 5-3.1 8.3s.7 6 3.1 8.3" />,
  <Path key="t" d="M8.3 7.5l1.6-.6M9.3 11.2h1.6M8.3 16.5l1.6.6M15.7 7.5l-1.6-.6M14.7 11.2h-1.6M15.7 16.5l-1.6.6" />,
]);

export const Racket = draw("Racket", [
  <Ellipse key="h" cx={9} cy={9} rx={6.5} ry={4.8} transform="rotate(45 9 9)" />,
  <Path key="s" d="M5.2 5.2l7.6 7.6M5.6 9.8l4.2-4.2M8.2 12.4l4.2-4.2" />,
  <Path key="g" d="m13.6 13.6 6.9 6.9" />,
  <Circle key="b" cx={19} cy={5} r={2} />,
]);

export const Broom = draw("Broom", [
  <Path key="h" d="M21 3l-9 9" />,
  <Path key="b" d="m9.8 9.8 4.4 4.4" />,
  <Path key="w" d="M10.6 10.6 3.4 13.3l7.3 7.3 2.7-7.2" />,
  <Path key="t" d="M12 12 7 17M11.2 11.2 5.2 15.2M12.8 12.8 8.8 18.8" />,
]);

export const Rake = draw("Rake", [
  <Path key="h" d="M21 3 10.5 13.5" />,
  <Path key="b" d="m6 10 8 8" />,
  <Path key="t" d="M6 10 3.5 12.5M8 12l-2.5 2.5M10 14l-2.5 2.5M12 16l-2.5 2.5M14 18l-2.5 2.5" />,
]);

export const Swimmer = draw("Swimmer", [
  <Circle key="h" cx={17} cy={7} r={2} />,
  <Path key="b" d="m3 13 5-4 3.5 2.5L14 10" />,
  <Path key="w1" d="M2 17c1.7 0 1.7-1.2 3.3-1.2s1.7 1.2 3.4 1.2 1.6-1.2 3.3-1.2 1.7 1.2 3.3 1.2 1.7-1.2 3.4-1.2S20.3 17 22 17" />,
  <Path key="w2" d="M2 21c1.7 0 1.7-1.2 3.3-1.2s1.7 1.2 3.4 1.2 1.6-1.2 3.3-1.2 1.7 1.2 3.3 1.2 1.7-1.2 3.4-1.2S20.3 21 22 21" />,
]);

export const Yoga = draw("Yoga", [
  <Circle key="h" cx={12} cy={4.5} r={2} />,
  <Path key="b" d="M12 7.5V14" />,
  <Path key="a" d="m5 8.5 7 2.5 7-2.5" />,
  <Path key="l" d="M4 19c2.5-2.6 5-4 8-4s5.5 1.4 8 4" />,
  <Path key="f" d="M8.5 19.5h7" />,
]);

export const Runner = draw("Runner", [
  <Circle key="h" cx={15.5} cy={4} r={2} />,
  <Path key="t" d="M13 7.5 11 13l3.5 3v5" />,
  <Path key="l" d="m11 13-2.5 4H4.5" />,
  <Path key="a" d="m7 10 4.5-2.5 3 2.5 3.5.5" />,
]);

export const HockeyStick = draw("HockeyStick", [
  <Path key="s" d="m6 2 7.2 14.4a2 2 0 0 0 1.8 1.1H21" />,
  <Ellipse key="p" cx={6.5} cy={19} rx={3.5} ry={1.5} />,
]);

export const GolfFlag = draw("GolfFlag", [
  <Path key="p" d="M12 18V2.5l7 3.5-7 3.5" />,
  <Ellipse key="g" cx={12} cy={19} rx={8} ry={2.5} />,
]);

export const Skate = draw("Skate", [
  <Path key="b" d="M5 3h5v7l6.2 2.4A3 3 0 0 1 18 15.2V17H5Z" />,
  <Path key="r" d="M3 21h18" />,
  <Path key="s" d="M7 17v4M16 17v4" />,
]);

export const Stairs = draw("Stairs", [<Path key="s" d="M3 21h5v-5h5v-5h5V6h3" />]);

/** Health Connect's exercise types, by the closest picture. */
const BY_TYPE: Record<string, Glyph> = {
  RUNNING: Runner,
  RUNNING_TREADMILL: Runner,
  WALKING: Footprints,
  HIKING: Mountain,
  ROCK_CLIMBING: Mountain,
  BIKING: Bike,
  BIKING_STATIONARY: Bike,
  WEIGHTLIFTING: Dumbbell,
  BENCH_PRESS: Dumbbell,
  BARBELL_SHOULDER_PRESS: Dumbbell,
  DEADLIFT: Dumbbell,
  DUMBBELL_CURL_LEFT_ARM: Dumbbell,
  DUMBBELL_CURL_RIGHT_ARM: Dumbbell,
  DUMBBELL_FRONT_RAISE: Dumbbell,
  DUMBBELL_LATERAL_RAISE: Dumbbell,
  DUMBBELL_TRICEPS_EXTENSION_LEFT_ARM: Dumbbell,
  DUMBBELL_TRICEPS_EXTENSION_RIGHT_ARM: Dumbbell,
  DUMBBELL_TRICEPS_EXTENSION_TWO_ARM: Dumbbell,
  LAT_PULL_DOWN: Dumbbell,
  STRENGTH_TRAINING: BicepsFlexed,
  CALISTHENICS: BicepsFlexed,
  BURPEE: BicepsFlexed,
  CRUNCH: BicepsFlexed,
  PLANK: BicepsFlexed,
  SQUAT: BicepsFlexed,
  LUNGE: BicepsFlexed,
  JUMPING_JACK: BicepsFlexed,
  JUMP_ROPE: BicepsFlexed,
  BACK_EXTENSION: BicepsFlexed,
  BENCH_SIT_UP: BicepsFlexed,
  FORWARD_TWIST: BicepsFlexed,
  UPPER_TWIST: BicepsFlexed,
  HIGH_INTENSITY_INTERVAL_TRAINING: Timer,
  BOOT_CAMP: Flame,
  EXERCISE_CLASS: Activity,
  ELLIPTICAL: Activity,
  STAIR_CLIMBING: Stairs,
  STAIR_CLIMBING_MACHINE: Stairs,
  ROWING: Sailboat,
  ROWING_MACHINE: Sailboat,
  PADDLING: Sailboat,
  SAILING: Sailboat,
  SURFING: Sailboat,
  SWIMMING_POOL: Swimmer,
  SWIMMING_OPEN_WATER: Swimmer,
  WATER_POLO: WavesLadder,
  SCUBA_DIVING: Fish,
  YOGA: Yoga,
  PILATES: Yoga,
  STRETCHING: Yoga,
  GUIDED_BREATHING: Wind,
  DANCING: Music,
  MARTIAL_ARTS: HandFist,
  BOXING: HandFist,
  FENCING: Swords,
  BASKETBALL: Basketball,
  SOCCER: SoccerBall,
  VOLLEYBALL: Volleyball,
  HANDBALL: Volleyball,
  FOOTBALL_AMERICAN: RugbyBall,
  FOOTBALL_AUSTRALIAN: RugbyBall,
  RUGBY: RugbyBall,
  BASEBALL: Baseball,
  SOFTBALL: Baseball,
  CRICKET: Baseball,
  TENNIS: Racket,
  TABLE_TENNIS: Racket,
  SQUASH: Racket,
  RACQUETBALL: Racket,
  BADMINTON: Racket,
  GOLF: GolfFlag,
  ICE_HOCKEY: HockeyStick,
  ROLLER_HOCKEY: HockeyStick,
  ICE_SKATING: Skate,
  SKATING: Skate,
  SKIING: MountainSnow,
  SNOWBOARDING: MountainSnow,
  SNOWSHOEING: Snowflake,
  PARAGLIDING: Wind,
  FRISBEE_DISC: Disc,
  WHEELCHAIR: Accessibility,
  GYMNASTICS: Trophy,
};

/**
 * Activities Health Connect has no type for, which Fitbit sends as a general workout under their name: picked by the
 * name. The type's own icon wins when there is one.
 */
const BY_NAME: [RegExp, Glyph][] = [
  [/house ?work|clean|chores|vacuum|mop/i, Broom],
  [/yard ?work|garden|mow|lawn|rak(e|ing)|leaves|shovel/i, Rake],
  [/tennis|squash|racquet|pickleball|badminton|padel/i, Racket],
];

/** The icon for a workout (its exercise type, else its name); null when neither has one (the kind's icon then). */
export function glyphForType(type: string | null | undefined, name?: string | null): Glyph | null {
  const own = type ? BY_TYPE[type] : undefined;
  if (own) return own;
  if (name) for (const [re, g] of BY_NAME) if (re.test(name)) return g;
  return null;
}

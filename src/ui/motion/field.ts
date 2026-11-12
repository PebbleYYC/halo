// What a hero ring's field is made of (HeroField.tsx): Sleep's sky and Activity's waves. Pure, so the look is fixed
// from one render to the next and can be tested; the motion itself lives in the component.

export type Star = {
  /** Offset from the middle of the hole, in px. */
  x: number;
  y: number;
  /** Diameter in px, and the opacity it rests at. */
  d: number;
  base: number;
  /** Its own twinkle: how fast, and where in the cycle it starts. */
  freq: number;
  phase: number;
  /** 0 farthest, 2 nearest: the layer it turns and drifts with. */
  layer: number;
};

export const STAR_LAYERS = 3;
export const STAR_COUNT = 34;

/**
 * A sky over a disc of `size`, clear of the middle band where the number sits, in three layers: the far ones small
 * and dim, the near ones larger and brighter, so turning the layers at different rates gives the field depth. The
 * sequence is fixed (a small LCG from one seed), so a screen redraws the same sky rather than a new one each time.
 */
export function starField(size: number, count = STAR_COUNT): Star[] {
  const r = size / 2;
  const out: Star[] = [];
  let s = 0x9e3779b9;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let guard = 0; out.length < count && guard < count * 20; guard++) {
    const a = rand() * Math.PI * 2;
    // Square-rooted radius spreads them over the disc instead of crowding the middle.
    const rad = Math.sqrt(rand()) * r * 0.95;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    const layer = out.length % STAR_LAYERS;
    const near = layer / (STAR_LAYERS - 1);
    const d = 1 + near * 1.6 + rand() * (0.7 + near);
    const base = 0.3 + near * 0.3 + rand() * 0.34;
    const freq = 1.1 + rand() * 2.2;
    const phase = rand() * Math.PI * 2;
    // The number's own space: a star there would sit under a digit.
    if (Math.abs(y) < r * 0.23 && Math.abs(x) < r * 0.56) continue;
    out.push({ x, y, d, base, freq, phase, layer });
  }
  return out;
}

/** How far each layer turns over the run, in degrees, and how far it drifts: the near ones move most. */
export const LAYER_TURN = [3, 7, 13] as const;
export const LAYER_DRIFT = [1.5, 3, 5] as const;

export type Wave = {
  /** Wavelengths across the hole, how fast the crest travels, where it starts, its height and its opacity. */
  cycles: number;
  speed: number;
  phase: number;
  amp: number;
  opacity: number;
  width: number;
};

/** Activity's trace: three waves crossing at their own rates, so the line never repeats itself inside the run. */
export const WAVES: readonly Wave[] = [
  { cycles: 1.6, speed: 2.1, phase: 0, amp: 1, opacity: 0.85, width: 2.5 },
  { cycles: 2.7, speed: -1.4, phase: 1.9, amp: 0.62, opacity: 0.5, width: 2 },
  { cycles: 4.1, speed: 3.2, phase: 3.6, amp: 0.34, opacity: 0.32, width: 1.5 },
];

/** How many points a wave is drawn from: enough for a smooth line, few enough to build every frame. */
export const WAVE_STEPS = 26;

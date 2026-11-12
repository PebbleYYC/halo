// The layout behind a hero ring's field (HeroField.tsx): where Sleep's stars sit. Pure, so the look is the same on
// every render and can be tested; the motion itself lives in the component.

export type Star = {
  /** Offset from the middle of the hole, in px. */
  x: number;
  y: number;
  /** Diameter in px, and the opacity the star rests at. */
  d: number;
  base: number;
  /** Its own twinkle: how fast, and where in the cycle it starts. */
  freq: number;
  phase: number;
};

export const STAR_COUNT = 16;

/**
 * Stars scattered over a disc of `size`, clear of the middle band where the number sits. The sequence is fixed (a
 * small LCG from one seed), so a screen redraws the same sky rather than a new one each time.
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
    // Square-rooted radius spreads them evenly over the disc instead of crowding the middle.
    const rad = Math.sqrt(rand()) * r * 0.93;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    const d = 1 + rand() * 1.8;
    const base = 0.3 + rand() * 0.45;
    const freq = 1.1 + rand() * 1.9;
    const phase = rand() * Math.PI * 2;
    // The number's own space: a star there would sit under a digit.
    if (Math.abs(y) < r * 0.24 && Math.abs(x) < r * 0.58) continue;
    out.push({ x, y, d, base, freq, phase });
  }
  return out;
}

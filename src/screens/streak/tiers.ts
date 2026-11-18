// The flame's colour by how long the streak has run: it burns hotter as the run grows, from an orange spark to a
// white-blue blaze. Each colour is reached at a milestone (src/queries/streak.ts), so a colour change is something to
// work toward, and the page says when the next one comes. Pure, so the steps are tested.

export type FlameTier = {
  /** The first streak length in this colour. */
  from: number;
  /** What the colour is called, for "Turns violet at 100 days". */
  name: string;
  /** The outer flame top to bottom, the middle one top to bottom, and the core. */
  outer: [string, string];
  middle: [string, string];
  core: string;
  /** The page's own accent in this tier: calendar bands, milestones. */
  accent: string;
};

export const FLAME_TIERS: readonly FlameTier[] = [
  { from: 0, name: "orange", outer: ["#ffb547", "#ff6a1a"], middle: ["#ffd76a", "#ff9a1f"], core: "#fff4cc", accent: "#ff8a1f" },
  { from: 7, name: "red", outer: ["#ff7a4d", "#ff2d3c"], middle: ["#ffb36b", "#ff5a36"], core: "#ffe8c2", accent: "#ff4b3a" },
  { from: 30, name: "rose", outer: ["#ff6a9a", "#e0245e"], middle: ["#ff9ec0", "#ff4f86"], core: "#ffe3f0", accent: "#f2467c" },
  { from: 100, name: "violet", outer: ["#b07cff", "#6e3df5"], middle: ["#d4b5ff", "#9b6bff"], core: "#f1e8ff", accent: "#8c5cff" },
  { from: 365, name: "blue", outer: ["#7fd3ff", "#3b6dff"], middle: ["#b8ecff", "#5aa9ff"], core: "#eefaff", accent: "#4c8dff" },
  { from: 1000, name: "white-blue", outer: ["#a9f4ff", "#2aa6d9"], middle: ["#e2fdff", "#7fe0f0"], core: "#ffffff", accent: "#35b8e0" },
];

/** The colour a streak of `days` burns in. */
export function flameTier(days: number): FlameTier {
  let t = FLAME_TIERS[0];
  for (const x of FLAME_TIERS) if (days >= x.from) t = x;
  return t;
}

/** The next colour up, or null in the last one. */
export function nextTier(days: number): FlameTier | null {
  return FLAME_TIERS.find((x) => x.from > days) ?? null;
}

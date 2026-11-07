// Wall-clock strings ("YYYY-MM-DD HH:mm") for the journal's time steppers: pure, so they test without the native modules.
const WALL = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Minutes since the epoch of a wall-clock string read as if it were UTC: only differences between two are used. */
export function wallMinutes(at: string): number | null {
  const m = WALL.exec(at.trim());
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60_000 : null;
}

export function wallOf(minutes: number): string {
  const d = new Date(minutes * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** "Today", "Yesterday" or "Nov 3", against `now` (both wall-clock strings). */
export function dayWord(at: string, now: string): string {
  const a = wallMinutes(`${at.slice(0, 10)} 00:00`);
  const b = wallMinutes(`${now.slice(0, 10)} 00:00`);
  if (a === null || b === null) return at.slice(0, 10);
  const back = Math.round((b - a) / 1440);
  return back === 0 ? "Today" : back === 1 ? "Yesterday" : `${MONTHS[+at.slice(5, 7) - 1]} ${+at.slice(8, 10)}`;
}

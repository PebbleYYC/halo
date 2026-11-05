// Edits to imported workouts (mobile): kept apart from the imported rows, keyed by the workout's id, so a re-import
// (which rewrites `exercises`) never undoes them. Every reader gets the edited workouts through `applyExerciseEdits`;
// a deleted one is left out everywhere (scores, lists, charts).
import type { Exercise } from "./types";

export type ExerciseEdit = {
  id: string;
  /** Health Connect exercise type name ("WEIGHTLIFTING"); null keeps the imported one. */
  type: string | null;
  /** The workout's name ("Weights"); null keeps the imported one. */
  name: string | null;
  startTs: number | null;
  endTs: number | null;
  /** The local day of the edited start (the store doesn't know the time zone). */
  day: string | null;
  deleted: boolean;
};

export function applyExerciseEdits(rows: Exercise[], edits: ExerciseEdit[]): Exercise[] {
  if (!edits.length) return rows;
  const byId = new Map(edits.map((e) => [e.id, e]));
  const out: Exercise[] = [];
  for (const r of rows) {
    const e = byId.get(r.id);
    if (!e) {
      out.push(r);
      continue;
    }
    if (e.deleted) continue;
    out.push({ ...r, type: e.type ?? r.type, name: e.name ?? r.name, startTs: e.startTs ?? r.startTs, endTs: e.endTs ?? r.endTs, day: e.day ?? r.day, edited: true });
  }
  return out.sort((a, b) => a.startTs - b.startTs || a.id.localeCompare(b.id));
}

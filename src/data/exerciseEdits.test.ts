import { describe, expect, it } from "vitest";
import { MemoryStore } from "./memory";
import type { Exercise } from "./types";

const ex = (id: string, startTs: number, over: Partial<Exercise> = {}): Exercise => ({ id, day: "2026-11-04", startTs, endTs: startTs + 3600, type: "OTHER_WORKOUT", name: null, calories: null, distanceM: null, ...over });

describe("exercise edits", () => {
  it("apply over imports, survive a re-import, hide deleted workouts and clear back to the import", async () => {
    const store = new MemoryStore();
    await store.upsertExercises([ex("a", 1000), ex("b", 9000)]);
    await store.setExerciseEdit({ id: "a", type: "ICE_HOCKEY", name: "Hockey", startTs: 20_000, endTs: 24_000, day: "2026-11-04", deleted: false });
    await store.setExerciseEdit({ id: "b", type: null, name: null, startTs: null, endTs: null, day: null, deleted: true });
    // A sync rewrites the imported rows; the edits stay on top.
    await store.upsertExercises([ex("a", 1000, { calories: 300 }), ex("b", 9000)]);
    const all = await store.allExercises();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: "a", type: "ICE_HOCKEY", name: "Hockey", startTs: 20_000, endTs: 24_000, calories: 300, edited: true });
    expect(await store.allExercises({ raw: true })).toHaveLength(2);
    expect(await store.importedExercise("a")).toMatchObject({ type: "OTHER_WORKOUT", startTs: 1000 });
    await store.clearExerciseEdit("a");
    expect((await store.allExercises())[0]).toMatchObject({ id: "a", type: "OTHER_WORKOUT", startTs: 1000 });
  });
});

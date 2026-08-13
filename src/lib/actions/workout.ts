"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  coopParticipant,
  exercise,
  personalRecord,
  post,
  routine,
  routineExercise,
  routineSet,
  workout,
  workoutExercise,
  workoutSet,
  type PrKind,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { getPreviousSets, type PreviousSet } from "@/lib/queries/workout";
import { isBlobUrl } from "@/lib/blob";
import { recalculatePersonalRecords } from "@/lib/records";
import { recordsSomething, sumSetTotals } from "@/lib/workout-totals";
import { estimate1RM } from "@/lib/utils";
import { rpeValue } from "@/lib/rpe";
import { grantAchievements } from "./achievements";
import type { ActionResult } from "./user";

/* -------------------------------------------------------------------------- */
/* Guards                                                                      */
/* -------------------------------------------------------------------------- */

type Denied = { error: string };
type WorkoutGrant = {
  me: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  workout: typeof workout.$inferSelect;
};
type WorkoutExerciseGrant = WorkoutGrant & {
  we: typeof workoutExercise.$inferSelect;
};

async function ownedWorkout(
  workoutId: string,
): Promise<Denied | WorkoutGrant> {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in" };
  const [w] = await db
    .select()
    .from(workout)
    .where(and(eq(workout.id, workoutId), eq(workout.userId, me.id)))
    .limit(1);
  if (!w) return { error: "Workout not found" };
  return { me, workout: w };
}

/** The workout-exercise must belong to a workout this user owns. */
async function ownedWorkoutExercise(
  workoutExerciseId: string,
): Promise<Denied | WorkoutExerciseGrant> {
  const me = await getCurrentUser();
  if (!me) return { error: "Not signed in" };
  const [row] = await db
    .select({ we: workoutExercise, w: workout })
    .from(workoutExercise)
    .innerJoin(workout, eq(workout.id, workoutExercise.workoutId))
    .where(
      and(
        eq(workoutExercise.id, workoutExerciseId),
        eq(workout.userId, me.id),
      ),
    )
    .limit(1);
  if (!row) return { error: "Not found" };
  return { me, we: row.we, workout: row.w };
}

/* -------------------------------------------------------------------------- */
/* Starting a workout                                                          */
/* -------------------------------------------------------------------------- */

export async function startEmptyWorkout(): Promise<
  ActionResult<{ workoutId: string }>
> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const existing = await activeWorkoutId(me.id);
  if (existing) return { ok: true, data: { workoutId: existing } };

  let workoutId: string;
  try {
    const [w] = await db
      .insert(workout)
      .values({
        userId: me.id,
        name: defaultWorkoutName(),
        gymId: me.homeGymId,
      })
      .returning({ id: workout.id });
    workoutId = w.id;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Double tap: the other insert won. Hand back the workout it created
    // rather than surfacing a database error for something the user can't act on.
    const raced = await activeWorkoutId(me.id);
    if (!raced) throw err;
    workoutId = raced;
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { workoutId } };
}

/**
 * Materialise a routine into a live workout. `loadMultiplier` implements the
 * deload/overload feature: prescribed weights are scaled once, at copy time,
 * so the user sees the adjusted target rather than doing mental arithmetic.
 */
export async function startWorkoutFromRoutine(
  routineId: string,
  loadMultiplier = 1,
): Promise<ActionResult<{ workoutId: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const mult = z.number().min(0.3).max(2).catch(1).parse(loadMultiplier);

  const existing = await activeWorkoutId(me.id);
  if (existing) return { ok: false, error: "You already have a workout running" };

  const [r] = await db
    .select()
    .from(routine)
    .where(eq(routine.id, routineId))
    .limit(1);
  if (!r) return { ok: false, error: "Routine not found" };
  if (r.userId !== me.id && !r.isPublic) {
    return { ok: false, error: "That routine is private" };
  }

  let res: string;
  try {
    res = await db.transaction(async (tx) => {
      const [w] = await tx
        .insert(workout)
        .values({
          userId: me.id,
          routineId: r.id,
          name: r.name,
          gymId: me.homeGymId,
          loadMultiplier: mult,
        })
        .returning({ id: workout.id });

      // Read the whole routine in two queries, then write it in two — rather
      // than three round trips per exercise. A 50-exercise routine was ~150
      // sequential round trips inside one transaction, which is minutes of
      // connection time on a cold Neon and a real timeout risk.
      const res_ = await tx
        .select()
        .from(routineExercise)
        .where(eq(routineExercise.routineId, r.id))
        .orderBy(asc(routineExercise.position));

      if (!res_.length) return w.id;

      const rsets = await tx
        .select()
        .from(routineSet)
        .where(
          inArray(
            routineSet.routineExerciseId,
            res_.map((re) => re.id),
          ),
        )
        .orderBy(asc(routineSet.position));

      const inserted = await tx
        .insert(workoutExercise)
        .values(
          res_.map((re) => ({
            workoutId: w.id,
            exerciseId: re.exerciseId,
            position: re.position,
            notes: re.notes,
            restSeconds: re.restSeconds ?? me.defaultRestSeconds,
            supersetGroup: re.supersetGroup,
            intervalWorkSeconds: re.intervalWorkSeconds,
            intervalRestSeconds: re.intervalRestSeconds,
          })),
        )
        .returning({ id: workoutExercise.id, position: workoutExercise.position });

      // Map back by position: `returning` order isn't guaranteed, but position
      // is unique within this workout and came straight from the routine.
      const weByPosition = new Map(inserted.map((x) => [x.position, x.id]));
      const rows = rsets.flatMap((rs) => {
        const re = res_.find((x) => x.id === rs.routineExerciseId);
        const weId = re ? weByPosition.get(re.position) : undefined;
        if (!weId) return [];
        return [
          {
            workoutExerciseId: weId,
            position: rs.position,
            setType: rs.setType,
            // Scaled targets, pre-filled but not yet completed.
            weightKg:
              rs.targetWeightKg != null
                ? Math.round(rs.targetWeightKg * mult * 100) / 100
                : null,
            reps: rs.targetReps,
            seconds: rs.targetSeconds,
            distanceM: rs.targetDistanceM,
            // The prescribed effort is *not* pre-filled into `rpe`. Weight and
            // reps can be, because they land in text inputs that visibly are
            // targets you type over; RPE has no input, only the result-shaped
            // `@8` subscript, so pre-filling it there claimed the lifter had
            // rated a set they hadn't performed. It goes in its own column and
            // the row renders it as `→8`.
            rpe: null,
            targetRpe: rs.targetRpe,
            completedAt: null,
          },
        ];
      });

      if (rows.length) await tx.insert(workoutSet).values(rows);

      return w.id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "You already have a workout running" };
    }
    throw err;
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { workoutId: res } };
}

/**
 * Postgres unique-violation. `workout_one_active_idx` is a partial unique index
 * on (user_id) WHERE ended_at IS NULL, so this is what a lost check-then-insert
 * race looks like — two taps both saw "no active workout" and both inserted.
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "23505"
  );
}

async function activeWorkoutId(userId: string) {
  const [row] = await db
    .select({ id: workout.id })
    .from(workout)
    .where(and(eq(workout.userId, userId), isNull(workout.endedAt)))
    .limit(1);
  return row?.id ?? null;
}

function defaultWorkoutName() {
  const h = new Date().getHours();
  if (h < 11) return "Morning Workout";
  if (h < 17) return "Afternoon Workout";
  if (h < 22) return "Evening Workout";
  return "Night Workout";
}

/* -------------------------------------------------------------------------- */
/* Editing a live workout                                                      */
/* -------------------------------------------------------------------------- */

/** Shape the workout screen needs to render a newly added exercise. */
export type AddedExercise = {
  id: string;
  exerciseId: string;
  position: number;
  name: string;
  primaryMuscle: string;
  equipment: string;
  trackingType: string;
  restSeconds: number | null;
  setId: string;
};

/**
 * Returns the created rows rather than relying on `router.refresh()`.
 *
 * The workout screen keeps set values in local state so re-renders can't fight
 * the user's typing; a refresh therefore updates the server payload but leaves
 * that state untouched, and the new exercise never appears. Handing the rows
 * back lets the client append them directly — and keeps the rest timer, which
 * also lives in that component's state, alive.
 */
export async function addExercisesToWorkout(
  workoutId: string,
  exerciseIds: string[],
): Promise<ActionResult<{ added: AddedExercise[] }>> {
  const guard = await ownedWorkout(workoutId);
  if ("error" in guard) return { ok: false, error: guard.error };
  if (!exerciseIds.length) return { ok: true, data: { added: [] } };

  const [{ max }] = await db
    .select({ max: sql<number>`COALESCE(MAX(${workoutExercise.position}), -1)::int` })
    .from(workoutExercise)
    .where(eq(workoutExercise.workoutId, workoutId));

  const exs = await db
    .select()
    .from(exercise)
    .where(inArray(exercise.id, exerciseIds));
  const byId = new Map(exs.map((e) => [e.id, e]));

  // Keep the caller's ordering, skipping ids that don't resolve.
  const wanted = exerciseIds
    .map((id) => byId.get(id))
    .filter((e): e is NonNullable<typeof e> => e != null);
  if (!wanted.length) return { ok: true, data: { added: [] } };

  const added = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(workoutExercise)
      .values(
        wanted.map((ex, i) => ({
          workoutId,
          exerciseId: ex.id,
          position: max + 1 + i,
          restSeconds: guard.me.defaultRestSeconds,
        })),
      )
      .returning({
        id: workoutExercise.id,
        exerciseId: workoutExercise.exerciseId,
        position: workoutExercise.position,
        restSeconds: workoutExercise.restSeconds,
      });

    // Start each with one empty set so the row is immediately usable.
    const sets = await tx
      .insert(workoutSet)
      .values(
        inserted.map((we) => ({
          workoutExerciseId: we.id,
          position: 0,
          setType: "normal" as const,
        })),
      )
      .returning({
        id: workoutSet.id,
        workoutExerciseId: workoutSet.workoutExerciseId,
      });

    const setByWe = new Map(sets.map((s) => [s.workoutExerciseId, s.id]));

    return inserted.map((we) => {
      const ex = byId.get(we.exerciseId)!;
      return {
        id: we.id,
        exerciseId: we.exerciseId,
        position: we.position,
        name: ex.name,
        primaryMuscle: ex.primaryMuscle as string,
        equipment: ex.equipment as string,
        trackingType: ex.trackingType as string,
        restSeconds: we.restSeconds,
        setId: setByWe.get(we.id)!,
      };
    });
  });

  // Deliberately no revalidatePath: the client appends these directly, and a
  // refresh here would only risk clobbering in-progress local state.
  return { ok: true, data: { added } };
}

export async function removeWorkoutExercise(
  workoutExerciseId: string,
): Promise<ActionResult> {
  const guard = await ownedWorkoutExercise(workoutExerciseId);
  if ("error" in guard) return { ok: false, error: guard.error };

  await db
    .delete(workoutExercise)
    .where(eq(workoutExercise.id, workoutExerciseId));

  // No revalidate: the screen already dropped it from local state.
  return { ok: true };
}

/** What the workout screen needs to re-render a block after a swap. */
export type ReplacedExercise = {
  exerciseId: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  trackingType: string;
  /** Sets in order — same rows, emptied. */
  setIds: string[];
  previous: PreviousSet[];
};

/**
 * Swap the movement on one block, keeping its position, rest, superset letter
 * and set count.
 *
 * The logged values are cleared rather than carried over: they were performed
 * on a different exercise, and leaving them would attribute someone's pull-up
 * reps to a lat pulldown in history, in the muscle-volume split and in the
 * records computed at finish. The set *rows* survive — the user asked for
 * "3 sets of this instead", not for the block to be rebuilt — and so does the
 * exercise's own "Previous" column, which is refetched for the new movement.
 *
 * Live workouts only. A finished workout's totals are denormalised onto the
 * row at finish, so mutating its sets here would leave them describing sets
 * that no longer exist.
 */
export async function replaceWorkoutExercise(
  workoutExerciseId: string,
  exerciseId: string,
): Promise<ActionResult<ReplacedExercise>> {
  const guard = await ownedWorkoutExercise(workoutExerciseId);
  if ("error" in guard) return { ok: false, error: guard.error };
  if (guard.workout.endedAt)
    return { ok: false, error: "This workout is already finished" };

  // Scoped exactly like every picker read: built-ins plus this user's own live
  // custom entries. An archived or someone else's id resolves to nothing.
  const [target] = await db
    .select()
    .from(exercise)
    .where(
      and(
        eq(exercise.id, exerciseId),
        isNull(exercise.archivedAt),
        or(isNull(exercise.ownerId), eq(exercise.ownerId, guard.me.id)),
      ),
    )
    .limit(1);
  if (!target) return { ok: false, error: "Exercise not found" };

  const setIds = await db.transaction(async (tx) => {
    await tx
      .update(workoutExercise)
      .set({
        exerciseId: target.id,
        // Cues, seat heights and machine numbers belong to the old movement.
        notes: null,
        // Interval prescriptions are per-movement too, and a work/rest
        // countdown left running on a barbell lift is worse than no setting.
        intervalWorkSeconds: null,
        intervalRestSeconds: null,
      })
      .where(eq(workoutExercise.id, workoutExerciseId));

    await tx
      .update(workoutSet)
      .set({
        weightKg: null,
        reps: null,
        seconds: null,
        distanceM: null,
        rpe: null,
        // The prescription belonged to the movement being swapped out — an
        // effort written for a barbell squat says nothing about the machine
        // that replaced it.
        targetRpe: null,
        estimated1rm: null,
        completedAt: null,
      })
      .where(eq(workoutSet.workoutExerciseId, workoutExerciseId));

    return tx
      .select({ id: workoutSet.id })
      .from(workoutSet)
      .where(eq(workoutSet.workoutExerciseId, workoutExerciseId))
      .orderBy(asc(workoutSet.position));
  });

  // Clearing completions changes this participant's live co-op numbers.
  await bumpCoopProgress(guard.workout.id);

  const previous = await getPreviousSets(guard.me.id, guard.workout.id, [
    target.id,
  ]);

  // No revalidate, same as the rest of this section: the screen applies the
  // returned block to its own state, and a refresh would fight it.
  return {
    ok: true,
    data: {
      exerciseId: target.id,
      name: target.name,
      primaryMuscle: target.primaryMuscle,
      equipment: target.equipment,
      trackingType: target.trackingType,
      setIds: setIds.map((s) => s.id),
      previous: previous.get(target.id) ?? [],
    },
  };
}

export async function reorderWorkoutExercises(
  workoutId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const guard = await ownedWorkout(workoutId);
  if ("error" in guard) return { ok: false, error: guard.error };
  if (!orderedIds.length) return { ok: true };

  // One CASE update rather than a round trip per exercise: this runs on the
  // mid-workout hot path, where a 12-exercise session was 12 sequential
  // statements inside a transaction.
  await db.execute(sql`
    UPDATE ${workoutExercise}
    SET position = v.position
    FROM (VALUES ${sql.join(
      orderedIds.map((id, i) => sql`(${id}::uuid, ${i}::int)`),
      sql`, `,
    )}) AS v(id, position)
    WHERE ${workoutExercise.id} = v.id
      AND ${workoutExercise.workoutId} = ${workoutId}::uuid
  `);

  // No revalidate: the screen reorders locally, and refreshing this route
  // would re-render the workout page around client state it can't see.
  return { ok: true };
}

export async function addSet(
  workoutExerciseId: string,
): Promise<ActionResult<{ setId: string }>> {
  const guard = await ownedWorkoutExercise(workoutExerciseId);
  if ("error" in guard) return { ok: false, error: guard.error };

  // Carry the previous set's load forward — that's what people actually do.
  const [last] = await db
    .select()
    .from(workoutSet)
    .where(eq(workoutSet.workoutExerciseId, workoutExerciseId))
    .orderBy(sql`${workoutSet.position} DESC`)
    .limit(1);

  const [s] = await db
    .insert(workoutSet)
    .values({
      workoutExerciseId,
      position: (last?.position ?? -1) + 1,
      setType: "normal",
      weightKg: last?.weightKg ?? null,
      reps: last?.reps ?? null,
      seconds: last?.seconds ?? null,
      distanceM: last?.distanceM ?? null,
      // Not the rating: the previous set's effort is a fact about that set, and
      // copying it here would manufacture a rating for a set nobody has done.
      rpe: null,
      // The prescription does carry forward, same argument as the rest override
      // below — an appended set continues the pattern being prescribed.
      targetRpe: last?.targetRpe ?? null,
      // Including the rest override, if the previous set carried one. A set
      // appended after one pushed to 3m is the next set of that same heavy
      // pattern, not a return to the exercise's default.
      restSeconds: last?.restSeconds ?? null,
    })
    .returning({ id: workoutSet.id });

  // No revalidate: the screen appends the set from this return value.
  return { ok: true, data: { setId: s.id } };
}

export async function removeSet(setId: string): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const [row] = await db
    .select({ workoutId: workout.id, weId: workoutExercise.id })
    .from(workoutSet)
    .innerJoin(
      workoutExercise,
      eq(workoutExercise.id, workoutSet.workoutExerciseId),
    )
    .innerJoin(workout, eq(workout.id, workoutExercise.workoutId))
    .where(and(eq(workoutSet.id, setId), eq(workout.userId, me.id)))
    .limit(1);
  if (!row) return { ok: false, error: "Set not found" };

  await db.transaction(async (tx) => {
    await tx.delete(workoutSet).where(eq(workoutSet.id, setId));
    // Renumber so set indices stay 1..n with no gaps. One windowed UPDATE
    // rather than one per surviving set — this runs on the mid-workout hot
    // path, on a single tap.
    await tx.execute(sql`
      UPDATE workout_set ws
      SET position = ranked.rn
      FROM (
        SELECT id, (ROW_NUMBER() OVER (ORDER BY position) - 1) AS rn
        FROM workout_set
        WHERE workout_exercise_id = ${row.weId}::uuid
      ) ranked
      WHERE ws.id = ranked.id AND ws.position <> ranked.rn
    `);
  });

  return { ok: true };
}

const setPatchSchema = z.object({
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  reps: z.number().int().min(0).max(1000).nullable().optional(),
  seconds: z.number().int().min(0).max(86_400).nullable().optional(),
  distanceM: z.number().min(0).max(1_000_000).nullable().optional(),
  // The scale itself, not a range around it: every caller is a chip in
  // `RpePicker`, so anything off the half-point grid is a bug rather than an
  // intent worth honouring. `targetRpe` is deliberately absent — a prescription
  // is what the routine said, and nothing mid-workout gets to rewrite it.
  rpe: rpeValue.nullable().optional(),
  // Per-set rest override. Same bound as the exercise-level column; `null`
  // inherits the exercise, `0` means no rest at all.
  restSeconds: z.number().int().min(0).max(1800).nullable().optional(),
  setType: z.enum(["normal", "warmup", "drop", "failure"]).optional(),
  completed: z.boolean().optional(),
});

/**
 * Single entry point for every set mutation. Returns the fresh row so the
 * client can reconcile without a refetch — important because this fires on
 * every checkmark tap mid-workout.
 */
export async function updateSet(
  setId: string,
  patch: z.input<typeof setPatchSchema>,
): Promise<
  ActionResult<{
    setId: string;
    completedAt: string | null;
    estimated1rm: number | null;
    isPr: boolean;
  }>
> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const parsed = setPatchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Invalid set values" };

  const [row] = await db
    .select({
      set: workoutSet,
      workoutId: workout.id,
      exerciseId: workoutExercise.exerciseId,
    })
    .from(workoutSet)
    .innerJoin(
      workoutExercise,
      eq(workoutExercise.id, workoutSet.workoutExerciseId),
    )
    .innerJoin(workout, eq(workout.id, workoutExercise.workoutId))
    .where(and(eq(workoutSet.id, setId), eq(workout.userId, me.id)))
    .limit(1);
  if (!row) return { ok: false, error: "Set not found" };

  const p = parsed.data;
  const weightKg = p.weightKg !== undefined ? p.weightKg : row.set.weightKg;
  const reps = p.reps !== undefined ? p.reps : row.set.reps;

  const completedAt =
    p.completed === undefined
      ? row.set.completedAt
      : p.completed
        ? (row.set.completedAt ?? new Date())
        : null;

  const est =
    weightKg != null && reps != null ? estimate1RM(weightKg, reps) : null;

  await db
    .update(workoutSet)
    .set({
      ...(p.weightKg !== undefined ? { weightKg: p.weightKg } : {}),
      ...(p.reps !== undefined ? { reps: p.reps } : {}),
      ...(p.seconds !== undefined ? { seconds: p.seconds } : {}),
      ...(p.distanceM !== undefined ? { distanceM: p.distanceM } : {}),
      ...(p.rpe !== undefined ? { rpe: p.rpe } : {}),
      ...(p.restSeconds !== undefined ? { restSeconds: p.restSeconds } : {}),
      ...(p.setType !== undefined ? { setType: p.setType } : {}),
      completedAt,
      estimated1rm: est,
    })
    .where(eq(workoutSet.id, setId));

  // Live PR check so the badge can fire the moment the set is ticked. Warmups
  // never count. The authoritative record write still happens at finish.
  let isPr = false;
  const setType = p.setType ?? row.set.setType;
  if (completedAt && setType !== "warmup" && est) {
    const [best] = await db
      .select({ value: personalRecord.value })
      .from(personalRecord)
      .where(
        and(
          eq(personalRecord.userId, me.id),
          eq(personalRecord.exerciseId, row.exerciseId),
          eq(personalRecord.kind, "1rm"),
        ),
      )
      .limit(1);
    isPr = !best || est > best.value + 0.01;
  }

  if (p.completed !== undefined) await bumpCoopProgress(row.workoutId);

  return {
    ok: true,
    data: {
      setId,
      completedAt: completedAt ? completedAt.toISOString() : null,
      estimated1rm: est,
      isPr,
    },
  };
}

/**
 * Write the same values to several sets at once — the fill that carries a
 * typed weight or rep count down the empty sets below it.
 *
 * One call rather than one `updateSet` per row: this fires when a numeric cell
 * loses focus mid-workout, and four sequential round-trips from a phone on gym
 * wifi is the difference between instant and noticeably late.
 *
 * Deliberately narrower than `updateSet`: it never touches `completedAt` and
 * runs no PR check. A fill only ever targets sets that are empty and not
 * completed, so there is no completion to record and nothing that could set a
 * record — that stays the single-set path, which the checkmark uses.
 */
export async function updateSets(
  setIds: string[],
  patch: z.input<typeof setPatchSchema>,
): Promise<ActionResult<{ updated: number }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  // Bounded: this is a public POST endpoint like every other export here, and
  // a fill is at most a handful of sets in one exercise.
  const ids = z.array(z.string().uuid()).min(1).max(20).safeParse(setIds);
  if (!ids.success) return { ok: false, error: "Invalid set ids" };

  const parsed = setPatchSchema.omit({ completed: true }).safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Invalid set values" };
  const p = parsed.data;

  // Same ownership join as `updateSet`. Ids belonging to anyone else simply
  // don't come back, so they're never written.
  const rows = await db
    .select({ id: workoutSet.id, weightKg: workoutSet.weightKg, reps: workoutSet.reps })
    .from(workoutSet)
    .innerJoin(
      workoutExercise,
      eq(workoutExercise.id, workoutSet.workoutExerciseId),
    )
    .innerJoin(workout, eq(workout.id, workoutExercise.workoutId))
    .where(and(inArray(workoutSet.id, ids.data), eq(workout.userId, me.id)));
  if (!rows.length) return { ok: true, data: { updated: 0 } };

  const columns = {
    ...(p.weightKg !== undefined ? { weightKg: p.weightKg } : {}),
    ...(p.reps !== undefined ? { reps: p.reps } : {}),
    ...(p.seconds !== undefined ? { seconds: p.seconds } : {}),
    ...(p.distanceM !== undefined ? { distanceM: p.distanceM } : {}),
    ...(p.rpe !== undefined ? { rpe: p.rpe } : {}),
    ...(p.restSeconds !== undefined ? { restSeconds: p.restSeconds } : {}),
    ...(p.setType !== undefined ? { setType: p.setType } : {}),
  };

  // `estimated_1rm` is per row — it depends on the values the row already had
  // — but the rows being filled are near-identical, so grouping by the
  // resulting estimate collapses this to one UPDATE in the normal case.
  const byEstimate = new Map<number | null, string[]>();
  for (const r of rows) {
    const weightKg = p.weightKg !== undefined ? p.weightKg : r.weightKg;
    const reps = p.reps !== undefined ? p.reps : r.reps;
    const est = weightKg != null && reps != null ? estimate1RM(weightKg, reps) : null;
    byEstimate.set(est, [...(byEstimate.get(est) ?? []), r.id]);
  }

  for (const [estimated1rm, group] of byEstimate) {
    await db
      .update(workoutSet)
      .set({ ...columns, estimated1rm })
      .where(inArray(workoutSet.id, group));
  }

  return { ok: true, data: { updated: rows.length } };
}

export async function updateWorkoutMeta(
  workoutId: string,
  patch: { name?: string; note?: string | null; gymId?: string | null },
): Promise<ActionResult> {
  const guard = await ownedWorkout(workoutId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const schema = z.object({
    name: z.string().trim().min(1).max(80).optional(),
    note: z.string().trim().max(1000).nullable().optional(),
    gymId: z.string().uuid().nullable().optional(),
  });
  const parsed = schema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Invalid values" };

  await db.update(workout).set(parsed.data).where(eq(workout.id, workoutId));
  return { ok: true };
}

export async function updateWorkoutExerciseSettings(
  workoutExerciseId: string,
  patch: {
    restSeconds?: number | null;
    notes?: string | null;
    supersetGroup?: string | null;
    intervalWorkSeconds?: number | null;
    intervalRestSeconds?: number | null;
  },
): Promise<ActionResult> {
  const guard = await ownedWorkoutExercise(workoutExerciseId);
  if ("error" in guard) return { ok: false, error: guard.error };

  const schema = z.object({
    restSeconds: z.number().int().min(0).max(1800).nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    supersetGroup: z.string().trim().max(2).nullable().optional(),
    intervalWorkSeconds: z.number().int().min(0).max(3600).nullable().optional(),
    intervalRestSeconds: z.number().int().min(0).max(3600).nullable().optional(),
  });
  const parsed = schema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Invalid values" };

  // Rest set here means the *whole* exercise, so it clears the per-set
  // overrides underneath it. Without that, choosing 90s for an exercise where
  // set 2 had been pushed to 3m leaves that set at 3m and the setting looks
  // like it silently failed — and the two levels are indistinguishable in the
  // UI once the sheet is closed. One transaction, because a cleared override
  // with the old exercise value still in place is the wrong rest either way.
  const cascade = parsed.data.restSeconds !== undefined;

  await db.transaction(async (tx) => {
    await tx
      .update(workoutExercise)
      .set(parsed.data)
      .where(eq(workoutExercise.id, workoutExerciseId));

    if (cascade) {
      await tx
        .update(workoutSet)
        .set({ restSeconds: null })
        .where(eq(workoutSet.workoutExerciseId, workoutExerciseId));
    }
  });

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Finishing                                                                   */
/* -------------------------------------------------------------------------- */

export type FinishSummary = {
  workoutId: string;
  durationSeconds: number;
  totalVolumeKg: number;
  totalSets: number;
  totalReps: number;
  prs: { exerciseName: string; kind: PrKind; value: number; reps: number | null; weightKg: number | null }[];
  unlockedAchievements: { key: string; title: string; description: string; icon: string }[];
};

/**
 * What to do with sets the lifter planned but never ticked off.
 *
 * `delete` — they were noise; forget they existed. The historical default.
 * `complete` — the lifter did them but forgot to tick; count them for real.
 * `keep`     — they were genuinely skipped; record that the session was left
 *              unfinished rather than pretending the plan was the performance.
 */
export type UnfinishedSetsMode = "delete" | "complete" | "keep";

/**
 * Close out the workout: settle unticked sets, roll up totals, detect records,
 * grant achievements and publish to the feed. Everything the celebration
 * screen needs comes back in one payload so it can animate immediately.
 */
export async function finishWorkout(
  workoutId: string,
  opts: {
    shareToFeed?: boolean;
    caption?: string | null;
    photoUrl?: string | null;
    unfinishedSets?: UnfinishedSetsMode;
  } = {},
): Promise<ActionResult<FinishSummary>> {
  const guard = await ownedWorkout(workoutId);
  if ("error" in guard) return { ok: false, error: guard.error };
  const { me, workout: w } = guard;
  if (w.endedAt) return { ok: false, error: "Workout already finished" };

  const wes = await db
    .select({
      id: workoutExercise.id,
      exerciseId: workoutExercise.exerciseId,
      name: exercise.name,
    })
    .from(workoutExercise)
    .innerJoin(exercise, eq(exercise.id, workoutExercise.exerciseId))
    .where(eq(workoutExercise.workoutId, workoutId));

  const weIds = wes.map((r) => r.id);
  const sets = weIds.length
    ? await db
        .select()
        .from(workoutSet)
        .where(inArray(workoutSet.workoutExerciseId, weIds))
    : [];

  const endedAt = new Date();
  const durationSeconds = Math.max(
    1,
    Math.round((endedAt.getTime() - w.startedAt.getTime()) / 1000),
  );

  // Settle the unticked sets before anything is counted, so totals, records
  // and the celebration all agree on what was actually performed.
  const mode: UnfinishedSetsMode = opts.unfinishedSets ?? "delete";
  const unticked = sets.filter((s) => s.completedAt == null);
  const promoted = mode === "complete" ? unticked.filter(recordsSomething) : [];
  // Empty rows are dropped even in "complete" mode — there is nothing to log.
  const abandoned =
    mode === "complete"
      ? unticked.filter((s) => !recordsSomething(s))
      : mode === "delete"
        ? unticked
        : [];

  const completed = [
    ...sets.filter((s) => s.completedAt != null),
    ...promoted.map((s) => ({ ...s, completedAt: endedAt })),
  ];
  if (!completed.length) {
    return { ok: false, error: "Log at least one set before finishing" };
  }

  // Warm-ups are excluded from volume — counting them inflates every stat.
  // `sumSetTotals` owns that rule; quick-log writes the same counters.
  const scoring = completed.filter((s) => s.setType !== "warmup");
  const { totalVolumeKg, totalReps } = sumSetTotals(completed);

  const byWe = new Map(wes.map((r) => [r.id, r]));
  const prs: FinishSummary["prs"] = [];
  const photoUrl =
    opts.photoUrl && isBlobUrl(opts.photoUrl) ? opts.photoUrl : null;

  await db.transaction(async (tx) => {
    if (abandoned.length) {
      await tx.delete(workoutSet).where(
        inArray(
          workoutSet.id,
          abandoned.map((s) => s.id),
        ),
      );
    }

    // Handful of rows in practice, and each needs its own 1RM, so a loop beats
    // building a CASE expression.
    for (const s of promoted) {
      await tx
        .update(workoutSet)
        .set({
          completedAt: endedAt,
          estimated1rm:
            s.estimated1rm ?? estimate1RM(s.weightKg ?? 0, s.reps ?? 0),
        })
        .where(eq(workoutSet.id, s.id));
    }

    // Best candidate per exercise per record kind.
    const best = new Map<
      string,
      Record<PrKind, { value: number; setId: string; weightKg: number | null; reps: number | null } | null>
    >();

    for (const s of scoring) {
      const we = byWe.get(s.workoutExerciseId);
      if (!we) continue;
      const cur =
        best.get(we.exerciseId) ??
        ({ "1rm": null, weight: null, volume: null, reps: null } as Record<
          PrKind,
          { value: number; setId: string; weightKg: number | null; reps: number | null } | null
        >);

      const e1 = s.estimated1rm ?? estimate1RM(s.weightKg ?? 0, s.reps ?? 0);
      const vol = (s.weightKg ?? 0) * (s.reps ?? 0);

      const consider = (kind: PrKind, value: number) => {
        if (value <= 0) return;
        if (!cur[kind] || value > cur[kind]!.value) {
          cur[kind] = { value, setId: s.id, weightKg: s.weightKg, reps: s.reps };
        }
      };
      consider("1rm", e1);
      consider("weight", s.weightKg ?? 0);
      consider("volume", vol);
      consider("reps", s.reps ?? 0);

      best.set(we.exerciseId, cur);
    }

    for (const [exerciseId, kinds] of best) {
      const existing = await tx
        .select()
        .from(personalRecord)
        .where(
          and(
            eq(personalRecord.userId, me.id),
            eq(personalRecord.exerciseId, exerciseId),
          ),
        );
      const existingByKind = new Map(existing.map((r) => [r.kind, r]));

      for (const kind of ["1rm", "weight", "volume", "reps"] as PrKind[]) {
        const cand = kinds[kind];
        if (!cand) continue;
        const prev = existingByKind.get(kind);
        if (prev && cand.value <= prev.value + 0.01) continue;

        await tx
          .insert(personalRecord)
          .values({
            userId: me.id,
            exerciseId,
            kind,
            value: cand.value,
            weightKg: cand.weightKg,
            reps: cand.reps,
            workoutSetId: cand.setId,
            workoutId,
            achievedAt: endedAt,
          })
          .onConflictDoUpdate({
            target: [
              personalRecord.userId,
              personalRecord.exerciseId,
              personalRecord.kind,
            ],
            set: {
              value: cand.value,
              weightKg: cand.weightKg,
              reps: cand.reps,
              workoutSetId: cand.setId,
              workoutId,
              achievedAt: endedAt,
            },
          });

        // Only 1RM records are loud enough to celebrate; the rest would spam.
        if (kind === "1rm") {
          const name =
            wes.find((r) => r.exerciseId === exerciseId)?.name ?? "Exercise";
          prs.push({
            exerciseName: name,
            kind,
            value: cand.value,
            reps: cand.reps,
            weightKg: cand.weightKg,
          });
        }
      }
    }

    await tx
      .update(workout)
      .set({
        endedAt,
        durationSeconds,
        totalVolumeKg,
        totalSets: scoring.length,
        totalReps,
        prCount: prs.length,
        // Caller-supplied, so only accepted if it really is our blob store.
        ...(photoUrl ? { photoUrl } : {}),
      })
      .where(eq(workout.id, workoutId));

    if (opts.shareToFeed !== false) {
      await tx
        .insert(post)
        .values({
          userId: me.id,
          workoutId,
          caption: opts.caption?.trim() || null,
        })
        .onConflictDoNothing();
    }
  });

  // If this was a co-op session, end it once everyone has finished. The room
  // otherwise shows a finished lifter with a forever-ticking clock.
  if (w.coopSessionId) await endCoopSessionIfAllFinished(w.coopSessionId);

  const unlocked = await grantAchievements(me.id, {
    finishedWorkoutAt: endedAt,
    workoutVolumeKg: totalVolumeKg,
    durationSeconds,
    newPrCount: prs.length,
    isCoop: w.coopSessionId != null,
  });

  // Deliberately no revalidatePath here. Revalidating would re-render the
  // workout route, which now redirects (the workout has an endedAt), tearing
  // down the celebration overlay mid-animation. The client refreshes when the
  // user dismisses it.

  return {
    ok: true,
    data: {
      workoutId,
      durationSeconds,
      totalVolumeKg,
      totalSets: scoring.length,
      totalReps,
      prs,
      unlockedAchievements: unlocked,
    },
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Exercises touched by a workout — needed before it's deleted. */
async function exerciseIdsInWorkout(tx: Tx, workoutId: string) {
  const rows = await tx
    .selectDistinct({ exerciseId: workoutExercise.exerciseId })
    .from(workoutExercise)
    .where(eq(workoutExercise.workoutId, workoutId));
  return rows.map((r) => r.exerciseId);
}

export async function discardWorkout(workoutId: string): Promise<ActionResult> {
  const guard = await ownedWorkout(workoutId);
  if ("error" in guard) return { ok: false, error: guard.error };
  if (guard.workout.endedAt) {
    return { ok: false, error: "Finished workouts can't be discarded here" };
  }

  // An unfinished workout never contributed records, so no recalculation.
  await db.delete(workout).where(eq(workout.id, workoutId));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteWorkout(workoutId: string): Promise<ActionResult> {
  const guard = await ownedWorkout(workoutId);
  if ("error" in guard) return { ok: false, error: guard.error };
  const userId = guard.me.id;

  await db.transaction(async (tx) => {
    // Capture the exercises first: the cascade takes the workout_exercise rows
    // with it, and the personal_record rows referencing this workout too.
    const exerciseIds = await exerciseIdsInWorkout(tx, workoutId);
    await tx.delete(workout).where(eq(workout.id, workoutId));
    await recalculatePersonalRecords(tx, userId, exerciseIds);
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Co-op counters                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Close a co-op session when its last participant finishes, so it stops
 * appearing as "in progress" on the launcher and blocking a fresh one.
 */
async function endCoopSessionIfAllFinished(coopSessionId: string) {
  const res = await db.execute<{ unfinished: number }>(sql`
    SELECT COUNT(*)::int AS unfinished
    FROM coop_participant cp
    LEFT JOIN workout w ON w.id = cp.workout_id
    WHERE cp.coop_session_id = ${coopSessionId}::uuid
      AND (cp.workout_id IS NULL OR w.ended_at IS NULL)
  `);

  if ((res.rows[0]?.unfinished ?? 0) > 0) return;

  await db.execute(sql`
    UPDATE coop_session SET ended_at = NOW()
    WHERE id = ${coopSessionId}::uuid AND ended_at IS NULL
  `);
}

/**
 * Keep the co-op participant row's denormalised counters current. The 3-second
 * poll reads only that row, so it must never need to join through sets.
 */
async function bumpCoopProgress(workoutId: string) {
  const [w] = await db
    .select({
      id: workout.id,
      userId: workout.userId,
      coopSessionId: workout.coopSessionId,
    })
    .from(workout)
    .where(eq(workout.id, workoutId))
    .limit(1);
  if (!w?.coopSessionId) return;

  const res = await db.execute<{
    sets: number;
    volume: number;
    // A raw `db.execute` bypasses drizzle's column mapping, so this arrives as
    // the driver's own representation — a string on `pg` — never a Date.
    last_at: string | Date | null;
  }>(sql`
    SELECT
      COUNT(*)::int AS sets,
      COALESCE(SUM(COALESCE(ws.weight_kg, 0) * COALESCE(ws.reps, 0)), 0)::real AS volume,
      MAX(ws.completed_at) AS last_at
    FROM ${workoutSet} ws
    JOIN ${workoutExercise} we ON we.id = ws.workout_exercise_id
    WHERE we.workout_id = ${workoutId}::uuid
      AND ws.completed_at IS NOT NULL
      AND ws.set_type <> 'warmup'
  `);
  const agg = res.rows[0];

  await db
    .update(coopParticipant)
    .set({
      setsCompleted: agg?.sets ?? 0,
      volumeKg: agg?.volume ?? 0,
      // Drizzle calls `.toISOString()` on whatever it's handed here, so the
      // string the driver returned has to become a Date first — without this
      // every completed set in a co-op session threw, and the write that
      // publishes your progress to the room never landed.
      lastSetAt: agg?.last_at ? new Date(agg.last_at) : null,
    })
    .where(
      and(
        eq(coopParticipant.coopSessionId, w.coopSessionId),
        eq(coopParticipant.userId, w.userId),
      ),
    );
}


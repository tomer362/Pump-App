"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
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
import { estimate1RM } from "@/lib/utils";
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

  const [w] = await db
    .insert(workout)
    .values({
      userId: me.id,
      name: defaultWorkoutName(),
      gymId: me.homeGymId,
    })
    .returning({ id: workout.id });

  revalidatePath("/", "layout");
  return { ok: true, data: { workoutId: w.id } };
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

  const res = await db.transaction(async (tx) => {
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

    const res_ = await tx
      .select()
      .from(routineExercise)
      .where(eq(routineExercise.routineId, r.id))
      .orderBy(asc(routineExercise.position));

    for (const re of res_) {
      const [we] = await tx
        .insert(workoutExercise)
        .values({
          workoutId: w.id,
          exerciseId: re.exerciseId,
          position: re.position,
          notes: re.notes,
          restSeconds: re.restSeconds ?? me.defaultRestSeconds,
          supersetGroup: re.supersetGroup,
          intervalWorkSeconds: re.intervalWorkSeconds,
          intervalRestSeconds: re.intervalRestSeconds,
        })
        .returning({ id: workoutExercise.id });

      const rsets = await tx
        .select()
        .from(routineSet)
        .where(eq(routineSet.routineExerciseId, re.id))
        .orderBy(asc(routineSet.position));

      if (rsets.length) {
        await tx.insert(workoutSet).values(
          rsets.map((rs) => ({
            workoutExerciseId: we.id,
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
            rpe: null,
            completedAt: null,
          })),
        );
      }
    }

    return w.id;
  });

  revalidatePath("/", "layout");
  return { ok: true, data: { workoutId: res } };
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

export async function addExercisesToWorkout(
  workoutId: string,
  exerciseIds: string[],
): Promise<ActionResult> {
  const guard = await ownedWorkout(workoutId);
  if ("error" in guard) return { ok: false, error: guard.error };
  if (!exerciseIds.length) return { ok: true };

  const [{ max }] = await db
    .select({ max: sql<number>`COALESCE(MAX(${workoutExercise.position}), -1)::int` })
    .from(workoutExercise)
    .where(eq(workoutExercise.workoutId, workoutId));

  const exs = await db
    .select()
    .from(exercise)
    .where(inArray(exercise.id, exerciseIds));
  const byId = new Map(exs.map((e) => [e.id, e]));

  await db.transaction(async (tx) => {
    let pos = max + 1;
    for (const id of exerciseIds) {
      const ex = byId.get(id);
      if (!ex) continue;
      const [we] = await tx
        .insert(workoutExercise)
        .values({
          workoutId,
          exerciseId: id,
          position: pos++,
          restSeconds: guard.me.defaultRestSeconds,
        })
        .returning({ id: workoutExercise.id });

      // Start with one empty set so the row is immediately usable.
      await tx.insert(workoutSet).values({
        workoutExerciseId: we.id,
        position: 0,
        setType: "normal",
      });
    }
  });

  revalidatePath(`/workout/${workoutId}`);
  return { ok: true };
}

export async function removeWorkoutExercise(
  workoutExerciseId: string,
): Promise<ActionResult> {
  const guard = await ownedWorkoutExercise(workoutExerciseId);
  if ("error" in guard) return { ok: false, error: guard.error };

  await db
    .delete(workoutExercise)
    .where(eq(workoutExercise.id, workoutExerciseId));

  revalidatePath(`/workout/${guard.workout.id}`);
  return { ok: true };
}

export async function reorderWorkoutExercises(
  workoutId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const guard = await ownedWorkout(workoutId);
  if ("error" in guard) return { ok: false, error: guard.error };

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(workoutExercise)
        .set({ position: i })
        .where(
          and(
            eq(workoutExercise.id, orderedIds[i]),
            eq(workoutExercise.workoutId, workoutId),
          ),
        );
    }
  });

  revalidatePath(`/workout/${workoutId}`);
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
    })
    .returning({ id: workoutSet.id });

  revalidatePath(`/workout/${guard.workout.id}`);
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
    // Renumber so set indices stay 1..n with no gaps.
    const rest = await tx
      .select({ id: workoutSet.id })
      .from(workoutSet)
      .where(eq(workoutSet.workoutExerciseId, row.weId))
      .orderBy(asc(workoutSet.position));
    for (let i = 0; i < rest.length; i++) {
      await tx
        .update(workoutSet)
        .set({ position: i })
        .where(eq(workoutSet.id, rest[i].id));
    }
  });

  revalidatePath(`/workout/${row.workoutId}`);
  return { ok: true };
}

const setPatchSchema = z.object({
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  reps: z.number().int().min(0).max(1000).nullable().optional(),
  seconds: z.number().int().min(0).max(86_400).nullable().optional(),
  distanceM: z.number().min(0).max(1_000_000).nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
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
  revalidatePath(`/workout/${workoutId}`);
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

  await db
    .update(workoutExercise)
    .set(parsed.data)
    .where(eq(workoutExercise.id, workoutExerciseId));

  revalidatePath(`/workout/${guard.workout.id}`);
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
 * Close out the workout: drop unticked sets, roll up totals, detect records,
 * grant achievements and publish to the feed. Everything the celebration
 * screen needs comes back in one payload so it can animate immediately.
 */
export async function finishWorkout(
  workoutId: string,
  opts: { shareToFeed?: boolean; caption?: string | null } = {},
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

  const completed = sets.filter((s) => s.completedAt != null);
  if (!completed.length) {
    return { ok: false, error: "Log at least one set before finishing" };
  }

  const endedAt = new Date();
  const durationSeconds = Math.max(
    1,
    Math.round((endedAt.getTime() - w.startedAt.getTime()) / 1000),
  );

  // Warm-ups are excluded from volume — counting them inflates every stat.
  const scoring = completed.filter((s) => s.setType !== "warmup");
  const totalVolumeKg = scoring.reduce(
    (sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0),
    0,
  );
  const totalReps = scoring.reduce((sum, s) => sum + (s.reps ?? 0), 0);

  const byWe = new Map(wes.map((r) => [r.id, r]));
  const prs: FinishSummary["prs"] = [];

  await db.transaction(async (tx) => {
    // Unticked sets are noise: they were planned but not performed.
    const abandoned = sets.filter((s) => s.completedAt == null).map((s) => s.id);
    if (abandoned.length) {
      await tx.delete(workoutSet).where(inArray(workoutSet.id, abandoned));
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

export async function discardWorkout(workoutId: string): Promise<ActionResult> {
  const guard = await ownedWorkout(workoutId);
  if ("error" in guard) return { ok: false, error: guard.error };
  if (guard.workout.endedAt) {
    return { ok: false, error: "Finished workouts can't be discarded here" };
  }

  await db.delete(workout).where(eq(workout.id, workoutId));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteWorkout(workoutId: string): Promise<ActionResult> {
  const guard = await ownedWorkout(workoutId);
  if ("error" in guard) return { ok: false, error: guard.error };

  await db.delete(workout).where(eq(workout.id, workoutId));
  revalidatePath("/", "layout");
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Co-op counters                                                              */
/* -------------------------------------------------------------------------- */

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
    last_at: Date | null;
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
      lastSetAt: agg?.last_at ?? null,
    })
    .where(
      and(
        eq(coopParticipant.coopSessionId, w.coopSessionId),
        eq(coopParticipant.userId, w.userId),
      ),
    );
}


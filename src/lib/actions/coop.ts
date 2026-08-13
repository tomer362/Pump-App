"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  coopParticipant,
  coopSession,
  routine,
  routineExercise,
  routineSet,
  workout,
  workoutExercise,
  workoutSet,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "./rate-limit";
import type { ActionResult } from "./user";

function makeJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Start a shared session. Each participant still gets their own `workout` row —
 * the co-op session only links them, so everyone's history, volume and records
 * stay individually correct.
 */
export async function createCoopSession(input: {
  name: string;
  routineId?: string | null;
  loadMultiplier?: number;
}): Promise<ActionResult<{ coopSessionId: string; joinCode: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const limited = await rateLimit(me.id, "create_coop", {
    limit: 10,
    windowSeconds: 3600,
  });
  if (!limited.ok) return limited;

  const parsed = z
    .object({
      name: z.string().trim().min(1, "Give the session a name").max(60),
      routineId: z.string().uuid().nullable().optional(),
      loadMultiplier: z.number().min(0.3).max(1.5).optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }

  const [existingWorkout] = await db
    .select({ id: workout.id })
    .from(workout)
    .where(and(eq(workout.userId, me.id), isNull(workout.endedAt)))
    .limit(1);
  if (existingWorkout) {
    return { ok: false, error: "Finish your current workout first" };
  }

  const joinCode = makeJoinCode();

  const result = await db.transaction(async (tx) => {
    const [session] = await tx
      .insert(coopSession)
      .values({
        hostId: me.id,
        routineId: parsed.data.routineId ?? null,
        name: parsed.data.name,
        joinCode,
        loadMultiplier: parsed.data.loadMultiplier ?? 1,
      })
      .returning({ id: coopSession.id, joinCode: coopSession.joinCode });

    const workoutId = await createLinkedWorkout(
      tx,
      me.id,
      me.homeGymId,
      me.defaultRestSeconds,
      session.id,
      parsed.data.routineId ?? null,
      parsed.data.name,
      parsed.data.loadMultiplier ?? 1,
    );

    await tx.insert(coopParticipant).values({
      coopSessionId: session.id,
      userId: me.id,
      workoutId,
    });

    return session;
  });

  revalidatePath("/coop");
  return {
    ok: true,
    data: { coopSessionId: result.id, joinCode: result.joinCode },
  };
}

export async function joinCoopSession(
  code: string,
): Promise<ActionResult<{ coopSessionId: string; workoutId: string }>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  // Same reasoning as gym codes: the code is the only credential.
  const limited = await rateLimit(me.id, "join_coop", {
    limit: 10,
    windowSeconds: 600,
  });
  if (!limited.ok) return limited;

  const [session] = await db
    .select()
    .from(coopSession)
    .where(
      eq(coopSession.joinCode, z.string().trim().max(16).parse(code).toUpperCase()),
    )
    .limit(1);
  if (!session) return { ok: false, error: "No session with that code" };
  if (session.endedAt) return { ok: false, error: "That session has ended" };

  const [already] = await db
    .select()
    .from(coopParticipant)
    .where(
      and(
        eq(coopParticipant.coopSessionId, session.id),
        eq(coopParticipant.userId, me.id),
      ),
    )
    .limit(1);
  if (already?.workoutId) {
    return {
      ok: true,
      data: { coopSessionId: session.id, workoutId: already.workoutId },
    };
  }

  const [existingWorkout] = await db
    .select({ id: workout.id })
    .from(workout)
    .where(and(eq(workout.userId, me.id), isNull(workout.endedAt)))
    .limit(1);
  if (existingWorkout) {
    return { ok: false, error: "Finish your current workout first" };
  }

  const workoutId = await db.transaction(async (tx) => {
    const id = await createLinkedWorkout(
      tx,
      me.id,
      me.homeGymId,
      me.defaultRestSeconds,
      session.id,
      session.routineId,
      session.name,
      session.loadMultiplier,
    );
    await tx
      .insert(coopParticipant)
      .values({ coopSessionId: session.id, userId: me.id, workoutId: id })
      .onConflictDoUpdate({
        target: [coopParticipant.coopSessionId, coopParticipant.userId],
        set: { workoutId: id },
      });
    return id;
  });

  revalidatePath("/coop");
  return { ok: true, data: { coopSessionId: session.id, workoutId } };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Create this participant's own workout, seeded from the shared routine. */
async function createLinkedWorkout(
  tx: Tx,
  userId: string,
  gymId: string | null,
  defaultRestSeconds: number,
  coopSessionId: string,
  routineId: string | null,
  name: string,
  loadMultiplier: number,
): Promise<string> {
  const [w] = await tx
    .insert(workout)
    .values({ userId, routineId, gymId, name, coopSessionId, loadMultiplier })
    .returning({ id: workout.id });

  if (!routineId) return w.id;

  const [r] = await tx
    .select({ id: routine.id, isPublic: routine.isPublic, userId: routine.userId })
    .from(routine)
    .where(eq(routine.id, routineId))
    .limit(1);
  if (!r) return w.id;

  const res = await tx
    .select()
    .from(routineExercise)
    .where(eq(routineExercise.routineId, routineId))
    .orderBy(routineExercise.position);

  if (!res.length) return w.id;

  // Batched: this runs once per joiner, so a per-exercise round trip here is
  // multiplied by the size of the session.
  const rsets = await tx
    .select()
    .from(routineSet)
    .where(
      inArray(
        routineSet.routineExerciseId,
        res.map((re) => re.id),
      ),
    )
    .orderBy(routineSet.position);

  const inserted = await tx
    .insert(workoutExercise)
    .values(
      res.map((re) => ({
        workoutId: w.id,
        exerciseId: re.exerciseId,
        position: re.position,
        notes: re.notes,
        restSeconds: re.restSeconds ?? defaultRestSeconds,
        supersetGroup: re.supersetGroup,
        intervalWorkSeconds: re.intervalWorkSeconds,
        intervalRestSeconds: re.intervalRestSeconds,
      })),
    )
    .returning({ id: workoutExercise.id, position: workoutExercise.position });

  const byPosition = new Map(inserted.map((x) => [x.position, x.id]));
  const rows = rsets.flatMap((rs) => {
    const re = res.find((x) => x.id === rs.routineExerciseId);
    const weId = re ? byPosition.get(re.position) : undefined;
    if (!weId) return [];
    return [
      {
        workoutExerciseId: weId,
        position: rs.position,
        setType: rs.setType,
        weightKg:
          rs.targetWeightKg != null
            ? Math.round(rs.targetWeightKg * loadMultiplier * 100) / 100
            : null,
        reps: rs.targetReps,
        seconds: rs.targetSeconds,
        distanceM: rs.targetDistanceM,
        // Two columns, two facts — same as `startWorkoutFromRoutine`, which this
        // is the second copy of. A prescription pre-filled into `rpe` reads as a
        // rating the lifter gave a set they haven't started.
        rpe: null,
        targetRpe: rs.targetRpe,
      },
    ];
  });

  if (rows.length) await tx.insert(workoutSet).values(rows);

  return w.id;
}

export async function endCoopSession(
  coopSessionId: string,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  await db
    .update(coopSession)
    .set({ endedAt: new Date() })
    .where(
      and(eq(coopSession.id, coopSessionId), eq(coopSession.hostId, me.id)),
    );

  revalidatePath("/coop");
  return { ok: true };
}

export async function leaveCoopSession(
  coopSessionId: string,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  await db
    .delete(coopParticipant)
    .where(
      and(
        eq(coopParticipant.coopSessionId, coopSessionId),
        eq(coopParticipant.userId, me.id),
      ),
    );
  // The participant's own workout is left alone — it's their session to keep.
  await db
    .update(workout)
    .set({ coopSessionId: null })
    .where(
      and(
        eq(workout.userId, me.id),
        eq(workout.coopSessionId, coopSessionId),
      ),
    );

  revalidatePath("/coop");
  return { ok: true };
}

/** Announce a rest period so the others can see you're between sets. */
export async function setCoopResting(
  coopSessionId: string,
  seconds: number | null,
): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  await db
    .update(coopParticipant)
    .set({
      restingUntil:
        seconds && seconds > 0 ? new Date(Date.now() + seconds * 1000) : null,
    })
    .where(
      and(
        eq(coopParticipant.coopSessionId, coopSessionId),
        eq(coopParticipant.userId, me.id),
      ),
    );

  return { ok: true };
}

export type CoopSnapshot = {
  id: string;
  name: string;
  joinCode: string;
  hostId: string;
  loadMultiplier: number;
  endedAt: string | null;
  startedAt: string;
  participants: {
    userId: string;
    name: string;
    image: string | null;
    username: string | null;
    workoutId: string | null;
    setsCompleted: number;
    volumeKg: number;
    lastSetAt: string | null;
    restingUntil: string | null;
    startedAt: string | null;
    /** Set once this person has finished their own workout. */
    endedAt: string | null;
  }[];
};

/**
 * The polled endpoint. One indexed query over denormalised counters — it runs
 * every few seconds per participant, so it must never fan out over sets.
 *
 * This is a server action, which means it is a public POST endpoint: the
 * membership check has to live HERE, not only in the page that renders it.
 * Without it any signed-in user could enumerate a session id and read the
 * roster plus the join code, then let themselves in.
 */
export async function getCoopSnapshot(
  coopSessionId: string,
): Promise<CoopSnapshot | null> {
  const me = await getCurrentUser();
  if (!me) return null;

  const [membership] = await db
    .select({ userId: coopParticipant.userId })
    .from(coopParticipant)
    .where(
      and(
        eq(coopParticipant.coopSessionId, coopSessionId),
        eq(coopParticipant.userId, me.id),
      ),
    )
    .limit(1);
  if (!membership) return null;

  const [session] = await db
    .select()
    .from(coopSession)
    .where(eq(coopSession.id, coopSessionId))
    .limit(1);
  if (!session) return null;

  const rows = await db.execute<{
    user_id: string;
    name: string;
    image: string | null;
    username: string | null;
    workout_id: string | null;
    sets_completed: number;
    volume_kg: number;
    last_set_at: string | null;
    resting_until: string | null;
    started_at: string | null;
    ended_at: string | null;
  }>(sql`
    SELECT
      cp.user_id,
      u.name,
      u.image,
      u.username,
      cp.workout_id,
      cp.sets_completed,
      cp.volume_kg,
      cp.last_set_at,
      cp.resting_until,
      w.started_at,
      w.ended_at
    FROM coop_participant cp
    JOIN "user" u ON u.id = cp.user_id
    LEFT JOIN workout w ON w.id = cp.workout_id
    WHERE cp.coop_session_id = ${coopSessionId}::uuid
    ORDER BY cp.joined_at
  `);

  return {
    id: session.id,
    name: session.name,
    joinCode: session.joinCode,
    hostId: session.hostId,
    loadMultiplier: session.loadMultiplier,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
    participants: rows.rows.map((r) => ({
      userId: r.user_id,
      name: r.name,
      image: r.image,
      username: r.username,
      workoutId: r.workout_id,
      setsCompleted: r.sets_completed,
      volumeKg: r.volume_kg,
      lastSetAt: r.last_set_at ? new Date(r.last_set_at).toISOString() : null,
      // A finished lifter must stop resting in the UI, however stale the row.
      restingUntil:
        r.ended_at || !r.resting_until
          ? null
          : new Date(r.resting_until).toISOString(),
      endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : null,
      startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
    })),
  };
}

import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  exercise,
  routine,
  routineExercise,
  routineSet,
  user,
} from "@/lib/db/schema";

export type RoutineListItem = {
  id: string;
  name: string;
  notes: string | null;
  folder: string | null;
  isPublic: boolean;
  exerciseCount: number;
  setCount: number;
  /** First few exercise names, for the card preview. */
  preview: string[];
  ownerName: string;
  ownerUsername: string | null;
  ownerId: string;
  updatedAt: Date;
  /** Handle of whoever wrote the routine this was copied from, if anyone. */
  sourceAuthor: string | null;
};

export async function getRoutines(userId: string): Promise<RoutineListItem[]> {
  const rows = await db
    .select({
      id: routine.id,
      name: routine.name,
      notes: routine.notes,
      folder: routine.folder,
      isPublic: routine.isPublic,
      updatedAt: routine.updatedAt,
      ownerId: routine.userId,
      ownerName: user.name,
      ownerUsername: user.username,
      exerciseCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${routineExercise} re WHERE re.routine_id = ${routine.id}
      )`,
      setCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${routineSet} rs
        JOIN ${routineExercise} re2 ON re2.id = rs.routine_exercise_id
        WHERE re2.routine_id = ${routine.id}
      )`,
      preview: sql<string[]>`(
        SELECT COALESCE(ARRAY_AGG(t.name ORDER BY t.position), ARRAY[]::text[])
        FROM (
          SELECT e.name, re3.position
          FROM ${routineExercise} re3
          JOIN ${exercise} e ON e.id = re3.exercise_id
          WHERE re3.routine_id = ${routine.id}
          ORDER BY re3.position LIMIT 4
        ) t
      )`,
      // Null for an original, and for a copy of your own routine — crediting
      // yourself is noise.
      sourceAuthor: sql<string | null>`(
        SELECT COALESCE(su.username, su.name)
        FROM ${routine} sr
        JOIN ${user} su ON su.id = sr.user_id
        WHERE sr.id = ${routine.sourceRoutineId}
          AND sr.user_id <> ${routine.userId}
      )`,
    })
    .from(routine)
    .innerJoin(user, eq(user.id, routine.userId))
    .where(eq(routine.userId, userId))
    .orderBy(desc(routine.updatedAt));

  return rows;
}

export type FullRoutine = {
  id: string;
  userId: string;
  name: string;
  notes: string | null;
  folder: string | null;
  isPublic: boolean;
  ownerName: string;
  ownerUsername: string | null;
  sourceRoutineId: string | null;
  sourceAuthor: string | null;
  exercises: {
    id: string;
    exerciseId: string;
    position: number;
    notes: string | null;
    restSeconds: number | null;
    supersetGroup: string | null;
    intervalWorkSeconds: number | null;
    intervalRestSeconds: number | null;
    name: string;
    primaryMuscle: string;
    equipment: string;
    trackingType: string;
    sets: {
      id: string;
      position: number;
      setType: "normal" | "warmup" | "drop" | "failure";
      targetWeightKg: number | null;
      targetReps: number | null;
      targetSeconds: number | null;
      targetDistanceM: number | null;
      targetRpe: number | null;
    }[];
  }[];
};

export async function getFullRoutine(
  routineId: string,
): Promise<FullRoutine | null> {
  const [r] = await db
    .select({
      routine,
      ownerName: user.name,
      ownerUsername: user.username,
      sourceAuthor: sql<string | null>`(
        SELECT COALESCE(su.username, su.name)
        FROM ${routine} sr
        JOIN ${user} su ON su.id = sr.user_id
        WHERE sr.id = ${routine.sourceRoutineId}
          AND sr.user_id <> ${routine.userId}
      )`,
    })
    .from(routine)
    .innerJoin(user, eq(user.id, routine.userId))
    .where(eq(routine.id, routineId))
    .limit(1);
  if (!r) return null;

  const res = await db
    .select({
      id: routineExercise.id,
      exerciseId: routineExercise.exerciseId,
      position: routineExercise.position,
      notes: routineExercise.notes,
      restSeconds: routineExercise.restSeconds,
      supersetGroup: routineExercise.supersetGroup,
      intervalWorkSeconds: routineExercise.intervalWorkSeconds,
      intervalRestSeconds: routineExercise.intervalRestSeconds,
      name: exercise.name,
      primaryMuscle: exercise.primaryMuscle,
      equipment: exercise.equipment,
      trackingType: exercise.trackingType,
    })
    .from(routineExercise)
    .innerJoin(exercise, eq(exercise.id, routineExercise.exerciseId))
    .where(eq(routineExercise.routineId, routineId))
    .orderBy(asc(routineExercise.position));

  const ids = res.map((x) => x.id);
  const sets = ids.length
    ? await db
        .select()
        .from(routineSet)
        .where(inArray(routineSet.routineExerciseId, ids))
        .orderBy(asc(routineSet.position))
    : [];

  const byRe = new Map<string, FullRoutine["exercises"][number]["sets"]>();
  for (const s of sets) {
    const list = byRe.get(s.routineExerciseId) ?? [];
    list.push({
      id: s.id,
      position: s.position,
      setType: s.setType,
      targetWeightKg: s.targetWeightKg,
      targetReps: s.targetReps,
      targetSeconds: s.targetSeconds,
      targetDistanceM: s.targetDistanceM,
      targetRpe: s.targetRpe,
    });
    byRe.set(s.routineExerciseId, list);
  }

  return {
    id: r.routine.id,
    userId: r.routine.userId,
    name: r.routine.name,
    notes: r.routine.notes,
    folder: r.routine.folder,
    isPublic: r.routine.isPublic,
    sourceRoutineId: r.routine.sourceRoutineId,
    sourceAuthor: r.sourceAuthor,
    ownerName: r.ownerName,
    ownerUsername: r.ownerUsername,
    exercises: res.map((x) => ({ ...x, sets: byRe.get(x.id) ?? [] })),
  };
}

/** Public routines from people the user follows — the "programs" discovery list. */
export async function getFollowedRoutines(userId: string, limit = 30) {
  return db
    .select({
      id: routine.id,
      name: routine.name,
      notes: routine.notes,
      updatedAt: routine.updatedAt,
      ownerId: routine.userId,
      ownerName: user.name,
      ownerUsername: user.username,
      ownerImage: user.image,
      exerciseCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${routineExercise} re WHERE re.routine_id = ${routine.id}
      )`,
    })
    .from(routine)
    .innerJoin(user, eq(user.id, routine.userId))
    .where(
      and(
        eq(routine.isPublic, true),
        sql`${routine.userId} IN (SELECT following_id FROM follow WHERE follower_id = ${userId})`,
      ),
    )
    .orderBy(desc(routine.updatedAt))
    .limit(limit);
}

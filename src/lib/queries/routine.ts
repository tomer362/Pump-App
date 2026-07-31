import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  exercise,
  routine,
  routineExercise,
  routineFolder,
  routineLike,
  routineSet,
  user,
} from "@/lib/db/schema";
import type { FolderColor } from "@/lib/db/schema";

export type RoutineListItem = {
  id: string;
  name: string;
  notes: string | null;
  folderId: string | null;
  position: number;
  isPublic: boolean;
  likeCount: number;
  saveCount: number;
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
      folderId: routine.folderId,
      position: routine.position,
      isPublic: routine.isPublic,
      likeCount: routine.likeCount,
      saveCount: routine.saveCount,
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
    // Manual order within a folder. `updatedAt` only breaks ties now — it used
    // to be the sort, which meant opening and saving a routine reshuffled the
    // list under you.
    .orderBy(asc(routine.position), desc(routine.updatedAt));

  return rows;
}

export type FolderListItem = {
  id: string;
  name: string;
  color: FolderColor;
  position: number;
  rotation: boolean;
  routineCount: number;
  /**
   * For a rotation folder, the routine that comes after the one you last
   * finished — null when the folder is empty or rotation is off.
   */
  nextRoutineId: string | null;
  nextRoutineName: string | null;
};

/**
 * Folders with their counts, and — for rotation folders — which routine is up
 * next. "Next" is the routine one position past whatever you last *finished*
 * from this folder, wrapping at the end; a folder you've never trained starts
 * at its first routine.
 *
 * It's a single query with correlated subqueries rather than a fan-out: the
 * routines list is one page load and Neon Free scales to zero, so the cost that
 * matters is round trips.
 */
export async function getFolders(userId: string): Promise<FolderListItem[]> {
  // The outer folder id has to be written raw: inside a correlated subquery a
  // drizzle `${routineFolder.id}` renders as a bare "id" and would resolve
  // against the subquery's own FROM instead of the folder row.
  const folderId = sql.raw('"routine_folder"."id"');

  const lastPosition = sql`(
    SELECT r."position"
    FROM "workout" w
    JOIN "routine" r ON r."id" = w."routine_id"
    WHERE w."user_id" = ${userId}
      AND w."ended_at" IS NOT NULL
      AND r."folder_id" = ${folderId}
    ORDER BY w."ended_at" DESC
    LIMIT 1
  )`;

  /**
   * Next in the cycle. Routines positioned after the last one you finished sort
   * first, so the head of that group is the answer; when nothing is after it,
   * every row falls into the same bucket and the ordering wraps to the start of
   * the folder on its own — no modular arithmetic needed.
   */
  const nextInCycle = (column: "id" | "name") => sql`(
    SELECT n.${sql.raw(`"${column}"`)} FROM "routine" n
    WHERE n."folder_id" = ${folderId}
    ORDER BY (n."position" > COALESCE(${lastPosition}, -1)) DESC, n."position"
    LIMIT 1
  )`;

  const rows = await db
    .select({
      id: routineFolder.id,
      name: routineFolder.name,
      color: routineFolder.color,
      position: routineFolder.position,
      rotation: routineFolder.rotation,
      routineCount: sql<number>`(
        SELECT COUNT(*)::int FROM "routine" r WHERE r."folder_id" = ${folderId}
      )`,
      nextRoutineId: sql<string | null>`${nextInCycle("id")}`,
      nextRoutineName: sql<string | null>`${nextInCycle("name")}`,
    })
    .from(routineFolder)
    .where(eq(routineFolder.userId, userId))
    .orderBy(asc(routineFolder.position), asc(routineFolder.name));

  return rows.map((r) => ({
    ...r,
    nextRoutineId: r.rotation ? r.nextRoutineId : null,
    nextRoutineName: r.rotation ? r.nextRoutineName : null,
  }));
}

export type FullRoutine = {
  id: string;
  userId: string;
  name: string;
  notes: string | null;
  folderId: string | null;
  folderName: string | null;
  folderColor: FolderColor | null;
  isPublic: boolean;
  likeCount: number;
  saveCount: number;
  likedByMe: boolean;
  ownerName: string;
  ownerUsername: string | null;
  ownerImage: string | null;
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
  viewerId?: string,
): Promise<FullRoutine | null> {
  const [r] = await db
    .select({
      routine,
      ownerName: user.name,
      ownerUsername: user.username,
      ownerImage: user.image,
      folderName: routineFolder.name,
      folderColor: routineFolder.color,
      likedByMe: viewerId
        ? sql<boolean>`EXISTS (
            SELECT 1 FROM ${routineLike} rl
            WHERE rl.routine_id = ${routine.id} AND rl.user_id = ${viewerId}
          )`
        : sql<boolean>`false`,
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
    .leftJoin(routineFolder, eq(routineFolder.id, routine.folderId))
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
    folderId: r.routine.folderId,
    folderName: r.folderName,
    folderColor: r.folderColor,
    isPublic: r.routine.isPublic,
    likeCount: r.routine.likeCount,
    saveCount: r.routine.saveCount,
    likedByMe: r.likedByMe,
    sourceRoutineId: r.routine.sourceRoutineId,
    sourceAuthor: r.sourceAuthor,
    ownerName: r.ownerName,
    ownerUsername: r.ownerUsername,
    ownerImage: r.ownerImage,
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

/* -------------------------------------------------------------------------- */
/* Discover                                                                    */
/* -------------------------------------------------------------------------- */

export const DISCOVER_SORTS = ["popular", "new"] as const;
export type DiscoverSort = (typeof DISCOVER_SORTS)[number];

export type DiscoverRoutine = {
  id: string;
  name: string;
  notes: string | null;
  createdAt: Date;
  popularity: number;
  likeCount: number;
  saveCount: number;
  likedByMe: boolean;
  exerciseCount: number;
  setCount: number;
  preview: string[];
  ownerId: string;
  ownerName: string;
  ownerUsername: string | null;
  ownerImage: string | null;
};

/**
 * Keyset cursor for Discover. `popularity` and `createdAt` both tie easily —
 * a brand-new routine has popularity 0, and so does every other one — so the
 * id is carried as a tiebreak and both halves of the comparison have to move
 * together, or a page boundary silently swallows rows.
 */
export type DiscoverCursor = { value: number | string; id: string };

/**
 * Public routines other people wrote. Two orderings, both matching a partial
 * index on `is_public`: `popular` walks the generated `popularity` column,
 * `new` walks `created_at`. Neither computes a score at query time — a decayed
 * ranking would need a scheduled recompute, and Hobby cron is two jobs a day.
 */
export async function getDiscoverRoutines(
  viewerId: string,
  {
    sort = "popular",
    limit = 20,
    cursor,
  }: { sort?: DiscoverSort; limit?: number; cursor?: DiscoverCursor } = {},
): Promise<DiscoverRoutine[]> {
  const popular = sort === "popular";

  // Ordering and the cursor both reference the bare column, never an
  // expression over it — `routine_popular_idx` is on (popularity, id), and
  // wrapping it in COALESCE here would cost the index scan for a null that
  // GENERATED ALWAYS never produces.
  const keyset = cursor
    ? popular
      ? sql`(${routine.popularity}, ${routine.id}) < (${Number(cursor.value)}, ${cursor.id}::uuid)`
      : sql`(${routine.createdAt}, ${routine.id}) < (${new Date(cursor.value)}, ${cursor.id}::uuid)`
    : undefined;

  const rows = await db
    .select({
      id: routine.id,
      name: routine.name,
      notes: routine.notes,
      createdAt: routine.createdAt,
      popularity: sql<number>`COALESCE(${routine.popularity}, 0)`,
      likeCount: routine.likeCount,
      saveCount: routine.saveCount,
      likedByMe: sql<boolean>`EXISTS (
        SELECT 1 FROM ${routineLike} rl
        WHERE rl.routine_id = ${routine.id} AND rl.user_id = ${viewerId}
      )`,
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
      ownerId: routine.userId,
      ownerName: user.name,
      ownerUsername: user.username,
      ownerImage: user.image,
    })
    .from(routine)
    .innerJoin(user, eq(user.id, routine.userId))
    .where(
      and(
        eq(routine.isPublic, true),
        ne(routine.userId, viewerId),
        // An empty routine is a draft, not a program. Listing them would fill
        // Discover with stubs nobody can train from.
        sql`EXISTS (
          SELECT 1 FROM ${routineExercise} re4 WHERE re4.routine_id = ${routine.id}
        )`,
        keyset,
      ),
    )
    .orderBy(
      popular ? desc(routine.popularity) : desc(routine.createdAt),
      desc(routine.id),
    )
    .limit(limit);

  return rows;
}

/** The cursor for whatever the last row of a Discover page was. */
export function discoverCursor(
  item: DiscoverRoutine,
  sort: DiscoverSort,
): DiscoverCursor {
  return {
    value: sort === "popular" ? item.popularity : item.createdAt.toISOString(),
    id: item.id,
  };
}

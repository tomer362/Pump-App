import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  isNull,
  lt,
  not,
  or,
  sql,
  inArray,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  EXERCISE_PAGE_SIZE,
  EXERCISE_RECENT_LIMIT,
  IMPORTED_HINT_LIMIT,
} from "@/lib/pagination";
import {
  exercise,
  exerciseAlternative,
  personalRecord,
  workout,
  workoutExercise,
  workoutSet,
  type Equipment,
  type Muscle,
} from "@/lib/db/schema";

export type ExerciseListItem = {
  id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  trackingType: string;
  isCustom: boolean;
  isArchived: boolean;
  /**
   * Arrived attached to somebody else's routine rather than being authored
   * here. Kept out of the default search scope until adopted — see
   * `ExerciseScope`.
   */
  isImported: boolean;
  /**
   * Last time this user logged it — powers the "Recent" ordering. Only
   * `getRecentExercises` fills this in; the alphabetical pages leave it null
   * on purpose, because computing it per row is what made loading the library
   * expensive in the first place.
   */
  lastPerformedAt: Date | null;
};

/**
 * Keyset cursor into the library: the last row of the page you have. Every
 * column of the ORDER BY is in it — `popularity` because that leads the sort,
 * then `(name, id)`, and `id` rather than `name` alone because a custom
 * exercise can share a name with a built-in and a cursor on a duplicated name
 * would either skip the twin or loop on it forever.
 */
export type ExerciseCursor = { popularity: number; name: string; id: string };

export type ExercisePage = {
  items: ExerciseListItem[];
  /** Pass back as `after` for the next batch; null when the library is spent. */
  cursor: ExerciseCursor | null;
};

/**
 * Which slice of the library to return.
 * - `available` — built-ins plus the custom entries this user **authored**
 * - `mine`      — only the custom entries this user authored
 * - `imported`  — only the ones that arrived attached to someone's routine
 * - `archived`  — this user's archived custom entries, however they arrived
 *
 * Imported entries are out of `available` and `mine` on purpose. Importing a
 * routine can mint up to 50 library rows named by a stranger, and having those
 * silently join every picker you open would make someone else's naming your
 * problem. They are still fully yours — history and records log against them,
 * and `getRecentExercises` surfaces them the moment you have trained one — but
 * reaching for one in search is a deliberate act. `adoptImportedExercise`
 * clears the flag for good.
 */
export type ExerciseScope = "available" | "mine" | "imported" | "archived";

export type ExerciseFilters = {
  query?: string;
  muscle?: Muscle | "all";
  equipment?: Equipment | "all";
  /**
   * The manage view needs to reach archived entries; nothing that feeds a
   * picker ever should.
   */
  scope?: ExerciseScope;
};

/**
 * The filter half of the queries below, so they can't drift apart.
 *
 * `includeImported` is the one exemption, and `getRecentExercises` is its only
 * caller. Recent is by definition "things you have actually trained" — an
 * imported exercise you have logged sets against disappearing from it would be
 * a bug, not restraint. That exemption is also what makes hiding imports by
 * default safe: the moment one becomes part of your training it sits at the
 * top of every picker with no reveal needed.
 */
function filterWhere(
  userId: string,
  f: ExerciseFilters,
  { includeImported = false }: { includeImported?: boolean } = {},
) {
  const scope = f.scope ?? "available";
  const authored = and(eq(exercise.ownerId, userId), isNull(exercise.importedAt));
  const anyOfMine = eq(exercise.ownerId, userId);

  const ownership =
    scope === "archived"
      ? // Archival is a state, not a provenance: an archived import belongs in
        // the same management view as an archived exercise you wrote.
        anyOfMine
      : scope === "mine"
        ? includeImported
          ? anyOfMine
          : authored
        : scope === "imported"
          ? and(anyOfMine, sql`${exercise.importedAt} IS NOT NULL`)
          : or(isNull(exercise.ownerId), includeImported ? anyOfMine : authored);

  return and(
    ownership,
    scope === "archived"
      ? sql`${exercise.archivedAt} IS NOT NULL`
      : isNull(exercise.archivedAt),
    f.query && f.query.trim()
      ? ilike(exercise.name, `%${f.query.trim()}%`)
      : undefined,
    f.muscle && f.muscle !== "all"
      ? eq(exercise.primaryMuscle, f.muscle)
      : undefined,
    f.equipment && f.equipment !== "all"
      ? eq(exercise.equipment, f.equipment)
      : undefined,
  );
}

const LIST_COLUMNS = {
  id: exercise.id,
  name: exercise.name,
  primaryMuscle: exercise.primaryMuscle,
  equipment: exercise.equipment,
  trackingType: exercise.trackingType,
  ownerId: exercise.ownerId,
  archivedAt: exercise.archivedAt,
  importedAt: exercise.importedAt,
  // Not surfaced to the UI — selected because the cursor is built from it.
  popularity: exercise.popularity,
} as const;

type ListRow = {
  id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  trackingType: string;
  ownerId: string | null;
  archivedAt: Date | string | null;
  importedAt: Date | string | null;
  popularity: number;
};

function toListItem(r: ListRow, lastPerformedAt: Date | null = null) {
  return {
    id: r.id,
    name: r.name,
    primaryMuscle: r.primaryMuscle,
    equipment: r.equipment,
    trackingType: r.trackingType,
    isCustom: r.ownerId != null,
    isArchived: r.archivedAt != null,
    isImported: r.importedAt != null,
    lastPerformedAt,
  };
}

/**
 * One batch of the library, most commonly trained first, keyset-paginated.
 *
 * This used to select every matching row with a correlated `MAX(started_at)`
 * subquery per row and re-sort the lot in JS, so opening a picker cost one
 * scan of the whole library — against a scale-to-zero database, on a phone,
 * before anything could render. Recency now comes from `getRecentExercises`,
 * which is bounded, and the rest arrives a page at a time as the user scrolls.
 *
 * Ordered by `(popularity DESC, name, id)` — see `seed-data/popularity.ts` for
 * where the ranking comes from. That triple is also the cursor: `ORDER BY` and
 * the comparison have to agree on collation, and they do when both are the
 * plain columns. Unranked rows score 0 and so tail the list alphabetically,
 * which is also where custom exercises land — they are reachable through
 * "Recent" and through search either way.
 */
export async function searchExercisePage(
  userId: string,
  {
    after,
    limit = EXERCISE_PAGE_SIZE,
    ...filters
  }: ExerciseFilters & { after?: ExerciseCursor | null; limit?: number } = {},
): Promise<ExercisePage> {
  const rows = await db
    .select(LIST_COLUMNS)
    .from(exercise)
    .where(
      and(
        filterWhere(userId, filters),
        after
          ? or(
              lt(exercise.popularity, after.popularity),
              and(
                eq(exercise.popularity, after.popularity),
                or(
                  gt(exercise.name, after.name),
                  and(eq(exercise.name, after.name), gt(exercise.id, after.id)),
                ),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(exercise.popularity), asc(exercise.name), asc(exercise.id))
    .limit(limit);

  const last = rows[rows.length - 1];
  return {
    items: rows.map((r) => toListItem(r)),
    // A short page means the library is spent — no extra count query, and no
    // trailing request that comes back empty.
    cursor:
      last && rows.length === limit
        ? { popularity: last.popularity, name: last.name, id: last.id }
        : null,
  };
}

/**
 * The exercises this user has actually logged, most recent first — the group
 * that sits above the alphabetical batches in every picker.
 *
 * Bounded by construction: it starts from the user's own workout rows rather
 * than from the library, so its cost tracks their training history, not the
 * number of exercises that exist.
 */
export async function getRecentExercises(
  userId: string,
  { limit = EXERCISE_RECENT_LIMIT, ...filters }: ExerciseFilters & { limit?: number } = {},
): Promise<ExerciseListItem[]> {
  const rows = await db
    .select({
      ...LIST_COLUMNS,
      lastPerformedAt: sql<string | Date>`MAX(${workout.startedAt})`,
    })
    .from(exercise)
    .innerJoin(workoutExercise, eq(workoutExercise.exerciseId, exercise.id))
    .innerJoin(
      workout,
      and(eq(workout.id, workoutExercise.workoutId), eq(workout.userId, userId)),
    )
    .where(filterWhere(userId, filters, { includeImported: true }))
    // Grouping by the primary key is enough in Postgres — every other selected
    // column is functionally dependent on it.
    .groupBy(exercise.id)
    .orderBy(sql`MAX(${workout.startedAt}) DESC`)
    .limit(limit);

  // Drizzle has no column definition to decode a raw `sql` fragment against,
  // so this arrives as whatever the driver produced — normalise rather than
  // assume it is already a Date.
  return rows.map((r) => toListItem(r, new Date(r.lastPerformedAt)));
}

/**
 * The imported exercises that match the filters the user is already searching
 * with — what the picker's "Show N from imported routines" row expands.
 *
 * Fetched rather than counted, and capped. A `COUNT(*)` would cost the same
 * scan and then need a second round trip to show anything, so the reveal would
 * spin; with the rows already in hand it is instant. `limit + 1` so the UI can
 * honestly say "25+" rather than a wrong number.
 *
 * Cheap for the same reason `getRecentExercises` is: `owner_id = $me` bounds it
 * to one person's own custom rows, not the library.
 */
export async function getImportedMatches(
  userId: string,
  filters: ExerciseFilters = {},
  limit = IMPORTED_HINT_LIMIT,
): Promise<ExerciseListItem[]> {
  const rows = await db
    .select(LIST_COLUMNS)
    .from(exercise)
    .where(filterWhere(userId, { ...filters, scope: "imported" }))
    .orderBy(desc(exercise.popularity), asc(exercise.name), asc(exercise.id))
    .limit(limit + 1);
  return rows.map((r) => toListItem(r));
}

/**
 * Whole-library read, kept for callers that genuinely want every match (tests
 * and the query checker). Nothing user-facing should use it — that is what
 * `searchExercisePage` is for.
 */
export async function searchExercises(
  userId: string,
  { limit = 500, ...filters }: ExerciseFilters & { limit?: number } = {},
): Promise<ExerciseListItem[]> {
  const { items } = await searchExercisePage(userId, { ...filters, limit });
  return items;
}

/**
 * Resolve a handful of ids the user just picked. Scoped like every other read
 * here: built-ins plus their own, so an id from someone else's library comes
 * back empty rather than named.
 */
export async function getExercisesByIds(
  userId: string,
  ids: string[],
): Promise<ExerciseListItem[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select(LIST_COLUMNS)
    .from(exercise)
    .where(
      and(
        inArray(exercise.id, ids),
        or(isNull(exercise.ownerId), eq(exercise.ownerId, userId)),
      ),
    );
  return rows.map((r) => toListItem(r));
}

export async function getExercise(id: string) {
  const [row] = await db
    .select()
    .from(exercise)
    .where(eq(exercise.id, id))
    .limit(1);
  return row ?? null;
}

export type ExerciseAlternativeItem = {
  id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  /** How this one's effect on the body differs from the exercise you're on. */
  note: string;
};

/**
 * Curated "try this instead" list for one exercise.
 *
 * Only ever resolves to built-ins. The ownerId filter is defensive rather than
 * necessary today — nothing writes user-authored alternatives — but it means
 * this surface could never leak another user's custom exercise name if that
 * ever changed.
 */
export async function getExerciseAlternatives(
  exerciseId: string,
): Promise<ExerciseAlternativeItem[]> {
  return db
    .select({
      id: exercise.id,
      name: exercise.name,
      primaryMuscle: exercise.primaryMuscle,
      equipment: exercise.equipment,
      note: exerciseAlternative.note,
    })
    .from(exerciseAlternative)
    .innerJoin(exercise, eq(exercise.id, exerciseAlternative.alternativeId))
    .where(
      and(eq(exerciseAlternative.exerciseId, exerciseId), isNull(exercise.ownerId)),
    )
    .orderBy(asc(exerciseAlternative.position), asc(exercise.name));
}

/**
 * What to offer first when swapping one exercise out for another: the curated
 * alternatives, then — because only a fraction of the library has pairs
 * authored for it — the most-trained movements that hit the same muscle and
 * are logged the same way.
 *
 * The tracking-type filter is what makes the fallback safe to apply blindly: a
 * suggestion that tracked distance where the block tracks reps would swap the
 * columns out from under sets the user is mid-way through.
 */
export async function getReplacementSuggestions(
  userId: string,
  exerciseId: string,
  limit = 8,
): Promise<ExerciseListItem[]> {
  const [source] = await db
    .select({
      primaryMuscle: exercise.primaryMuscle,
      trackingType: exercise.trackingType,
    })
    .from(exercise)
    .where(
      and(
        eq(exercise.id, exerciseId),
        or(isNull(exercise.ownerId), eq(exercise.ownerId, userId)),
      ),
    )
    .limit(1);
  if (!source) return [];

  const curated = await db
    .select(LIST_COLUMNS)
    .from(exerciseAlternative)
    .innerJoin(exercise, eq(exercise.id, exerciseAlternative.alternativeId))
    .where(
      and(
        eq(exerciseAlternative.exerciseId, exerciseId),
        isNull(exercise.ownerId),
        isNull(exercise.archivedAt),
      ),
    )
    .orderBy(asc(exerciseAlternative.position), asc(exercise.name))
    .limit(limit);

  const picked = curated.map((r) => toListItem(r));
  if (picked.length >= limit) return picked;

  const exclude = [exerciseId, ...picked.map((p) => p.id)];
  const sameMuscle = await db
    .select(LIST_COLUMNS)
    .from(exercise)
    .where(
      and(
        eq(exercise.primaryMuscle, source.primaryMuscle),
        eq(exercise.trackingType, source.trackingType),
        isNull(exercise.archivedAt),
        // Same default exclusion as every other list: an imported exercise is
        // reachable here through the picker's search and hint, and through
        // Recent once trained, but it is not offered unasked. "What shows by
        // default" should be one rule, not one per surface.
        or(
          isNull(exercise.ownerId),
          and(eq(exercise.ownerId, userId), isNull(exercise.importedAt)),
        ),
        not(inArray(exercise.id, exclude)),
      ),
    )
    .orderBy(desc(exercise.popularity), asc(exercise.name))
    .limit(limit - picked.length);

  return [...picked, ...sameMuscle.map((r) => toListItem(r))];
}

export type ExerciseHistoryPoint = {
  workoutId: string;
  date: Date;
  bestWeightKg: number | null;
  bestEst1rm: number | null;
  totalVolumeKg: number;
  sets: { weightKg: number | null; reps: number | null; setType: string }[];
};

/** Per-session history for one exercise — the chart + log on exercise detail. */
export async function getExerciseHistory(
  userId: string,
  exerciseId: string,
  limit = 30,
): Promise<ExerciseHistoryPoint[]> {
  const rows = await db
    .select({
      workoutId: workout.id,
      date: workout.startedAt,
      weightKg: workoutSet.weightKg,
      reps: workoutSet.reps,
      setType: workoutSet.setType,
      est: workoutSet.estimated1rm,
    })
    .from(workoutSet)
    .innerJoin(
      workoutExercise,
      eq(workoutExercise.id, workoutSet.workoutExerciseId),
    )
    .innerJoin(workout, eq(workout.id, workoutExercise.workoutId))
    .where(
      and(
        eq(workout.userId, userId),
        eq(workoutExercise.exerciseId, exerciseId),
        sql`${workout.endedAt} IS NOT NULL`,
        sql`${workoutSet.completedAt} IS NOT NULL`,
      ),
    )
    .orderBy(desc(workout.startedAt), asc(workoutSet.position));

  const byWorkout = new Map<string, ExerciseHistoryPoint>();
  for (const r of rows) {
    let point = byWorkout.get(r.workoutId);
    if (!point) {
      point = {
        workoutId: r.workoutId,
        date: r.date,
        bestWeightKg: null,
        bestEst1rm: null,
        totalVolumeKg: 0,
        sets: [],
      };
      byWorkout.set(r.workoutId, point);
    }
    point.sets.push({ weightKg: r.weightKg, reps: r.reps, setType: r.setType });
    if (r.setType !== "warmup") {
      point.totalVolumeKg += (r.weightKg ?? 0) * (r.reps ?? 0);
      if (r.weightKg != null && (point.bestWeightKg ?? -1) < r.weightKg) {
        point.bestWeightKg = r.weightKg;
      }
      if (r.est != null && (point.bestEst1rm ?? -1) < r.est) {
        point.bestEst1rm = r.est;
      }
    }
  }

  return [...byWorkout.values()].slice(0, limit);
}

export async function getExerciseRecords(userId: string, exerciseId: string) {
  return db
    .select()
    .from(personalRecord)
    .where(
      and(
        eq(personalRecord.userId, userId),
        eq(personalRecord.exerciseId, exerciseId),
      ),
    );
}

export type ExerciseSessionPoint = {
  workoutId: string;
  date: Date;
  topWeightKg: number | null;
  bestEst1rm: number | null;
  volumeKg: number;
  reps: number;
  sets: number;
};

/**
 * One row per completed session of this exercise, oldest first — the series
 * behind every chart on the detail screen.
 *
 * Aggregated in SQL rather than by grouping set rows in JS: the charts only
 * ever need per-session figures, and a lifter with three years of history has
 * thousands of sets but only a few hundred sessions. `getExerciseHistory`
 * still returns set-level detail, because the History tab prints every set.
 *
 * Warm-ups are excluded throughout, matching `recalculatePersonalRecords`.
 */
export async function getExerciseSessionSeries(
  userId: string,
  exerciseId: string,
): Promise<ExerciseSessionPoint[]> {
  const res = await db.execute<{
    workout_id: string;
    date: string | Date;
    top_weight: number | null;
    best_e1rm: number | null;
    volume: number;
    reps: number;
    sets: number;
  }>(sql`
    SELECT
      w.id                                                    AS workout_id,
      w.started_at                                            AS date,
      MAX(ws.weight_kg)                                       AS top_weight,
      MAX(ws.estimated_1rm)                                   AS best_e1rm,
      COALESCE(SUM(COALESCE(ws.weight_kg, 0)
                 * COALESCE(ws.reps, 0)), 0)::real            AS volume,
      COALESCE(SUM(COALESCE(ws.reps, 0)), 0)::int             AS reps,
      COUNT(*)::int                                           AS sets
    FROM workout_set ws
    JOIN workout_exercise we ON we.id = ws.workout_exercise_id
    JOIN workout w           ON w.id = we.workout_id
    WHERE w.user_id = ${userId}
      AND we.exercise_id = ${exerciseId}::uuid
      AND w.ended_at IS NOT NULL
      AND ws.completed_at IS NOT NULL
      AND ws.set_type <> 'warmup'
    GROUP BY w.id, w.started_at
    ORDER BY w.started_at ASC
  `);

  return res.rows.map((r) => ({
    workoutId: r.workout_id,
    date: new Date(r.date),
    topWeightKg: r.top_weight,
    bestEst1rm: r.best_e1rm,
    volumeKg: r.volume,
    reps: r.reps,
    sets: r.sets,
  }));
}

export type RepMax = {
  reps: number;
  weightKg: number;
  /** Epley estimate for this weight × reps, so rows are comparable. */
  estimated1rm: number;
  achievedAt: Date;
  workoutId: string;
};

/**
 * Heaviest weight ever lifted at each rep count, 1–12.
 *
 * The "best performance at each rep" table: two lifters with the same 1RM can
 * have very different rep strength, and it's the row you actually pick a
 * working weight from.
 */
export async function getExerciseRepMaxes(
  userId: string,
  exerciseId: string,
  maxReps = 12,
): Promise<RepMax[]> {
  const res = await db.execute<{
    reps: number;
    weight_kg: number;
    estimated_1rm: number | null;
    achieved_at: string | Date;
    workout_id: string;
  }>(sql`
    SELECT DISTINCT ON (ws.reps)
      ws.reps,
      ws.weight_kg,
      ws.estimated_1rm,
      w.started_at AS achieved_at,
      w.id         AS workout_id
    FROM workout_set ws
    JOIN workout_exercise we ON we.id = ws.workout_exercise_id
    JOIN workout w           ON w.id = we.workout_id
    WHERE w.user_id = ${userId}
      AND we.exercise_id = ${exerciseId}::uuid
      AND w.ended_at IS NOT NULL
      AND ws.completed_at IS NOT NULL
      AND ws.set_type <> 'warmup'
      AND ws.reps BETWEEN 1 AND ${maxReps}
      AND COALESCE(ws.weight_kg, 0) > 0
    ORDER BY ws.reps ASC, ws.weight_kg DESC, w.started_at ASC
  `);

  return res.rows.map((r) => ({
    reps: r.reps,
    weightKg: r.weight_kg,
    estimated1rm: r.estimated_1rm ?? r.weight_kg * (1 + r.reps / 30),
    achievedAt: new Date(r.achieved_at),
    workoutId: r.workout_id,
  }));
}

export type ExerciseSummary = {
  sessions: number;
  sets: number;
  reps: number;
  volumeKg: number;
  firstPerformedAt: Date | null;
  lastPerformedAt: Date | null;
};

/** The header figures on the exercise detail screen. */
export async function getExerciseSummary(
  userId: string,
  exerciseId: string,
): Promise<ExerciseSummary> {
  const res = await db.execute<{
    sessions: number;
    sets: number;
    reps: number;
    volume: number;
    first_at: string | Date | null;
    last_at: string | Date | null;
  }>(sql`
    SELECT
      COUNT(DISTINCT w.id)::int                              AS sessions,
      COUNT(ws.id)::int                                      AS sets,
      COALESCE(SUM(COALESCE(ws.reps, 0)), 0)::int            AS reps,
      COALESCE(SUM(COALESCE(ws.weight_kg, 0)
                 * COALESCE(ws.reps, 0)), 0)::real           AS volume,
      MIN(w.started_at)                                      AS first_at,
      MAX(w.started_at)                                      AS last_at
    FROM workout_set ws
    JOIN workout_exercise we ON we.id = ws.workout_exercise_id
    JOIN workout w           ON w.id = we.workout_id
    WHERE w.user_id = ${userId}
      AND we.exercise_id = ${exerciseId}::uuid
      AND w.ended_at IS NOT NULL
      AND ws.completed_at IS NOT NULL
      AND ws.set_type <> 'warmup'
  `);

  const row = res.rows[0];
  return {
    sessions: row?.sessions ?? 0,
    sets: row?.sets ?? 0,
    reps: row?.reps ?? 0,
    volumeKg: row?.volume ?? 0,
    firstPerformedAt: row?.first_at ? new Date(row.first_at) : null,
    lastPerformedAt: row?.last_at ? new Date(row.last_at) : null,
  };
}

/** Current 1RM records keyed by exercise — lets the workout screen flag PRs live. */
export async function getCurrent1rmRecords(
  userId: string,
  exerciseIds: string[],
): Promise<Record<string, number>> {
  if (!exerciseIds.length) return {};
  const rows = await db
    .select({
      exerciseId: personalRecord.exerciseId,
      value: personalRecord.value,
    })
    .from(personalRecord)
    .where(
      and(
        eq(personalRecord.userId, userId),
        eq(personalRecord.kind, "1rm"),
        inArray(personalRecord.exerciseId, exerciseIds),
      ),
    );
  return Object.fromEntries(rows.map((r) => [r.exerciseId, r.value]));
}

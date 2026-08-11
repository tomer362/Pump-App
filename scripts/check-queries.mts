/**
 * Executes every read query against the database and reports which ones throw.
 *
 * Correlated subqueries written with drizzle's `sql` template can silently
 * render an unqualified column name, which only fails at execution time — this
 * catches all of them in one pass instead of one screen at a time.
 *
 *   pnpm check:queries
 */
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db/index.ts";
import {
  exercise,
  exerciseAlternative,
  gym,
  gymMember,
  workout,
} from "../src/lib/db/schema.ts";
import * as workoutQ from "../src/lib/queries/workout.ts";
import * as exerciseQ from "../src/lib/queries/exercise.ts";
import * as routineQ from "../src/lib/queries/routine.ts";
import * as socialQ from "../src/lib/queries/social.ts";
import * as statsQ from "../src/lib/queries/stats.ts";

/**
 * Prefer a user who has actually finished a workout, deterministically —
 * `SELECT ... LIMIT 1` with no ORDER BY picked whichever row the planner felt
 * like that run, which was often a throwaway test account with no data, so
 * every join in every query below returned zero rows and "ok" meant nothing
 * beyond "didn't throw." Ordering by workout count, then id, makes the run
 * repeatable and gives the correlated subqueries and joins real rows to touch.
 */
const [best] = await db.execute<{ id: string }>(sql`
  SELECT u.id
  FROM "user" u
  LEFT JOIN ${workout} w ON w.user_id = u.id AND w.ended_at IS NOT NULL
  GROUP BY u.id
  ORDER BY COUNT(w.id) DESC, u.id
  LIMIT 1
`).then((r) => r.rows);
if (!best) {
  console.error("No users in the database — sign in once first.");
  process.exit(1);
}
const uid = best.id;

// A real exercise id, so the empty-array early-return in getPreviousSets and
// getCurrent1rmRecords doesn't skip their SQL entirely — that early return is
// exactly why 3 of these cases used to report "ok" without ever reaching the
// database, including the one query built with sql.join(...) interpolation,
// which is the exact class of bug this script exists to catch.
const [anyExercise] = await db.select({ id: exercise.id }).from(exercise).limit(1);
if (!anyExercise) {
  console.error("No exercises in the database — run `pnpm db:seed` first.");
  process.exit(1);
}
const eid = anyExercise.id;

// A real (gym, member) pair, if one exists, so getGymDetail's member-roster
// query (with its leftJoin on gymPresence) actually runs instead of returning
// early on "not a member of this gym" — the function requires the viewer to
// be a member of the exact gym requested, so this has to be one real row, not
// an arbitrary gym id paired with an arbitrary user id. Falls back to a
// placeholder — and says so — if no gym has ever been created.
const [anyGymMembership] = await db
  .select({ gymId: gymMember.gymId, userId: gymMember.userId })
  .from(gymMember)
  .innerJoin(gym, sql`${gym.id} = ${gymMember.gymId}`)
  .limit(1);
const gymCase: [string, () => Promise<unknown>] = anyGymMembership
  ? [
      "social.getGymDetail",
      () => socialQ.getGymDetail(anyGymMembership.gymId, anyGymMembership.userId),
    ]
  : [
      "social.getGymDetail (SHALLOW — no gym in the database, only the not-found path ran)",
      () => socialQ.getGymDetail("00000000-0000-0000-0000-000000000000", uid),
    ];

// An exercise that actually has curated alternatives, so the join in
// getExerciseAlternatives touches real rows rather than returning empty on an
// arbitrary id — the same reason the gym case above picks a real membership.
const [anyAlt] = await db
  .select({ exerciseId: exerciseAlternative.exerciseId })
  .from(exerciseAlternative)
  .limit(1);
const altCase: [string, () => Promise<unknown>] = anyAlt
  ? [
      "exercise.getExerciseAlternatives",
      () => exerciseQ.getExerciseAlternatives(anyAlt.exerciseId),
    ]
  : [
      "exercise.getExerciseAlternatives (SHALLOW — no alternatives seeded, only the empty path ran)",
      () => exerciseQ.getExerciseAlternatives(eid),
    ];

const cases: [string, () => Promise<unknown>][] = [
  ["workout.getActiveWorkoutSummary", () => workoutQ.getActiveWorkoutSummary(uid)],
  ["workout.getWorkoutHistory", () => workoutQ.getWorkoutHistory(uid)],
  ["workout.getPersonalRecords", () => workoutQ.getPersonalRecords(uid)],
  ["workout.getPreviousSets", () => workoutQ.getPreviousSets(uid, null, [eid])],
  ["exercise.searchExercises", () => exerciseQ.searchExercises(uid, { query: "bench" })],
  [
    // Multi-token search builds one OR-group per token across three columns —
    // a different predicate shape from the single-token case above.
    "exercise.searchExercises (multi-token)",
    () => exerciseQ.searchExercises(uid, { query: "incline dumbbell" }),
  ],
  [
    // The spelling-tolerant rescue. Only reachable through a query that matches
    // nothing literally, which is the point: this is the one path that calls
    // word_similarity, so pg_trgm missing from the database fails here rather
    // than in front of a user.
    "exercise.searchExercises (fuzzy rescue)",
    () => exerciseQ.searchExercises(uid, { query: "incilne" }),
  ],
  ["exercise.getCurrent1rmRecords", () => exerciseQ.getCurrent1rmRecords(uid, [eid])],
  ["exercise.searchExercises (mine)", () => exerciseQ.searchExercises(uid, { scope: "mine" })],
  ["exercise.searchExercises (archived)", () => exerciseQ.searchExercises(uid, { scope: "archived" })],
  ["exercise.searchExercises (imported)", () => exerciseQ.searchExercises(uid, { scope: "imported" })],
  ["exercise.getImportedMatches", () => exerciseQ.getImportedMatches(uid, { query: "curl" })],
  ["exercise.searchExercisePage", () => exerciseQ.searchExercisePage(uid)],
  [
    // The imported scope has its own ownership predicate, so walk its keyset
    // too rather than assuming the default scope's page proves it.
    "exercise.searchExercisePage (imported, after cursor)",
    async () => {
      const first = await exerciseQ.searchExercisePage(uid, {
        scope: "imported",
        limit: 5,
      });
      return exerciseQ.searchExercisePage(uid, {
        scope: "imported",
        limit: 5,
        after: first.cursor,
      });
    },
  ],
  [
    // The keyset predicate only renders when a cursor is passed, so the first
    // page alone would leave the half that can actually be a syntax error
    // untested. Walk one batch forward.
    "exercise.searchExercisePage (after cursor)",
    async () => {
      const first = await exerciseQ.searchExercisePage(uid, { limit: 5 });
      return exerciseQ.searchExercisePage(uid, { limit: 5, after: first.cursor });
    },
  ],
  ["exercise.getRecentExercises", () => exerciseQ.getRecentExercises(uid)],
  ["exercise.getExercisesByIds", () => exerciseQ.getExercisesByIds(uid, [eid])],
  ["exercise.getExercise", () => exerciseQ.getExercise(eid)],
  ["exercise.getExerciseHistory", () => exerciseQ.getExerciseHistory(uid, eid)],
  ["exercise.getExerciseRecords", () => exerciseQ.getExerciseRecords(uid, eid)],
  ["exercise.getExerciseSessionSeries", () => exerciseQ.getExerciseSessionSeries(uid, eid)],
  ["exercise.getExerciseRepMaxes", () => exerciseQ.getExerciseRepMaxes(uid, eid)],
  ["exercise.getExerciseSummary", () => exerciseQ.getExerciseSummary(uid, eid)],
  ["exercise.getLastLoggedSet", () => exerciseQ.getLastLoggedSet(uid, eid)],
  altCase,
  [
    "exercise.getReplacementSuggestions",
    () => exerciseQ.getReplacementSuggestions(uid, eid),
  ],
  ["routine.getRoutines", () => routineQ.getRoutines(uid)],
  ["routine.getFollowedRoutines", () => routineQ.getFollowedRoutines(uid)],
  ["routine.getFolders", () => routineQ.getFolders(uid)],
  [
    "routine.getDiscoverRoutines(popular)",
    () => routineQ.getDiscoverRoutines(uid, { sort: "popular" }),
  ],
  [
    "routine.getDiscoverRoutines(new)",
    () => routineQ.getDiscoverRoutines(uid, { sort: "new" }),
  ],
  // The cursor branch is a different SQL shape (row-value comparison against a
  // uuid cast) and would otherwise only ever run on page two, in production.
  [
    "routine.getDiscoverRoutines(popular, cursor)",
    () =>
      routineQ.getDiscoverRoutines(uid, {
        sort: "popular",
        cursor: { value: 5, id: "00000000-0000-0000-0000-000000000000" },
      }),
  ],
  [
    "routine.getDiscoverRoutines(new, cursor)",
    () =>
      routineQ.getDiscoverRoutines(uid, {
        sort: "new",
        cursor: {
          value: new Date().toISOString(),
          id: "00000000-0000-0000-0000-000000000000",
        },
      }),
  ],
  ["social.getFollowingFeed", () => socialQ.getFollowingFeed(uid)],
  ["social.getDiscoveryFeed", () => socialQ.getDiscoveryFeed(uid)],
  ["social.getUserFeed", () => socialQ.getUserFeed(uid, uid)],
  ["social.searchPeople", () => socialQ.searchPeople(uid, "a")],
  ["social.getFriends", () => socialQ.getFriends(uid)],
  ["social.getPendingFriendRequests", () => socialQ.getPendingFriendRequests(uid)],
  ["social.getSentFriendRequests", () => socialQ.getSentFriendRequests(uid)],
  ["social.getFollowCounts", () => socialQ.getFollowCounts(uid)],
  ["social.getFriendsAtGym", () => socialQ.getFriendsAtGym(uid)],
  ["social.getMyPresence", () => socialQ.getMyPresence(uid)],
  ["social.getMyGyms", () => socialQ.getMyGyms(uid)],
  gymCase,
  ["stats.getMuscleVolume", () => statsQ.getMuscleVolume(uid, 7)],
  ["stats.getWeeklyTrend", () => statsQ.getWeeklyTrend(uid, 12)],
  ["stats.getLifetimeStats", () => statsQ.getLifetimeStats(uid)],
  ["stats.getTrainingCalendar", () => statsQ.getTrainingCalendar(uid, 200)],
  ["stats.getRecentRecords", () => statsQ.getRecentRecords(uid, 6)],
  ["stats.getAchievements", () => statsQ.getAchievements(uid)],
];

let failed = 0;
let shallow = 0;
for (const [name, run] of cases) {
  try {
    await run();
    console.log(`  ok    ${name}`);
    if (name.includes("SHALLOW")) shallow++;
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(err as Error).message.split("\n")[0]}`);
  }
}

console.log(
  failed ? `\n${failed} query/queries failed.` : `\nAll ${cases.length} queries ran.`,
);
if (shallow) {
  console.log(
    `${shallow} of them only exercised a shortcut path — see "SHALLOW" above.`,
  );
}
process.exit(failed ? 1 : 0);

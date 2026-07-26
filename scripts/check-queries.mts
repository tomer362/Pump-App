/**
 * Executes every read query against the database and reports which ones throw.
 *
 * Correlated subqueries written with drizzle's `sql` template can silently
 * render an unqualified column name, which only fails at execution time — this
 * catches all of them in one pass instead of one screen at a time.
 *
 *   pnpm check:queries
 */
import { db } from "../src/lib/db/index.ts";
import { user } from "../src/lib/db/schema.ts";
import * as workoutQ from "../src/lib/queries/workout.ts";
import * as exerciseQ from "../src/lib/queries/exercise.ts";
import * as routineQ from "../src/lib/queries/routine.ts";
import * as socialQ from "../src/lib/queries/social.ts";
import * as statsQ from "../src/lib/queries/stats.ts";

const [anyUser] = await db.select().from(user).limit(1);
if (!anyUser) {
  console.error("No users in the database — sign in once first.");
  process.exit(1);
}
const uid = anyUser.id;

const cases: [string, () => Promise<unknown>][] = [
  ["workout.getActiveWorkoutSummary", () => workoutQ.getActiveWorkoutSummary(uid)],
  ["workout.getWorkoutHistory", () => workoutQ.getWorkoutHistory(uid)],
  ["workout.getWorkoutCount", () => workoutQ.getWorkoutCount(uid)],
  ["workout.getPersonalRecords", () => workoutQ.getPersonalRecords(uid)],
  ["workout.getWorkoutDays", () => workoutQ.getWorkoutDays(uid, new Date(0))],
  ["workout.getPreviousSets", () => workoutQ.getPreviousSets(uid, null, [])],
  ["exercise.searchExercises", () => exerciseQ.searchExercises(uid, { query: "bench" })],
  ["exercise.getCurrent1rmRecords", () => exerciseQ.getCurrent1rmRecords(uid, [])],
  ["routine.getRoutines", () => routineQ.getRoutines(uid)],
  ["routine.getFollowedRoutines", () => routineQ.getFollowedRoutines(uid)],
  ["social.getFollowingFeed", () => socialQ.getFollowingFeed(uid)],
  ["social.getDiscoveryFeed", () => socialQ.getDiscoveryFeed(uid)],
  ["social.searchPeople", () => socialQ.searchPeople(uid, "a")],
  ["social.getFriends", () => socialQ.getFriends(uid)],
  ["social.getPendingFriendRequests", () => socialQ.getPendingFriendRequests(uid)],
  ["social.getFollowCounts", () => socialQ.getFollowCounts(uid)],
  ["social.getFriendsAtGym", () => socialQ.getFriendsAtGym(uid)],
  ["social.getMyPresence", () => socialQ.getMyPresence(uid)],
  ["social.getMyGyms", () => socialQ.getMyGyms(uid)],
  ["stats.getMuscleVolume", () => statsQ.getMuscleVolume(uid, 7)],
  ["stats.getWeeklyTrend", () => statsQ.getWeeklyTrend(uid, 12)],
  ["stats.getLifetimeStats", () => statsQ.getLifetimeStats(uid)],
  ["stats.getAchievements", () => statsQ.getAchievements(uid)],
];

let failed = 0;
for (const [name, run] of cases) {
  try {
    await run();
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${(err as Error).message.split("\n")[0]}`);
  }
}

console.log(
  failed ? `\n${failed} query/queries failed.` : `\nAll ${cases.length} queries ran.`,
);
process.exit(failed ? 1 : 0);

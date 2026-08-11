"use server";

import { getCurrentUser } from "@/lib/session";
import { exerciseVideoLink } from "@/lib/exercise-video";
import {
  getExercise,
  getExerciseAlternatives,
  getExercisesByIds,
  getImportedMatches,
  getRecentExercises,
  getReplacementSuggestions,
  searchExercisePage,
  type ExerciseCursor,
  type ExerciseFilters,
  type ExerciseListItem,
  type ExercisePage,
} from "@/lib/queries/exercise";
import type { ExerciseAboutData } from "@/components/exercise/exercise-about";

/**
 * Client-callable wrappers around the exercise reads. Kept separate from the
 * query module so `server-only` still guards direct DB access.
 */

export type ExerciseBatch = ExercisePage & {
  /**
   * Only on the opening batch of a set of filters — the recent group doesn't
   * change as you scroll, so refetching it per batch would be one wasted
   * round-trip per scroll.
   */
  recent?: ExerciseListItem[];
  /**
   * Matches hidden by the default scope, for the "Show N from imported
   * routines" row. Present only on the opening batch of a *narrowed* search —
   * see the conditions in `searchExerciseBatchAction`.
   */
  imported?: ExerciseListItem[];
};

/**
 * Whether to probe for hidden imported matches at all.
 *
 * Only when the user has actually narrowed. That kills the extra query on the
 * single most common path — opening a picker cold — and it matches the reveal
 * rule in the UI: unfiltered browsing never shows the hint, so unfiltered
 * browsing shouldn't pay for it.
 */
function hasNarrowed(f: ExerciseFilters) {
  return Boolean(
    f.query?.trim() ||
      (f.muscle && f.muscle !== "all") ||
      (f.equipment && f.equipment !== "all"),
  );
}

/**
 * One batch of results for the current filters. Without a cursor this is the
 * opening batch and carries the recent group with it, so a picker opens on a
 * single request; with one it is the next scroll batch and carries only rows.
 */
export async function searchExerciseBatchAction(
  params: ExerciseFilters & { after?: ExerciseCursor | null },
): Promise<ExerciseBatch> {
  const me = await getCurrentUser();
  if (!me) return { items: [], cursor: null, fuzzy: false, recent: [] };

  const { after, ...filters } = params;
  if (after) return searchExercisePage(me.id, { ...filters, after });

  // Three parallel queries at most, still one round trip. The imported probe
  // rides the request the picker was making anyway, and only when the default
  // scope is in play — `imported` and `archived` are explicit choices that
  // need no hint about themselves.
  const probeImported =
    (filters.scope ?? "available") === "available" && hasNarrowed(filters);

  const companions = (f: ExerciseFilters) =>
    Promise.all([
      // Archived entries are a management view, not something you reach for
      // mid-workout — a recent group there would only push the list down.
      f.scope === "archived"
        ? Promise.resolve<ExerciseListItem[]>([])
        : getRecentExercises(me.id, f),
      probeImported
        ? getImportedMatches(me.id, f)
        : Promise.resolve<ExerciseListItem[]>([]),
    ]);

  const [page, [recent, imported]] = await Promise.all([
    searchExercisePage(me.id, filters),
    companions(filters),
  ]);

  // The page fell back to a spelling-tolerant match, so these two were asking
  // the wrong question — they matched literally and came back empty. Ask again
  // the way the page ended up asking, or a typo'd search shows a list of
  // results with an empty "Recent" above it for exercises the user trains.
  if (page.fuzzy) {
    const [fuzzyRecent, fuzzyImported] = await companions({
      ...filters,
      fuzzy: true,
    });
    return { ...page, recent: fuzzyRecent, imported: fuzzyImported };
  }

  return { ...page, recent, imported };
}

/**
 * The About panel for one exercise, for a sheet that has an id and no page
 * behind it — the routine builder, which can't navigate to `/exercises/[id]`
 * without discarding the unsaved routine.
 *
 * **The ownership check is this function's own job.** `getExercise` deliberately
 * takes no owner filter; the detail page applies one and 404s. Every export of
 * a `"use server"` module is a public POST endpoint, so relying on the caller
 * would make this the way to read a stranger's custom exercise — the one thing
 * `scripts/check-authz.mjs` already pins for the page. Missing and forbidden
 * both return null: the caller renders the same thing either way, and telling
 * them apart would confirm the id exists.
 *
 * Sequential rather than parallel with the alternatives read, so an id that
 * isn't the caller's costs one query and touches nothing else.
 */
export async function getExerciseAboutAction(
  exerciseId: string,
): Promise<
  | (ExerciseAboutData & {
      name: string;
      primaryMuscle: string;
      equipment: string;
    })
  | null
> {
  const me = await getCurrentUser();
  if (!me) return null;

  const row = await getExercise(exerciseId);
  if (!row) return null;
  if (row.ownerId && row.ownerId !== me.id) return null;

  return {
    name: row.name,
    primaryMuscle: row.primaryMuscle,
    equipment: row.equipment,
    bodyEffect: row.bodyEffect,
    instructions: row.instructions,
    secondaryMuscles: row.secondaryMuscles,
    video: exerciseVideoLink(row),
    alternatives: await getExerciseAlternatives(exerciseId),
  };
}

/**
 * What to show at the top of the picker when it opens to swap an exercise out.
 * Nothing here is privileged — it is the same library every picker reads — so
 * an unrecognised id comes back empty rather than as an error.
 */
export async function getReplacementSuggestionsAction(
  exerciseId: string,
): Promise<ExerciseListItem[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  return getReplacementSuggestions(me.id, exerciseId);
}

/** Names and metadata for the ids a user just selected in a picker. */
export async function getExercisesByIdsAction(
  ids: string[],
): Promise<ExerciseListItem[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  return getExercisesByIds(me.id, ids);
}

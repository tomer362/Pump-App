"use server";

import { getCurrentUser } from "@/lib/session";
import {
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
  if (!me) return { items: [], cursor: null, recent: [] };

  const { after, ...filters } = params;
  if (after) return searchExercisePage(me.id, { ...filters, after });

  // Three parallel queries at most, still one round trip. The imported probe
  // rides the request the picker was making anyway, and only when the default
  // scope is in play — `imported` and `archived` are explicit choices that
  // need no hint about themselves.
  const probeImported =
    (filters.scope ?? "available") === "available" && hasNarrowed(filters);

  const [page, recent, imported] = await Promise.all([
    searchExercisePage(me.id, filters),
    // Archived entries are a management view, not something you reach for
    // mid-workout — a recent group there would only push the list down.
    filters.scope === "archived"
      ? Promise.resolve<ExerciseListItem[]>([])
      : getRecentExercises(me.id, filters),
    probeImported
      ? getImportedMatches(me.id, filters)
      : Promise.resolve<ExerciseListItem[]>([]),
  ]);
  return { ...page, recent, imported };
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

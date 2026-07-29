"use server";

import { getCurrentUser } from "@/lib/session";
import {
  getExercisesByIds,
  getRecentExercises,
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
};

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

  const [page, recent] = await Promise.all([
    searchExercisePage(me.id, filters),
    // Archived entries are a management view, not something you reach for
    // mid-workout — a recent group there would only push the list down.
    filters.scope === "archived"
      ? Promise.resolve<ExerciseListItem[]>([])
      : getRecentExercises(me.id, filters),
  ]);
  return { ...page, recent };
}

/** Names and metadata for the ids a user just selected in a picker. */
export async function getExercisesByIdsAction(
  ids: string[],
): Promise<ExerciseListItem[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  return getExercisesByIds(me.id, ids);
}

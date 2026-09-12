"use server";

import { getCurrentUser } from "@/lib/session";
import { isUuid } from "@/lib/uuid";
import { exerciseVideoLink } from "@/lib/exercise-video";
import { RECENT_BONUS } from "@/lib/exercise-match";
import { tokenizeQuery } from "@/lib/exercise-search-terms";
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
import type { ExerciseAboutSheetData } from "@/components/exercise/exercise-about";

/**
 * Client-callable wrappers around the exercise reads. Kept separate from the
 * query module so `server-only` still guards direct DB access.
 */

export type ExerciseBatch = ExercisePage & {
  /**
   * Only on the opening batch of a set of filters — the recent group doesn't
   * change as you scroll, so refetching it per batch would be one wasted
   * round-trip per scroll. Empty while a text search is running: a search is
   * one ranked list, and a group pinned above it would override the ranking.
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

  if (tokenizeQuery(filters.query ?? "").length === 0) {
    return { ...page, recent, imported };
  }

  return { ...page, items: foldInRecent(page.items, recent), recent: [], imported };
}

/**
 * One ranked list for a text search, with what the user actually trains lifted
 * inside it.
 *
 * Browsing keeps its "Recent" group; searching cannot. A group pinned above the
 * results would put a mediocre match above a perfect one and undo the ranking
 * that is the point of the search — but dropping recency entirely is worse in
 * the place it matters most, a picker opened mid-session, where the bench press
 * variation you actually use should not sit third behind the two the library
 * happens to rank higher. So recency becomes a bonus inside the one ordering
 * rather than a shelf above it, big enough to lift a row past its ties and too
 * small to lift it past a better match.
 *
 * Recent rows that the ranked block didn't reach are appended before sorting:
 * both lists come from the same matcher, so a row here is a row that matched,
 * and having trained something is the strongest reason there is to show it.
 */
function foldInRecent(
  items: ExerciseListItem[],
  recent: ExerciseListItem[],
): ExerciseListItem[] {
  if (recent.length === 0) return items;

  const boosted = new Set(recent.map((r) => r.id));
  const merged = [...items];
  const seen = new Set(items.map((i) => i.id));
  for (const r of recent) if (!seen.has(r.id)) merged.push(r);

  const rank = (e: ExerciseListItem) =>
    (e.matchScore ?? 0) + (boosted.has(e.id) ? RECENT_BONUS : 0);

  // Stable, so rows the bonus can't separate keep the order the ranking gave
  // them — which already breaks ties on popularity, then name, then id.
  return merged.sort((a, b) => rank(b) - rank(a));
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
): Promise<ExerciseAboutSheetData | null> {
  const me = await getCurrentUser();
  if (!me) return null;
  if (!isUuid(exerciseId)) return null;

  const row = await getExercise(exerciseId);
  if (!row) return null;
  if (row.ownerId && row.ownerId !== me.id) return null;

  // The same two facts the detail page puts above its tabs, computed the same
  // way, so the sheet the routine builder opens instead of navigating can't
  // say less about the exercise than the page would.
  const archived = row.archivedAt != null;

  return {
    name: row.name,
    primaryMuscle: row.primaryMuscle,
    equipment: row.equipment,
    archived,
    imported: row.ownerId === me.id && !archived && row.importedAt != null,
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
  if (!isUuid(exerciseId)) return [];
  return getReplacementSuggestions(me.id, exerciseId);
}

/** Names and metadata for the ids a user just selected in a picker. */
export async function getExercisesByIdsAction(
  ids: string[],
): Promise<ExerciseListItem[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  // A picker hands back a handful of ids; anything else is not a picker. A
  // non-uuid element used to throw out of the query, and there was no bound
  // on how many a caller could ask for at once.
  if (!Array.isArray(ids) || ids.length > 50 || !ids.every(isUuid)) return [];
  return getExercisesByIds(me.id, ids);
}

"use server";

import { getCurrentUser } from "@/lib/session";
import { searchExercises, type ExerciseListItem } from "@/lib/queries/exercise";
import type { Equipment, Muscle } from "@/lib/db/schema";

/**
 * Client-callable wrapper around the exercise search. Kept separate from the
 * query module so `server-only` still guards direct DB access.
 */
export async function searchExercisesAction(params: {
  query?: string;
  muscle?: Muscle | "all";
  equipment?: Equipment | "all";
}): Promise<ExerciseListItem[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  return searchExercises(me.id, { ...params, limit: 500 });
}

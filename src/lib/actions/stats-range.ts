"use server";

import { getCurrentUser } from "@/lib/session";
import { getMuscleVolume, type MuscleVolume } from "@/lib/queries/stats";

// Not exported: every export of a `"use server"` module must be an async
// function, so the shared constant lives in `lib/stats-windows.ts`.
const ALLOWED = [7, 30, 90];

/**
 * Client-callable wrapper so the "by muscle" range switch doesn't need a
 * navigation. Kept out of the query module because `server-only` guards that;
 * the window is validated here rather than passed through, since every export
 * of a `"use server"` module is a public endpoint.
 */
export async function getMuscleVolumeAction(
  days: number,
): Promise<MuscleVolume[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  return getMuscleVolume(me.id, ALLOWED.includes(days) ? days : 7);
}

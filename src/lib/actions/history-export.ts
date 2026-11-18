"use server";

import { getExercise } from "@/lib/queries/exercise";
import {
  getHistoryExportRecords,
  getHistoryExportRows,
} from "@/lib/queries/history-export";
import {
  buildHistoryDocument,
  historyFilename,
  toHistoryCsv,
} from "@/lib/history-export";
import { getCurrentUser } from "@/lib/session";
import { isUuid } from "@/lib/uuid";
import { rateLimit } from "./rate-limit";
import type { ActionResult } from "./user";

export type HistoryExportFile = {
  filename: string;
  mime: string;
  body: string;
};

/**
 * Your own training history as a file — everything, or one exercise.
 *
 * There is no `userId` parameter: whose history is read comes from the session
 * and nowhere else, so this endpoint can only ever return the caller's own
 * sets. An exercise id is checked for the same visibility the exercise page
 * applies (a built-in, or a custom you own) so that a stranger's custom id
 * answers "not found" rather than an empty file named after their exercise.
 */
export async function exportHistory(input: {
  format: "csv" | "json";
  exerciseId?: string | null;
}): Promise<ActionResult<HistoryExportFile>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Not signed in" };

  const format = input?.format;
  if (format !== "csv" && format !== "json") {
    return { ok: false, error: "Unknown format" };
  }

  let exerciseId: string | undefined;
  let exerciseName: string | null = null;
  if (input.exerciseId != null) {
    if (!isUuid(input.exerciseId)) {
      return { ok: false, error: "Exercise not found" };
    }
    const ex = await getExercise(input.exerciseId);
    if (!ex || (ex.ownerId && ex.ownerId !== me.id)) {
      return { ok: false, error: "Exercise not found" };
    }
    exerciseId = ex.id;
    exerciseName = ex.name;
  }

  // The heaviest read in the app, and its whole output in one response.
  const limited = await rateLimit(me.id, "history_export", {
    limit: 30,
    windowSeconds: 3600,
  });
  if (!limited.ok) return limited;

  const [{ rows, truncated }, records] = await Promise.all([
    getHistoryExportRows(me.id, exerciseId),
    getHistoryExportRecords(me.id, exerciseId),
  ]);

  if (truncated) {
    return {
      ok: false,
      error:
        "That's more history than one file can hold. Export one exercise at a time.",
    };
  }
  if (rows.length === 0) {
    return {
      ok: false,
      error: exerciseName
        ? "Nothing logged for this exercise yet"
        : "No finished workouts to export yet",
    };
  }

  const now = new Date();
  const filename = historyFilename(format, now, exerciseName);

  if (format === "csv") {
    return {
      ok: true,
      data: {
        filename,
        mime: "text/csv",
        body: toHistoryCsv(rows, me.unit),
      },
    };
  }

  const doc = buildHistoryDocument(rows, records, {
    unit: me.unit,
    now,
    exerciseName,
  });
  return {
    ok: true,
    data: {
      filename,
      mime: "application/json",
      body: JSON.stringify(doc, null, 2),
    },
  };
}

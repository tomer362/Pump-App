"use client";

import { useEffect } from "react";
import { endWorkoutActivity } from "@/lib/workout-activity";

/**
 * Clears the workout notification, the armed rest alarm and the badge when the
 * app is open and no workout is running.
 *
 * `endWorkoutActivity()` is otherwise only called from finish and discard — the
 * two paths that *know* the session stopped. A session that was simply
 * abandoned (force-quit mid-workout, or finished on another device) hits
 * neither, so its banner sat on the lock screen indefinitely and read as one
 * more notification piling up. The server has already told this layout whether
 * a workout is live; if it isn't, nothing on the phone should still be saying
 * one is.
 *
 * Renders nothing, and is mounted only in the `(app)` shell — the workout
 * screen itself lives outside that group, so this can never fire against a
 * session that is running.
 */
export function ClearStaleWorkoutActivity() {
  useEffect(() => {
    endWorkoutActivity();
  }, []);

  return null;
}

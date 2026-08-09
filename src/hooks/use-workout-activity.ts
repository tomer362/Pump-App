"use client";

import { useEffect, useRef } from "react";
import {
  cancelRestAlarm,
  hideWorkoutProgress,
  scheduleRestAlarm,
  setWorkoutBadge,
  showWorkoutProgress,
} from "@/lib/workout-activity";

/**
 * Keeps the out-of-browser view of a live workout in step with the screen.
 *
 * Two rules shape this. **The progress notification only exists while Pump is
 * off screen** — pushing an update on every ticked set would put a banner over
 * the set table and, on a platform that ignores `silent`, buzz the phone once
 * per rep; and the page is frozen while hidden anyway, so there is no live
 * update to be had. Backgrounding is therefore the event, and the notification
 * is a snapshot taken at that moment. **The rest alarm, by contrast, is armed
 * the instant the rest starts**, while the app is still in the foreground,
 * because by the time the phone is in a pocket there is nothing left running
 * that could arm it.
 *
 * @see lib/workout-activity.ts for why the delay lives in the service worker.
 */
export function useWorkoutActivity({
  url,
  title,
  progressBody,
  restEndsAt,
  restBody,
  setsRemaining,
}: {
  /** Where a tap on the notification lands — this workout. */
  url: string;
  /** The session's name. */
  title: string;
  /** Totals line, read at a glance from the lock screen. */
  progressBody: string;
  /** Absolute end of the running rest, or null when nothing is resting. */
  restEndsAt: number | null;
  /** The set the alert should name. */
  restBody: string;
  /** Sets still owed, for the app-icon badge. */
  setsRemaining: number;
}) {
  // Read at fire time rather than depended on: the body is a formatted string
  // that changes on every keystroke in the set table, and re-arming the alarm
  // or re-posting the notification for that would be pure churn.
  const latest = useRef({ url, title, progressBody, restBody });

  // Declared first on purpose: effects run in order within a commit, so the two
  // below always read this render's strings rather than the previous one's.
  useEffect(() => {
    latest.current = { url, title, progressBody, restBody };
  }, [url, title, progressBody, restBody]);

  // Only `endsAt` re-arms. A rest that is extended by ±15s gets a new end time
  // and so a new alarm, which is exactly right; a rest that is merely being
  // looked at does not.
  useEffect(() => {
    const { url, restBody } = latest.current;
    if (restEndsAt == null) {
      cancelRestAlarm();
      return;
    }
    scheduleRestAlarm({ endsAt: restEndsAt, body: restBody, url });
  }, [restEndsAt]);

  useEffect(() => {
    const sync = () => {
      const { url, title, progressBody } = latest.current;
      if (document.visibilityState === "hidden") {
        showWorkoutProgress({ title, body: progressBody, url });
      } else {
        hideWorkoutProgress();
      }
    };

    // On mount the app is by definition on screen, so this also clears anything
    // a previous session left behind.
    sync();
    document.addEventListener("visibilitychange", sync);
    // iOS backgrounds an installed PWA hard enough that the visibility event
    // can be the last thing the page gets; `pagehide` is the more reliable of
    // the two there. `sync` reads the current state, so a double call is a
    // no-op rather than a duplicate notification.
    window.addEventListener("pagehide", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", sync);
    };
  }, []);

  useEffect(() => {
    setWorkoutBadge(setsRemaining);
  }, [setsRemaining]);
}

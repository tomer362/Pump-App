"use client";

import { useEffect, useRef } from "react";
import {
  cancelRestAlarm,
  hideWorkoutProgress,
  scheduleRestAlarm,
  setWorkoutBadge,
  showWorkoutProgress,
} from "@/lib/workout-activity";
import { ALERTS_ENABLED_EVENT } from "@/lib/notify-client";

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
  const latest = useRef({ url, title, progressBody, restBody, restEndsAt });

  // Declared first on purpose: effects run in order within a commit, so the
  // ones below always read this render's values rather than the previous one's.
  useEffect(() => {
    latest.current = { url, title, progressBody, restBody, restEndsAt };
  }, [url, title, progressBody, restBody, restEndsAt]);

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

  // Granting the permission mid-rest has to arm the rest that is running.
  //
  // Every arm above is dropped on the floor while the permission is still
  // `default` — `post()` refuses to send one — and the effect that arms depends
  // only on `endsAt`, which hasn't changed. So a lifter who starts a set, reads
  // the prompt that says "get an alert when your rest is up", and taps yes, got
  // no alert for that rest: the first one they were promised, and the one that
  // decides whether they believe the feature works.
  useEffect(() => {
    const rearm = () => {
      const { url, restBody, restEndsAt } = latest.current;
      if (restEndsAt == null) return;
      scheduleRestAlarm({ endsAt: restEndsAt, body: restBody, url });
    };
    window.addEventListener(ALERTS_ENABLED_EVENT, rearm);
    return () => window.removeEventListener(ALERTS_ENABLED_EVENT, rearm);
  }, []);

  useEffect(() => {
    // The *transition* is the event, not the state. Both listeners below can
    // fire for a single backgrounding — on iOS `pagehide` arrives with
    // `visibilityState` already "hidden" — and posting twice showed two banners
    // on any platform whose tag-replacement is unreliable, which is how leaving
    // the app repeatedly built a stack.
    let hidden = document.visibilityState === "hidden";

    const sync = () => {
      const nowHidden = document.visibilityState === "hidden";
      if (nowHidden === hidden) return;
      hidden = nowHidden;
      const { url, title, progressBody, restBody, restEndsAt } = latest.current;
      if (nowHidden)
        showWorkoutProgress({
          title,
          body: progressBody,
          url,
          restEndsAt,
          restBody,
        });
      else hideWorkoutProgress();
    };

    // On mount the app is by definition on screen, so this also clears anything
    // a previous session left behind.
    hideWorkoutProgress();
    document.addEventListener("visibilitychange", sync);
    // iOS backgrounds an installed PWA hard enough that the visibility event
    // can be the last thing the page gets; `pagehide` is the more reliable of
    // the two there.
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

"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { haptic } from "@/lib/utils";
import { enableNotifications, markNotifyAsked } from "@/lib/notify-client";
import { primeRestAudio } from "@/lib/rest-audio";
import { workoutAlertsSupported } from "@/lib/workout-activity";

const DISMISSED_KEY = "pump.rest-alert-prompt";

/**
 * One line, once, on the screen where it matters: rest alerts exist and are off.
 *
 * Piggybacking the opt-in on the Notifications settings screen was tidy and
 * meant nobody found it — the feature reads as broken rather than unasked-for,
 * because there is nothing anywhere to say a permission is missing. Asking here
 * is also the honest place to ask: the permission is for a thing that is about
 * to happen, roughly sixty seconds from now.
 *
 * Deliberately not a modal, not on first paint, and dismissible for good. It
 * shows only where the answer is still "not yet" — never after a grant, never
 * after a block, and never on a browser that can't do it at all.
 */
export function RestAlertPrompt() {
  const [show, setShow] = useState(false);

  // Every input here is client-only — `Notification` doesn't exist on the server
  // and neither does localStorage — so the probe can't run during render, and a
  // `useState` initialiser reading them would make the first client render
  // disagree with the HTML. Deferred a frame rather than run in the effect body,
  // which also keeps the row from appearing in the same paint as the set table:
  // it slides in after, instead of shifting the rows down under a thumb.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (!workoutAlertsSupported()) return;
      if (Notification.permission !== "default") return;
      try {
        if (window.localStorage.getItem(DISMISSED_KEY) === "1") return;
      } catch {
        /* Private mode: offer it, the worst case is one extra line. */
      }
      setShow(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    // The periodic nudge asks the identical question from the app shell, so
    // answering it here has to restart its weekly clock too — otherwise this
    // line is dismissed mid-set and a modal opens on the feed a minute later.
    markNotifyAsked();
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* Then it comes back next session; still better than a modal. */
    }
    setShow(false);
  };

  return (
    <div className="bg-surface-1 hairline-b flex items-center gap-2 py-1.5 pr-1 pl-4">
      <Bell className="text-text-3 size-3.5 shrink-0" strokeWidth={2.2} />
      <span className="text-text-2 min-w-0 flex-1 text-[12px] leading-snug">
        Get an alert when your rest is up, without watching the screen.
      </span>
      <button
        onClick={async () => {
          haptic.light();
          // Through `enableNotifications`, not a bare `requestPermission()`:
          // the grant alone isn't enough, because the worker is what posts the
          // alerts and a grant with no registration reports "on" everywhere and
          // then does nothing. No VAPID key — these need no subscription.
          await enableNotifications();
          // Also unlocks the chime, since this is a tap and iOS only lets a
          // gesture do that. The alert and the sound are one answer here.
          primeRestAudio();
          // Either way this line is answered and shouldn't come back.
          dismiss();
        }}
        className="press text-volt shrink-0 px-2 py-1.5 text-[12px] font-bold"
      >
        Turn on
      </button>
      <button
        onClick={() => {
          haptic.light();
          dismiss();
        }}
        aria-label="Dismiss"
        className="press text-text-3 shrink-0 p-2"
      >
        <X className="size-3.5" strokeWidth={2.6} />
      </button>
    </div>
  );
}

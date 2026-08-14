"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { haptic } from "@/lib/utils";
import {
  enableNotifications,
  isIOS,
  isStandalone,
  markNotifyAsked,
  notifyAskedWithin,
} from "@/lib/notify-client";
import { workoutAlertsSupported } from "@/lib/workout-activity";
import { claimNudgeSlot } from "@/lib/nudge-slot";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Long enough for the page under it to have painted and settled. */
const DELAY_MS = 1200;

/**
 * Notifications are the one feature nobody discovers: it lives behind a browser
 * permission, the permission is only asked for on a settings screen most people
 * never open, and until it's granted the app looks like it simply doesn't have
 * rest alerts. So the app asks — once when you're new, and once a week after
 * that while the answer is still nothing.
 *
 * It asks only while `Notification.permission` is `"default"`. A block can't be
 * undone from a page (`requestPermission()` returns instantly on `denied`), so
 * the button would be a lie; and someone who granted the permission and then
 * muted alerts in settings made a deliberate choice that this must not reopen
 * weekly. Both of those are the settings screen's job, not a popup's.
 */
export function NotifyNudge({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // The prompt is dismissed by three different paths (grant, "Not now",
  // backdrop/Escape/drag) and all of them must count as "asked".
  const marked = useRef(false);

  // Every input is client-only — `Notification` doesn't exist on the server and
  // neither does localStorage — so this can't run during render, and a
  // `useState` initialiser reading them would make the first client render
  // disagree with the server HTML.
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!workoutAlertsSupported()) return;
      // On an iPhone that isn't installed there is no notification to grant,
      // and a modal saying so on every visit is worse than saying nothing.
      if (isIOS() && !isStandalone()) return;
      if (Notification.permission !== "default") return;
      if (notifyAskedWithin(WEEK_MS)) return;
      // One unprompted modal per visit — the install sheet is eligible at the
      // same moment on an uninstalled Chromium browser, and two stacked bottom
      // sheets are unreadable. Checked before `setOpen`, so losing the claim
      // doesn't stamp the weekly clock below: this never asked, and should ask
      // on the next visit rather than going quiet for a week.
      if (!claimNudgeSlot()) return;
      setOpen(true);
    }, DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Stamped on show, not on dismiss: a tab closed or force-quit with the sheet
  // still up would otherwise reopen it on the very next page load.
  useEffect(() => {
    if (!open || marked.current) return;
    marked.current = true;
    markNotifyAsked();
  }, [open]);

  return (
    // Rendered unconditionally so the sheet's exit animation runs; it is an
    // `AnimatePresence` with nothing in it while closed.
    <Sheet
      open={open}
      title="Know when your rest is up"
      onClose={() => !busy && setOpen(false)}
    >
      <div className="px-4 pb-4">
        <div className="flex gap-3">
          <span className="bg-surface-2 grid size-10 shrink-0 place-items-center rounded-full">
            <BellRing className="text-volt size-5" strokeWidth={2.2} />
          </span>
          <p className="text-text-2 text-[14px] leading-relaxed">
            Pump can tell you the moment your rest ends — phone locked, app
            closed, doesn&apos;t matter. Friends arriving at the gym and your
            records land there too.
          </p>
        </div>

        <div className="mt-5 space-y-2">
          <Button
            block
            variant="volt"
            loading={busy}
            onClick={async () => {
              haptic.light();
              setBusy(true);
              try {
                // Whatever the answer, this question is now answered — a
                // refusal at the browser prompt closes the sheet the same as a
                // grant does, and the weekly clock has already been reset.
                await enableNotifications(vapidPublicKey || undefined);
              } finally {
                setBusy(false);
                setOpen(false);
              }
            }}
          >
            Turn on notifications
          </Button>
          <Button block variant="ghost" onClick={() => setOpen(false)}>
            Not now
          </Button>
        </div>

        <p className="text-text-3 mt-3 text-center text-[12px] leading-relaxed">
          You can change this any time in Notifications.
        </p>
      </div>
    </Sheet>
  );
}

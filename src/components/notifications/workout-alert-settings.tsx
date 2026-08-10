"use client";

import { useEffect, useState } from "react";
import { BellRing, Info, Smartphone, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import {
  sendTestWorkoutAlert,
  setWorkoutAlertsMuted,
  workoutAlertsMuted,
  workoutAlertsSupported,
} from "@/lib/workout-activity";
import { enableNotifications, isIOS, isStandalone } from "@/lib/notify-client";

type State = "loading" | "needs-install" | "unsupported" | "denied" | "off" | "on";

/**
 * Opt-in for the alerts a running workout sends: rest is up, and the quiet
 * progress line while Pump is off screen.
 *
 * Separate from `PushSettings` on purpose. These are posted locally by the
 * service worker — no subscription, no VAPID key pair, no server — so they work
 * on a deployment with no push configuration at all. `PushSettings` hides its
 * entire toggle when VAPID is missing, which meant that on such a deployment
 * there was no way anywhere in the app to grant notification permission, and
 * therefore no way for the workout alerts to ever fire. They were unreachable
 * rather than broken.
 */
export function WorkoutAlertSettings() {
  const [state, setState] = useState<State>("loading");
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tested, setTested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!workoutAlertsSupported()) {
        // On iPhone this is exactly what a Safari tab looks like: `Notification`
        // simply isn't there until the app is on the home screen.
        setState(isIOS() && !isStandalone() ? "needs-install" : "unsupported");
        return;
      }
      setMuted(workoutAlertsMuted());
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      // Permission alone isn't enough — the worker is what posts these. A grant
      // with no registration (a cleared site, a failed install) would otherwise
      // report "on" and then do nothing, which is the exact failure this whole
      // screen exists to make visible.
      const reg = await navigator.serviceWorker.getRegistration();
      setState(
        Notification.permission === "granted" && reg ? "on" : "off",
      );
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      // This card is the workout alerts, which need no VAPID key pair and no
      // subscription — hence no key passed. Web push is `PushSettings` below.
      const res = await enableNotifications();
      if (!res.ok) {
        setState(res.permission === "denied" ? "denied" : "off");
        if (res.error) setError(res.error);
        return;
      }
      setMuted(false);
      setState("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't turn alerts on");
    } finally {
      setBusy(false);
    }
  }

  function toggleMute() {
    const next = !muted;
    setWorkoutAlertsMuted(next);
    setMuted(next);
    setTested(false);
  }

  return (
    <div className="space-y-4">
      <Card className="px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="bg-surface-2 grid size-10 shrink-0 place-items-center rounded-full">
            <Timer
              className={
                state === "on" && !muted ? "text-volt size-5" : "text-text-3 size-5"
              }
              strokeWidth={2.2}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">
              {state === "on" && !muted ? "Workout alerts on" : "Workout alerts off"}
            </p>
            <p className="text-text-3 text-[13px] leading-snug">
              An alert when your rest is up, the session on your lock screen, and
              sets still owed on the app icon.
            </p>
          </div>
        </div>

        {state === "needs-install" ? (
          <div className="border-hairline mt-4 rounded-[12px] border px-3 py-3">
            <p className="mb-1 flex items-center gap-1.5 text-[14px] font-semibold">
              <Smartphone className="size-4" />
              Add Pump to your Home Screen first
            </p>
            <p className="text-text-3 text-[13px] leading-relaxed">
              On iPhone, notifications only work for installed web apps. Tap
              Share, then <span className="text-text-2">Add to Home Screen</span>
              , open Pump from the icon, and come back here.
            </p>
          </div>
        ) : state === "unsupported" ? (
          <p className="text-text-3 mt-4 text-[13px] leading-relaxed">
            This browser can&apos;t show notifications. The rest bar and its chime
            still work while Pump is on screen.
          </p>
        ) : state === "denied" ? (
          <p className="text-text-3 mt-4 text-[13px] leading-relaxed">
            Notifications are blocked for Pump. Re-enable them in your browser or
            system settings, then come back.
          </p>
        ) : state === "on" ? (
          <div className="mt-4 space-y-2">
            <Button block variant="solid" onClick={toggleMute}>
              {muted ? "Turn alerts back on" : "Turn off"}
            </Button>
            {!muted && (
              <Button
                block
                variant="ghost"
                onClick={() => {
                  sendTestWorkoutAlert();
                  setTested(true);
                }}
              >
                <BellRing className="size-4" />
                {tested ? "Sent — check your notifications" : "Send a test alert"}
              </Button>
            )}
          </div>
        ) : state === "off" ? (
          <Button block variant="volt" className="mt-4" loading={busy} onClick={enable}>
            Turn on workout alerts
          </Button>
        ) : null}

        {error && <p className="text-danger mt-2 text-[13px]">{error}</p>}
      </Card>

      <Card className="flex gap-3 px-4 py-4">
        <Info className="text-text-3 size-5 shrink-0" />
        <p className="text-text-2 text-[13px] leading-relaxed">
          The rest alert is armed in the background the moment your rest starts,
          which is the only place it can be armed from — so a browser that stops
          the worker while your phone is locked will miss it. Nothing depends on
          it: the bar and the chime in the app are always the real timer.
        </p>
      </Card>
    </div>
  );
}

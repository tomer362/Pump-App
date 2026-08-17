"use client";

import { useEffect, useState } from "react";
import { BellRing, Info, Smartphone, Timer, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import {
  sendTestWorkoutAlert,
  setWorkoutAlertsMuted,
  setWorkoutProgressMuted,
  workoutAlertsMuted,
  workoutAlertsSupported,
  workoutProgressMuted,
} from "@/lib/workout-activity";
import {
  playRestChime,
  primeRestAudio,
  restSoundHoldsSession,
  restSoundMuted,
  setRestSoundHoldsSession,
  setRestSoundMuted,
} from "@/lib/rest-audio";
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
  const [progressOff, setProgressOff] = useState(false);
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
      setProgressOff(workoutProgressMuted());
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

  function toggleProgress() {
    const next = !progressOff;
    setWorkoutProgressMuted(next);
    setProgressOff(next);
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
              <>
                {/* The progress line is the one that appears every single time
                    you leave the app mid-session, so it is the one worth being
                    able to silence on its own — turning the pair off would take
                    the rest alert with it, which is the part that matters. */}
                <Button block variant="ghost" onClick={toggleProgress}>
                  {progressOff
                    ? "Show the workout on my lock screen"
                    : "Don't show the workout on my lock screen"}
                </Button>
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
              </>
            )}
          </div>
        ) : state === "off" ? (
          <Button block variant="volt" className="mt-4" loading={busy} onClick={enable}>
            Turn on workout alerts
          </Button>
        ) : null}

        {error && <p className="text-danger mt-2 text-[13px]">{error}</p>}
      </Card>

      <RestSoundCard />

      <Card className="flex gap-3 px-4 py-4">
        <Info className="text-text-3 size-5 shrink-0" />
        <p className="text-text-2 text-[13px] leading-relaxed">
          Both the chime and the alert are set up the moment your rest starts,
          which is the only point they can be — nothing of Pump&apos;s is running
          once your phone is in your pocket. With the phone away it&apos;s the
          alert that reaches you, unless you let the chime hold the audio. Either
          way neither is depended on: the bar in the app is always the real
          timer.
        </p>
      </Card>
    </div>
  );
}

/**
 * The rest chime, on its own card and outside every gate above it.
 *
 * It needs no permission, no service worker and no install — it is a sound the
 * page plays — so putting it behind the notification opt-in would hide a
 * working feature behind an unrelated refusal. It is also the only thing in
 * this app that can make a noise at a chosen moment on a locked phone: a
 * notification cannot carry a sound of its own, whatever the platform.
 */
function RestSoundCard() {
  const [off, setOff] = useState(false);
  const [holds, setHolds] = useState(false);

  // localStorage doesn't exist on the server, so this can't be a `useState`
  // initialiser without the first client render disagreeing with the HTML. Same
  // deferred read as `RestAlertPrompt`.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setOff(restSoundMuted());
      setHolds(restSoundHoldsSession());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <Card className="px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="bg-surface-2 grid size-10 shrink-0 place-items-center rounded-full">
          <Volume2
            className={off ? "text-text-3 size-5" : "text-volt size-5"}
            strokeWidth={2.2}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">
            Rest chime {off ? "off" : "on"}
          </p>
          <p className="text-text-3 text-[13px] leading-snug">
            {holds
              ? "Two tones when your rest is up, including while your phone is locked. Your volume still applies; silent mode doesn't."
              : "Two tones over whatever you're listening to — nothing of Pump's pauses your music. Silent mode and your volume still apply."}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Button
          block
          variant="solid"
          onClick={() => {
            const next = !off;
            setRestSoundMuted(next);
            setOff(next);
            // Unmuting is a tap, which is the only thing that can unlock audio
            // on iOS — take it while we have it rather than waiting for the
            // first rest of the next session.
            if (!next) primeRestAudio();
          }}
        >
          {off ? "Turn the chime on" : "Turn off"}
        </Button>
        {!off && (
          <>
            <Button block variant="ghost" onClick={() => void playRestChime()}>
              <Volume2 className="size-4" />
              Play it
            </Button>
            {/* The trade this switch makes is the whole of it, so the button
                says what it costs rather than naming a setting. Holding the
                audio session for the length of the rest is the only way the
                chime survives a locked screen — and it is also what stops
                Spotify, which is why it is off unless somebody asks for it. */}
            <Button
              block
              variant="ghost"
              onClick={() => {
                const next = !holds;
                // Inside the tap, which is what lets the keep-alive start
                // playing straight away if a rest is running.
                setRestSoundHoldsSession(next);
                setHolds(next);
                primeRestAudio();
              }}
            >
              {holds
                ? "Stop pausing my music (chime only while Pump is open)"
                : "Chime while my phone is locked (pauses my music)"}
            </Button>
          </>
        )}
      </div>
      {!off && !holds && (
        <p className="text-text-3 mt-3 text-[13px] leading-relaxed">
          While your phone is away, the rest alert is a notification rather than
          the chime — turn on workout alerts above for that.
        </p>
      )}
    </Card>
  );
}

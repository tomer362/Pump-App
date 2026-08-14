"use client";

import { useEffect, useRef, useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { InstallSteps } from "@/components/install/install-steps";
import { haptic } from "@/lib/utils";
import {
  INSTALL_EVENT,
  dismissInstallForever,
  installAskedWithin,
  installDismissedForever,
  installPromptAvailable,
  isIOSSafari,
  isStandalone,
  markInstallAsked,
  promptInstall,
} from "@/lib/install-client";
import { claimNudgeSlot } from "@/lib/nudge-slot";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Long enough for the page under it to have painted and settled. */
const DELAY_MS = 1200;
/**
 * How long after mount the sheet may still appear. Chromium decides when to
 * fire `beforeinstallprompt` and can take a moment, so we keep waiting past the
 * initial delay — but not indefinitely: a sheet arriving over a screen someone
 * started reading a minute ago is an interruption, not an offer.
 */
const WINDOW_MS = 10_000;

/**
 * Offers to install Pump — and then actually installs it.
 *
 * Installing is the gateway feature on a phone: on iOS the Push API, the
 * lock-screen rest alert and the icon badge exist only in a home-screen PWA, so
 * an uninstalled iPhone is an app that appears to have no notifications at all
 * — and `NotifyNudge` deliberately says nothing there, which left that user
 * offered neither. Nothing in the app had ever mentioned installing.
 *
 * On Chromium the button calls the captured event's `prompt()`, which opens the
 * browser's own install dialog: this asks the real question, it does not
 * describe it. On iOS Safari no such API exists at any privilege level, so the
 * sheet switches to the Share → Add to Home Screen steps rather than showing a
 * button that cannot do what it says.
 */
export function InstallNudge() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // No deferred event to prompt with means we got here by being iOS Safari,
  // which is the instructional branch — the eligibility check admits nothing
  // else. Captured at the moment we decide to open, because `prompt()` spends
  // the event and the branch must not change under the open sheet.
  const [guided, setGuided] = useState(false);
  const decided = useRef(false);

  // Every input here is client-only — `localStorage`, the UA, the deferred
  // event — so none of it can be read during render without the first client
  // pass disagreeing with the server HTML. And all of it is read inside a
  // timer or a listener, never in the effect body: the decision is a reaction
  // to something happening, not a render.
  useEffect(() => {
    const mountedAt = Date.now();
    let ready = false;

    const attempt = () => {
      // The delay is so the page underneath has painted and settled; the window
      // is so a late event can't drop a sheet over a screen someone has been
      // reading for a minute.
      if (!ready || decided.current) return;
      if (Date.now() - mountedAt > WINDOW_MS) return;

      // Already installed: there is nothing to offer, and this is also what
      // keeps the sheet out of the installed app itself.
      if (isStandalone()) return;
      if (installDismissedForever()) return;
      if (installAskedWithin(WEEK_MS)) return;

      // Never open a sheet whose button can't install. Without an event there
      // is no install to perform, and iOS Chrome/Firefox can't install at all
      // — silence beats a dead control.
      const canPrompt = installPromptAvailable();
      if (!canPrompt && !isIOSSafari()) return;

      // One unprompted modal per visit. Losing the claim deliberately doesn't
      // stamp the weekly clock: this never asked, so it asks next visit.
      if (!claimNudgeSlot()) return;

      decided.current = true;
      setGuided(!canPrompt);
      setOpen(true);
      // Stamped on show, not on dismiss: a tab force-quit with the sheet still
      // up would otherwise reopen it on the very next page load.
      markInstallAsked();
    };

    const id = window.setTimeout(() => {
      ready = true;
      attempt();
    }, DELAY_MS);

    // Chromium decides when to fire the event and can take a moment past the
    // initial delay, so we keep listening rather than only asking once.
    window.addEventListener(INSTALL_EVENT, attempt);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener(INSTALL_EVENT, attempt);
    };
  }, []);

  return (
    // Rendered unconditionally so the sheet's exit animation runs; it is an
    // `AnimatePresence` with nothing in it while closed.
    <Sheet
      open={open}
      title="Put Pump on your Home Screen"
      onClose={() => !busy && setOpen(false)}
    >
      <div className="px-4 pb-4">
        <div className="flex gap-3">
          <span className="bg-surface-2 grid size-10 shrink-0 place-items-center rounded-full">
            <Smartphone className="text-volt size-5" strokeWidth={2.2} />
          </span>
          <p className="text-text-2 text-[14px] leading-relaxed">
            Installed, Pump opens full screen from its own icon — no browser bar
            eating the top of the set table — and it can reach you on the lock
            screen when your rest is up.
          </p>
        </div>

        <div className="mt-5 space-y-2">
          {guided ? (
            <InstallSteps />
          ) : (
            <Button
              block
              variant="volt"
              loading={busy}
              onClick={async () => {
                haptic.light();
                setBusy(true);
                try {
                  // Accepted or declined, the question has been put — the
                  // browser's own dialog is the answer, and the weekly clock
                  // was already stamped when this opened.
                  await promptInstall();
                } finally {
                  setBusy(false);
                  setOpen(false);
                }
              }}
            >
              Install Pump
            </Button>
          )}

          <Button block variant="ghost" onClick={() => setOpen(false)}>
            Ask me later
          </Button>
        </div>

        {/* Quieter than "Ask me later" on purpose: the two are not equals, and
            the permanent one shouldn't be the easy mis-tap. */}
        <button
          type="button"
          className="text-text-3 press mx-auto mt-3 block px-3 py-2 text-[12px] underline-offset-2 hover:underline"
          onClick={() => {
            dismissInstallForever();
            setOpen(false);
          }}
        >
          Don&apos;t ask again
        </button>

        <p className="text-text-3 mt-1 text-center text-[12px] leading-relaxed">
          You can still install Pump any time from Notifications.
        </p>
      </div>
    </Sheet>
  );
}

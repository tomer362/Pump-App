"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { InstallSteps } from "@/components/install/install-steps";
import {
  installServerSnapshot,
  installSnapshot,
  isIOSSafari,
  isStandalone,
  promptInstall,
  subscribeInstallPrompt,
} from "@/lib/install-client";

type State = "loading" | "installed" | "installable" | "guided" | "unavailable";

/**
 * The permanent way in, and the reason the sheet is allowed a "Don't ask again"
 * at all: a prompt that can be dismissed forever must not be the only route to
 * the feature, or dismissing it once removes installing from the app entirely.
 * That is the exact failure the workout alerts hit when their opt-in lived
 * inside a card that hid itself.
 *
 * It sits above the two notification cards because on iOS it is their
 * precondition — neither push nor the lock-screen rest alert exists until Pump
 * is on the Home Screen.
 */
export function InstallSettings() {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [guided, setGuided] = useState(false);
  const [busy, setBusy] = useState(false);

  const canPrompt = useSyncExternalStore(
    subscribeInstallPrompt,
    installSnapshot,
    installServerSnapshot,
  );

  // `navigator` and `matchMedia` are client-only, so this can't be a `useState`
  // initialiser — the first client render has to match the server's.
  useEffect(() => {
    // Deferred a frame rather than set in the effect body — the same shape
    // `RestAlertPrompt` uses to probe its client-only inputs.
    const raf = requestAnimationFrame(() => {
      setInstalled(isStandalone());
      setGuided(isIOSSafari());
    });
    // Installing from here leaves *this* tab an ordinary browser tab — the
    // installed app is a separate window — so `isStandalone()` stays false and
    // can't be what confirms it. The event is the only signal.
    const onInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const state: State =
    installed === null
      ? "loading"
      : installed
        ? "installed"
        : canPrompt
          ? "installable"
          : guided
            ? "guided"
            : "unavailable";

  if (state === "loading") return null;

  return (
    <Card className="px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="bg-surface-2 grid size-10 shrink-0 place-items-center rounded-full">
          {state === "installed" ? (
            <Check className="text-volt size-5" strokeWidth={2.6} />
          ) : (
            <Smartphone className="text-text-3 size-5" strokeWidth={2.2} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">
            {state === "installed" ? "Pump is installed" : "Install Pump"}
          </p>
          <p className="text-text-3 text-[13px] leading-snug">
            {state === "installed"
              ? "Open it from your Home Screen for full screen and lock-screen rest alerts."
              : "Full screen from its own icon, and the only way to get rest alerts on an iPhone."}
          </p>
        </div>
      </div>

      {state === "installable" ? (
        <Button
          block
          variant="volt"
          className="mt-4"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const outcome = await promptInstall();
              if (outcome === "accepted") setInstalled(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          Install Pump
        </Button>
      ) : state === "guided" ? (
        <div className="mt-4">
          <InstallSteps />
        </div>
      ) : state === "unavailable" ? (
        <p className="text-text-3 mt-4 text-[13px] leading-relaxed">
          This browser doesn&apos;t offer installing. Open Pump in Safari on
          iPhone, or Chrome elsewhere, to add it to your Home Screen.
        </p>
      ) : null}
    </Card>
  );
}

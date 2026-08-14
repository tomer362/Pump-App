/**
 * The browser side of "install this app", in one place — the same shape as
 * `notify-client.ts`, and for the same reason: two surfaces ask the question
 * (the periodic sheet and the card on Notifications) and the sequence is easy
 * to get subtly wrong in a way that leaves a button which does nothing.
 *
 * Installing is not cosmetic here. On iOS the Push API, the lock-screen rest
 * alert and the app-icon badge only exist in a home-screen-installed PWA, so
 * an uninstalled iPhone is an app with no notifications — and `NotifyNudge`
 * correctly stays silent there, which left that user offered neither.
 */

import { isIOS, isStandalone } from "@/lib/notify-client";

export { isIOS, isStandalone };

/**
 * Chromium's install event. Not in lib.dom — it is a Chromium extension to the
 * platform that no other engine implements, which is the whole reason the iOS
 * branch of the UI exists.
 */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    /** Stashed by the inline capture script in the root layout. */
    __pumpInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

/** Fired by the capture script when the deferred event lands or is spent. */
export const INSTALL_EVENT = "pump:installable";

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

function deferred(): BeforeInstallPromptEvent | null {
  if (typeof window === "undefined") return null;
  return window.__pumpInstallPrompt ?? null;
}

/**
 * Whether there is a real install to perform right now.
 *
 * Chromium fires `beforeinstallprompt` at most once per page load, only when
 * its own installability checks pass, and never on an already-installed app —
 * so this being false means we genuinely cannot install, and the UI must say
 * nothing rather than offer a dead button.
 */
export function installPromptAvailable() {
  return deferred() !== null;
}

/**
 * Subscribe for `useSyncExternalStore`. The event may arrive before or after a
 * component mounts — it is dispatched by a script in `<head>` that runs long
 * before hydration — so the store is the only honest way to read it: a
 * `useState` initialiser would freeze whichever answer happened to be true at
 * first render, and reading it during render would disagree with the server.
 */
export function subscribeInstallPrompt(onChange: () => void) {
  window.addEventListener(INSTALL_EVENT, onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    window.removeEventListener(INSTALL_EVENT, onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

export const installSnapshot = () => installPromptAvailable();
/** Server snapshot: there is no `window` to have an event in. */
export const installServerSnapshot = () => false;

/**
 * Show the browser's own install dialog and wait for the answer.
 *
 * The event is single-use — Chromium rejects a second `prompt()` on the same
 * event — so it is dropped as soon as it has been spent, whatever the user
 * answered, and subscribers are told so the button can disappear rather than
 * sit there throwing.
 */
export async function promptInstall(): Promise<InstallOutcome> {
  const evt = deferred();
  if (!evt) return "unavailable";

  try {
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    return outcome;
  } catch {
    return "unavailable";
  } finally {
    window.__pumpInstallPrompt = null;
    window.dispatchEvent(new Event(INSTALL_EVENT));
  }
}

/**
 * iOS Safari, where Add to Home Screen exists but no API can reach it.
 *
 * Chrome and Firefox on iOS are the same WebKit underneath but *cannot* install
 * at all — their share sheet has no Add to Home Screen — so instructions there
 * would be a lie, and they're excluded. Safari's UA is the one without another
 * browser's token in it.
 */
export function isIOSSafari() {
  if (!isIOS()) return false;
  const ua = navigator.userAgent;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/.test(ua);
}

/** Can this device be walked through installing, one way or the other? */
export function installable() {
  if (isStandalone()) return false;
  return installPromptAvailable() || isIOSSafari();
}

/**
 * When the app last asked to be installed, or `"never"` once the user has said
 * so outright. One key for both, because they answer the same question: the
 * timestamp means "not now", and `"never"` is a timestamp that never expires.
 */
const ASKED_KEY = "pump.install-nudge";
const NEVER = "never";

export function markInstallAsked() {
  try {
    // Never overwrite a permanent dismissal with a fresh timestamp — that
    // would quietly restart the weekly cycle someone opted out of.
    if (window.localStorage.getItem(ASKED_KEY) === NEVER) return;
    window.localStorage.setItem(ASKED_KEY, String(Date.now()));
  } catch {
    /* Private mode: it comes back next session. */
  }
}

export function installAskedWithin(ms: number) {
  try {
    const last = Number(window.localStorage.getItem(ASKED_KEY));
    return Boolean(last) && Date.now() - last < ms;
  } catch {
    // Private mode: treat it as unasked. The worst case is one extra prompt.
    return false;
  }
}

export function dismissInstallForever() {
  try {
    window.localStorage.setItem(ASKED_KEY, NEVER);
  } catch {
    /* Private mode: the weekly clock is the fallback. */
  }
}

export function installDismissedForever() {
  try {
    return window.localStorage.getItem(ASKED_KEY) === NEVER;
  } catch {
    return false;
  }
}

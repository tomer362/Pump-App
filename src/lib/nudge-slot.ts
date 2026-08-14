/**
 * One unprompted modal per visit, whichever asks first.
 *
 * Two sheets now open themselves off a timer after mount — the install nudge
 * and the notification nudge — and on a Chromium browser with the app not
 * installed and the permission still `default`, both are eligible at once.
 * Stacked bottom sheets are unreadable, and being asked two questions you
 * didn't ask for is how an app teaches people to dismiss without reading.
 *
 * The latch is module state, not storage: it is scoped to this page's life, so
 * the loser is not suppressed for a week — it simply asks on the next visit.
 *
 * Install claims it first, by being mounted first in the `(app)` layout:
 * effects run in tree order and equal-delay timers fire in the order they were
 * registered. That is the right precedence, because on iOS installing is a
 * precondition for the notifications the other sheet is asking about.
 */

let taken = false;

/** True exactly once per page load; every later caller gets false. */
export function claimNudgeSlot() {
  if (taken) return false;
  taken = true;
  return true;
}

@AGENTS.md

# Pump

A mobile-first PWA gym tracker with a social layer, deployed on **Vercel Hobby**.

**The motive.** The core loop is logging a set between rests: one-handed, sweaty
thumb, phone at arm's length, 60 seconds of attention. Everything else in the
app is secondary to making that fast. The second goal is that training is
social — you should see what your friends lifted and know when they're at the
gym, without either becoming a feed to doomscroll.

Two things are treated as requirements, not polish: **phone ergonomics** and a
**visual identity that isn't a default AI-generated frontend**. Both have hard
rules below.

---

## Feature spec

Translated from the original Hebrew note; all of it is implemented.

| # | Feature | Where |
|---|---------|-------|
| 1 | Build a routine (template) | `/routines/new`, `components/routine/routine-builder.tsx` |
| 2 | Log a workout | `/workout/[id]`, `components/workout/workout-screen.tsx` |
| 3 | Workout history | `/history`, `/history/[id]` |
| 4 | Add/remove sets mid-workout | `set-row.tsx`, `addSet`/`removeSet` |
| 5 | Custom exercises | `createCustomExercise`, exercise picker |
| 6 | Rest timer auto-starts on set completion | `components/workout/rest-timer.tsx` |
| 7 | Accounts | Google OAuth only (`lib/auth.ts`) |
| 8 | Friends | `/friends`, mutual + explicit |
| 9 | Follow people and their programs | `follow` table, `/routines` "programs you follow" |
| 10 | Share a routine | `copyRoutine`, share sheet on `/routines/[id]`, JSON export/import (`lib/routine-transfer.ts`) |
| 11 | "I'm at the gym" broadcast | `gym_presence` TTL row, feed presence strip |
| 12 | Register your gym (gym = group) | `/gyms`, join codes |
| 13 | Achievements | `lib/actions/achievements.ts`, profile grid |
| 14 | Interval exercises + TTS cues | `components/workout/interval-runner.tsx` |
| 15 | Run a routine at ±% load (deload) | `workout.loadMultiplier`, `/start` percent picker |
| 16 | Co-op session | `/coop`, `lib/actions/coop.ts` |
| 17 | Weekly per-muscle volume | `getMuscleVolume`, `components/stats/muscle-volume-chart.tsx` |
| 18 | Quick-log a set outside a workout | `lib/actions/quick-log.ts`, `components/exercise/quick-log-{dock,sheet}.tsx` |

Exercises is the fourth tab; **Stats** is a button in its nav bar, plus a row on
the profile. The library and the per-exercise page (charts, rep maxes, records)
are the between-sessions surface, and quick-log lives on it.

---

## Platform constraints — these govern every design decision

Verified against Vercel/Neon docs, 2026. **Re-read before proposing anything
realtime, scheduled, or background.**

| Constraint | Consequence |
|---|---|
| Serverless functions can't hold a WebSocket | **No sockets.** Co-op (#16) polls one cheap endpoint every 3 s, gated on tab visibility. Presence (#11) is a TTL row read on page load. |
| Hobby cron: **2 jobs, once per day max** | No cleanup jobs. Expired `gym_presence` rows are filtered on read, never swept. |
| Function timeout ~30 s | No long-running work in a request. |
| Neon Free: 0.5 GB, 100 compute-hours/mo, **scale-to-zero** | First query after idle pays a cold start. Keep queries per request low; prefer denormalised counters over aggregates. |
| Hobby: 1 M invocations, 100 GB bandwidth/mo | Don't add polling loops beyond the co-op one. |
| iOS web push needs a **home-screen-installed** PWA (iOS 16.4+), ~70–85 % delivery | Push is a bonus channel. The in-app feed is always the source of truth; nothing depends on a notification arriving. |
| Hobby is personal/non-commercial only | Not for a revenue-generating deployment. |

**Denormalised-by-design:** `workout.totalVolumeKg/totalSets/totalReps/prCount`
and `coop_participant.setsCompleted/volumeKg` are written at mutation time so
the feed, history and co-op poll never re-aggregate over sets.

---

## Design system — "Volt"

### Anti-goals (the tells that make an app look auto-generated)
Inter at default tracking everywhere · purple→indigo gradients · uniform
`rounded-2xl` cards floating on gray · emoji as iconography · centered hero +
three feature cards · `shadow-lg` on everything.

### Tokens (`src/app/globals.css`)
```
--color-bg          #0b0b0c   base. NOT #000 — pure black smears on OLED scroll
--color-surface-1/2/3         elevation by tinted surface, never by shadow
--color-hairline    #2a2a2e   1px dividers are the main structural device
--color-text-1/2/3            f4f4f5 / a1a1aa / 6b6b73
--color-volt        #d7ff3e   THE accent
--color-pr          #ffd84d   personal records only
```

**The accent rule.** Volt appears *only* on state that matters: a completed
set, a running timer, the active tab, a PR. Everything else is grayscale. That
restraint is the identity — spending volt on decoration destroys it.

**volt and pr-gold are not distinguishable to a colourblind reader**
(ΔE 4.1 deutan, measured). Never use them as the only difference between two
things. PR gold always ships with a trophy icon and the letters "PR".

### Type
System stack first (`-apple-system, BlinkMacSystemFont, system-ui`) so iPhones
render genuine SF Pro and the app reads as native. **Archivo** carries display
and numerals.
- `.num` — tabular figures, for values that change in place (timers, live counters, table columns).
- `.num-prop` — proportional figures, for large standalone figures. Tabular widths make "121" look loose at display sizes.

### Density
The workout screen is a **data table** — rows, hairlines, right-aligned
numerals. Cards are reserved for the social feed and summary blocks, so they
keep meaning.

### Charts
One measure per chart, one axis, one colour. Never shade bars by magnitude on
nominal categories (that double-encodes length as hue). Bars: ≤24 px, 4 px
rounded data-end, square at the baseline. Grid/axes: solid hairlines, never
dashed. Single series → no legend. Every chart has a table view or direct
labels, so no value is reachable only through a tooltip.

---

## Phone ergonomics — non-negotiable

- `100dvh`/`svh` only, **never `100vh`**. Use `h-screen-d` / `min-h-screen-d`.
- `viewport-fit=cover` is set; every bottom-docked control needs `pb-safe`/`mb-safe`.
- Primary actions live in the **bottom third**. Tab bar, set checkmarks, timer, finish.
- Inputs ≥16 px font-size — anything smaller triggers iOS zoom-on-focus.
- `inputmode="decimal"|"numeric"` on every numeric field; select-all on focus.
- `useKeyboardInset()` for anything docked near the bottom of a form. iOS does not resize the layout viewport for the keyboard.
- Tap targets ≥44 px (`tap` utility).
- Timers derive from an absolute end timestamp, never an incrementing counter — mobile browsers throttle background timers and a counter drifts.
- **A hold and a drag both need `user-select: none`, and once a selection exists only `removeAllRanges()` clears it.** `useLongPress` spreads the property itself rather than trusting each consumer to remember `select-none`, and clears any range when it fires: Android Chrome starts its own selection at about the same ~500 ms, and on iOS a hold that began on a nested node can raise the handles before the style resolves. The draggable lists carry it too — a drag started on a grip travels across every row below it, which is how a selection gets painted — and `input, textarea` opt back in globally in `globals.css`, or WebKit inherits the block into the weight you just typed.
- **A long-press gesture needs `-webkit-touch-callout: none`, not just `select-none`.** A hold on an `<a>` raises Safari's link preview card, which is neither a `contextmenu` event nor a text selection — so neither `preventDefault()` nor `select-none` reaches it, and the reorder sheet opened behind Apple's card. `useLongPress` spreads the inline style itself (with `-webkit-user-drag: none`, or a drifting hold drags the URL); the property inherits, so the press target covers the links nested inside it.
- **`px-safe-*`, not `px-4 inset-safe-x`.** Both set `padding-left`, so one silently wins — and in portrait, where the inset is `0px`, `inset-safe-x` winning collapsed several large titles flush against the screen edge. `px-safe-4` is `max(1rem, env(safe-area-inset-left))`: the inset can only raise the padding. Use bare `inset-safe-x` only on an element with no horizontal padding of its own (the tab bar, the workout header).

**The document never scrolls.** `body` is exactly `100dvh` and `overflow:
hidden`; content scrolls in the one container inside it, with
`overscroll-y-contain`. Before that, `min-h-screen-d` on `body` *and* on the
`(app)` shell *and* the tab-bar spacer stacked, so every page — however short —
scrolled into a blank void that iOS then lagged repainting the fixed tab bar
over. Nothing in `src/` reads `window.scrollY` or calls `window.scrollTo`, and
`position: fixed` still resolves against the viewport because the scroller sets
no transform or filter — so docked chrome needs no change. Route shells use
`min-h-full`, never a second `min-h-screen-d`.

**Which is why coming back to a list used to land you at the top.** Both the
browser's scroll restoration and Next's act on the *document* scroller, which
here is permanently at zero, so nothing was ever restored: every back from an
exercise, a workout or a post reopened the list at row one.
`lib/scroll-memory.ts` is the memory and `components/ui/scroll-restoration.tsx`
is the only thing that drives it — one component in the root layout, which is
also why the scroller now carries `id="app-scroll"` (`use-scroll-watch.ts`
still finds it by capture-phase listening, because it only ever wants events;
restoring needs the element in a layout effect, before any scroll has fired).

- **A return restores; anything else starts at the top.** A `popstate` covers
  `router.back()`, the NavBar chevron and the iOS back-swipe; the NavBar's
  fixed-href variant (`back="/gyms"`) and a tab-bar tap are *forward* pushes
  that read as returns, so they say so through `markRestoringNavigation`. A
  latch with no navigation behind it expires in `LATCH_TTL_MS`, or a cancelled
  swipe would restore the next screen you deliberately opened. Tapping the tab
  you are already on is the one gesture that means the opposite, and scrolls to
  top.
- **Two indices, because a push cannot use the first.** Offsets are stored per
  Navigation-API entry key *and* per route, and a pop prefers the entry — which
  is what lets one route hold two places in one stack. A `back="/path"` push
  and a tab tap mint a *new* entry, so the route slot is the only one they can
  ever match; on a browser with no Navigation API everything falls back to it.
  Never `history.state`: the App Router owns that object.
- **Only a scroll somebody performed is remembered.** Next scrolls the
  container to the top of the incoming route while the URL is still the
  outgoing one, so an ungated handler wrote those few pixels over the position
  the lifter left — on every navigation, which is every time this is supposed
  to work. `acceptScroll` takes a scroll as real when a gesture that can cause
  one happened in the last 400 ms, or when it continues an unbroken chain of
  scrolls (a flick's momentum fires no further input events). Not
  `pointerdown`: tapping a link is input, and what follows it is the
  navigation — that gap is covered by arming `suspendSaves` on every anchor
  click.
- **The restore is a bounded rAF loop, not one assignment.** The page arrives
  as a `loading.tsx` skeleton, where the offset clamps to nothing, and Next
  scrolls again on the commit where the streamed content lands — later than
  this effect. So the loop re-asserts every frame for `RESTORE_DEADLINE_MS`
  and aborts the instant the lifter touches the screen. It never animates: a
  smooth scroll would still be moving when the next frame re-asserts.
- **`/workout/[id]` is deny-listed** (`SKIP_PREFIXES`). `jumpToSet` and
  `useScrollWatch` already own that screen's scrolling, and mid-workout "where
  I was" means the next set, not a pixel offset.

**Restoring the offset is not enough on a list that paginates.** `/feed`,
`/history` and Discover seed one server-rendered page into `useState`, so a
back navigation remounted them 20 rows tall and the position was not merely
forgotten but *unreachable*. `hooks/use-paged-list.ts` keeps the accumulated
rows in `sessionStorage` and merges them back — no re-fetching, because back is
the most common gesture in the app and re-requesting four pages from a
scale-to-zero database on every press is exactly the spend `ui/load-more.tsx`
refuses when it declines to auto-load on a sentinel. The snapshot is taken only
while its leading ids still match the server's fresh first page; anything else
means the list really changed and the page wins. `use-exercise-batches` does
the same for the library's auto-loaded batches under `persistKey`, and
deliberately not for the picker sheet — a sheet doesn't participate in history.

**The other half of "put me back" is the state around the list**
(`hooks/use-route-memory.ts`): the library's search box and filters, and which
tab of `/exercises/[id]` you were reading. Restoring a scroll offset onto a
list that has forgotten what you searched for restores a position in the wrong
list. Not the URL, tidier though that would be: these screens are server
components, so `router.replace` with a new query re-runs them — a tab tap would
re-issue eight aggregates and a keystroke would add a round trip to the one the
client already makes. All of it is read through `useSyncExternalStore` with a
null server snapshot, never a `useState` initialiser, or the first client
render disagrees with the server HTML and React discards the subtree being
restored. `sessionStorage` throughout, and `clearSessionMemory` on sign-out:
these hold one account's rows, searches and reading positions.

**Scrolling the workout never loses your place.** A phone shows about one
exercise at a time, so the active workout screen keeps three things pinned as
you move (`hooks/use-scroll-watch.ts`, one rAF-throttled measure pass over
`[data-block-title]` and the next set's `[data-set-id]`):

- The header's second line **cross-fades** from session totals to the exercise
  currently under it, with that exercise's own `done/total`. Fixed-height box —
  a row that grew and shrank would shift the table under a thumb aiming at a
  checkmark. It swaps on the *name row* crossing, not the block, so the header
  never repeats a title that's still on screen.
- A 2 px volt **progress rail** on the header's hairline: completed sets over
  planned. The only thing on the screen that answers "how much longer".
- The rest bar carries a **"Next"** row — exercise, set number and the numbers
  to hit, from what's typed or from last session. When nothing is resting and
  that set has scrolled off, the same target becomes a **jump pill** docked at
  the bottom; tapping either scrolls the row to centre and tints it
  `bg-surface-2` for 1.6 s. Neutral, not volt: the row is one you still owe,
  and volt on a set row means completed.
- Each exercise's **column headers are sticky**, so a long lift never leaves
  you reading unlabelled numbers.
- The meta row carries **`{muscle} · N sets this week`** — the 7-day figure from
  finished workouts, plus this session's sets counted on the client so it moves
  as you train.
- In a co-op session the header gains a **presence strip**: each other lifter's
  set count, or their rest clock counting down locally between polls.

**"Next" is superset-aware.** A superset rotates, so after a set on A1 the next
thing to do is A2, not A1's second set — `findNextTarget` starts its search at
the member after whichever exercise was ticked last and wraps. That position is
seeded from the logged `completedAt` times, so a reload mid-rotation doesn't
forget which half you're on. Because a superset starts no rest timer, there is
no rest bar to name the partner: completing one shows the jump pill for seven
seconds reading "Straight into …", on screen or not.

**`overflow: hidden` and `position: sticky` can't share the exercise section.**
A clipping ancestor becomes the sticky element's scroll container, so the column
headers would stick to a box the size of their own exercise and never move. The
clip only exists to stop content spilling while the height animates in or out,
so `ExerciseBlock` applies it for exactly those moments: 260 ms after mount, and
again while `useIsPresent()` reports the block is exiting.

`scroll` doesn't bubble, so the watcher listens in the **capture** phase — that
reaches the single scroller in the root layout without a ref to it. It measures
rects rather than using an IntersectionObserver because both questions are
thresholds on a live position, and an observer's numbers are stale between
threshold crossings.

**Fixed-element stacking.** The tab bar is `z-40` at `bottom-0`, and how much of
the screen it occupies is `--bottom-dock` (`--tab-row` 52 px + `--safe-b`).
Anything else docked to the bottom derives from that token — `ActiveWorkoutPill`
is `bottom-dock`, `CommentThread`'s composer sits above the bar at `z-50`, and
the exercise page's `QuickLogDock` clears *both*, at `--bottom-dock` normally and
`+ 56px` when a workout is running so it stacks on top of the pill rather than
under it. The active workout screen lives **outside** the `(app)` group so it has
no tab bar at all, and everything docked there wants `mb-safe`, not the dock.

**An explicit height absorbs its own padding, so `h-[52px] pb-safe` is 52 px.**
That was `TabBarSpacer`, against a `<nav>` that set no height and so measured
52 px *plus* the inset — every page in the app hid the bottom of its last row
behind the bar, and on a phone the strip below the icons read as a dead band
where the app had simply stopped. Both now use `h-dock`, so they cannot disagree:
`nav.getBoundingClientRect().height === spacer…height` is the regression check,
and setting `--safe-b` inline on `<html>` in devtools (24 px Android gesture,
34 px iPhone, 48 px Android 3-button) reproduces a phone — it has to be the
inline style, since `:root` outranks any `html` rule you add. The bar is
`glass-dock` (surface-1) rather than `glass` (bg) for the same reason: against a
`bg`-coloured page, a chin painted `bg` is invisible and reads as void.

**A running workout is visible outside the browser too.** Locking the phone
between sets used to end the session as far as the OS was concerned, and the
rest chime only played if the tab was awake to play it. Three signals now leave
the page (`lib/workout-activity.ts`, driven by `hooks/use-workout-activity.ts`,
fulfilled by the `message` handler in `public/sw.js`):

- A **quiet progress notification** — workout name, sets, volume, what's next —
  posted when Pump goes to the background and closed when it comes back. It is
  a snapshot taken at the moment of backgrounding, not a live readout: the page
  is frozen while hidden, so there is nothing to update it with, and posting on
  every ticked set would put a banner over the set table and buzz the phone once
  per rep on any platform that ignores `silent`.
- A **rest-over alert** — same notification tag, with `renotify` and a vibrate
  pattern so it actually interrupts. Skipped if any client is still visible,
  since the volt bar and the chime have already said it.
- The **app-icon badge** (`navigator.setAppBadge`) carries sets still owed. The
  only one of the three that needs no permission, so it works for someone who
  installed the app and declined push.

**Replace a notification by closing it, not by asking.** `tag` is supposed to
make the rest alert and the quiet line replace each other; iOS honours it
inconsistently and ignores `renotify` outright, so both `sw.js` paths now
`closeWorkoutNotifications()` first. That was only half of it: `useWorkoutActivity`
listens on `visibilitychange` **and** `pagehide`, both of which report `hidden`
for one backgrounding, so it posted twice each time — the transition is the
event now, not the state. And `endWorkoutActivity()` fires from finish and
discard only, so a session that was merely abandoned left its banner up forever;
`ClearStaleWorkoutActivity` in the `(app)` shell calls it whenever the server
says no workout is live. Separately, the progress line has its own mute
(`pump.workout-progress`) — it is the one that appears every time you leave the
app, so it is the one somebody quietening their lock screen means, and muting
the pair would take the alert with it.

**Workout alerts need a permission and nothing else — no VAPID, no subscription,
no server** — so their opt-in cannot live in `PushSettings`, which hides its
whole toggle when VAPID is absent. It shipped that way once and the feature was
*unreachable* rather than broken: on a deployment with no push keys there was no
control anywhere in the app that could grant notification permission, and every
function in `lib/workout-activity.ts` gates on `Notification.permission ===
"granted"`. `WorkoutAlertSettings` is therefore its own card, rendered
unconditionally, and it reports "on" only when a service worker registration
*also* exists — a grant with no worker would report on and then do nothing. It
carries a "Send a test alert" button because none of this is verifiable off a
real installed phone. `RestAlertPrompt` asks once on the workout screen itself,
since a permission nobody can find is the same as a feature that doesn't work.
Muting is a local preference (`pump.workout-alerts`); a page can't revoke a
browser permission, so a control claiming to would be lying. Clearing messages
(`workout-hide`/`-end`/`-rest-cancel`) bypass that gate, or muting would leave the
last notification stuck on screen.

**The app asks for the permission on its own — once when you're new, then
weekly.** A permission nobody was ever asked for reads as a missing feature, and
`RestAlertPrompt` only fires on the workout screen, which someone who hasn't
started training yet never sees. `NotifyNudge` is a `Sheet` mounted in the
`(app)` shell (so never over a running workout), opened 1.2 s after mount so it
never shifts the page under a thumb. It asks **only while
`Notification.permission === "default"`**: a block cannot be undone from a page
— `requestPermission()` returns instantly on `denied` — so its button would be a
lie, and someone who granted the permission and then muted alerts in settings
made a deliberate choice a weekly popup must not reopen. The clock
(`pump.notify-nudge`) is stamped when the sheet **opens**, not when it closes,
or a force-quit with it on screen reopens it on the next load; `RestAlertPrompt`
stamps the same key, since the two ask the identical question and answering one
mid-set must not earn a modal on the feed a minute later.

**The app also offers to install itself — and the button performs the install,
it doesn't describe it.** Installing is the gateway on a phone: on iOS the Push
API, the lock-screen rest alert and the icon badge exist *only* in a
home-screen PWA, and `NotifyNudge` correctly says nothing on an uninstalled
iPhone — so that lifter was offered neither, and nothing in the app had ever
mentioned installing. `InstallNudge` mirrors the doctrine above (a `Sheet` in
the `(app)` shell, 1.2 s after mount, `pump.install-nudge` stamped on open),
with two additions the notification nudge doesn't need: **"Ask me later"** and
a quieter **"Don't ask again"**, which writes `"never"` into the same key —
one key, because a timestamp means "not now" and `"never"` is a timestamp that
never expires. `markInstallAsked` refuses to overwrite `"never"`, or a later
visit would silently restart a cycle somebody opted out of.

- **The event is captured by an inline script in `<head>`, not an effect.**
  Chromium fires `beforeinstallprompt` once, early, and never replays it, so a
  listener registered after hydration misses it on every cold load and the
  feature would appear to work only after a soft navigation. The script
  `preventDefault()`s it (which is what keeps Chrome's own mini-infobar down),
  stashes it, and dispatches `pump:installable`; `lib/install-client.ts` is the
  only reader. `prompt()` spends the event, so it is dropped afterwards
  whatever the answer — a second call would throw.
- **The sheet never opens without an install to perform.** No deferred event and
  not iOS Safari means silence, because the alternative is a button that does
  nothing. iOS Safari gets the Share → Add to Home Screen steps instead of a
  button, since WebKit exposes no install API at any privilege level; iOS
  Chrome and Firefox get nothing at all, as their share sheet has no Add to
  Home Screen either.
- **One unprompted modal per visit** (`lib/nudge-slot.ts`). On an uninstalled
  Chromium browser with the permission still `default`, both nudges are
  eligible in the same instant and two stacked bottom sheets are unreadable.
  The latch is module state, not storage, so the loser asks next visit rather
  than going quiet for a week — which is also why the claim is checked *before*
  `setOpen`, ahead of the stamp-on-open. Install wins by being mounted first.
- **`InstallSettings` on `/notifications` is what makes "Don't ask again"
  safe.** A prompt that can be dismissed forever must not be the only route to
  the feature — the same failure the workout alerts hit when their opt-in lived
  in a card that hid itself. It sits above the two permission cards because on
  iPhone it is their precondition. Installing from it leaves *this* tab an
  ordinary tab, so `isStandalone()` cannot confirm it; the `appinstalled` event
  is the only signal.

**The consistency heatmap opens on this week, not on last February** — unless
you had already panned it somewhere else and came back (`useScrollMemory`,
which is the same memory keyed by a name inside the page). Half a
year of columns is wider than a phone, the newest week is the right-hand edge,
and `scrollbar-none` leaves nothing on screen to say the grid scrolls — so at
the browser's default `scrollLeft: 0` the one part anybody opens `/stats` for
was the part off the edge. A `useLayoutEffect` pins the scroller to
`scrollWidth`, keyed on `today` rather than `[]` because the grid doesn't exist
until the store supplies a client-side date, and layout rather than passive so
the jump lands before paint. Over-assigning is clamped, so a card wide enough
to fit the whole grid is a no-op — and never `scrollIntoView`, which would
scroll the document's one root scroller and move the page itself.

**The opt-in sequence lives once, in `lib/notify-client.ts`.** `enableNotifications`
is permission → register `/sw.js` → `serviceWorker.ready` → un-mute → *then*, only
when a VAPID key is passed, `subscribeToPush`. Push is last and non-fatal by
construction: rest alerts, the lock-screen line and the badge are already working
by the time it runs, so a refused endpoint must not report "off" about three
features that are on. `WorkoutAlertSettings` calls it with no key (those alerts
need no subscription); `NotifyNudge` passes `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, so one
tap covers both channels where the deployment has them. `RestAlertPrompt` goes
through it too — it used to call `Notification.requestPermission()` bare, which
grants the permission without registering the worker that posts the alerts, and
`WorkoutAlertSettings` then correctly reported "off" about a permission the
lifter had just granted.

**The only thing that can make a noise on a locked phone is an audio session**
(`lib/rest-audio.ts`). A notification cannot carry a sound — the `sound` option
is implemented by nobody, so a banner gets the OS tone and `vibrate` and that is
all — and every timer the page or the worker could use is throttled or stopped
by exactly the case that matters. But a page *playing audio* is kept running by
the OS, and a Web Audio node scheduled on the audio clock fires at its sample
whatever is happening to JavaScript. So the tap that starts a rest primes the
context (iOS unlocks audio on a gesture and nothing else) and schedules
`public/sounds/rest-over.wav` for the instant the rest ends. Both assets are
generated by `scripts/generate-sounds.mjs`, so the whole of each is twenty lines
of arithmetic. The chime is keyed on `endsAt`, which is what lets the foreground
timer hitting zero and the scheduled node be the same event and sound once. It
is still an enhancement: a phone call takes the session, Safari refuses a
context that no tap primed, and the volt bar stays the source of truth.

**But an audio session is taken, not shared — so holding one costs you your
music.** `silence.wav` looping for the length of the rest is, to the OS, this
page playing media: iOS interrupted Spotify for it, Android handed Pump the
audio focus and paused it, and the `mediaSession` metadata put Pump on the lock
screen in place of the music app's own transport. Every rest, for the whole
rest. Lifting to music is most of the gym and a chime is not worth that, so the
default now **mixes**: `navigator.audioSession.type = "ambient"` (the one WebKit
category that plays alongside another app rather than over it), no keep-alive
element constructed at all, and no media-session claim — the scheduled node is
the only thing this module puts on the hardware, half a second at the end of the
rest rather than the whole of it. The cost is symmetrical and is what the
settings copy has to say: an ambient session obeys the ring/silent switch and is
suspended when the page backgrounds, so the chime is certain while Pump is on
screen and the service-worker banner is the channel when it isn't.
`pump.rest-sound-hold` buys the old behaviour back for someone who trains
without music — the loop, `"playback"`, and the locked-screen chime — and
`setRestSoundHoldsSession` applies it to a rest already running, because the
music it stops is playing *now*. `silence.wav` stays one LSB rather than digital
silence, and a *file* rather than a muted element, because iOS ignores `volume`
on media entirely and some platforms drop a session for an all-zero stream.

**The delay lives in the service worker, held open by `waitUntil`.** A
backgrounded tab has its timers clamped to roughly once a minute and an
installed iOS PWA is suspended outright, so a page-side `setTimeout` is
guaranteed to be late for precisely the case that matters; and a server-scheduled
push is impossible here — Hobby cron is twice a day and a function can't sleep
for two minutes. So the alarm is armed the instant the rest starts, while the app
is still in the foreground, because nothing will be running later that could arm
it. It is best-effort by construction: a browser may stop a worker whenever it
likes, and iOS does — which is why the *banner* is what this channel delivers and
the sound comes from the audio session above, the more reliable of the two. The
in-app bar stays the source of truth.

`workout-hide` (app came back) deliberately does **not** cancel the armed alarm —
only `workout-end` does. Opening Pump mid-rest and putting it away again must not
lose the alert. `endWorkoutActivity()` is called from the finish action's success
path and from discard, the only two places that know the session stopped being
live; the finish call happens before the celebration, which is dismissed by a tap
that may never come. It also cancels the scheduled chime — the fourth thing a
finished session leaves running, and the only one that would make a noise — so
"the workout is over" stays a single call.

**Dense screens are solid, not translucent.** `glass` is for browsing chrome.
The workout and routine-builder headers use `bg-bg` — a device that fails to
composite `backdrop-filter` would let exercise names ghost through.

---

## Animation — deliberate moments only

Everything routine is a 150–200 ms CSS transition. These get choreography:

| Moment | Treatment |
|---|---|
| Set completed | Row tints volt; light haptic |
| Rest running | Bottom bar with draining track; pulse + haptic in the last 3 s |
| **Workout finished** | SVG checkmark draws on → stats count up staggered → confetti **only if a PR** |
| PR mid-workout | Gold badge burst on the row, non-blocking |
| **Friend added** | Two avatars spring in and snap together |
| Achievement unlocked | Scale-in with a shimmer sweep |

`motion` for choreography (springs, not easing curves). `canvas-confetti` is
lazy-imported on the finish screen only. All of it degrades under
`prefers-reduced-motion`. Haptics via the Vibration API are **Android-only** —
iOS Safari doesn't implement it, so never make a haptic the sole feedback.

---

## Conventions

- **Weights are always stored in kilograms.** `user.unit` is a display
  preference; convert at the edge with `formatWeight`/`lbToKg`.
- **An exercise you load has a load column. `reps` is for exercises with no
  number to record.** Eighteen built-ins were configured `reps` while plainly
  carrying weight — a dumbbell walking lunge, a plate front raise, a weighted
  chin-up, a loaded neck harness — so the app offered nowhere to write the one
  value that changes between sessions, and their charts and records could only
  ever be flat. `tests/seed-data.test.ts` now pins the whole library against
  equipment, with the two real exceptions named: `glute-ham-raise` and
  `captains-chair-leg-raise` are machines that hold *you*, and the pad only
  sets the angle. Bands stay reps-only in both directions — their help is a
  colour, not a number of kilograms.
- **A load you *add* to a bodyweight lift is its own exercise, not a weight box
  on the bodyweight one.** `chin-up-weighted` established this and nine entries
  now follow it — `dip-weighted`, `dip-machine`, `push-up-weighted`,
  `pull-up-weighted`, `inverted-row-weighted`, `back-extension-weighted`,
  `hanging-leg-raise-weighted`, `decline-sit-up-weighted`, and
  `assisted-chin-up-machine` at `assist_reps`. Putting a usually-empty weight
  column on Push Up would ask every lifter to leave a field blank forever and
  would make a bodyweight day's estimated 1RM null, which is the exact shape of
  the chart bug below. A separate entry keeps bodyweight logging clean, gives
  the belt somewhere honest to go, and lets the two progress as the different
  things they are. Cross-link both ways or the picker never leads from one to
  the other — and the seed test forbids orphans anyway.
- **An assisted machine's weight column is help received, so it is recorded but
  never scored** (`assist_reps`, `lib/tracking.ts`). Assisted dips and assisted
  pull-ups were `reps`, which lost the only number that moves — the whole point
  of the machine is the counterweight coming down. But `weight_reps` would have
  been worse than losing it: every scoring path in the app is a sum or a maximum
  over `weight_kg × reps`, so the day you needed 45 kg of help would have
  outranked the day you needed 20, an assisted pull-up would have out-volumed
  the real one it is a scaffold toward, and the PR badge would have fired for
  getting weaker. So `assist_reps` stores the number in the same column, shows
  it signed (`−40 × 8`, `−kg` in the table header), and excludes it from volume,
  from `estimated_1rm`, and from the `weight`/`volume`/`1rm` record kinds — in
  `sumSetTotals`, in `finishWorkout`'s live PR pass, in
  `recalculatePersonalRecords`, and in the four read aggregates that never leave
  Postgres. Reps still score, because more reps at the same assistance is a real
  result. Where "best" is unavoidable the comparison **inverts** rather than
  disappearing: the rep-max table and the session chart read the *least*
  assistance, and the exercise page swaps its volume tile for "Least assist". No
  migration: the column is plain `text`, and the two built-ins had no weights
  logged against them to rewrite.
- **A quick-logged set lives in a workout that was inserted already ended.**
  Nothing counts until a workout is finished — every stats and records query
  filters `ended_at IS NOT NULL` — so `quickLogSet` writes a `workout` whose
  `endedAt` is set at insert. That is safe against `workout_one_active_idx`
  because the unique index is scoped `WHERE ended_at IS NULL`: a quick log is
  never *active*, so it neither blocks nor is blocked by a real session.
  Consecutive logs for **today** reuse the same row for 12 rolling hours (not a
  calendar day — `started_at` is timezone-naive and the user's midnight is
  unknown). The session is identified by `workout.kind`, never by its name:
  `name` is user-editable through `updateWorkoutMeta`, so a rename would
  silently fork a second session. Records go through
  `recalculatePersonalRecords`, which also owns `workout.pr_count` — quick-log
  must not write that column itself.
- **A backdated quick log is scoped to the calendar day, and stamped at noon
  UTC.** The rolling window is meaningless for a day three weeks ago, so the
  reuse lookup switches to that day's half-open range — a range on the raw
  column, so `workout_user_kind_started_idx` still serves it and `DATE(started_at)
  = $1` never re-opens the question of which zone `DATE` means. The client sends
  a `YYYY-MM-DD` (`lib/day.ts`, pure so `pure.test.ts` can hold it), not an
  instant: the user picked a *date*, and an instant would invent a time-of-day
  they never gave. **Noon**, because a `timestamp` column here carries no zone
  and drizzle serialises through `toISOString()` — so the stored value is the
  UTC clock, and noon is the only stamp where `DATE(started_at)` is the chosen
  day *and* a client rendering it locally reads the same date back at every
  offset in (-12, +12). Midnight renders as the previous day everywhere west of
  Greenwich, which would put the history header and the heatmap in contradiction
  with the picker. The request also carries `tzOffsetMinutes`, used for one
  thing only — deciding which day is "today" for *this caller*, so a user at
  UTC+13 isn't refused for logging their own today "in the future". It is never
  stored and never reaches a timestamp.
- **`finishWorkout` and quick-log both write the denormalised counters**, so
  "what scores" (ticked, not a warm-up) lives once in `lib/workout-totals.ts`
  and is asserted in `tests/workout-totals.test.ts`.
- **`/workout/[id]` deliberately has no `loading.tsx`.** A loading file makes
  Next stream a 200 shell before `notFound()` runs, and `check-authz` asserts
  that someone else's live workout answers 404 on the wire, not just in the
  rendered output. Every other route has one — and needs one, because
  prefetching a dynamic route fetches the loading shell and nothing else.
- **Motion constants live in `lib/motion.ts`; reduced motion comes from
  `useMotionPreset()`.** The `prefers-reduced-motion` block in `globals.css`
  zeroes CSS transitions and animations only — it cannot reach a JS-driven
  transform, which is what `motion` animates. A `motion.*` component that
  doesn't consult the hook ignores the setting entirely.
- Estimated 1RM is **Epley** (`w × (1 + r/30)`), cached on `workout_set.estimated1rm` so PR detection is one comparison.
- **A session with no load is not a session at 0 kg.** `estimate1RM` returns `0`, not null, for a non-positive input, so every write path guards on `weightKg > 0 && reps > 0` — `quickLogSet` did, `updateSet` and the bulk fill did not, and a stored `0` is indistinguishable downstream from a real estimate (`0016` nulls out the rows already written that way). At the read end the exercise chart's `valueOf` returns `null` rather than `?? 0` and the series *drops* sessions with no figure for the selected metric: coercing to zero printed "0 kg" against days nothing was logged at zero, put a fictional 0 on the low axis label and pinned the trend line to the floor. Volume and reps are untouched — those are COALESCEd counts where zero really is zero. The empty state distinguishes "nothing logged in this range" from "nothing in this range carried a load", which are different facts.
- Warm-up sets are excluded from volume, records and muscle-volume counts.
- **Rest resolves through three levels: `workout_set.rest_seconds` → `workout_exercise.rest_seconds` → `user.default_rest_seconds`.** `null` at a level means inherit; **`0` means no rest at all** and stops the search, which is why the chain is `??` and never `||`. Those two were conflated before — the exercise sheet's chip was labelled "Off" and wrote `null`, so turning rest off gave you the default rest. `RestPicker` now spells `null` as "Same as …" and shows what it resolves to.
- **The routine builder writes the same three states through the same control.** It carried its own row of six hardcoded chips long after `RestPicker` landed, so it reproduced the conflation above — "Off" wrote `null`, and `startWorkoutFromRoutine` reads `null` as `?? defaultRestSeconds`: a routine that said Off rested. Worse for reading a routine back, its chips were `[0,60,90,120,180,240]` while every writer accepts 0–1800 (the JSON import, `routine-prompt`, and "save workout as routine", which copies straight from a picker offering 30 and 45) — so an exercise resting 45 s opened with nothing lit and nothing naming the value, which is the whole of "the rest it had isn't showing". `REST_PRESETS`/`restLabel` are therefore in `lib/rest.ts` — pure, like `RPE_VALUES`, because the routine detail page renders rest from a server component and every export of a `"use client"` module is a client reference. And a stored value outside the presets is **sorted into the grid as a selected chip**: 150 s is reachable, and highlighting nothing is indistinguishable from "no rest set".
- **Setting rest at the exercise level clears every per-set override under it.** That is what "change it for the whole exercise" has to mean: an override left on one set would silently keep winning over the value just chosen, and the two levels are indistinguishable once the sheet closes. `updateWorkoutExerciseSettings` does it in one transaction whenever `restSeconds` is present in the patch, and `setRest` mirrors it optimistically on the client. Per-set rest does **not** round-trip into a saved routine — `routine_set` has no rest column, only `routine_exercise` does.
- **The rest strip is a divider that carries a value, not a sixth column.** Rest isn't a measurement of the set, it's the gap after it, so `RestStrip` is recessed (`bg-surface-1` against the rows' `bg-bg`) and sits outside the table's column grid — the point of putting it in the flow is that you can see where the gaps are uneven. Volt marks a set carrying its own override, the only way to tell the two levels apart at a glance. It renders after every working set including the last (that rest runs too) and never after a warm-up (those start no timer, so naming a rest would be a lie). It is 40 px, not 44: it repeats between every set on the one screen the design keeps dense, and it matches `RpePicker`'s chips, which are this app's floor for a repeated control.
- **The running rest appears in two places, and they read from one store.** `RestTimerState` carries the `setId` its rest follows, persisted with `endsAt`, so the strip sitting in that gap counts down alongside the bar instead of showing its planned duration — the bar said `1:56` while the strip three rows up still said `2:00`, and there is no reading of that which isn't a bug. Only the bar and that one strip subscribe to `useRemaining()`, so a tick re-renders two leaves and never the set table.
- **The bar is summoned, not shown.** Visibility used to be the same bit as "a rest is running": ticking a set called `timer.start()` and the panel docked itself over the bottom of the set table for the whole two minutes — over the rows you are reading and the inputs you are typing the next set into. The clock is not the panel. `restBarFor` in `workout-screen.tsx` holds the `endsAt` the bar is open for (an `endsAt`, never a boolean, so a *new* rest cannot inherit the previous one's open state), the running `RestStrip` is what opens it, and `RestTimerPanel` puts itself away on a capture-phase `pointerdown` outside it or on any scroll — capture, because that dismissal has to land before whatever you tapped runs, and because `scroll` doesn't bubble to the one scroller in the root layout. The rest carries on underneath: only the panel closes. Read `restBarOpen`, which derives from the store, never `restBarFor` alone — a rest that runs out auto-clears 2.5 s later, and the stale `endsAt` would suppress the jump pill for the rest of the session. That pill now stands down for the panel being *open*, not for a rest existing.
- **A sheet that commits as you tap needs a `dismissLabel`.** `Sheet` has no corner X on purpose — the dismiss belongs in the thumb zone — but that left the settings sheets (exercise options, set options, the plate calculator, the builder's exercise and About sheets) dismissible only by dragging the handle, tapping the backdrop or Escape, none of which is drawn on the screen. So the sheet read as having no way out, and on the About sheet the handle is scrolled away from the prose anyway. The button is neutral, not volt: nothing is being committed — every control in those sheets has already written — and it is skipped entirely for a sheet with a real footer action or one that closes on the choice you make (the rest sheet, both RPE sheets).
- **The destructive control in an options sheet lives in its header, not at its foot.** Removing an exercise sat under rest, order, superset, interval and a note — in the workout screen, in the routine builder, and (shorter, but the same shape) on `/exercises/[id]`. It is the one thing somebody opens that sheet in a hurry for, and it was the one thing off the bottom of a phone. `Sheet` therefore takes a `titleAction`, rendered flush right in the title row, and each of those three passes a red trash `IconButton` into it; the full-width danger button below is gone, so there is exactly one way to remove and it is always on screen. Mid-workout it is the only control on that screen that destroys logged work with no undo, so it confirms — **but only when there is something to lose**: `loggedSets()` (a typed number, a rating or a completion — not a rest override or a set type, which the next block recreates anyway) decides between a confirm sheet and removing on the tap. On `/exercises/[id]` the icon opens the existing *archive* confirmation unchanged: a trash glyph is the affordance, and the copy is where "your history stays exactly as it is" gets said.
- **Replacing an exercise asks whether the logged sets come with it.** `replaceWorkoutExercise` cleared every value on the block, always — right for a squat swapped for a plank, wrong for the case that actually happens, which is a barbell row swapped for a chest-supported row two sets in. `keepValues` is the answer to that question, and the **server decides whether to honour it**: the keep is refused across a change of tracking type whatever the client sent, because the columns differ and an `assist_reps` load means the opposite of a `weight_reps` one. Kept means the `workoutSet` update is skipped entirely — `estimated1rm` included, which is still correct precisely because weight, reps and the tracking type are all unchanged. The set *rows* survive either way, which is what makes a session carrying more sets than the routine prescribed safe: all of them keep their values. The action returns the sets in full rather than their ids, so the screen rebuilds the block from what happened instead of from what it hoped; `notes` and the interval prescription are still cleared in both cases, because a cue or a work/rest countdown is per-movement even when the numbers aren't. The screen only raises the sheet when both halves hold — `loggedSets(block).length > 0` and the picked row's `trackingType` matching — which is why `ExercisePicker.onConfirm` hands back the chosen `ExerciseListItem`s alongside the ids. An exercise created inline has no row to hand back, so that path clears, as it always did.
- **The plate calculator is offered on a bar you load, and nowhere else** (`lib/equipment.ts`). Its whole arithmetic is `(target − bar) / 2`, so on a dumbbell incline press or a dumbbell curl it was answering a question the exercise never asked. `hasLoadablePlates` is `barbell` or `smith` — `machine` covers selectorised stacks as well as plate-loaded ones and nothing on the row can tell them apart, and `equipment: "plate"` in this library means an exercise performed *holding* a plate (Plate Pinch, Svend Press, Russian Twist), not a plate-loaded machine. It is a pure module of its own rather than an export of `plate-calculator.tsx`, which is behind a `dynamic()` import so it stays out of the first paint of the one screen that is a sweaty thumb waiting.
- **The reorder sheet commits on close, not on each drop.** Writing through per drop re-ordered the full exercise blocks live *behind* the modal — tall rows sliding about on a screen that is mostly numeric inputs. The drag is local state inside `ReorderList`, the order reaches the parent through a ref (no re-render per intermediate position), and `closeReorder` commits — from the Done button and from `onClose`, which `Sheet` does route backdrop and Escape through, so dismissing never loses the change.
- **`data-set-id` wraps the set row alone, not the row plus its rest strip.** `useScrollWatch` and `jumpToSet` both ask "where is the set I owe", and a box 40 px taller would answer with the gap after it.
- **A prescribed effort and a rated one are two facts in two columns.** `workout_set.target_rpe` is what the routine asked for, copied from `routine_set.target_rpe` at start; `workout_set.rpe` is what the lifter said it felt like. `startWorkoutFromRoutine` used to pre-fill the prescription straight into `rpe`, "like every other target" — but weight and reps land in *text inputs*, which visibly are targets you type over, whereas RPE has no input, only the result-shaped subscript under the set number. So every untouched set in a freshly started routine displayed the lifter's own rating for a lift they hadn't performed, and a finished session held no record of asked-for versus delivered. The column is a snapshot (there is nothing to join back to: a mid-workout `addSet` has no `routine_set`, a replaced exercise points at a movement the routine never named, and editing the template must not rewrite a live session). It is never in `setPatchSchema` — a prescription is not editable mid-workout — and `0015` recovers the pre-filled values on live routine sessions only, deliberately leaving finished workouts alone because no predicate can tell a deliberate rating from a pre-fill after the fact. `tests/workout-start.test.ts` is the regression test that was missing.
- **The two registers differ by glyph, never by shade: `→8` prescribed, `@8` rated, `@–` owed.** `lib/rpe.ts` owns the decision table (`rpeSubscript`) and every rendering of both. Two greys at 9 px on a phone in a gym are not a difference, and on a completed row's volt tint they collapse entirely; volt is out of the question for a target, since it marks state the lifter produced and a prescription is the one thing on screen they haven't. A rating always wins once it exists. The same `→8` appears on `/routines/[id]`, the builder's per-set cell, the rest bar's "Next" line and the history row, so one prescription reads identically before, during and after.
- **RPE is per-set, and the scale lives only in `RPE_VALUES`** (`lib/rpe.ts` — pure, because server actions validate against it and cannot import a client component; `rpe-picker.tsx` imports it back). Five surfaces write it — set options, quick-log, history detail, and the routine builder both per set and for a whole exercise at once — and they all render the same component; only the explanatory `hint` differs, because a routine prescribes an effort ahead of time and a set records one afterwards. The builder used to hand-roll its chips and its array omitted 6.5, so a routine could prescribe an effort a logged set could not record. Our own write paths validate against the scale itself (`rpeValue`); a JSON import or an LLM plan goes through `rpeInput`, which snaps to the nearest half point instead of sinking a 50-exercise import over one set written `7.3`, and drops what still falls under 6 rather than inventing a 6 nobody wrote.
- **Anything that speaks for several sets uses `rpeRangeLabel`, not `sets[0]`.** The builder's card header read the first set's prescription, so a lift ramping 7/8/9 announced itself as "RPE 7" — and the exercise-level picker lit its `—` chip for a mixed fold, claiming "no prescription" about an exercise that had three. Mixed values are not hypothetical: `saveWorkoutAsRoutine`, the JSON import and `routine-prompt` all produce them. That control still writes every set at once (the common case, "3×8 @ 8") and now says so; a ramp is set on the row's own RPE cell.
- **RPE is the one logged value that stays editable after `finishWorkout`.** It feeds no denormalised counter, no volume figure and no personal record, so changing it on `/history/[id]` needs no recalculation — unlike weight or reps, which is why nothing else there is editable. `SetRpeRow` reuses `updateSet`, whose authorisation is already scoped to `workout.userId = me.id` and deliberately doesn't require the workout to be active. Skipped sets are excluded: an effort rating on a set you didn't do is a contradiction, not a gap.
- **The `@–` placeholder on a completed set row is the affordance, not decoration.** The subscript used to appear only once a rating existed, so the gesture that sets one was advertised by nothing but its own result and the feature read as absent. A completed set therefore always shows one of `@8` or `@–`, and an *un*completed set shows `→8` when a routine prescribed one — so the gesture is advertised before the set too, which is when the prescription is worth reading. There is no one-tap version of this control: nine half-points at the 44 px minimum is 396 px of chips, so it is a sheet — and effort comes first in that sheet, above set type, because set type is decided once and usually inherited from the routine. Same arithmetic is why the builder prescribes through a sheet rather than a strip of chips on the row.
- **The load multiplier scales weights and nothing else — least of all the prescribed effort.** RPE maps to a percentage of 1RM differently at every rep count, so any arithmetic on it in `LoadPicker` would be invented. The copy has to say so: "sets and reps stay as written" quietly implied the prescription still held at 80%, when a set written `@8` lifted that light feeling easier *is* the deload.
- Server actions return `ActionResult<T>` (`{ok:true,data} | {ok:false,error}`) — never throw for expected failures.
- Query modules import `server-only`; anything a client component needs goes through a thin `"use server"` wrapper (`actions/exercise-search.ts`, `actions/people-search.ts`).
- **Built-in exercises are identified by `exercise.slug`, not by name.** The uuid is per-database, so the seed upserts on slug and `exercise_alternative` pairs are authored against slugs and resolved to uuids at seed time. `slug` is null for custom exercises and is never settable through an action. Renaming a built-in is safe; changing its slug orphans every deployed row, which is why `seed-data/legacy-slugs.ts` is frozen. `tests/seed-data.test.ts` gates all of it without a database.
- **A custom exercise is archived, never deleted.** `DELETE` cascades through `workout_exercise` to every set logged against it, rewriting finished sessions and dropping the records computed from them — so the "delete" control sets `exercise.archived_at`. Archived rows drop out of `searchExercises` (and therefore every picker) but still resolve by id, because history links to them. `lib/actions/exercise.ts` owns create/update/archive/restore and scopes every statement with `owner_id = me.id`, which is also what makes the built-in library read-only by construction.
- **Edit and archive live in the NavBar's `right` slot, not at the foot of the page.** `/exercises/[id]` is a tab panel that can be a chart card, a rep-max table or thirty rows of history, so a control below it was off screen at every position anybody actually reads from — reaching "Edit exercise" meant scrolling past everything you came for. The bar is sticky and survives the large-title collapse, so one `…` `IconButton` there is reachable throughout and costs the content nothing. Still gated on ownership: a built-in shows no icon.
- **A routine never points at an exercise its owner doesn't own.** Both ways of
  taking someone's routine — `copyRoutine` and the JSON import — run every
  incoming exercise through `resolveExercisesForUser` (`lib/routine-write.ts`),
  which binds it to a built-in by `slug`, to one of your rows by
  `source_exercise_id` or case-insensitive name, or to a fresh clone. Copying
  the ids verbatim is what the old code did: it rendered, and then 404'd on the
  detail page, vanished from the picker, wrote PRs against a row you don't own,
  and cascaded away when the author deleted their account. `0010` backfills the
  rows that predate the fix; it deliberately leaves `workout_exercise` alone,
  and says why in its header.
- **An exercise that arrived with someone's routine is hidden from search until
  adopted.** `exercise.imported_at` is the flag and `filterWhere` is the only
  gate that reads it, so the `available` and `mine` scopes mean "built-in plus
  what you authored". An import can mint 50 rows named by a stranger; joining
  every picker unasked would make their naming your problem. The one exemption
  is `getRecentExercises`, which passes `includeImported` — Recent is "what you
  have trained", and hiding something you have actually done would be a bug.
  The picker offers an inline reveal when a *narrowed* search has hidden
  matches; `adoptImportedExercise` (or any edit) clears the flag for good.
- **The About sheet says the same things about an exercise that its page does.**
  The routine builder opens `ExerciseAboutSheetBody` rather than navigating (the
  draft is unsaved React state), and it showed neither the imported strip nor
  the archived one nor the `muscle · equipment` line the page carries as its
  NavBar subtitle — on the surface *most* likely to hold imported rows, since a
  routine that arrived as JSON is made of them. `ExerciseStateStrips` is the
  shared block and `getExerciseAboutAction` returns the two flags it needs,
  computed exactly as the page computes them. The sheet passes `onAdopted`
  because it has no server render for `router.refresh()` to reach: it rewrites
  its own per-id cache entry instead. The history/charts/records tabs stay off
  the sheet — six aggregates behind a sheet opened mid-build is the wrong trade.
- **The export format carries no ids and nothing the app treats as vetted.**
  `lib/routine-transfer.ts` is pure and `.strict()` at every level, which is
  what makes the exclusions enforceable rather than aspirational: no uuids
  (per-database, and an `exercise.id` in a file invites trusting it), no
  `sourceRoutineId` (a crafted document could otherwise drive `saveCount` on
  any routine it named — an import credits nobody), no `videoUrl`, no `slug` on
  a custom, no author identity. Weights are `targetWeightKg` and there is no
  `unit` field, which would only invite converting twice.
- **`<a download>` is not the primary export path.** Blob-URL downloads are
  unreliable in an installed iOS PWA and can bounce the user out of the app, so
  `navigator.share({files})` leads, the anchor is the desktop/Android fallback,
  and the clipboard sits behind both. On the import side, never branch on
  `file.type` — iOS reports `""` for a `.json` out of Files — and put the
  extension first in `accept`, because the Files picker filters by UTI.
- **Only curated YouTube ids reach `videoUrl`; everything else falls back to a search** built from the exercise name, and the UI labels the two differently (`lib/exercise-video.ts`). Never present a search results page as a vetted demonstration.
- **Correlated subqueries:** in a drizzle `.select()` with no joins, `${table.id}` renders as a bare `"id"` and resolves against the subquery's own FROM. Write the outer column qualified via `sql.raw('"table"."col"')`, or use `db.execute` with raw SQL. `pnpm check:queries` catches this.
- **`DISTINCT ON` inside a `UNION`** needs each branch parenthesised — an unbracketed `ORDER BY` binds to the whole union and it's a syntax error (`lib/records.ts`).
- **Anything time-relative is a client component with `suppressHydrationWarning`** — `<TimeAgo>`, `<Elapsed>`. Server and client render at different instants, and a text mismatch makes React discard the subtree: on `ActiveWorkoutPill` that remounts the one component whose job is to persist. Same rule for client-only storage: the rest timer seeds from `sessionStorage` through `useSyncExternalStore` (server snapshot `null`), never a `useState` initialiser.
- **Every export of a `"use server"` module is a public POST endpoint.** Authorisation belongs *in the action*, not only in the page that renders it — and a helper taking a `userId` doesn't belong in one at all (`lib/records.ts` is separate for exactly this reason). `node scripts/check-authz.mjs` is the regression test.
- Presentational primitives (`components/ui/primitives.tsx`) deliberately have **no** `"use client"`, so server components can pass them icons and render them directly.
- Photo upload goes **browser → Blob directly** via a token from `/api/blob/upload`; the client downscales to 1280 px first. Stored URLs are validated with `isBlobUrl` before they're written. No `BLOB_READ_WRITE_TOKEN` → the control simply isn't offered, same as push.
- The feed and history paginate on a **keyset cursor**, never `OFFSET` — new rows push onto the front of both.
- **A check-in names a gym you picked, and `null` is one of the answers.** The
  broadcast sheet on `/feed` lists your gym memberships plus "Don't say where",
  seeded from your current presence row or your home gym. So `checkInAtGym`
  distinguishes an *absent* `gymId` (inherit the home gym — what the old
  single-button flow meant) from an explicit `null`; `input.gymId ?? homeGymId`
  collapses the two and makes "don't say where" impossible to express. The id
  is then re-checked against `gym_member`: the gym's name goes out in a
  notification to every friend, so it can't be an arbitrary uuid off the wire,
  and an unjoined gym is refused rather than silently dropped
  (`check-authz` asserts it).

---

## Commands

```bash
pnpm dev              # Next 16 (Turbopack)
pnpm build            # production build
pnpm typecheck        # next typegen && tsc --noEmit
pnpm lint             # eslint (next lint was removed in v16)
pnpm test             # vitest — records, counters, rate limiter, pure helpers

pnpm db:generate      # drizzle-kit generate — after editing schema.ts
pnpm db:migrate       # apply migrations
pnpm db:seed          # exercise library + achievements (upserts on slug — re-run to update)
pnpm check:queries    # run every read query against the DB, catch SQL errors

node scripts/walkthrough.mjs   # iPhone-viewport walkthrough of the core loop, screenshots to /tmp/pump-shots
node scripts/smoke.mjs         # every route + two-user social/co-op flow + mid-workout paths
node scripts/check-authz.mjs   # sign in as B, call actions against A's ids, assert refusal
node scripts/generate-icons.mjs # regenerate PWA PNGs from public/icon.svg
node scripts/generate-sounds.mjs # regenerate public/sounds (rest chime + keep-alive loop)
```

`pnpm test` runs against the **real** database (`.env.local`), not a mock: the
things it covers — a record surviving the deletion of the workout that set it,
a counter agreeing with its rows under concurrency, a limiter that a burst
can't slip through — are all properties of the SQL. Each test creates a
throwaway user and cascades it away afterwards. `check-authz` needs `pnpm dev`
running.

Local dev uses plain Postgres via `pg`; production uses the Neon serverless
driver. `lib/db/index.ts` picks by hostname, so pointing `DATABASE_URL` at a
real Neon branch works without code changes.

`ALLOW_DEV_CREDENTIALS=true` opens email+password sign-in for local work before
a Google OAuth client exists. It is gated on `NODE_ENV !== "production"` as
well as the flag.

---

## Deploying

1. Vercel → Storage → **Neon** integration. It sets `DATABASE_URL`.
2. Google Cloud Console → OAuth client (Web). Authorized redirect URIs:
   `https://<domain>/api/auth/callback/google` and
   `http://localhost:3000/api/auth/callback/google`.
3. Env — all four are **required**, set for every environment the build runs in:
   `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL` (the
   canonical public origin, no trailing slash), `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`.
   **The build fails without `BETTER_AUTH_SECRET`, deliberately.** Better Auth
   otherwise falls back to a default secret that ships in its published source
   — it logs an error, carries on, and the deployment goes out with session
   cookies anyone can forge. A build that stops is the better outcome.
4. Nothing to run by hand — `pnpm build` runs `drizzle-kit migrate` **and**
   `pnpm db:seed` before `next build`, so every deploy carries the schema and
   the built-in library with it.
   **The seed has to run on deploy, not just locally.** It only ever ran as a
   manual step against `.env.local`, so the 249 built-in exercises reached dev
   databases and never production: migrations created an empty `exercise`
   table and every picker in the deployed app was empty. The seed is an upsert
   on `slug` and deletes no built-in, so re-running it on each build is safe
   and is how library edits ship. `db:seed` uses `--env-file-if-exists` because
   there is no `.env.local` on Vercel.
5. Optional: `npx web-push generate-vapid-keys` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Without them the app just doesn't
   offer push.
6. Optional: Vercel → Storage → **Blob**. It sets `BLOB_READ_WRITE_TOKEN`, and
   avatars and workout photos appear. Without it neither control is offered.

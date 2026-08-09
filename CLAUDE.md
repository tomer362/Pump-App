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

**Fixed-element stacking.** The tab bar is `z-40` at `bottom-0`, 52 px + safe
area. Anything else docked to the bottom must clear it (`ActiveWorkoutPill` at
`bottom-[52px]`) or sit above it (`CommentThread` composer, `z-50`). The
exercise page's `QuickLogDock` clears *both*: `bottom-[52px]` normally, and
`108px` when a workout is running so it stacks on top of the pill rather than
under it. The active workout screen lives **outside** the `(app)` group so it
has no tab bar at all.

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
- A **rest-over alert** — same notification tag, so it replaces the quiet line
  rather than stacking, with `renotify` and a vibrate pattern so it actually
  interrupts. Skipped if any client is still visible, since the volt bar and the
  chime have already said it.
- The **app-icon badge** (`navigator.setAppBadge`) carries sets still owed. The
  only one of the three that needs no permission, so it works for someone who
  installed the app and declined push.

**The delay lives in the service worker, held open by `waitUntil`.** A
backgrounded tab has its timers clamped to roughly once a minute and an
installed iOS PWA is suspended outright, so a page-side `setTimeout` is
guaranteed to be late for precisely the case that matters; and a server-scheduled
push is impossible here — Hobby cron is twice a day and a function can't sleep
for two minutes. So the alarm is armed the instant the rest starts, while the app
is still in the foreground, because nothing will be running later that could arm
it. It is best-effort by construction: a browser may stop a worker whenever it
likes, and iOS does. The in-app bar stays the source of truth.

`workout-hide` (app came back) deliberately does **not** cancel the armed alarm —
only `workout-end` does. Opening Pump mid-rest and putting it away again must not
lose the alert. `endWorkoutActivity()` is called from the finish action's success
path and from discard, the only two places that know the session stopped being
live; the finish call happens before the celebration, which is dismissed by a tap
that may never come.

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
- Warm-up sets are excluded from volume, records and muscle-volume counts.
- **Rest resolves through three levels: `workout_set.rest_seconds` → `workout_exercise.rest_seconds` → `user.default_rest_seconds`.** `null` at a level means inherit; **`0` means no rest at all** and stops the search, which is why the chain is `??` and never `||`. Those two were conflated before — the exercise sheet's chip was labelled "Off" and wrote `null`, so turning rest off gave you the default rest. `RestPicker` now spells `null` as "Same as …" and shows what it resolves to.
- **Setting rest at the exercise level clears every per-set override under it.** That is what "change it for the whole exercise" has to mean: an override left on one set would silently keep winning over the value just chosen, and the two levels are indistinguishable once the sheet closes. `updateWorkoutExerciseSettings` does it in one transaction whenever `restSeconds` is present in the patch, and `setRest` mirrors it optimistically on the client. Per-set rest does **not** round-trip into a saved routine — `routine_set` has no rest column, only `routine_exercise` does.
- **The rest strip is a divider that carries a value, not a sixth column.** Rest isn't a measurement of the set, it's the gap after it, so `RestStrip` is recessed (`bg-surface-1` against the rows' `bg-bg`) and sits outside the table's column grid — the point of putting it in the flow is that you can see where the gaps are uneven. Volt marks a set carrying its own override, the only way to tell the two levels apart at a glance. It renders after every working set including the last (that rest runs too) and never after a warm-up (those start no timer, so naming a rest would be a lie). It is 40 px, not 44: it repeats between every set on the one screen the design keeps dense, and it matches `RpePicker`'s chips, which are this app's floor for a repeated control.
- **`data-set-id` wraps the set row alone, not the row plus its rest strip.** `useScrollWatch` and `jumpToSet` both ask "where is the set I owe", and a box 40 px taller would answer with the gap after it.
- **RPE is per-set, and the scale lives only in `RPE_VALUES`** (`components/workout/rpe-picker.tsx`). Four surfaces write it — set options, quick-log, history detail, and the routine builder's prescribed `routine_set.target_rpe` — and they all render the same component; only the explanatory `hint` differs, because a routine prescribes an effort ahead of time and a set records one afterwards. The builder used to hand-roll its chips and its array omitted 6.5, so a routine could prescribe an effort a logged set could not record.
- **RPE is the one logged value that stays editable after `finishWorkout`.** It feeds no denormalised counter, no volume figure and no personal record, so changing it on `/history/[id]` needs no recalculation — unlike weight or reps, which is why nothing else there is editable. `SetRpeRow` reuses `updateSet`, whose authorisation is already scoped to `workout.userId = me.id` and deliberately doesn't require the workout to be active. Skipped sets are excluded: an effort rating on a set you didn't do is a contradiction, not a gap.
- **The `@–` placeholder on a completed set row is the affordance, not decoration.** The subscript used to appear only once a rating existed, so the gesture that sets one was advertised by nothing but its own result and the feature read as absent. There is no one-tap version of this control: nine half-points at the 44 px minimum is 396 px of chips, so it is a sheet — and effort comes first in that sheet, above set type, because set type is decided once and usually inherited from the routine.
- Server actions return `ActionResult<T>` (`{ok:true,data} | {ok:false,error}`) — never throw for expected failures.
- Query modules import `server-only`; anything a client component needs goes through a thin `"use server"` wrapper (`actions/exercise-search.ts`, `actions/people-search.ts`).
- **Built-in exercises are identified by `exercise.slug`, not by name.** The uuid is per-database, so the seed upserts on slug and `exercise_alternative` pairs are authored against slugs and resolved to uuids at seed time. `slug` is null for custom exercises and is never settable through an action. Renaming a built-in is safe; changing its slug orphans every deployed row, which is why `seed-data/legacy-slugs.ts` is frozen. `tests/seed-data.test.ts` gates all of it without a database.
- **A custom exercise is archived, never deleted.** `DELETE` cascades through `workout_exercise` to every set logged against it, rewriting finished sessions and dropping the records computed from them — so the "delete" control sets `exercise.archived_at`. Archived rows drop out of `searchExercises` (and therefore every picker) but still resolve by id, because history links to them. `lib/actions/exercise.ts` owns create/update/archive/restore and scopes every statement with `owner_id = me.id`, which is also what makes the built-in library read-only by construction.
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

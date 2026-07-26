# Pump

A mobile-first PWA gym tracker with a social layer — build routines, log every
set in one tap, see what your friends are lifting, and know when they're at the
gym.

Built to run on Vercel's Hobby plan with a free Neon Postgres database.

## Features

- **Routines** — templates with sets, target reps, rest times, supersets and
  interval blocks. Start one at ±% load for a deload week.
- **Workout logging** — Strong-style set rows with a "Previous" column that
  pre-fills last session's numbers, so an unchanged set is a single tap.
  Warm-up / drop / failure set tags, RPE, plate calculator, and a rest timer
  that auto-starts and survives backgrounding.
- **Interval mode** — work/rest countdown with spoken cues for circuits.
- **Social** — friends, following, a feed of completed workouts with likes and
  threaded comments, a discovery feed, and shareable routines.
- **Gyms** — join by code, and broadcast "I'm here" so friends know you're
  training.
- **Co-op sessions** — train together, track separately: everyone keeps their
  own workout and records while seeing each other's progress live.
- **Stats** — lifetime volume, streaks, weekly per-muscle set counts against
  the usual growth range, 12-week trend, and per-exercise progress charts.
- **Records and achievements** — automatic PR detection (Epley 1RM) with a
  celebration when you hit one.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Drizzle ORM · Neon
Postgres · Better Auth (Google) · Motion · PWA with web push.

## Getting started

```bash
pnpm install
cp .env.example .env.local     # fill in DATABASE_URL and auth secrets
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Set `ALLOW_DEV_CREDENTIALS=true` in `.env.local` to sign in with email and
password before you've created a Google OAuth client.

See [CLAUDE.md](./CLAUDE.md) for architecture, the design system, and the
platform constraints that shape both.

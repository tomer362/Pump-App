#!/usr/bin/env node
/**
 * Fails the build fast and clearly when `BETTER_AUTH_SECRET` is missing,
 * instead of letting Next get partway through "Collecting page data" first.
 *
 * `src/lib/auth.ts` already throws on this — the module-scope check there is
 * the real, load-bearing guard and stays exactly as-is; it's the backstop for
 * any path that starts the app without going through this build script (e.g.
 * `next start` against artifacts built elsewhere). But because every route
 * transitively imports `@/lib/session` → `@/lib/auth`, that throw fires the
 * instant Next evaluates whichever route it happens to process first while
 * collecting page data — which produces a second, misleading error naming an
 * arbitrary route (`Failed to collect page data for /api/blob/upload`, say)
 * that has nothing to do with the actual problem. Running this first means
 * the build fails with only the one message that's actually true.
 *
 *   node scripts/check-env.mjs && next build
 */
import { config } from "dotenv";

// `next build` loads `.env.local` itself, but this script runs as a plain
// node process *before* that, so it needs the same loading done explicitly —
// otherwise a local `pnpm build` would fail this check even with the secret
// correctly set in `.env.local`. On Vercel there is no `.env.local` file;
// the vars are already real environment variables, and `config()` never
// overrides a value that's already set, so this is a no-op there.
config({ path: ".env.local", quiet: true });

if (!process.env.BETTER_AUTH_SECRET) {
  console.error(
    "BETTER_AUTH_SECRET is not set.\n" +
      "  Generate one:  openssl rand -base64 32\n" +
      "  Then add it under Project → Settings → Environment Variables and redeploy.\n" +
      "  Without it, sessions are signed with better-auth's public default " +
      "secret and can be forged for any account.",
  );
  process.exit(1);
}

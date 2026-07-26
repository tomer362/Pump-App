import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import * as schema from "./db/schema";

/**
 * Without an explicit secret, better-auth falls back to a built-in default —
 * a value that ships in its published source, so a session cookie signed with
 * it can be forged by anyone, for any account. It logs an error and carries
 * on, which is easy to scroll past in a build log that then reports success.
 *
 * A deployment in that state is worse than one that doesn't build, so refuse
 * to build. `next build` runs with NODE_ENV=production, and Vercel exposes
 * environment variables during the build, so this fires exactly where the
 * mistake is cheapest to fix.
 */
if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_SECRET) {
  throw new Error(
    "BETTER_AUTH_SECRET is not set.\n" +
      "  Generate one:  openssl rand -base64 32\n" +
      "  Then add it under Project → Settings → Environment Variables and redeploy.\n" +
      "  Without it, sessions are signed with better-auth's public default " +
      "secret and can be forged for any account.",
  );
}

// Google is the only sign-in method in production; without a client, nobody
// can get in at all. Not fatal — deploying before the OAuth client exists is
// a reasonable order to do things in — but it must not be silent.
if (
  process.env.NODE_ENV === "production" &&
  !process.env.GOOGLE_CLIENT_ID
) {
  console.warn(
    "[pump] GOOGLE_CLIENT_ID is not set — sign-in will fail until it is. " +
      "See the deploy steps in CLAUDE.md.",
  );
}

/**
 * Google is the only sign-in method. Sessions are stored in our own Postgres
 * (no external per-user cap), with a cookie cache so the common case — a page
 * load checking who you are — doesn't hit the database on every request. That
 * matters on Neon's free tier, where the DB scales to zero.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },

  /**
   * Google is the only sign-in method in production.
   *
   * `ALLOW_DEV_CREDENTIALS` opens an email+password path so the app can be run
   * and tested locally before a Google OAuth client exists. It is gated on
   * NODE_ENV as well as the flag, so setting the variable on a production
   * deployment still does nothing.
   */
  emailAndPassword: {
    enabled:
      process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_DEV_CREDENTIALS === "true",
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days — a gym app shouldn't log you out.
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  user: {
    additionalFields: {
      username: { type: "string", required: false, input: false },
      bio: { type: "string", required: false, input: false },
      unit: { type: "string", required: false, input: false },
      defaultRestSeconds: { type: "number", required: false, input: false },
      homeGymId: { type: "string", required: false, input: false },
      onboardedAt: { type: "date", required: false, input: false },
    },
  },

  // Must be last: flushes Set-Cookie through Next's async cookie API.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

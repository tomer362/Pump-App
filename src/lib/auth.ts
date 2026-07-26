import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import * as schema from "./db/schema";

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

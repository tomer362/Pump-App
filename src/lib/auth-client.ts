"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;

/** Kick off the Google OAuth redirect. */
export function signInWithGoogle(callbackURL = "/feed") {
  return authClient.signIn.social({ provider: "google", callbackURL });
}

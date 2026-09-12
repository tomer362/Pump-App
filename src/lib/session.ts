import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { db } from "./db";
import { user as userTable, type User } from "./db/schema";
import { eq } from "drizzle-orm";

/**
 * Deduped per-request. Several server components ask "who am I?" on a single
 * render; `cache` collapses those into one auth check.
 */
export const getSession = cache(async () => {
  // Next 16: headers() is async.
  return auth.api.getSession({ headers: await headers() });
});

/**
 * The full app-side user row. The session's user object only carries the
 * auth fields, and screens need unit/rest/home-gym preferences too.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const [row] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  return row ?? null;
});

/** Use in any authenticated screen. Redirects instead of throwing. */
export async function requireUser(): Promise<User> {
  const current = await getCurrentUser();
  if (!current) redirect("/sign-in");
  if (!current.onboardedAt) redirect("/onboarding");
  return current;
}


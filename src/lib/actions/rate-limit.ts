import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { ActionResult } from "./user";

/**
 * Fixed-window rate limiting, backed by Postgres.
 *
 * Deliberately not Redis: Hobby has no durable KV, and one tiny upsert is
 * cheap next to the actions being guarded — `checkInAtGym` fans out a push to
 * every friend, so leaving it unguarded turns a loop into a notification
 * cannon aimed at other people's lock screens.
 *
 * The whole check is a single atomic upsert. Read-then-write would let
 * concurrent calls slip through the exact gap the limiter exists to close.
 */
export async function rateLimit(
  userId: string,
  action: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): Promise<ActionResult> {
  const res = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limit (user_id, action, window_start, count)
    VALUES (${userId}, ${action}, NOW(), 1)
    ON CONFLICT (user_id, action) DO UPDATE SET
      window_start = CASE
        WHEN rate_limit.window_start < NOW() - (${windowSeconds} || ' seconds')::interval
          THEN NOW() ELSE rate_limit.window_start END,
      count = CASE
        WHEN rate_limit.window_start < NOW() - (${windowSeconds} || ' seconds')::interval
          THEN 1 ELSE rate_limit.count + 1 END
    RETURNING count
  `);

  const count = res.rows[0]?.count ?? 1;
  if (count <= limit) return { ok: true };

  return { ok: false, error: retryMessage(windowSeconds) };
}

function retryMessage(windowSeconds: number) {
  if (windowSeconds <= 60) return "Slow down a moment and try again.";
  const minutes = Math.ceil(windowSeconds / 60);
  return `Too many attempts — try again in about ${minutes} minute${
    minutes === 1 ? "" : "s"
  }.`;
}

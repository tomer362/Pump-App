import { randomInt } from "node:crypto";

/**
 * Six characters from an alphabet with no 0/O or 1/I, so a code read off a
 * friend's phone across a gym floor survives the trip. A join code is the only
 * credential a gym or a co-op session has, so it comes from the CSPRNG rather
 * than `Math.random()`.
 *
 * `gym.join_code` and `coop_session.join_code` are both UNIQUE. 32^6 is ~10^9
 * codes, so a collision is rare but not impossible, and one used to surface as
 * an unhandled 23505 out of `createGym` — callers retry through
 * `withFreshJoinCode` instead of hoping.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeJoinCode(length = 6) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

/**
 * Drizzle wraps the driver error in a DrizzleQueryError, so the code lives on
 * the `cause` — checking only the top-level error silently misses every one.
 */
export function isUniqueViolation(err: unknown) {
  for (let e: unknown = err, depth = 0; e && depth < 5; depth++) {
    if ((e as { code?: string }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Run `insert` with a fresh code, retrying on a unique violation. Anything
 * else thrown is re-raised untouched — a collision is the only failure this
 * knows how to answer.
 */
export async function withFreshJoinCode<T>(
  insert: (joinCode: string) => Promise<T>,
  attempts = 5,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await insert(makeJoinCode());
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}

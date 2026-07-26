import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/actions/rate-limit";
import { cleanup, makeUser } from "./helpers";

/**
 * The limiter guards `checkInAtGym`, which fans a push out to every friend —
 * unguarded, a loop there is a notification cannon pointed at other people's
 * lock screens. It's a single atomic upsert precisely so a burst of concurrent
 * calls can't slip through a read-then-write gap, which is the property that
 * needs proving.
 */
describe("rateLimit", () => {
  let userId: string;

  beforeAll(async () => {
    userId = await makeUser();
  });

  afterAll(async () => {
    await cleanup([userId]);
  });

  it("allows exactly `limit` calls, then refuses", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await rateLimit(userId, "t-basic", { limit: 3, windowSeconds: 60 })).ok).toBe(true);
    }
    const fourth = await rateLimit(userId, "t-basic", {
      limit: 3,
      windowSeconds: 60,
    });
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) expect(fourth.error).toMatch(/again/i);
  });

  it("counts each action separately", async () => {
    await rateLimit(userId, "t-a", { limit: 1, windowSeconds: 60 });
    // "t-a" is now spent; a different action must be unaffected.
    expect((await rateLimit(userId, "t-b", { limit: 1, windowSeconds: 60 })).ok).toBe(true);
    expect((await rateLimit(userId, "t-a", { limit: 1, windowSeconds: 60 })).ok).toBe(false);
  });

  it("counts each user separately", async () => {
    const other = await makeUser();
    await rateLimit(userId, "t-user", { limit: 1, windowSeconds: 60 });
    expect((await rateLimit(userId, "t-user", { limit: 1, windowSeconds: 60 })).ok).toBe(false);
    expect((await rateLimit(other, "t-user", { limit: 1, windowSeconds: 60 })).ok).toBe(true);
    await cleanup([other]);
  });

  it("lets a burst of concurrent calls through only up to the limit", async () => {
    // The whole reason it's one upsert: with read-then-write, all ten of these
    // read count=0 and all ten are allowed.
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        rateLimit(userId, "t-burst", { limit: 4, windowSeconds: 60 }),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(4);
  });

  it("reopens once the window has passed", async () => {
    // A zero-second window is always expired, which is the same code path as
    // waiting an hour without the test taking an hour.
    expect((await rateLimit(userId, "t-window", { limit: 1, windowSeconds: 0 })).ok).toBe(true);
    expect((await rateLimit(userId, "t-window", { limit: 1, windowSeconds: 0 })).ok).toBe(true);
  });
});

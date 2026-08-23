import { describe, expect, it } from "vitest";
import {
  LATCH_TTL_MS,
  MAX_ENTRIES,
  emptyStore,
  evictOldest,
  isLatchFresh,
  lookup,
  parseStore,
  routeKeyFrom,
  serializeStore,
  shouldSkipPath,
  type ScrollStore,
} from "@/lib/scroll-memory";
import {
  capItems,
  dedupeById,
  mergeSaved,
  reviveList,
} from "@/lib/paged-list";

describe("routeKeyFrom", () => {
  it("keeps the query, which is part of which list you were reading", () => {
    expect(routeKeyFrom("/routines", "?tab=discover&sort=new")).toBe(
      "/routines?tab=discover&sort=new",
    );
    expect(routeKeyFrom("/routines", "?tab=discover&sort=new")).not.toBe(
      routeKeyFrom("/routines", "?tab=discover&sort=popular"),
    );
  });

  it("normalises a trailing slash so one screen is one key", () => {
    expect(routeKeyFrom("/history/", "")).toBe(routeKeyFrom("/history", ""));
    expect(routeKeyFrom("/", "")).toBe("/");
  });

  it("takes a bare search string as well as one with its question mark", () => {
    expect(routeKeyFrom("/feed", "tab=all")).toBe("/feed?tab=all");
  });
});

describe("shouldSkipPath", () => {
  it("leaves the workout screen to its own scrolling", () => {
    expect(shouldSkipPath("/workout/abc-123")).toBe(true);
  });

  it("covers every other route", () => {
    for (const path of ["/routines/abc", "/feed", "/exercises/1", "/stats"]) {
      expect(shouldSkipPath(path)).toBe(false);
    }
  });
});

describe("isLatchFresh", () => {
  const latch = { source: "pop" as const, entryKey: null, at: 1_000_000 };

  it("holds for the length of a navigation", () => {
    expect(isLatchFresh(latch, latch.at)).toBe(true);
    expect(isLatchFresh(latch, latch.at + LATCH_TTL_MS)).toBe(true);
  });

  it("expires, so a cancelled back-swipe can't hijack the next tap", () => {
    expect(isLatchFresh(latch, latch.at + LATCH_TTL_MS + 1)).toBe(false);
    expect(isLatchFresh(null, latch.at)).toBe(false);
  });
});

describe("evictOldest", () => {
  it("keeps the most recently written and never exceeds the cap", () => {
    const map: Record<string, { at: number }> = {};
    for (let i = 0; i < MAX_ENTRIES + 5; i++) map[`/r${i}`] = { at: i };
    const kept = evictOldest(map, MAX_ENTRIES);
    expect(Object.keys(kept)).toHaveLength(MAX_ENTRIES);
    expect(kept["/r0"]).toBeUndefined();
    expect(kept[`/r${MAX_ENTRIES + 4}`]).toEqual({ at: MAX_ENTRIES + 4 });
  });

  it("leaves a map under the cap alone", () => {
    const map = { "/a": { at: 1 } };
    expect(evictOldest(map, MAX_ENTRIES)).toBe(map);
  });
});

describe("parseStore", () => {
  it("never throws on nothing, on garbage, or on a foreign shape", () => {
    for (const raw of [null, "", "{", '{"byRoute":3}', "[]", '{"byRoute":{"/a":{"top":"x"}}}']) {
      expect(parseStore(raw)).toEqual(emptyStore());
    }
  });

  it("round-trips offsets and named sub-scrollers", () => {
    const store: ScrollStore = {
      byEntry: { e1: { top: 12, at: 5 } },
      byRoute: { "/stats": { top: 300, at: 6, sub: { heatmap: 480 } } },
    };
    expect(parseStore(serializeStore(store))).toEqual(store);
  });
});

describe("lookup", () => {
  const store: ScrollStore = {
    byEntry: { e1: { top: 111, at: 2 } },
    byRoute: { "/feed": { top: 222, at: 2 } },
  };

  it("prefers the history entry on a pop, so one route can hold two places", () => {
    expect(lookup(store, { routeKey: "/feed", entryKey: "e1" }, "pop")?.top).toBe(111);
  });

  it("falls back to the route where the browser names no entry", () => {
    expect(lookup(store, { routeKey: "/feed", entryKey: null }, "pop")?.top).toBe(222);
  });

  it("uses the route for a back-push and a tab tap, which mint a new entry", () => {
    for (const source of ["back-push", "tab"] as const) {
      expect(lookup(store, { routeKey: "/feed", entryKey: "e1" }, source)?.top).toBe(222);
    }
  });

  it("is null for a screen with no memory", () => {
    expect(lookup(store, { routeKey: "/gyms", entryKey: null }, "tab")).toBeNull();
  });
});

describe("paged list snapshots", () => {
  const idOf = (n: { id: string }) => n.id;
  const rows = (...ids: string[]) => ids.map((id) => ({ id }));

  it("keeps the head, which is what a restored offset points into", () => {
    expect(capItems(rows("a", "b", "c"), 2)).toEqual(rows("a", "b"));
  });

  it("dedupes on the cursor boundary, first seen winning", () => {
    expect(dedupeById(rows("a", "b", "a", "c"), idOf)).toEqual(rows("a", "b", "c"));
  });

  it("takes the snapshot only while it still agrees with the fresh page", () => {
    const initial = rows("a", "b");
    const saved = rows("a", "b", "c", "d");
    expect(mergeSaved(initial, saved, idOf)).toBe(saved);
    // A post deleted, a workout logged since: the server's page is the truth.
    expect(mergeSaved(rows("z", "a"), saved, idOf)).toEqual(rows("z", "a"));
    // Nothing stored, or a snapshot no longer than the page it would replace.
    expect(mergeSaved(initial, null, idOf)).toBe(initial);
    expect(mergeSaved(initial, rows("a"), idOf)).toBe(initial);
  });

  it("reads a stored list back and refuses anything that isn't one", () => {
    const revive = (v: unknown) => v as { id: string };
    expect(reviveList([{ id: "a" }], revive)).toEqual(rows("a"));
    expect(reviveList({ id: "a" }, revive)).toBeNull();
    expect(reviveList(null, revive)).toBeNull();
  });
});

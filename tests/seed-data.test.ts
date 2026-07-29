import { describe, expect, it } from "vitest";
import { SEED_EXERCISES, LEGACY_NAME_TO_SLUG } from "@/lib/db/seed-data";
import { EQUIPMENT, MUSCLES, TRACKING_TYPES } from "@/lib/db/schema";
import { isYouTubeUrl, youTubeWatchUrl } from "@/lib/exercise-video";

/**
 * The content gate for a hand-authored library of a few hundred entries. It
 * needs no database, so it runs on every commit and catches the failure modes
 * that a seed run would otherwise surface hours later (or silently swallow):
 * a mistyped alternative slug, a duplicate slug that would make the upsert
 * collide, a placeholder left in for prose.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const slugs = new Set(SEED_EXERCISES.map((e) => e.slug));

describe("seed exercise library", () => {
  it("has a substantial library", () => {
    expect(SEED_EXERCISES.length).toBeGreaterThanOrEqual(240);
  });

  it("uses well-formed, unique slugs", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const e of SEED_EXERCISES) {
      expect(e.slug, `${e.name} has a malformed slug`).toMatch(SLUG);
      if (seen.has(e.slug)) dupes.push(e.slug);
      seen.add(e.slug);
    }
    // A duplicate slug would make the seed's ON CONFLICT (slug) upsert collide
    // with itself inside a single INSERT, which Postgres rejects outright.
    expect(dupes).toEqual([]);
  });

  it("uses unique display names", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const e of SEED_EXERCISES) {
      if (seen.has(e.name)) dupes.push(e.name);
      seen.add(e.name);
    }
    expect(dupes).toEqual([]);
  });

  it("only uses muscles, equipment and tracking types the schema knows", () => {
    for (const e of SEED_EXERCISES) {
      expect(MUSCLES, e.slug).toContain(e.primaryMuscle);
      for (const m of e.secondaryMuscles ?? []) {
        expect(MUSCLES, e.slug).toContain(m);
      }
      expect(EQUIPMENT, e.slug).toContain(e.equipment);
      if (e.trackingType) expect(TRACKING_TYPES, e.slug).toContain(e.trackingType);
    }
  });

  it("never lists a muscle as both primary and secondary", () => {
    for (const e of SEED_EXERCISES) {
      expect(e.secondaryMuscles ?? [], e.slug).not.toContain(e.primaryMuscle);
    }
  });
});

describe("alternatives", () => {
  it("every alternative slug resolves to a real exercise", () => {
    const unresolved: string[] = [];
    for (const e of SEED_EXERCISES) {
      for (const a of e.alternatives ?? []) {
        if (!slugs.has(a.slug)) unresolved.push(`${e.slug} -> ${a.slug}`);
      }
    }
    // The seed throws on these too, but failing here means it never reaches a
    // database — and the message names the offending pair directly.
    expect(unresolved).toEqual([]);
  });

  it("no exercise lists itself", () => {
    for (const e of SEED_EXERCISES) {
      const self = (e.alternatives ?? []).filter((a) => a.slug === e.slug);
      expect(self, `${e.slug} lists itself`).toEqual([]);
    }
  });

  it("lists each alternative at most once", () => {
    for (const e of SEED_EXERCISES) {
      const list = (e.alternatives ?? []).map((a) => a.slug);
      // A repeated target would violate the composite primary key on insert.
      expect(new Set(list).size, `${e.slug} repeats an alternative`).toBe(list.length);
    }
  });

  it("explains the difference in every note", () => {
    for (const e of SEED_EXERCISES) {
      for (const a of e.alternatives ?? []) {
        const note = a.note.trim();
        // 40 characters is well below any real explanation and well above any
        // placeholder, so this catches "TODO" without policing style.
        expect(note.length, `${e.slug} -> ${a.slug} note is too short`).toBeGreaterThanOrEqual(40);
        expect(note.length, `${e.slug} -> ${a.slug} note is too long`).toBeLessThanOrEqual(400);
      }
    }
  });

  it("gives every exercise somewhere else to go", () => {
    const orphans = SEED_EXERCISES.filter((e) => (e.alternatives ?? []).length === 0);
    expect(orphans.map((e) => e.slug)).toEqual([]);
  });
});

describe("body-effect prose", () => {
  it("is three paragraphs within readable bounds", () => {
    for (const e of SEED_EXERCISES) {
      if (!e.bodyEffect) continue;
      const paras = e.bodyEffect.split("\n\n");
      // Joint action, then which tissue does the work, then which quality it
      // builds. Three is the convention; a different count means the entry was
      // written to a different shape.
      expect(paras.length, `${e.slug} has ${paras.length} paragraphs`).toBe(3);
      for (const p of paras) {
        expect(p.trim().length, `${e.slug} has an empty paragraph`).toBeGreaterThan(0);
      }
      expect(e.bodyEffect.length, `${e.slug} bodyEffect too short`).toBeGreaterThanOrEqual(400);
      expect(e.bodyEffect.length, `${e.slug} bodyEffect too long`).toBeLessThanOrEqual(1400);
    }
  });

  it("covers every exercise", () => {
    const missing = SEED_EXERCISES.filter((e) => !e.bodyEffect?.trim());
    expect(missing.map((e) => e.slug)).toEqual([]);
  });

  it("has instructions on every exercise", () => {
    const missing = SEED_EXERCISES.filter((e) => !e.instructions?.trim());
    expect(missing.map((e) => e.slug)).toEqual([]);
  });
});

describe("video ids", () => {
  it("are 11-character YouTube ids that build valid watch URLs", () => {
    for (const e of SEED_EXERCISES) {
      if (!e.videoId) continue;
      expect(e.videoId, e.slug).toMatch(VIDEO_ID);
      expect(isYouTubeUrl(youTubeWatchUrl(e.videoId)), e.slug).toBe(true);
    }
  });
});

describe("legacy slug backfill", () => {
  it("covers the 94 built-ins that predate the slug column", () => {
    expect(LEGACY_NAME_TO_SLUG.length).toBe(94);
  });

  it("maps every legacy name to a slug that still exists", () => {
    const missing = LEGACY_NAME_TO_SLUG.filter(([, slug]) => !slugs.has(slug));
    // If this fails, a rename has orphaned rows in every deployed database:
    // migration 0004 assigned that slug, and nothing in the seed claims it now.
    expect(missing.map(([name, slug]) => `${name} -> ${slug}`)).toEqual([]);
  });

  it("maps each legacy name and slug exactly once", () => {
    expect(new Set(LEGACY_NAME_TO_SLUG.map(([n]) => n)).size).toBe(94);
    expect(new Set(LEGACY_NAME_TO_SLUG.map(([, s]) => s)).size).toBe(94);
  });
});

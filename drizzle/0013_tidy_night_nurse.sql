-- Trigram matching for exercise search, so a misspelled token still finds the
-- movement it was aiming at ("incilne" → "Incline …"). Consumed by
-- `word_similarity` in lib/queries/exercise.ts, which only runs after a literal
-- search has come back empty.
--
-- Hand-added above the generated statement: `gin_trgm_ops` does not resolve
-- until the extension exists, and drizzle-kit only ever emits the index.
-- Re-generating this migration would drop this line — the index declaration in
-- schema.ts says so too. pg_trgm is a Neon-supported extension and ships with
-- postgresql-contrib locally; `pnpm build` runs drizzle-kit migrate, so it goes
-- out with the deploy that needs it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX "exercise_name_trgm_idx" ON "exercise" USING gin ("name" gin_trgm_ops);

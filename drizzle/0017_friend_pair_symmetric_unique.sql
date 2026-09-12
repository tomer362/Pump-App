-- Hand-edited around drizzle-kit's output, in the manner of 0010 and 0015.
--
-- friend_pair_idx is unique on the *ordered* pair, so two people who sent each
-- other a request in the same instant ended up with A→B and B→A both pending;
-- toPerson then showed each of them "Requested" and offered neither an Accept.
-- The symmetric index below makes the second insert a 23505, which
-- sendFriendRequest answers by accepting the first — but it cannot be created
-- while such pairs exist. For each one the newer row is dropped; the older is
-- the one whose sender genuinely asked first, and if either side had already
-- accepted, that row is the one kept regardless of age.
DELETE FROM "friend_request" fr
USING "friend_request" other
WHERE fr."requester_id" = other."addressee_id"
  AND fr."addressee_id" = other."requester_id"
  AND (
    (fr."status" <> 'accepted' AND other."status" = 'accepted')
    OR (
      (fr."status" = 'accepted') = (other."status" = 'accepted')
      AND (fr."created_at", fr."id") > (other."created_at", other."id")
    )
  );
--> statement-breakpoint
CREATE UNIQUE INDEX "friend_pair_sym_idx" ON "friend_request" USING btree (LEAST("requester_id", "addressee_id"),GREATEST("requester_id", "addressee_id"));

/**
 * Every `"use server"` export is a public POST endpoint, and most of them take
 * a bare id off the wire. Postgres raises `invalid input syntax for type uuid`
 * on anything that isn't one, and a thrown error out of an action is a 500
 * rather than the `ActionResult` refusal every caller is written against — so
 * ids are checked here first. Pure, so it can be shared with client code and
 * pinned by `tests/pure.test.ts` without a database.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

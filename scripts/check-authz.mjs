/**
 * Authorisation regression test for the IDOR class.
 *
 * A `"use server"` export is a live POST endpoint. It is reachable with any
 * arguments by anyone with a session — the UI never showing you a button is
 * not a check. The shipped `getCoopSnapshot` authenticated but never verified
 * membership, so a signed-in stranger could enumerate a session id, read the
 * roster and lift the join code straight out of the response.
 *
 * This signs in as B and calls sensitive actions against A's resource ids,
 * asserting each is refused. It posts the Server Action wire format directly
 * rather than driving the UI, because the UI is exactly the layer an attacker
 * skips.
 *
 *   node scripts/check-authz.mjs
 */
import { chromium, devices } from "playwright";
import { globSync, readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROMIUM =
  process.env.CHROMIUM_PATH ??
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const USERS = [
  { email: "authz-a@example.com", password: "devpassword123", name: "Authz A" },
  { email: "authz-b@example.com", password: "devpassword123", name: "Authz B" },
];

const browser = await chromium.launch({ executablePath: CHROMIUM });
const failures = [];
let checks = 0;

async function session(user) {
  const ctx = await browser.newContext({ ...devices["iPhone 14 Pro"] });
  const page = await ctx.newPage();

  let res = await page.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: user.email, password: user.password },
    failOnStatusCode: false,
  });
  if (!res.ok()) {
    res = await page.request.post(`${BASE}/api/auth/sign-up/email`, {
      data: { email: user.email, password: user.password, name: user.name },
      failOnStatusCode: false,
    });
    if (!res.ok()) throw new Error(`sign-up failed: ${await res.text()}`);
  }

  await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  if (page.url().includes("/onboarding")) {
    await page.getByRole("button", { name: /start lifting/i }).click();
    await page.waitForURL(/\/feed/, { timeout: 20000 });
  }
  return { ctx, page };
}

/**
 * Resolve Server Action ids by export name.
 *
 * Next routes actions by an opaque id sent in the `Next-Action` header. The
 * client chunks carry an `__next_internal_action_entry_do_not_use__` marker
 * mapping each id to its export name, and those chunks are public. The id is
 * a global registry key, not a per-route one — anyone who has seen it can POST
 * it from anywhere. That is precisely why the authorisation check has to live
 * inside the action rather than in the page that renders it.
 */
async function actionIdsByName(page, url) {
  const chunks = new Set();
  const collect = (res) => {
    if (/\.js(\?|$)/.test(res.url()) && res.status() === 200) {
      chunks.add(res.url());
    }
  };
  page.on("response", collect);
  await page.goto(url, { waitUntil: "networkidle" });
  page.off("response", collect);

  const map = new Map();
  for (const chunk of chunks) {
    const body = await (await page.request.get(chunk)).text();
    const re = /([0-9a-f]{40,})\\?"\s*:\s*\{\\?"name\\?"\s*:\s*\\?"(\w+)/g;
    for (const m of body.matchAll(re)) map.set(m[2], m[1]);
  }
  return map;
}

/**
 * Whether a given file+export is registered as a Server Action at all, per
 * Next's own build manifest — the ground truth, not a guess.
 *
 * `actionIdsByName` above only finds an id if some client component actually
 * imports that export, because that's the only case where the id gets
 * embedded in a shipped JS chunk. But Next assigns every export of a
 * `"use server"` file a stable id at compile time regardless of whether any
 * client code references it — and, critically, that id is (by default, with
 * no `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` set, which this app doesn't set) a
 * deterministic hash of the file path and export name. Anyone with the source
 * — which is exactly the threat model for a repo like this one — can compute
 * it offline without ever seeing it in a bundle. Client-visibility is not the
 * boundary; the manifest is.
 *
 * Verified directly: reverting the `notifyFriends` fix and reading this
 * manifest showed an id attached to `/notifications`'s bundle (because
 * `push.ts` is used there via `savePushSubscription`) even though no client
 * component anywhere imports `notifyFriends` itself — and POSTing that id
 * executed the action. `actionIdsByName` never found it on any page it scanned.
 */
function serverActionExists(relFilename, exportedName) {
  // Only the dev manifest — this script targets a running `pnpm dev`, and
  // `.next/server/...` is whatever a *production* build last wrote, which can
  // easily be stale relative to the server actually being probed.
  const manifestPaths = globSync(".next/dev/server/server-reference-manifest.json");
  for (const p of manifestPaths) {
    let raw;
    try {
      raw = JSON.parse(readFileSync(p, "utf8"));
    } catch {
      continue;
    }
    for (const meta of Object.values(raw.node ?? {})) {
      if (meta.filename === relFilename && meta.exportedName === exportedName) {
        return true;
      }
    }
  }
  return false;
}

/**
 * The manifest ids for named exports of one `"use server"` file.
 *
 * Same ground truth as `serverActionExists`, but returns the id so the export
 * can actually be POSTed. `actionIdsByName` can't reach these: nothing ships
 * `archiveCustomExercise` in a client chunk under a resolvable name, yet every
 * one of them is a live endpoint.
 */
function actionIdsFromManifest(relFilename, exportedNames) {
  const wanted = new Set(exportedNames);
  const found = new Map();
  for (const p of globSync(".next/dev/server/server-reference-manifest.json")) {
    let raw;
    try {
      raw = JSON.parse(readFileSync(p, "utf8"));
    } catch {
      continue;
    }
    for (const [id, meta] of Object.entries(raw.node ?? {})) {
      if (meta.filename === relFilename && wanted.has(meta.exportedName)) {
        found.set(meta.exportedName, id);
      }
    }
  }
  return found;
}

/** POST an action id as this user and return the raw response body. */
async function postAction(page, url, actionId, args) {
  return page.evaluate(
    async ([pageUrl, id, argv]) => {
      const r = await fetch(pageUrl, {
        method: "POST",
        credentials: "include",
        headers: {
          "Next-Action": id,
          "Content-Type": "text/plain;charset=UTF-8",
        },
        body: JSON.stringify(argv),
      });
      return { status: r.status, body: await r.text() };
    },
    [url, actionId, args],
  );
}

function check(label, passed, detail = "") {
  checks++;
  console.log(`  ${passed ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures.push(label);
}

/**
 * Fail loudly and stop, rather than letting a broken fixture make every
 * downstream check pass vacuously.
 *
 * If A's co-op setup silently fails, `coopId` becomes the literal string
 * `"coop"` (the last path segment of the URL it never left), and every check
 * built on it goes green having tested nothing: `/coop/coop` 404s like a
 * genuine non-member probe would, an absent join code makes the "does the
 * code leak" check vacuously true, and there is no action to probe at all.
 * This turns that silent pass into a loud, specific failure instead.
 */
function requireFixture(condition, message) {
  if (!condition) throw new Error(`fixture setup failed: ${message}`);
}

try {
  console.log("→ Signing in as A and B");
  const a = await session(USERS[0]);
  const b = await session(USERS[1]);

  console.log("→ A creates a co-op session");
  await a.page.goto(`${BASE}/coop`, { waitUntil: "networkidle" });
  const startCoop = a.page.getByRole("button", { name: /start a session/i });
  if (await startCoop.count()) {
    await startCoop.click();
    await a.page.waitForTimeout(400);
    await a.page.getByPlaceholder(/saturday legs/i).fill("Authz probe");
    await a.page.getByRole("button", { name: /create session/i }).click();
    await a.page.waitForURL(/\/coop\/[0-9a-f-]{36}/, { timeout: 20000 });
  } else {
    const open = a.page.getByRole("button", { name: /open session/i });
    if (await open.count()) {
      await open.click();
      await a.page.waitForURL(/\/coop\/[0-9a-f-]{36}/, { timeout: 20000 });
    }
  }
  const coopId = a.page.url().split("/").pop();
  const joinCode = (
    await a.page
      .locator("button", { hasText: /^[A-Z0-9]{6}$/ })
      .first()
      .textContent({ timeout: 10000 })
      .catch(() => null)
  )?.trim();

  requireFixture(
    /^[0-9a-f-]{36}$/.test(coopId ?? ""),
    `expected a co-op session URL, landed on "${a.page.url()}" instead`,
  );
  requireFixture(Boolean(joinCode), "could not read a join code off the room page");

  console.log("→ B probes A's resources");

  // 1. The co-op room page itself must not render for a non-member.
  const roomRes = await b.page.goto(`${BASE}/coop/${coopId}`, {
    waitUntil: "domcontentloaded",
  });
  const roomHtml = await b.page.content();
  check(
    "co-op room page is not readable by a non-member",
    roomRes.status() === 404 ||
      !roomHtml.includes("Authz probe"),
    `status ${roomRes.status()}`,
  );

  // 2. And crucially the join code must not leak through it either — that is
  //    the credential that would let B in.
  check(
    "join code does not leak to a non-member",
    joinCode ? !roomHtml.includes(joinCode) : true,
  );

  // 3. A's private routine must not be readable.
  await a.page.goto(`${BASE}/routines/new`, { waitUntil: "networkidle" });
  await a.page.getByPlaceholder(/routine name/i).fill("Authz private");
  // The visibility control is a tablist, not a plain button.
  await a.page.getByRole("tab", { name: /^Private$/ }).click();
  await a.page.getByRole("button", { name: /^Add exercise$/ }).click();
  await a.page.waitForTimeout(400);
  await a.page.getByPlaceholder(/search exercises/i).fill("Bench Press");
  await a.page.waitForTimeout(900);
  await a.page.getByRole("button", { name: /Bench Press/ }).first().click();
  await a.page.getByRole("button", { name: /^Add \d+ exercises?$/ }).click();
  await a.page.waitForTimeout(600);
  await a.page.getByRole("button", { name: /^Save$/ }).click();
  await a.page.waitForURL(/\/routines\/[0-9a-f-]{36}/, { timeout: 20000 });
  const routineId = a.page.url().split("/").pop();

  const routineRes = await b.page.goto(`${BASE}/routines/${routineId}`, {
    waitUntil: "domcontentloaded",
  });
  check(
    "private routine is not readable by another user",
    routineRes.status() === 404 ||
      !(await b.page.content()).includes("Authz private"),
    `status ${routineRes.status()}`,
  );

  // 4. A's gym join code must not be readable by a non-member.
  await a.page.goto(`${BASE}/gyms`, { waitUntil: "networkidle" });
  const addGym = a.page.getByRole("button", { name: /^Add gym$/ });
  if (await addGym.count()) {
    await addGym.click();
    await a.page.waitForTimeout(400);
    await a.page.getByPlaceholder(/^Gym name$/).fill("Authz Gym");
    await a.page.getByRole("button", { name: /^Create gym$/ }).click();
    await a.page.waitForTimeout(1200);
  }
  const gymLink = await a.page
    .locator('a[href^="/gyms/"]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  // Previously: `if (gymLink) { check(...) }`. When gym creation silently
  // failed, this whole check vanished from the summary with no trace — the
  // final "N of N passed" count just quietly had a smaller N, and nothing in
  // the output said a gym check was ever supposed to run.
  requireFixture(Boolean(gymLink), "could not find a gym link on /gyms after creating one");
  const gymRes = await b.page.goto(`${BASE}${gymLink}`, {
    waitUntil: "domcontentloaded",
  });
  const gymHtml = await b.page.content();
  check(
    "gym detail (and its join code) is not readable by a non-member",
    gymRes.status() === 404 || !/Join code/i.test(gymHtml),
    `status ${gymRes.status()}`,
  );

  // 5. A's in-progress workout must not be readable.
  await a.page.goto(`${BASE}/start`, { waitUntil: "networkidle" });
  const resume = a.page.locator('a[href^="/workout/"]').first();
  if (await resume.count()) await resume.click();
  else {
    const empty = a.page.getByRole("button", { name: /start empty workout/i });
    if (await empty.count()) await empty.click();
  }
  await a.page.waitForURL(/\/workout\/[0-9a-f-]{36}/, { timeout: 20000 });
  const workoutId = a.page.url().split("/").pop();

  const workoutRes = await b.page.goto(`${BASE}/workout/${workoutId}`, {
    waitUntil: "domcontentloaded",
  });
  check(
    "another user's live workout is not readable",
    workoutRes.status() === 404,
    `status ${workoutRes.status()}`,
  );

  // 6. The polled co-op snapshot is a POST endpoint. Blocking the page that
  //    renders it proves nothing — the check has to be inside the action.
  //    Every action id A's room page references is fired as B against A's
  //    session id; none may hand back the roster or the join code.
  const byName = await actionIdsByName(a.page, `${BASE}/coop/${coopId}`);
  const snapshotId = byName.get("getCoopSnapshot");
  if (!snapshotId) {
    check(
      "getCoopSnapshot refuses a non-member",
      false,
      "INCONCLUSIVE: could not resolve the action id — the probe did not run",
    );
  } else {
    const res = await postAction(b.page, `${BASE}/coop`, snapshotId, [coopId]);
    const ran = !/Failed to find Server Action/i.test(res.body);
    const leaked =
      (joinCode && res.body.includes(joinCode)) ||
      res.body.includes("Authz probe") ||
      res.body.includes(USERS[0].name);
    check(
      "getCoopSnapshot refuses a non-member",
      ran && !leaked,
      ran ? "action ran and returned nothing" : "INCONCLUSIVE: action did not run",
    );
  }

  // 7. Custom-exercise mutations take a caller-supplied exercise id. A owns
  //    one; B fires every mutation at it. Each action scopes its statement
  //    with `owner_id = me.id`, so a refusal here is the row simply not
  //    matching — but the whole point is that the check lives in the action
  //    and not only in the page that renders the controls.
  await a.page.goto(`${BASE}/exercises`, { waitUntil: "networkidle" });
  await a.page.getByRole("button", { name: /create custom exercise/i }).click();
  await a.page.waitForTimeout(500);
  const customName = `Authz Custom ${Date.now()}`;
  await a.page.getByPlaceholder(/reverse nordic curl/i).fill(customName);
  await a.page.getByRole("button", { name: /^Create$/ }).click();
  await a.page.waitForTimeout(1200);
  await a.page.goto(`${BASE}/exercises`, { waitUntil: "networkidle" });
  await a.page.getByPlaceholder(/search exercises/i).fill(customName);
  await a.page.waitForTimeout(900);
  const customHref = await a.page
    .locator('a[href^="/exercises/"]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  requireFixture(
    Boolean(customHref),
    "could not find the custom exercise A just created",
  );
  const customId = customHref.split("/").pop();

  // B must not even be able to open the detail page for A's custom exercise.
  const customRes = await b.page.goto(`${BASE}/exercises/${customId}`, {
    waitUntil: "domcontentloaded",
  });
  check(
    "another user's custom exercise is not readable",
    customRes.status() === 404 ||
      !(await b.page.content()).includes(customName),
    `status ${customRes.status()}`,
  );

  const exerciseActions = actionIdsFromManifest("src/lib/actions/exercise.ts", [
    "updateCustomExercise",
    "archiveCustomExercise",
    "restoreCustomExercise",
  ]);
  requireFixture(
    exerciseActions.size === 3,
    `expected 3 exercise action ids in the dev manifest, found ${exerciseActions.size}`,
  );
  for (const [name, id] of exerciseActions) {
    const args =
      name === "updateCustomExercise"
        ? [
            {
              exerciseId: customId,
              name: "Hijacked",
              primaryMuscle: "chest",
              secondaryMuscles: [],
              equipment: "barbell",
              trackingType: "weight_reps",
            },
          ]
        : [customId];
    const res = await postAction(b.page, `${BASE}/exercises`, id, args);
    const ran = !/Failed to find Server Action/i.test(res.body);
    // Every one of them returns `{ok:false}` for a row it doesn't own.
    const refused = /isn't one of your exercises|Not signed in/.test(res.body);
    check(
      `${name} refuses another user's exercise`,
      ran && refused,
      ran ? "" : "INCONCLUSIVE: action did not run",
    );
  }

  // And A's exercise must still be intact and unarchived afterwards.
  await a.page.goto(`${BASE}/exercises/${customId}`, { waitUntil: "networkidle" });
  const afterHtml = await a.page.content();
  check(
    "A's custom exercise survived B's probes unchanged",
    afterHtml.includes(customName) && !afterHtml.includes("Hijacked"),
  );

  // 8. The set mutations take caller-supplied set ids and are the hot path of
  //    the workout screen — `updateSets` writes several rows at once, so a
  //    missing owner scope there would let anyone rewrite a stranger's log in
  //    one request. A adds an exercise to their live workout; B fires both
  //    mutations at the resulting set id. Neither returns an error for a row
  //    it doesn't own (the ownership join simply matches nothing), so the
  //    check that means anything is that A's set is untouched afterwards.
  await a.page.goto(`${BASE}/workout/${workoutId}`, { waitUntil: "networkidle" });
  await a.page.getByRole("button", { name: /^Add exercise$/ }).click();
  await a.page.waitForTimeout(400);
  await a.page.getByPlaceholder(/search exercises/i).fill("Bench Press");
  await a.page.waitForTimeout(900);
  await a.page.getByRole("button", { name: /Bench Press/ }).first().click();
  await a.page.getByRole("button", { name: /^Add \d+ exercises?$/ }).click();
  await a.page.waitForTimeout(1200);
  const victimSetId = await a.page
    .locator("[data-set-id]")
    .first()
    .getAttribute("data-set-id")
    .catch(() => null);
  requireFixture(
    Boolean(victimSetId),
    "could not read a set id off A's workout screen",
  );

  const setActions = actionIdsFromManifest("src/lib/actions/workout.ts", [
    "updateSet",
    "updateSets",
  ]);
  requireFixture(
    setActions.size === 2,
    `expected 2 set-mutation action ids in the dev manifest, found ${setActions.size}`,
  );
  for (const [name, id] of setActions) {
    const args =
      name === "updateSets"
        ? [[victimSetId], { weightKg: 999, reps: 99 }]
        : [victimSetId, { weightKg: 999, reps: 99 }];
    const res = await postAction(b.page, `${BASE}/feed`, id, args);
    const ran = !/Failed to find Server Action/i.test(res.body);
    check(
      `${name} runs but writes nothing for another user's set`,
      ran,
      ran ? "" : "INCONCLUSIVE: action did not run",
    );
  }

  await a.page.reload({ waitUntil: "networkidle" });
  const setValue = await a.page
    .locator("[data-set-id]")
    .first()
    .locator("input")
    .first()
    .inputValue()
    .catch(() => "");
  check(
    "A's set survived B's probes unchanged",
    setValue !== "999",
    `set weight reads "${setValue}"`,
  );

  // 8. `notifyFriends` used to be exported from a "use server" module while
  //    taking a caller-supplied userId and freeform payload — any signed-in
  //    user could blast arbitrary push text to any user's entire friend list.
  //    It never appeared in any client-shipped chunk (nothing client-side
  //    imports it directly), so a chunk-scraping check would pass whether or
  //    not it was fixed — verified by reverting the fix and rechecking. The
  //    only reliable proof is Next's own build manifest: visit a route that
  //    forces `push.ts` to compile, then check whether the manifest still
  //    carries an id for this file+export pair at all.
  await a.page.goto(`${BASE}/notifications`, { waitUntil: "networkidle" });
  const stillAnAction = serverActionExists(
    "src/lib/actions/push.ts",
    "notifyFriends",
  );
  check(
    "notifyFriends is not registered as a Server Action at all",
    !stillAnAction,
    stillAnAction
      ? "found in server-reference-manifest.json — still a live POST endpoint"
      : "absent from the manifest — moved out of \"use server\" scope",
  );

  await a.ctx.close();
  await b.ctx.close();
} catch (err) {
  failures.push(`fatal: ${err.message}`);
  console.log(`  FAIL fatal: ${err.message}`);
} finally {
  await browser.close();
}

if (failures.length) {
  console.log(`\n⚠️  ${failures.length} of ${checks} authorisation checks failed:`);
  for (const f of failures) console.log(`   ${f}`);
  process.exitCode = 1;
} else {
  console.log(`\n✅ All ${checks} authorisation checks refused access.`);
}

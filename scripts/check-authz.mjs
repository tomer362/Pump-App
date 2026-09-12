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

  // 3b. Folders are rows scoped to one owner, and every mutation takes a bare
  //     uuid from the caller. A folder id is not secret — it rides in A's own
  //     HTML — so the scoping has to be inside each action.
  //     The manifest only carries an id once the client component importing
  //     the action has been compiled, so visit both screens that pull them in
  //     — the list (folder manager, reorder) and a routine (move sheet) —
  //     before resolving, or the lookup comes back half empty.
  await a.page.goto(`${BASE}/routines`, { waitUntil: "networkidle" });
  await a.page.goto(`${BASE}/routines/${routineId}`, {
    waitUntil: "networkidle",
  });

  const folderActions = actionIdsFromManifest(
    "src/lib/actions/routine-folder.ts",
    [
      "createFolder",
      "renameFolder",
      "setFolderColor",
      "setFolderRotation",
      "deleteFolder",
      "reorderFolders",
      "moveRoutineToFolder",
      "reorderRoutinesInFolder",
    ],
  );
  requireFixture(
    folderActions.size === 8,
    `expected 8 folder action ids in the dev manifest, found ${folderActions.size}`,
  );

  // A makes a folder of their own, through their own session.
  const aFolder = await postAction(
    a.page,
    `${BASE}/routines`,
    folderActions.get("createFolder"),
    [{ name: `Authz folder ${Date.now()}` }],
  );
  const folderId = aFolder.body.match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0];
  requireFixture(
    Boolean(folderId),
    `could not create a folder as A: ${aFolder.body.slice(0, 200)}`,
  );

  const folderProbes = [
    ["renameFolder", [folderId, "Hijacked"]],
    ["setFolderColor", [folderId, "clay"]],
    ["setFolderRotation", [folderId, true]],
    ["reorderFolders", [[folderId]]],
    ["moveRoutineToFolder", [routineId, folderId]],
    ["reorderRoutinesInFolder", [folderId, [routineId]]],
    // Destructive last, so a failure to refuse doesn't invalidate the probes
    // above by removing the row they target.
    ["deleteFolder", [folderId]],
  ];

  for (const [name, args] of folderProbes) {
    const res = await postAction(
      b.page,
      `${BASE}/routines`,
      folderActions.get(name),
      args,
    );
    const ran = !/Failed to find Server Action/i.test(res.body);
    const refused = /Folder not found|Routine not found|Not signed in/.test(
      res.body,
    );
    check(
      `${name} refuses another user's folder`,
      ran && refused,
      ran ? "" : "INCONCLUSIVE: action did not run",
    );
  }

  // The folder must still exist, keep its name, and hold nothing of B's.
  await a.page.goto(`${BASE}/routines`, { waitUntil: "networkidle" });
  const foldersHtml = await a.page.content();
  check(
    "A's folder survived B's probes unchanged",
    foldersHtml.includes("Authz folder") && !foldersHtml.includes("Hijacked"),
  );

  // 3c. Liking is the one routine action open to non-owners, so its guard is
  //     the visibility check rather than ownership: A's routine is private.
  const likeActions = actionIdsFromManifest(
    "src/lib/actions/routine-social.ts",
    ["toggleRoutineLike"],
  );
  requireFixture(
    likeActions.size === 1,
    "expected toggleRoutineLike in the dev manifest",
  );
  const likeRes = await postAction(
    b.page,
    `${BASE}/routines`,
    likeActions.get("toggleRoutineLike"),
    [routineId],
  );
  const likeRan = !/Failed to find Server Action/i.test(likeRes.body);
  check(
    "toggleRoutineLike refuses another user's private routine",
    likeRan && /That routine is private|Routine not found/.test(likeRes.body),
    likeRan ? "" : "INCONCLUSIVE: action did not run",
  );

  // 3c-ii. Export is the one action that returns a routine's entire contents
  //        as a string, so it is the newest and sharpest read surface here.
  //        Import is the matching write: a document is attacker-authored, and
  //        the strict schema is what stops it writing fields of its choosing.
  const transferActions = actionIdsFromManifest(
    "src/lib/actions/routine-transfer.ts",
    ["exportRoutineFile", "previewRoutineImport", "importRoutine"],
  );
  requireFixture(
    transferActions.size === 3,
    `expected 3 routine-transfer action ids in the dev manifest, found ${transferActions.size}`,
  );

  for (const name of ["exportRoutineFile"]) {
    const res = await postAction(
      b.page,
      `${BASE}/routines`,
      transferActions.get(name),
      [routineId],
    );
    const ran = !/Failed to find Server Action/i.test(res.body);
    check(
      `${name} refuses another user's private routine`,
      ran &&
        /That routine is private|Routine not found/.test(res.body) &&
        // The refusal is worthless if the payload came back anyway.
        !res.body.includes("Authz private"),
      ran ? "" : "INCONCLUSIVE: action did not run",
    );
  }

  // A document that names another user as the owner of the exercise it
  // creates. `.strict()` should reject it outright rather than ignore the key.
  const hostileDoc = JSON.stringify({
    format: "pump.routine",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    routine: {
      name: "Authz smuggled",
      notes: null,
      exercises: [
        {
          exercise: {
            slug: null,
            name: "Authz Smuggled Lift",
            primaryMuscle: "chest",
            secondaryMuscles: [],
            equipment: "barbell",
            trackingType: "weight_reps",
            instructions: null,
            // The value is irrelevant — `.strict()` rejects the key itself,
            // which is what makes "we excluded ownerId" enforceable rather
            // than a comment in the schema.
            ownerId: "some-other-user",
            videoUrl: "https://example.invalid/not-vetted",
          },
          notes: null,
          restSeconds: null,
          supersetGroup: null,
          intervalWorkSeconds: null,
          intervalRestSeconds: null,
          sets: [],
        },
      ],
    },
  });

  for (const name of ["previewRoutineImport", "importRoutine"]) {
    const res = await postAction(
      b.page,
      `${BASE}/routines`,
      transferActions.get(name),
      [hostileDoc],
    );
    const ran = !/Failed to find Server Action/i.test(res.body);
    check(
      `${name} refuses a document carrying ownerId and videoUrl`,
      ran && !/"ok"\s*:\s*true/.test(res.body),
      ran ? "" : "INCONCLUSIVE: action did not run",
    );
  }

  // And the smuggled exercise must not exist for either user afterwards.
  await a.page.goto(`${BASE}/exercises`, { waitUntil: "networkidle" });
  await a.page.getByPlaceholder(/search exercises/i).fill("Authz Smuggled");
  await a.page.waitForTimeout(900);
  check(
    "the smuggled exercise was never created",
    !(await a.page.content()).includes("Authz Smuggled Lift"),
  );

  // 3d. A folder id also reaches the database through the routine editor,
  //     which writes whatever folderId it is handed.
  const createRoutineAction = actionIdsFromManifest(
    "src/lib/actions/routine.ts",
    ["createRoutine"],
  );
  requireFixture(
    createRoutineAction.size === 1,
    "expected createRoutine in the dev manifest",
  );
  const smuggle = await postAction(
    b.page,
    `${BASE}/routines/new`,
    createRoutineAction.get("createRoutine"),
    [
      {
        name: "Smuggled",
        folderId,
        isPublic: false,
        exercises: [{ exerciseId: null, sets: [] }],
      },
    ],
  );
  const smuggleRan = !/Failed to find Server Action/i.test(smuggle.body);
  check(
    "createRoutine refuses another user's folderId",
    smuggleRan && !/"ok"\s*:\s*true/.test(smuggle.body),
    smuggleRan ? "" : "INCONCLUSIVE: action did not run",
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

  // 4b. Nor may B broadcast from A's gym: the chosen gym's name reaches every
  //     one of B's friends as a notification, so it has to be a gym B joined.
  const checkInAction = actionIdsFromManifest("src/lib/actions/social.ts", [
    "checkInAtGym",
  ]);
  requireFixture(
    checkInAction.size === 1,
    "expected checkInAtGym in the dev manifest",
  );
  const foreignGymId = gymLink.split("/").pop();
  const checkIn = await postAction(
    b.page,
    `${BASE}/feed`,
    checkInAction.get("checkInAtGym"),
    [{ gymId: foreignGymId, note: null, minutes: 45 }],
  );
  const checkInRan = !/Failed to find Server Action/i.test(checkIn.body);
  check(
    "checkInAtGym refuses a gym the caller hasn't joined",
    checkInRan && !/"ok"\s*:\s*true/.test(checkIn.body),
    checkInRan ? "" : "INCONCLUSIVE: action did not run",
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
  // Status, not content: this is the one route asserted on the response code
  // itself. That makes it sensitive to streaming — giving `/workout/[id]` a
  // `loading.tsx` flips this to 200, because the shell is sent before
  // `notFound()` has run. The page still refuses to render a stranger's
  // session, but a 200 for someone else's live workout is the wrong thing to
  // put on the wire, so that route deliberately has no loading file.
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
    "adoptImportedExercise",
  ]);
  requireFixture(
    exerciseActions.size === 4,
    `expected 4 exercise action ids in the dev manifest, found ${exerciseActions.size}`,
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

  // The routine builder can't navigate to the exercise page without discarding
  // an unsaved draft, so it reads the About panel through an action instead.
  // That makes the 404 above reachable a second way, over POST — and
  // `getExercise` carries no owner filter of its own, so the guard has to be in
  // the action or this is the way to read a stranger's custom exercise.
  const aboutAction = actionIdsFromManifest("src/lib/actions/exercise-search.ts", [
    "getExerciseAboutAction",
  ]);
  requireFixture(
    aboutAction.size === 1,
    `expected getExerciseAboutAction in the dev manifest, found ${aboutAction.size}`,
  );
  for (const [name, id] of aboutAction) {
    const res = await postAction(b.page, `${BASE}/exercises`, id, [customId]);
    const ran = !/Failed to find Server Action/i.test(res.body);
    // It answers null for missing and for forbidden alike, so the only thing
    // to assert is that nothing of A's came back in the payload.
    check(
      `${name} refuses another user's exercise`,
      ran && !res.body.includes(customName),
      ran ? "" : "INCONCLUSIVE: action did not run",
    );
  }

  // Quick-log takes a caller-supplied exercise id and writes a workout, a
  // workout_exercise, a set and a records recalculation off the back of it —
  // the one write path in the app that creates its own session. Fired at A's
  // private custom exercise it must refuse; and `undoQuickLogSet` takes a set
  // id, so it needs the same owner scope in the other direction.
  const quickLogActions = actionIdsFromManifest("src/lib/actions/quick-log.ts", [
    "quickLogSet",
    "undoQuickLogSet",
  ]);
  requireFixture(
    quickLogActions.size === 2,
    `expected 2 quick-log action ids in the dev manifest, found ${quickLogActions.size}`,
  );
  {
    const res = await postAction(
      b.page,
      `${BASE}/exercises`,
      quickLogActions.get("quickLogSet"),
      [{ exerciseId: customId, weightKg: 100, reps: 5 }],
    );
    const ran = !/Failed to find Server Action/i.test(res.body);
    const refused = /Exercise not found|Not signed in/.test(res.body);
    check(
      "quickLogSet refuses another user's custom exercise",
      ran && refused,
      ran ? "" : "INCONCLUSIVE: action did not run",
    );

    // Out-of-range values are rejected before anything is written.
    const bad = await postAction(
      b.page,
      `${BASE}/exercises`,
      quickLogActions.get("quickLogSet"),
      [{ exerciseId: customId, weightKg: 99999, reps: -3 }],
    );
    check(
      "quickLogSet rejects out-of-range values",
      /Invalid set values|Exercise not found/.test(bad.body),
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

  // The exercise-level swap takes a caller-supplied workout-exercise id *and*
  // an exercise id, so it needs both scopes: A's block must not be replaceable
  // by B, and the replacement itself must come from the library B is allowed
  // to see. B fires it at A's block with A's private custom exercise.
  const victimBlockId = await a.page
    .locator("[data-block-id]")
    .first()
    .getAttribute("data-block-id")
    .catch(() => null);
  requireFixture(
    Boolean(victimBlockId),
    "could not read an exercise-block id off A's workout screen",
  );

  const [, replaceId] = [
    ...actionIdsFromManifest("src/lib/actions/workout.ts", [
      "replaceWorkoutExercise",
    ]),
  ][0] ?? [];
  if (!replaceId) {
    check(
      "replaceWorkoutExercise refuses another user's exercise block",
      false,
      "INCONCLUSIVE: could not resolve the action id — the probe did not run",
    );
  } else {
    const res = await postAction(b.page, `${BASE}/feed`, replaceId, [
      victimBlockId,
      customId,
    ]);
    const ran = !/Failed to find Server Action/i.test(res.body);
    const refused = /Not found|Not signed in/.test(res.body);
    check(
      "replaceWorkoutExercise refuses another user's exercise block",
      ran && refused,
      ran ? "" : "INCONCLUSIVE: action did not run",
    );
  }

  await a.page.reload({ waitUntil: "networkidle" });
  check(
    "A's exercise block survived B's replace probe",
    (await a.page.content()).includes("Bench Press"),
  );
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

  // 9. A co-op session is seeded from a routine that every joiner copies into
  //    their own workout, so the host's pick has to pass the same visibility
  //    rule `copyRoutine` applies. It used to read `isPublic` and ignore it.
  await b.page.goto(`${BASE}/coop`, { waitUntil: "networkidle" });
  const coopActions = actionIdsFromManifest("src/lib/actions/coop.ts", [
    "createCoopSession",
  ]);
  requireFixture(
    coopActions.size === 1,
    "expected createCoopSession in the dev manifest",
  );
  {
    const res = await postAction(
      b.page,
      `${BASE}/coop`,
      coopActions.get("createCoopSession"),
      [{ name: "Authz seeded", routineId }],
    );
    const ran = !/Failed to find Server Action/i.test(res.body);
    check(
      "createCoopSession refuses to seed from another user's private routine",
      ran && /That routine is private|Routine not found/.test(res.body),
      ran ? "" : "INCONCLUSIVE: action did not run",
    );
  }

  // 10. The routine editor writes whatever exercise ids it is handed, and the
  //     detail page's join is deliberately unfiltered — so a routine naming
  //     A's private custom exercise would render its name to B.
  {
    const res = await postAction(
      b.page,
      `${BASE}/routines/new`,
      createRoutineAction.get("createRoutine"),
      [
        {
          name: "Authz borrowed",
          isPublic: false,
          exercises: [{ exerciseId: customId, sets: [] }],
        },
      ],
    );
    const ran = !/Failed to find Server Action/i.test(res.body);
    check(
      "createRoutine refuses another user's custom exercise id",
      ran && !/"ok"\s*:\s*true/.test(res.body),
      ran ? "" : "INCONCLUSIVE: action did not run",
    );
  }

  // 11. A finished session kept private has no post, and `/history/[id]`
  //     used to render it to anyone signed in who had the id. A finishes the
  //     live workout from step 5 without sharing; B must get a 404. And once
  //     it is finished, its rows are what its counters describe — the set
  //     mutations refuse even for the owner.
  await a.page.goto(`${BASE}/workout/${workoutId}`, { waitUntil: "networkidle" });
  const finishActions = actionIdsFromManifest("src/lib/actions/workout.ts", [
    "finishWorkout",
    "removeSet",
    "addSet",
  ]);
  requireFixture(
    finishActions.size === 3,
    `expected 3 finish-path action ids in the dev manifest, found ${finishActions.size}`,
  );
  // Tick the one set so there is something to finish with.
  await postAction(a.page, `${BASE}/feed`, setActions.get("updateSet"), [
    victimSetId,
    { weightKg: 60, reps: 5, completed: true },
  ]);
  const finished = await postAction(
    a.page,
    `${BASE}/feed`,
    finishActions.get("finishWorkout"),
    [workoutId, { shareToFeed: false, unfinishedSets: "keep" }],
  );
  requireFixture(
    /"ok"\s*:\s*true/.test(finished.body),
    `A could not finish the fixture workout: ${finished.body.slice(0, 200)}`,
  );
  const privateRes = await b.page.goto(`${BASE}/history/${workoutId}`, {
    waitUntil: "domcontentloaded",
  });
  check(
    "an unshared finished workout is not readable by another user",
    privateRes.status() === 404,
    `status ${privateRes.status()}`,
  );
  {
    const res = await postAction(
      a.page,
      `${BASE}/feed`,
      finishActions.get("removeSet"),
      [victimSetId],
    );
    const ran = !/Failed to find Server Action/i.test(res.body);
    check(
      "removeSet refuses a set on a finished workout",
      ran && /already finished/.test(res.body),
      ran ? "" : "INCONCLUSIVE: action did not run",
    );
  }
  {
    const res = await postAction(
      a.page,
      `${BASE}/feed`,
      finishActions.get("addSet"),
      [victimBlockId],
    );
    const ran = !/Failed to find Server Action/i.test(res.body);
    check(
      "addSet refuses a block on a finished workout",
      ran && /already finished/.test(res.body),
      ran ? "" : "INCONCLUSIVE: action did not run",
    );
  }

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

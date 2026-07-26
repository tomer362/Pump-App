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
  if (gymLink) {
    const gymRes = await b.page.goto(`${BASE}${gymLink}`, {
      waitUntil: "domcontentloaded",
    });
    const gymHtml = await b.page.content();
    check(
      "gym detail (and its join code) is not readable by a non-member",
      gymRes.status() === 404 || !/Join code/i.test(gymHtml),
      `status ${gymRes.status()}`,
    );
  }

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

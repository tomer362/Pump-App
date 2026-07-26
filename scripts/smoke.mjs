/**
 * Two-user smoke test: visits every route as a signed-in user and exercises
 * the social loop (friend request → accept → gym check-in → like → comment),
 * failing on any 5xx, page error, or console error.
 *
 * Complements walkthrough.mjs, which covers the workout loop in depth.
 *
 *   node scripts/smoke.mjs
 */
import { chromium, devices } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROMIUM =
  process.env.CHROMIUM_PATH ??
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const USERS = [
  { email: "tomer@example.com", password: "devpassword123", name: "Tomer Ben" },
  { email: "dana@example.com", password: "devpassword123", name: "Dana Levi" },
];

const browser = await chromium.launch({ executablePath: CHROMIUM });
const problems = [];

/** Sign in (creating the account if needed) and return a ready page. */
async function session(user) {
  const ctx = await browser.newContext({ ...devices["iPhone 14 Pro"] });
  const page = await ctx.newPage();

  page.on("pageerror", (e) => problems.push(`[${user.name}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`[${user.name}] console: ${m.text()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`[${user.name}] ${r.status()} ${r.url()}`);
  });

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

  // Complete onboarding if this account is new.
  await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  if (page.url().includes("/onboarding")) {
    await page.getByRole("button", { name: /start lifting/i }).click();
    await page.waitForURL(/\/feed/, { timeout: 20000 });
  }
  return { ctx, page };
}

const ROUTES = [
  "/feed",
  "/discover",
  "/routines",
  "/routines/new",
  "/start",
  "/stats",
  "/history",
  "/records",
  "/profile",
  "/settings",
  "/friends",
  "/gyms",
  "/coop",
  "/exercises",
  "/notifications",
];

try {
  console.log("→ User A");
  const a = await session(USERS[0]);

  console.log("→ Visiting every route");
  for (const route of ROUTES) {
    const res = await a.page.goto(`${BASE}${route}`, {
      waitUntil: "domcontentloaded",
    });
    const status = res?.status() ?? 0;
    const ok = status < 400;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${route} (${status})`);
    if (!ok) problems.push(`route ${route} -> ${status}`);
    await a.page.waitForTimeout(250);
  }

  console.log("→ User B");
  const b = await session(USERS[1]);

  console.log("→ B sends A a friend request");
  await b.page.goto(`${BASE}/friends`, { waitUntil: "networkidle" });
  await b.page.getByPlaceholder(/search by name/i).fill("Tomer");
  await b.page.waitForTimeout(900);
  const addBtn = b.page.getByRole("button", { name: /^Add$/ }).first();
  if (await addBtn.count()) {
    await addBtn.click();
    await b.page.waitForTimeout(700);
    console.log("  request sent");
  } else {
    console.log("  (already connected)");
  }

  console.log("→ A accepts");
  await a.page.goto(`${BASE}/friends`, { waitUntil: "networkidle" });
  const acceptBtn = a.page.getByRole("button", { name: /^Accept$/ }).first();
  if (await acceptBtn.count()) {
    await acceptBtn.click();
    await a.page.waitForTimeout(1200);
    console.log("  accepted");
  } else {
    console.log("  (no pending request)");
  }

  console.log("→ A checks in at the gym");
  await a.page.goto(`${BASE}/feed`, { waitUntil: "networkidle" });
  const hereBtn = a.page.getByRole("button", { name: /i'm here/i });
  if (await hereBtn.count()) {
    await hereBtn.click();
    await a.page.waitForTimeout(600);
    await a.page.getByRole("button", { name: /broadcast for/i }).click();
    await a.page.waitForTimeout(900);
    console.log("  broadcasting");
  }

  console.log("→ B sees A's presence and likes a workout");
  // Must be the feed: the presence strip only exists there.
  await b.page.goto(`${BASE}/feed`, { waitUntil: "networkidle" });
  await b.page.waitForTimeout(600);
  const presence = await b.page
    .getByText(/friends? training now/i)
    .count();
  console.log(`  presence strip: ${presence > 0 ? "visible" : "not shown"}`);

  // Matches both states — a re-run finds the post already liked.
  const likeBtn = b.page.getByRole("button", { name: /^(Like|Unlike)$/ }).first();
  if (await likeBtn.count()) {
    await likeBtn.click();
    await b.page.waitForTimeout(700);
    console.log("  liked a post");

    const post = b.page.locator('a[href^="/post/"]').first();
    if (await post.count()) {
      await post.click();
      await b.page.waitForURL(/\/post\//, { timeout: 15000 });
      await b.page.getByPlaceholder(/add a comment/i).fill("Strong session 💪");
      await b.page.getByRole("button", { name: /post comment/i }).click();
      await b.page.waitForTimeout(900);
      console.log("  commented");
    }
  } else {
    console.log("  (no posts in B's feed yet)");
  }

  console.log("→ B opens A's profile");
  await b.page.goto(`${BASE}/u/tomerben`, { waitUntil: "domcontentloaded" });
  await b.page.waitForTimeout(500);

  console.log("→ Co-op: A hosts, B joins, both see each other");
  await a.page.goto(`${BASE}/coop`, { waitUntil: "networkidle" });
  const startCoop = a.page.getByRole("button", { name: /start a session/i });
  if (await startCoop.count()) {
    await startCoop.click();
    await a.page.waitForTimeout(500);
    await a.page.getByPlaceholder(/saturday legs/i).fill("Smoke co-op");
    await a.page.getByRole("button", { name: /create session/i }).click();
    await a.page.waitForURL(/\/coop\/[0-9a-f-]{36}/, { timeout: 20000 });
    await a.page.waitForTimeout(800);
  }
  const code = (
    await a.page.locator("button", { hasText: /^[A-Z0-9]{6}$/ }).first().textContent()
  )?.trim();
  console.log(`  join code: ${code ?? "not found"}`);

  if (code) {
    await b.page.goto(`${BASE}/coop`, { waitUntil: "networkidle" });
    const joinBtn = b.page.getByRole("button", { name: /^Join$/ });
    if (await joinBtn.count()) {
      await joinBtn.click();
      await b.page.waitForTimeout(500);
      await b.page.getByPlaceholder("ABC123").fill(code);
      await b.page.getByRole("button", { name: /join session/i }).click();
      await b.page.waitForTimeout(2000);
      const inRoom = /\/coop\//.test(b.page.url());
      console.log(`  B joined: ${inRoom}`);
      if (inRoom) {
        // A polls every 3s; give it a beat to pick B up.
        await a.page.waitForTimeout(4000);
        const count = await a.page.getByText(/\d+ training/).textContent();
        console.log(`  A sees: ${count?.trim()}`);
      }
    }
  }

  await a.ctx.close();
  await b.ctx.close();
} catch (err) {
  problems.push(`fatal: ${err.message}`);
} finally {
  await browser.close();
}

const unique = [...new Set(problems)].filter(
  // Missing favicon during dev is noise, not a defect.
  (p) => !/favicon/.test(p),
);

if (unique.length) {
  console.log("\n⚠️  Problems:");
  for (const p of unique) console.log(`   ${p}`);
  process.exitCode = 1;
} else {
  console.log("\n✅ All routes and the social loop are clean.");
}

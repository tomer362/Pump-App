/**
 * End-to-end walkthrough of the core loop at an iPhone viewport.
 *
 * Signs in, onboards, builds a routine, runs a full workout logging every set,
 * finishes it, and screenshots each step so the phone layout can be inspected:
 * thumb reach, safe-area padding, and whether the keyboard covers any control.
 *
 * Requires the dev server on :3000 and ALLOW_DEV_CREDENTIALS=true.
 *   node scripts/walkthrough.mjs
 */
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.SHOT_DIR ?? "/tmp/pump-shots";
const EMAIL = process.env.DEV_EMAIL ?? "tomer@example.com";
const PASSWORD = process.env.DEV_PASSWORD ?? "devpassword123";

mkdirSync(OUT, { recursive: true });

let step = 0;
const shot = async (page, name) => {
  step += 1;
  const file = `${OUT}/${String(step).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file });
  console.log(`  📸 ${file}`);
};

const log = (msg) => console.log(msg);

/**
 * The two unprompted sheets are dismissed before anything runs. `InstallNudge`
 * opens 1.2s after the app shell mounts and its backdrop covers the page, so
 * every click in these scripts raced it and lost — the run died on whatever
 * step happened to be 1.2s in. Seeding the keys the nudges stamp is the same
 * answer a returning user gets, and leaves the flows under test untouched.
 * ("never" is what "Don't ask again" writes; the notify nudge takes a stamp.)
 */
const DISMISS_NUDGES = () => {
  try {
    localStorage.setItem("pump.install-nudge", "never");
    localStorage.setItem("pump.notify-nudge", String(Date.now()));
  } catch {}
};

const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});

const context = await browser.newContext({
  ...devices["iPhone 14 Pro"],
  // Playwright's iPhone descriptor uses WebKit UA strings; Chromium is fine
  // for layout, which is what we're checking.
  deviceScaleFactor: 3,
});

await context.addInitScript(DISMISS_NUDGES);

const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

try {
  log("→ Sign-in screen");
  await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle" });
  await shot(page, "sign-in");

  log("→ Authenticating via dev credentials");
  const res = await page.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  if (!res.ok()) throw new Error(`sign-in failed: ${res.status()} ${await res.text()}`);

  log("→ Onboarding");
  await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  if (page.url().includes("/onboarding")) {
    await shot(page, "onboarding");
    await page.getByRole("button", { name: /start lifting/i }).click();
    await page.waitForURL(/\/feed/, { timeout: 20000 });
  }

  log("→ Feed (empty)");
  await page.goto(`${BASE}/feed`, { waitUntil: "networkidle" });
  await shot(page, "feed-empty");

  log("→ Start tab");
  await page.goto(`${BASE}/start`, { waitUntil: "networkidle" });
  await shot(page, "start");

  log("→ Routine builder");
  await page.goto(`${BASE}/routines/new`, { waitUntil: "networkidle" });
  await page.getByPlaceholder(/routine name/i).fill("Push A");
  await page.getByRole("button", { name: /add exercise/i }).click();
  await page.waitForTimeout(700);
  await shot(page, "exercise-picker");

  for (const name of ["Bench Press (Barbell)", "Overhead Press (Barbell)", "Tricep Pushdown (Cable)"]) {
    await page.getByRole("button", { name: new RegExp(escapeRe(name)) }).first().click();
  }
  await page.getByRole("button", { name: /^Add \d+ exercises?$/ }).click();
  await page.waitForTimeout(900);
  await shot(page, "routine-builder");

  await page.getByRole("button", { name: /^Save$/ }).click();
  await page.waitForURL(/\/routines\/[0-9a-f-]{36}/, { timeout: 20000 });
  await page.waitForTimeout(600);
  await shot(page, "routine-detail");

  log("→ Starting the routine");
  await page.getByRole("button", { name: /start routine/i }).click();
  await page.waitForURL(/\/workout\/[0-9a-f-]{36}/, { timeout: 20000 });
  await page.waitForTimeout(900);
  await shot(page, "workout-fresh");

  log("→ Logging sets");
  // Fill the first exercise's first set, then tick it — this is the core loop.
  const weightInputs = page.locator('input[inputmode="decimal"]');
  const repInputs = page.locator('input[inputmode="numeric"]');
  await weightInputs.first().fill("80");
  await repInputs.first().fill("8");
  await shot(page, "workout-keyboard");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  const checks = page.getByRole("button", { name: /^Complete set$/ });
  const total = await checks.count();
  log(`  ${total} sets pending`);
  for (let i = 0; i < total; i++) {
    const btn = page.getByRole("button", { name: /^Complete set$/ }).first();
    if (!(await btn.count())) break;
    await btn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(160);
  }
  await page.waitForTimeout(700);
  await shot(page, "workout-logged");

  log("→ Finishing");
  await page.getByRole("button", { name: /^Finish$/ }).click();
  await page.waitForTimeout(800);
  await shot(page, "finish-sheet");

  await page.getByRole("button", { name: /finish and save/i }).click();
  await page.waitForTimeout(2600);
  await shot(page, "celebration");

  await page.getByRole("button", { name: /^Done$/ }).click();
  await page.waitForTimeout(1400);
  await shot(page, "history-detail");

  log("→ Feed with the workout");
  await page.goto(`${BASE}/feed`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await shot(page, "feed-with-post");

  log("→ Exercises tab");
  await page.goto(`${BASE}/exercises`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await shot(page, "exercises");

  // The docked quick-log bar has to clear the tab bar and the home indicator,
  // and the sheet has to survive the keyboard — both are only visible here.
  log("→ Exercise detail and quick-log");
  const first = await page
    .locator('a[href^="/exercises/"]')
    .first()
    .getAttribute("href");
  await page.goto(`${BASE}${first}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await shot(page, "exercise-detail");
  const logSet = page.getByRole("button", { name: /^Log a set$/ });
  if (await logSet.count()) {
    await logSet.click();
    await page.waitForTimeout(600);
    await shot(page, "quick-log-sheet");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }

  log("→ Stats");
  await page.goto(`${BASE}/stats`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await shot(page, "stats");

  log("→ Profile");
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await shot(page, "profile");

  if (errors.length) {
    console.log("\n⚠️  Browser errors:");
    for (const e of [...new Set(errors)]) console.log(`   ${e}`);
    // The walkthrough ran to completion without throwing, but a page error
    // or console error is a real defect regardless — this used to leave the
    // exit code at 0, so nothing driving this script (CI or otherwise) could
    // ever learn that anything had gone wrong. Compare the throw branch
    // below, which already sets this.
    process.exitCode = 1;
  } else {
    console.log("\n✅ No browser errors.");
  }
} catch (err) {
  console.error("\n❌ Walkthrough failed:", err.message);
  await shot(page, "failure").catch(() => {});
  if (errors.length) {
    console.log("Browser errors:");
    for (const e of [...new Set(errors)]) console.log(`   ${e}`);
  }
  process.exitCode = 1;
} finally {
  await browser.close();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

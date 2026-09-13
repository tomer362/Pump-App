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

  /* ---------------------------------------------------------------------- *
   * The header has to still be there.
   *
   * It is `sticky top-0` inside `#app-scroll`, which pins it to the *viewport*
   * — so it is on screen only for as long as the document itself stays at
   * zero, and it carries the only Finish button in the app. `overflow: hidden`
   * does not guarantee that on its own: `scrollIntoView` used to walk up to
   * the viewport from the jump pill, `focus()` does the same without
   * `preventScroll`, and iOS pans a clipped page to reveal a focused field.
   * Once the document is off zero the set list carries on scrolling normally
   * underneath, so nothing looks broken — the workout simply cannot be
   * finished until a reload.
   * ---------------------------------------------------------------------- */
  log("→ Header survives scrolling, jumping and the keyboard");

  const headerIsHome = async (what) => {
    const state = await page.evaluate(() => {
      const doc = document.scrollingElement;
      const header = document.querySelector("header");
      const finish = [...document.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === "Finish",
      );
      const h = header?.getBoundingClientRect();
      const f = finish?.getBoundingClientRect();
      return {
        docTop: doc.scrollTop,
        docLeft: doc.scrollLeft,
        // Structurally zero since `html { overflow: hidden }`, rather than
        // merely un-gestureable.
        docRange: doc.scrollHeight - doc.clientHeight,
        // `pt-safe` is padding *inside* the sticky box, so the border-box top
        // is 0 on a notched phone and on a desktop alike.
        headerTop: h ? Math.round(h.top) : null,
        headerHeight: h ? Math.round(h.height) : null,
        finishBottom: f ? Math.round(f.bottom) : null,
        viewportH: window.innerHeight,
      };
    });
    if (state.docTop !== 0 || state.docLeft !== 0)
      errors.push(`document scrolled to ${state.docTop},${state.docLeft} after ${what}`);
    if (state.docRange !== 0)
      errors.push(`document has a ${state.docRange}px scroll range after ${what}`);
    if (state.headerTop !== 0)
      errors.push(`header top is ${state.headerTop}px, not 0, after ${what}`);
    if (!state.headerHeight)
      errors.push(`no workout header at all after ${what}`);
    if (!state.finishBottom || state.finishBottom > state.viewportH)
      errors.push(`Finish is off screen after ${what}`);
  };

  // 1. The bottom of a long workout — where the report came from.
  await page.evaluate(() => {
    const el = document.getElementById("app-scroll");
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(400);
  await shot(page, "workout-bottom");
  await headerIsHome("scrolling to the bottom");

  // 2. The jump pill — the call that used to be `scrollIntoView`, and which by
  //    design is only reachable once you have gone down the page.
  const jump = page.getByRole("button", { name: /Jump to the next set/i });
  if (await jump.count()) {
    await jump.first().click();
    await page.waitForTimeout(700);
    await shot(page, "workout-after-jump");
    await headerIsHome("tapping the jump pill");
  } else {
    errors.push("no jump pill at the bottom of a workout with sets still owed");
  }

  // 3. A weight field, focused and blurred. Chromium has no software keyboard,
  //    so this cannot reproduce iOS's pan — what it proves is that nothing in
  //    our own focus/blur path moves the document. Step 4 is what exercises
  //    the healing.
  const lastWeight = weightInputs.last();
  await lastWeight.click();
  await page.waitForTimeout(300);
  await headerIsHome("focusing a kg input");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  await headerIsHome("blurring a kg input");

  // 4. Inject the fault the guard exists for: give the document a range and
  //    scroll it, the way iOS does for a focused field. `DocumentScrollGuard`
  //    has to put it back without a reload — that is the whole difference
  //    between a bad frame and a workout that cannot be finished.
  await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.id = "pin-probe";
    probe.style.cssText =
      "position:absolute;top:0;left:0;width:1px;height:200vh";
    document.body.appendChild(probe);
    document.documentElement.style.overflow = "visible";
    document.scrollingElement.scrollTop = 300;
  });
  await page.waitForTimeout(500);
  const healed = await page.evaluate(() => document.scrollingElement.scrollTop);
  if (healed !== 0)
    errors.push(`the scroll guard left the document at ${healed}, not 0`);
  await page.evaluate(() => {
    document.getElementById("pin-probe")?.remove();
    document.documentElement.style.overflow = "";
  });
  await shot(page, "workout-header-pinned");

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

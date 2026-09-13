/**
 * Touch-ergonomics audit at an iPhone viewport.
 *
 * Walks every route as a signed-in user and measures what a thumb actually
 * meets: the real hit box of every interactive element, how close those boxes
 * sit to each other, whether anything that takes a tap says so, and whether
 * the one scroller's rows can be tapped at all. Reports, never fixes — the
 * point is a list you can argue with.
 *
 * Requires the dev server on :3000 and ALLOW_DEV_CREDENTIALS=true.
 *   node scripts/ux-audit.mjs
 *
 * The thresholds, and where they come from:
 *   44px   Apple's HIG minimum, and the `tap` utility in globals.css.
 *   24px   WCAG 2.2 AA (2.5.8 Target Size, Minimum) — below this is a failure
 *          against a published standard, not a matter of taste, so it is
 *          reported separately and louder.
 *   8px    The gap below which two targets are one target to a thumb.
 */
import { chromium, devices } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROMIUM =
  process.env.CHROMIUM_PATH ??
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const USER = {
  email: process.env.DEV_EMAIL ?? "tomer@example.com",
  password: process.env.DEV_PASSWORD ?? "devpassword123",
  name: "Tomer Ben",
};

const HIG_MIN = 44;
const WCAG_MIN = 24;
const GAP_MIN = 8;

const DISMISS_NUDGES = () => {
  try {
    localStorage.setItem("pump.install-nudge", "never");
    localStorage.setItem("pump.notify-nudge", String(Date.now()));
  } catch {}
};

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

/**
 * Runs in the page. Everything a thumb can hit, measured.
 *
 * `getClientRects()` rather than `getBoundingClientRect()` for the union: an
 * inline `<a>` wrapped across two lines has a bounding box spanning the gutter
 * between them, which would report a comfortable target where there is a thin
 * one. Hit testing at the centre is what decides whether something is *on top*
 * of the element — a control under a fixed bar measures full size and cannot
 * be tapped at all, which is the failure that looks most like "it ignored me".
 */
const MEASURE = ({ higMin, wcagMin, gapMin, atEnd }) => {
  const SELECTOR =
    'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="switch"], [role="tab"], [tabindex]:not([tabindex="-1"])';

  const describe = (el) => {
    const label =
      el.getAttribute("aria-label") ||
      el.textContent.trim().slice(0, 40) ||
      el.getAttribute("placeholder") ||
      "";
    const cls = (el.className || "").toString().split(/\s+/).slice(0, 3).join(".");
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${label ? ` "${label}"` : ""}`;
  };

  /** Is this inside something docked to the viewport rather than the list? */
  const isFixed = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const pos = getComputedStyle(n).position;
      if (pos === "fixed" || pos === "sticky") return true;
    }
    return false;
  };

  const els = [...document.querySelectorAll(SELECTOR)].filter((el) => {
    // Next's dev overlay is not this app's UI.
    if (el.closest("nextjs-portal")) return false;
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") return false;
    if (st.pointerEvents === "none") return false;
    if (el.disabled) return false;
    const r = el.getBoundingClientRect();
    // Off-screen or zero-area: not something a thumb is being offered.
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
  });

  const small = [];
  const covered = [];
  const unnamed = [];
  const numb = [];
  const boxes = [];

  /**
   * What a thumb can land on, which is not always the element's own box: the
   * `hit-slop` utility centres an invisible `::after` over a control to buy it
   * back up to 44px without changing the drawing. Measuring the box alone
   * would report those as still too small and send you off to "fix" something
   * already fixed.
   */
  const slopOf = (el) => {
    const after = getComputedStyle(el, "::after");
    if (!after || after.content === "none" || after.position !== "absolute")
      return { w: 0, h: 0 };
    return { w: parseFloat(after.width) || 0, h: parseFloat(after.height) || 0 };
  };

  for (const el of els) {
    const rects = [...el.getClientRects()];
    const r = el.getBoundingClientRect();
    // The largest single line box — what you can actually put a thumb on. An
    // inline link wrapped over two lines has a bounding box spanning the
    // gutter between them, which would report a comfortable target.
    const best = rects.reduce(
      (a, b) => (b.width * b.height > a.width * a.height ? b : a),
      r,
    );
    const slop = slopOf(el);
    const w = Math.round(Math.max(best.width, slop.w));
    const h = Math.round(Math.max(best.height, slop.h));
    boxes.push({
      el,
      r,
      fixed: isFixed(el),
      undersized: w < higMin || h < higMin,
      desc: describe(el),
    });

    /* Something that takes a tap has to say it was tapped. The app clears
       `-webkit-tap-highlight-color`, so without `press` (or an `active:`
       variant) a control gives no feedback at all between the finger landing
       and the screen changing — and on a slow action that reads exactly like
       a tap that missed. Inputs are exempt: the caret is the feedback. */
    const interactive =
      el.tagName === "BUTTON" ||
      el.tagName === "A" ||
      el.getAttribute("role") === "button";
    /* Self, an ancestor, or the wrapper just inside — a `<Link>` around a
       `.press` card is the app's commonest shape, and it does work: `:active`
       matches the ancestor chain of whatever the finger actually landed on,
       and that inner wrapper is an ancestor of it. */
    const feels = (n) =>
      n &&
      (/\bpress\b/.test((n.className || "").toString()) ||
        /active:/.test((n.className || "").toString()));
    if (
      interactive &&
      !feels(el) &&
      !el.closest(".press") &&
      ![...el.children].some(feels)
    ) {
      numb.push(describe(el));
    }

    if (w < higMin || h < higMin) {
      small.push({
        desc: describe(el),
        w,
        h,
        wcag: w < wcagMin || h < wcagMin,
      });
    }

    const label =
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      el.textContent.trim() ||
      el.getAttribute("placeholder") ||
      (el.labels && el.labels.length ? "labelled" : "");
    if (!label) unnamed.push(describe(el));

    // Is the middle of this control actually the thing a tap would reach?
    const cx = Math.round(r.left + r.width / 2);
    const cy = Math.round(r.top + r.height / 2);
    if (cx > 0 && cy > 0 && cx < innerWidth && cy < innerHeight) {
      const hit = document.elementFromPoint(cx, cy);
      if (
        hit &&
        !el.contains(hit) &&
        !hit.contains(el) &&
        !hit.closest?.("nextjs-portal")
      ) {
        /* Docked chrome passes over every row in the list as you scroll, so
           finding a row under it proves nothing on its own. It is a fault only
           when there is no scrolling left that would free the control: the
           list is at its end *and* the thing on top is docked to the bottom.
           A row tucked under the sticky title bar at the top is the same
           picture and not the same problem — you scroll up. That distinction
           is the whole value of this check: what it is left reporting is the
           bug `TabBarSpacer` exists to prevent. */
        const hitRect = hit.getBoundingClientRect();
        const dockedBelow = hitRect.top > innerHeight / 2;
        const fixedCoverer = isFixed(hit) && !isFixed(el);
        if (!fixedCoverer || (atEnd && dockedBelow)) {
          covered.push({ desc: describe(el), by: describe(hit) });
        }
      }
    }
  }

  // Two targets close enough to be one target.
  const crowded = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r;
      const b = boxes[j].r;
      if (boxes[i].el.contains(boxes[j].el) || boxes[j].el.contains(boxes[i].el))
        continue;
      // Docked chrome drifts past every row in the list as you scroll, so its
      // distance to any one of them is a scroll position, not a layout fact.
      if (boxes[i].fixed !== boxes[j].fixed) continue;
      /* Two options of the *same* control are not two targets. Missing one
         segment of a segmented control picks its neighbour — visible, and one
         tap to undo. The hazard worth reporting is two unrelated actions side
         by side, so a shared tablist or radiogroup is excluded by design. */
      const GROUP = '[role="tablist"], [role="radiogroup"], [role="group"]';
      const group = boxes[i].el.closest(GROUP);
      if (group && group === boxes[j].el.closest(GROUP)) continue;
      const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
      const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
      if (dx === 0 && dy === 0) continue; // overlap is the `covered` check
      const gap = dx === 0 ? dy : dy === 0 ? dx : Math.hypot(dx, dy);
      /* Spacing only matters where size has already failed. Two 44px rows of a
         list share a hairline and always will — that is what a list is, and
         flagging every adjacent pair buries the finding this check exists for:
         an undersized target with nothing around it to absorb a near miss. */
      if (gap < gapMin && (boxes[i].undersized || boxes[j].undersized)) {
        crowded.push({
          a: boxes[i].desc,
          b: boxes[j].desc,
          gap: Math.round(gap),
        });
      }
    }
  }

  return { small, covered, unnamed, crowded, numb, total: els.length };
};

const browser = await chromium.launch({ executablePath: CHROMIUM });
const findings = { small: [], wcag: [], covered: [], unnamed: [], crowded: [], numb: [] };
let scanned = 0;

const push = (bucket, route, text) => findings[bucket].push(`${route}  ${text}`);

try {
  const ctx = await browser.newContext({ ...devices["iPhone 14 Pro"] });
  await ctx.addInitScript(DISMISS_NUDGES);
  const page = await ctx.newPage();

  let res = await page.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: USER.email, password: USER.password },
    failOnStatusCode: false,
  });
  if (!res.ok()) {
    res = await page.request.post(`${BASE}/api/auth/sign-up/email`, {
      data: { ...USER },
      failOnStatusCode: false,
    });
    if (!res.ok()) throw new Error(`sign-in failed: ${await res.text()}`);
  }
  await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  if (page.url().includes("/onboarding")) {
    await page.getByRole("button", { name: /start lifting/i }).click();
    await page.waitForURL(/\/feed/, { timeout: 20000 });
  }

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    let seen = 0;
    let settled = true;
    // Twice: what the screen offers on arrival, and what it offers at the
    // foot of the list — which is both where the rest of the controls are and
    // the only place "hidden behind the tab bar for good" can be told apart
    // from "hidden behind the tab bar until you scroll".
    for (const atEnd of [false, true]) {
      if (atEnd) {
        // Twice, with a beat between: the library and the feed auto-load the
        // next batch when you reach the bottom, so one assignment lands at
        // what *was* the end and leaves you in the middle of a longer list —
        // where docked chrome legitimately covers a row, and reporting it
        // would be reporting a scroll position.
        let previous = -1;
        for (let i = 0; i < 4; i++) {
          const height = await page.evaluate(() => {
            const el = document.getElementById("app-scroll");
            if (!el) return 0;
            el.scrollTop = el.scrollHeight;
            return el.scrollHeight;
          });
          await page.waitForTimeout(450);
          if (height === previous) break;
          previous = height;
        }
        // A list that is still growing has no end to be stuck at, so any row
        // under the docked chrome here is a scroll position rather than a
        // fault. Saying so beats reporting a different library row each run.
        settled = await page.evaluate(() => {
          const el = document.getElementById("app-scroll");
          return !el || el.scrollTop >= el.scrollHeight - el.clientHeight - 2;
        });
      }
      const out = await page.evaluate(MEASURE, {
        higMin: HIG_MIN,
        wcagMin: WCAG_MIN,
        gapMin: GAP_MIN,
        atEnd: atEnd && settled,
      });
      seen = Math.max(seen, out.total);
      for (const s of out.small)
        push(s.wcag ? "wcag" : "small", route, `${s.w}×${s.h}  ${s.desc}`);
      for (const c of out.covered) push("covered", route, `${c.desc}  ← ${c.by}`);
      for (const u of out.unnamed) push("unnamed", route, u);
      for (const c of out.crowded)
        push("crowded", route, `${c.gap}px between ${c.a} and ${c.b}`);
      for (const n of out.numb) push("numb", route, n);
    }
    scanned += seen;
    console.log(`  ${route.padEnd(16)} ${String(seen).padStart(3)} targets`);
  }

  await ctx.close();
} finally {
  await browser.close();
}

const section = (title, rows, note) => {
  if (!rows.length) return;
  console.log(`\n${title} (${rows.length})`);
  if (note) console.log(`  ${note}`);
  for (const r of [...new Set(rows)].slice(0, 40)) console.log(`   ${r}`);
  const extra = new Set(rows).size - 40;
  if (extra > 0) console.log(`   …and ${extra} more`);
};

console.log(`\n${scanned} interactive elements measured across ${ROUTES.length} routes.`);
section("❌ Below WCAG 2.2 minimum (24px)", findings.wcag, "A published failure, not a taste call.");
section("⚠️  Below the 44px thumb minimum", findings.small, "Apple HIG, and this repo's own `tap` utility.");
section("⚠️  Centre of the control is covered by something else", findings.covered, "A tap here lands on the thing on top.");
section("⚠️  Targets closer than 8px", findings.crowded, "Two targets a thumb reads as one.");
section("⚠️  No press feedback", findings.numb, "No `press`, no `active:` — and tap highlight is off globally.");
section("⚠️  No accessible name", findings.unnamed);

const total =
  findings.wcag.length +
  findings.small.length +
  findings.covered.length +
  findings.crowded.length +
  findings.numb.length +
  findings.unnamed.length;
if (!total) console.log("\n✅ Nothing to report.");

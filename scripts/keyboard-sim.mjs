/**
 * Types into a set row under a model of the iOS on-screen keyboard and fails
 * if the page moves under the field while you type.
 *
 * Chromium has no software keyboard, and the bug this exists for lives
 * entirely in how iOS reports one: a set row low on the screen bounced once
 * per digit in an installed iOS 26 PWA. So the keyboard is simulated, in the
 * page, along the three axes iOS has varied on:
 *
 *   layout   A  innerHeight stays put; only visualViewport.height shrinks
 *            B  innerHeight shrinks with visualViewport.height
 *            C  the whole layout shrinks (innerHeight, 100dvh) — a real resize
 *   reveal   pan       iOS pans the visual viewport to show the caret
 *            scroller  it scrolls #app-scroll first, then pans the rest
 *            doc       it scrolls the (clipped) document — the "scroll leak"
 *
 * The document's scroll offset is virtual (Chromium can't scroll a clipped
 * root), and every write to it that the model didn't make is logged with its
 * caller, which is how the guard fight showed itself. On each keystroke the
 * model re-reveals the caret, as WebKit does after an edit.
 *
 * A case fails if the field's on-screen y moves while typing, or if the
 * document is not back at zero once the keyboard has closed (that is the
 * workout header — and Finish — gone).
 *
 * Requires the dev server on :3000 and ALLOW_DEV_CREDENTIALS=true.
 *   node scripts/keyboard-sim.mjs            # full matrix
 *   VERBOSE=1 node scripts/keyboard-sim.mjs B doc 700   # one case, with its trace
 */
import { chromium, devices } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LAYOUTS = (process.argv[2] ?? "A,B,C").split(",");
const REVEALS = (process.argv[3] ?? "pan,scroller,doc").split(",");
const POSITIONS = (process.argv[4] ?? "250,560,700,last").split(",");
/** iPhone 14 Pro as an installed PWA: no browser chrome, the full 852 px. */
const VIEWPORT = { width: 393, height: 852 };
/** Decimal pad plus the form accessory bar. */
const KEYBOARD = 300;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function keyboardModel({ layout, reveal, layoutH, kbH }) {
  const st = { height: layoutH, offsetTop: 0, doc: 0 };
  const visibleH = () => (layout === "C" ? window.innerHeight : st.height);

  const vv = new EventTarget();
  Object.defineProperties(vv, {
    height: { get: visibleH },
    width: { get: () => window.innerWidth },
    offsetTop: { get: () => st.offsetTop },
    offsetLeft: { get: () => 0 },
    pageTop: { get: () => st.offsetTop + st.doc },
    pageLeft: { get: () => 0 },
    scale: { get: () => 1 },
  });
  Object.defineProperty(window, "visualViewport", { get: () => vv });
  if (layout === "B")
    Object.defineProperty(window, "innerHeight", { get: () => st.height });

  const log = [];
  const t0 = performance.now();
  const mark = (kind, extra = {}) =>
    log.push({ t: Math.round(performance.now() - t0), kind, ...extra });

  let modelWriting = false;
  const native = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
  Object.defineProperty(Element.prototype, "scrollTop", {
    get() {
      return this === document.documentElement ? st.doc : native.get.call(this);
    },
    set(v) {
      const isDoc = this === document.documentElement;
      if (!modelWriting)
        mark("app-write", {
          el: isDoc ? "document" : this.id || this.tagName,
          from: Math.round(isDoc ? st.doc : native.get.call(this)),
          to: Math.round(v),
          by: new Error().stack.split("\n")[2]?.trim(),
        });
      if (isDoc) st.doc = Math.max(0, v);
      else native.set.call(this, v);
    },
  });
  Object.defineProperty(window, "scrollY", { get: () => st.doc });
  Object.defineProperty(window, "pageYOffset", { get: () => st.doc });

  const setVV = (height, offsetTop) => {
    const off = Math.min(Math.max(0, offsetTop), Math.max(0, layoutH - height));
    const resized = st.height !== height;
    const panned = st.offsetTop !== off;
    st.height = height;
    st.offsetTop = off;
    if (resized) vv.dispatchEvent(new Event("resize"));
    if (panned) vv.dispatchEvent(new Event("scroll"));
  };

  const MARGIN = 16;
  const reveal_ = (why) => {
    const el = document.activeElement;
    if (!(el instanceof HTMLInputElement)) return;
    // iOS plans against the keyboard's final frame, not the animating one.
    const finalBottom = layoutH - kbH;
    let r = el.getBoundingClientRect();
    if (reveal === "scroller") {
      const sc = document.getElementById("app-scroll");
      const want = r.bottom - st.doc + MARGIN - finalBottom;
      if (want > 0) {
        const before = sc.scrollTop;
        modelWriting = true;
        sc.scrollTop = before + want;
        modelWriting = false;
        if (sc.scrollTop !== before) mark("ios-scroll", { why });
      }
      r = el.getBoundingClientRect();
    }
    const top = r.top - st.doc;
    const bottom = r.bottom - st.doc;
    if (reveal === "doc") {
      if (bottom + MARGIN > finalBottom) {
        const to = st.doc + bottom + MARGIN - finalBottom;
        mark("ios-docscroll", { why, from: Math.round(st.doc), to: Math.round(to) });
        st.doc = to;
        window.dispatchEvent(new Event("scroll"));
      }
      return;
    }
    const visTop = st.offsetTop;
    const visBottom = st.offsetTop + visibleH();
    let off = st.offsetTop;
    if (bottom + MARGIN > visBottom) off += bottom + MARGIN - visBottom;
    else if (top - MARGIN < visTop) off -= visTop - (top - MARGIN);
    if (off !== st.offsetTop) {
      mark("ios-pan", { why, from: Math.round(st.offsetTop), to: Math.round(off) });
      setVV(st.height, off);
    }
  };

  document.addEventListener(
    "focusin",
    (e) => {
      if (!(e.target instanceof HTMLInputElement)) return;
      mark("focusin");
      reveal_("focus");
      if (layout === "C") return; // the harness resizes the real viewport
      const from = st.height;
      const to = layoutH - kbH;
      let i = 0;
      const step = () => {
        i += 1;
        setVV(Math.round(from + ((to - from) * i) / 6), st.offsetTop);
        reveal_("keyboard-anim");
        if (i < 6) setTimeout(step, 40);
      };
      if (from !== to) setTimeout(step, 40);
    },
    true,
  );
  window.addEventListener("resize", () => {
    if (layout !== "C") return;
    vv.dispatchEvent(new Event("resize"));
    reveal_("resize");
  });
  document.addEventListener(
    "input",
    () => requestAnimationFrame(() => reveal_("keystroke")),
    true,
  );
  document.addEventListener("selectionchange", () =>
    requestAnimationFrame(() => reveal_("selection")),
  );

  /* What a thumb sees: the field's y on the glass, every frame it changes. */
  let last = "";
  const frame = () => {
    const el = document.activeElement;
    const s = {
      inputY:
        el instanceof HTMLInputElement
          ? Math.round(el.getBoundingClientRect().top - st.offsetTop - st.doc)
          : null,
      doc: Math.round(st.doc),
      vvTop: Math.round(st.offsetTop),
      app: Math.round(document.getElementById("app-scroll")?.scrollTop ?? 0),
      innerHeight: window.innerHeight,
      pad: document.querySelector("header")?.parentElement?.style.paddingBottom || "0",
    };
    const key = JSON.stringify(s);
    if (key !== last) mark("frame", s);
    last = key;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  window.__kb = { st, setVV, log, mark };
}

const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const contextOptions = { ...devices["iPhone 14 Pro"], viewport: VIEWPORT, screen: VIEWPORT };
const dismissNudges = () => {
  try {
    localStorage.setItem("pump.install-nudge", "never");
    localStorage.setItem("pump.notify-nudge", String(Date.now()));
  } catch {}
};

/* One workout with enough rows to put a reps field anywhere on screen. */
async function startWorkout() {
  const ctx = await browser.newContext(contextOptions);
  await ctx.addInitScript(dismissNudges);
  const page = await ctx.newPage();
  // Onboarding suggests the handle from the name, so the name is per-run too.
  const id = Date.now().toString(36);
  const user = { email: `kb${id}@example.com`, password: "devpassword123", name: `Kb ${id}` };
  const res = await page.request.post(`${BASE}/api/auth/sign-up/email`, { data: user });
  if (!res.ok()) throw new Error(`sign-up failed: ${await res.text()}`);
  await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
  if (page.url().includes("/onboarding")) {
    await page.getByRole("button", { name: /start lifting/i }).click();
    await page.waitForURL(/\/feed/, { timeout: 30000 });
  }
  await page.goto(`${BASE}/routines/new`, { waitUntil: "networkidle" });
  await page.getByPlaceholder(/routine name/i).fill("Keyboard sim");
  await page.getByRole("button", { name: /add exercise/i }).click();
  await page.waitForTimeout(900);
  for (const name of [
    "Bench Press (Barbell)",
    "Overhead Press (Barbell)",
    "Tricep Pushdown (Cable)",
    "Lateral Raise (Dumbbell)",
  ]) {
    await page.getByRole("button", { name: new RegExp(escapeRe(name)) }).first().click();
  }
  await page.getByRole("button", { name: /^Add \d+ exercises?$/ }).click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /^Save$/ }).click();
  await page.waitForURL(/\/routines\/[0-9a-f-]{36}/, { timeout: 30000 });
  await page.getByRole("button", { name: /start routine/i }).click();
  await page.waitForURL(/\/workout\/[0-9a-f-]{36}/, { timeout: 30000 });
  const url = page.url();
  const state = await ctx.storageState();
  await ctx.close();
  return { url, state };
}

const { url, state } = await startWorkout();
const results = [];

for (const layout of LAYOUTS)
  for (const reveal of REVEALS)
    for (const pos of POSITIONS) {
      const ctx = await browser.newContext({ ...contextOptions, storageState: state });
      await ctx.addInitScript(dismissNudges);
      await ctx.addInitScript(keyboardModel, {
        layout,
        reveal,
        layoutH: VIEWPORT.height,
        kbH: KEYBOARD,
      });
      const page = await ctx.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await page.goto(url, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);

      const startY = await page.evaluate((pos) => {
        const sc = document.getElementById("app-scroll");
        const inputs = [...document.querySelectorAll('input[inputmode="numeric"]')];
        let el;
        if (pos === "last") {
          el = inputs.at(-1);
          sc.scrollTop = sc.scrollHeight;
        } else {
          el = inputs[Math.floor(inputs.length / 2)];
          sc.scrollTop += el.getBoundingClientRect().top - Number(pos);
        }
        el.setAttribute("data-kbsim", "");
        return Math.round(el.getBoundingClientRect().top);
      }, pos);
      await page.waitForTimeout(300);

      await page.locator("[data-kbsim]").tap();
      if (layout === "C")
        for (let i = 1; i <= 6; i++) {
          await page.waitForTimeout(40);
          await page.setViewportSize({
            width: VIEWPORT.width,
            height: Math.round(VIEWPORT.height - (KEYBOARD * i) / 6),
          });
        }
      await page.waitForTimeout(700);

      await page.evaluate(() => window.__kb.mark("typing"));
      for (const digit of "1234") {
        await page.keyboard.type(digit);
        await page.waitForTimeout(250);
      }
      await page.evaluate(() => window.__kb.mark("closing"));

      await page.keyboard.press("Enter");
      if (layout === "C") await page.setViewportSize(VIEWPORT);
      else await page.evaluate((h) => window.__kb.setVV(h, 0), VIEWPORT.height);
      await page.waitForTimeout(900);

      const log = await page.evaluate(() => window.__kb.log);
      const docAfter = await page.evaluate(() => window.__kb.st.doc);
      const from = log.findIndex((e) => e.kind === "typing");
      const to = log.findIndex((e) => e.kind === "closing");
      const typing = log.slice(from, to);
      let moves = 0;
      let prevY = null;
      for (const f of typing) {
        if (f.kind !== "frame" || f.inputY == null) continue;
        if (prevY != null && Math.abs(f.inputY - prevY) > 1) moves += 1;
        prevY = f.inputY;
      }
      const guardWrites = typing.filter((e) => e.kind === "app-write").length;
      const ok = moves === 0 && docAfter === 0 && pageErrors.length === 0;
      results.push({
        layout,
        reveal,
        row: pos,
        startY,
        jumpsWhileTyping: moves,
        appScrollWritesWhileTyping: guardWrites,
        documentAfterClose: Math.round(docAfter),
        pageErrors: pageErrors.length,
        result: ok ? "ok" : "FAIL",
      });
      if (process.env.VERBOSE) {
        console.log(`--- ${layout} ${reveal} ${pos}`);
        for (const e of log) console.log(JSON.stringify(e));
      }
      await ctx.close();
    }

await browser.close();
console.table(results);
const failed = results.filter((r) => r.result !== "ok");
if (failed.length) {
  console.error(`\n${failed.length} case(s) moved the page under the field.`);
  process.exit(1);
}
console.log("\nNo case moved the page while typing.");

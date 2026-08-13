/**
 * The rest-over chime, on a phone that is face-down in a bag.
 *
 * The problem this solves: nothing else in the app can make a noise at a chosen
 * moment while the screen is off. A `setTimeout` on the page is clamped to about
 * once a minute in a backgrounded tab and stopped outright in a suspended iOS
 * PWA; the service worker's alarm (`public/sw.js`) is best-effort for the same
 * reason and, even when it survives, a notification cannot carry a sound — the
 * `sound` option is implemented by nobody, so a banner gets the OS default tone
 * and `vibrate`, neither of which we choose.
 *
 * What does work is an **audio session**. A page that is actively playing audio
 * is kept running by the OS, and a Web Audio node scheduled on the audio clock
 * fires at its sample regardless of how the page's JavaScript timers are being
 * throttled. So the moment a rest starts — while the app is still in the
 * foreground and can still be trusted to run — the chime is scheduled for the
 * exact instant the rest ends, and an inaudible loop holds the session open in
 * between. Both are torn down the moment the rest is over or cancelled: nothing
 * here runs between sets.
 *
 * It is still an enhancement, not a dependency. iOS can interrupt an audio
 * session (a phone call, another app taking playback), and Safari will not
 * create a context at all until a real tap has primed one. Every function is a
 * no-op in those cases, the notification stays as the visual companion, and the
 * volt bar on the workout screen remains the source of truth.
 */

const CHIME_URL = "/sounds/rest-over.wav";
const SILENCE_URL = "/sounds/silence.wav";

/** Longest rest we'll hold a session open for; past this it's a stale message. */
const MAX_ARM_MS = 30 * 60 * 1000;

const PREF_KEY = "pump.rest-sound";

export function restSoundMuted() {
  try {
    return window.localStorage.getItem(PREF_KEY) === "off";
  } catch {
    return false;
  }
}

export function setRestSoundMuted(muted: boolean) {
  try {
    if (muted) window.localStorage.setItem(PREF_KEY, "off");
    else window.localStorage.removeItem(PREF_KEY);
  } catch {
    /* Private mode; the session still behaves as opted in. */
  }
}

let ctx: AudioContext | null = null;
let chime: AudioBuffer | null = null;
let keepAlive: HTMLAudioElement | null = null;
let armed: { endsAt: number; node: AudioBufferSourceNode; fallback: number } | null =
  null;
/**
 * A rest that started before the chime had finished downloading. The very first
 * rest of a session races the fetch below, and losing the sound on set one of
 * every workout is not a rare case worth waving through.
 */
let pendingArm: number | null = null;
/** The `endsAt` that has already sounded, so nothing chimes twice for one rest. */
let played: number | null = null;

function audioContext() {
  if (ctx) return ctx;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  ctx = new Ctx();
  return ctx;
}

/**
 * Called from the tap that starts a rest. Everything else here depends on this
 * having happened: iOS creates an `AudioContext` suspended and only a user
 * gesture may resume it, and the chime has to be decoded before it can be
 * scheduled for a moment when the page may no longer be running.
 */
export function primeRestAudio() {
  if (typeof window === "undefined" || restSoundMuted()) return;
  const audio = audioContext();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume().catch(() => {});

  if (!chime) {
    void fetch(CHIME_URL)
      .then((r) => r.arrayBuffer())
      .then((bytes) => audio.decodeAudioData(bytes))
      .then((buffer) => {
        chime = buffer;
        if (pendingArm != null) {
          const endsAt = pendingArm;
          pendingArm = null;
          armRestChime(endsAt);
        }
      })
      .catch(() => {
        /* No chime; the notification and the bar still do their jobs. */
      });
  }

  if (!keepAlive) {
    const el = new Audio(SILENCE_URL);
    el.loop = true;
    el.preload = "auto";
    // Not in the audio element's type — it is declared on video — but Safari
    // honours it on both, and without it iOS can take over the screen.
    (el as HTMLMediaElement & { playsInline?: boolean }).playsInline = true;
    keepAlive = el;
  }
}

function startKeepAlive() {
  if (!keepAlive) return;
  void keepAlive.play().catch(() => {});
  try {
    // Android surfaces a playing session in the notification shade; give it
    // something honest to say rather than the page title and a blank slot.
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Rest timer",
      artist: "Pump",
    });
    navigator.mediaSession.playbackState = "playing";
  } catch {
    /* Metadata is cosmetic, and older browsers have no media session at all. */
  }
}

function stopKeepAlive() {
  if (keepAlive) {
    keepAlive.pause();
    keepAlive.currentTime = 0;
  }
  try {
    navigator.mediaSession.playbackState = "none";
  } catch {
    /* Same. */
  }
}

/**
 * Schedule the chime for the end of this rest. Safe to call repeatedly — a rest
 * that is extended by ±15s gets a new `endsAt` and replaces the pending one.
 */
export function armRestChime(endsAt: number) {
  if (typeof window === "undefined" || restSoundMuted()) return;
  cancelRestChime();
  const audio = ctx;
  if (!audio) return;

  const delayMs = endsAt - Date.now();
  if (delayMs <= 0 || delayMs > MAX_ARM_MS) return;

  if (!chime) {
    // Still downloading. `primeRestAudio` picks this up when it lands.
    pendingArm = endsAt;
    return;
  }

  if (audio.state === "suspended") void audio.resume().catch(() => {});
  startKeepAlive();

  const node = audio.createBufferSource();
  node.buffer = chime;
  node.connect(audio.destination);
  // The audio clock, not a JS timer: this is the one thing here that survives
  // the page being frozen.
  node.start(audio.currentTime + delayMs / 1000);
  node.onended = () => {
    played = endsAt;
    if (armed?.endsAt === endsAt) finishArmed();
  };

  // Belt and braces. If the OS suspended the context anyway, the node never
  // ends and never fires; this runs whenever the page *is* awake at that point
  // (including the instant it is brought back), and `played` keeps the two from
  // both sounding.
  const fallback = window.setTimeout(() => {
    void playRestChime(endsAt);
  }, delayMs + 400);

  armed = { endsAt, node, fallback };
}

function finishArmed() {
  if (!armed) return;
  window.clearTimeout(armed.fallback);
  armed = null;
  stopKeepAlive();
}

/** Rest skipped, adjusted away, or the workout finished. */
export function cancelRestChime() {
  pendingArm = null;
  if (!armed) return;
  try {
    armed.node.onended = null;
    armed.node.stop();
    armed.node.disconnect();
  } catch {
    /* Already fired or never started. */
  }
  finishArmed();
}

/**
 * Play the chime now.
 *
 * With an `endsAt` it sounds at most once for that rest, which is what lets the
 * foreground timer hitting zero and the scheduled node share one path without
 * ever doubling up. With no argument it always plays — that is the settings
 * preview, whose entire job is to make a noise on demand.
 */
export async function playRestChime(endsAt?: number) {
  if (typeof window === "undefined" || restSoundMuted()) return;
  if (endsAt != null) {
    if (played === endsAt) return;
    played = endsAt;
    if (armed?.endsAt === endsAt) cancelRestChime();
  }

  try {
    const audio = audioContext();
    if (!audio) return;
    if (audio.state === "suspended") await audio.resume();
    if (!chime) {
      const bytes = await fetch(CHIME_URL).then((r) => r.arrayBuffer());
      chime = await audio.decodeAudioData(bytes);
    }
    const node = audio.createBufferSource();
    node.buffer = chime;
    node.connect(audio.destination);
    node.start();
  } catch {
    /* Audio is a nicety; never let it break the workout. */
  }
}

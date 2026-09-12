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
 * exact instant the rest ends. Both are torn down the moment the rest is over or
 * cancelled: nothing here runs between sets.
 *
 * **But holding that session costs you your music.** An audio session is not
 * shared by default: an inaudible keep-alive loop is, to the OS, this page
 * playing media, so iOS interrupts Spotify for it and Android hands Pump the
 * audio focus — for the whole rest, every rest. Lifting to music is not a fringe
 * case, it is most of the gym, and a chime is worth nothing bought at that
 * price. So the default is now to **mix**: `audioSession.type = "ambient"` (the
 * one WebKit category that plays alongside another app rather than over it), no
 * keep-alive loop, and no media-session claim, so nothing about a rest touches
 * what is already playing.
 *
 * The cost of mixing is the locked phone: an ambient session is suspended when
 * the page is backgrounded, so the chime is only certain while Pump is on
 * screen. That is what `holdsAudioSession()` — off unless the lifter turns it on
 * in settings — buys back, and the settings copy names the trade in both
 * directions. The service-worker banner and the vibration are the background
 * channel either way.
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
/**
 * Opt-in to holding the audio session for the length of the rest, which is what
 * makes the chime survive a locked screen — and what stops whatever else the
 * phone is playing. Absent means mix, because the default has to be the one
 * that cannot take something away from you.
 */
const HOLD_KEY = "pump.rest-sound-hold";

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

/** Whether this lifter chose the locked-screen chime over their music. */
export function restSoundHoldsSession() {
  try {
    return window.localStorage.getItem(HOLD_KEY) === "on";
  } catch {
    return false;
  }
}

export function setRestSoundHoldsSession(hold: boolean) {
  try {
    if (hold) window.localStorage.setItem(HOLD_KEY, "on");
    else window.localStorage.removeItem(HOLD_KEY);
  } catch {
    /* Same: fall back to mixing, the option that costs nothing. */
  }
  // A rest may be running right now, and the whole point of the switch is that
  // it takes effect on the music immediately rather than next session.
  if (typeof window === "undefined") return;
  if (hold) {
    applyAudioSessionType();
    if (armed) {
      ensureKeepAlive();
      startKeepAlive();
    }
  } else {
    stopKeepAlive();
    applyAudioSessionType();
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

/**
 * Declare what kind of audio this page is making, which is the whole of the
 * difference between the two modes on iOS.
 *
 * Left at its `"auto"` default, WebKit reads a looping element as media
 * playback and hands us the session outright — the other app stops. `"ambient"`
 * is the one category that mixes, at the price of obeying the ring/silent
 * switch and of being suspended when the page goes to the background.
 * `"playback"` is what the opt-in wants, and is what `"auto"` was resolving to
 * anyway; setting it explicitly means neither mode depends on a guess.
 *
 * Safari 16.4+ only, and nothing else implements it — but nothing else needs
 * it: on Android the audio focus follows from whether anything is *playing*,
 * which in mix mode is nothing until the chime itself.
 */
function applyAudioSessionType() {
  try {
    const session = (
      navigator as Navigator & { audioSession?: { type: string } }
    ).audioSession;
    if (!session) return;
    session.type = restSoundHoldsSession() ? "playback" : "ambient";
  } catch {
    /* Unknown category, or a browser that exposes a read-only stub. */
  }
}

/**
 * The page's one audio context, for anything else that wants to make a sound.
 * A second context is a second audio session — on iOS it competes with the
 * one `primeRestAudio` keeps in the mixing category, and can take the music.
 */
export function sharedAudioContext(): AudioContext | null {
  return audioContext();
}

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
  // Before the context exists: the category is read when the session activates.
  applyAudioSessionType();
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

  // Only for the lifter who asked for the locked-screen chime. The element is
  // not merely left paused otherwise — it is never constructed, so there is
  // nothing here that could take the audio focus from whatever they are
  // listening to.
  if (restSoundHoldsSession()) ensureKeepAlive();
}

function ensureKeepAlive() {
  if (keepAlive) return;
  const el = new Audio(SILENCE_URL);
  el.loop = true;
  el.preload = "auto";
  // Not in the audio element's type — it is declared on video — but Safari
  // honours it on both, and without it iOS can take over the screen.
  (el as HTMLMediaElement & { playsInline?: boolean }).playsInline = true;
  keepAlive = el;
}

function startKeepAlive() {
  if (!keepAlive) return;
  void keepAlive.play().catch(() => {});
  try {
    // Android surfaces a playing session in the notification shade; give it
    // something honest to say rather than the page title and a blank slot.
    // Only in this mode: claiming it in mix mode would put Pump on the lock
    // screen in place of the music app's own transport controls.
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
  // No element means this mode was never entered, and there is no session of
  // ours to release — say nothing rather than reset a media session we never
  // claimed.
  if (!keepAlive) return;
  keepAlive.pause();
  keepAlive.currentTime = 0;
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

  applyAudioSessionType();
  if (audio.state === "suspended") void audio.resume().catch(() => {});
  // A no-op in mix mode, where no element was ever built. The scheduled node
  // below is then the only thing this module puts on the audio hardware, and it
  // is half a second long at the end of the rest rather than the whole of it.
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
    applyAudioSessionType();
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

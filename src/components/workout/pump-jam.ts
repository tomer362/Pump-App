"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { restSoundMuted, sharedAudioContext } from "@/lib/rest-audio";

/**
 * The easter egg behind a long press on the workout header's elapsed time.
 *
 * It is *synthesised*, not a recording. Two reasons, in order: shipping the
 * record would put a copyrighted asset in the repo, and `playChime()` in
 * `rest-timer.tsx` already set the precedent that this app makes its own noise
 * rather than downloading any — which is also why this works in a basement gym
 * with no signal. What comes out is a four-voice homage at the right tempo in
 * the right key, and anyone who knows the track will know what it is.
 *
 * Everything here follows the same rule the timers do: schedule against an
 * absolute clock (`ctx.currentTime`), never a counter. A phone throttles
 * timers hard, and a sequencer that counts its own steps in `setInterval`
 * drifts into slop within a couple of bars.
 */

const BPM = 124;
/** One sixteenth note, the grid everything below sits on. */
const STEP_SECONDS = 60 / BPM / 4;
const STEPS_PER_BAR = 16;
const BARS = 8;
const TOTAL_STEPS = BARS * STEPS_PER_BAR;

/** How often the scheduler wakes, and how far past itself it writes. */
const TICK_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;

/**
 * Quiet on purpose. This plays out of a phone speaker in a room with other
 * people in it, and it is a joke rather than a sound system.
 */
const MASTER_GAIN = 0.18;

/** The notes the bass line uses, low in A minor. */
const NOTES: Record<string, number> = {
  A: 110, // A2
  G: 98, // G2
  C: 130.81, // C3
  D: 146.83, // D3
  E: 164.81, // E3
};

/**
 * Two bars of bass, alternating — one character per sixteenth, `.` is a rest.
 * A tracker row rather than an array of numbers because the rolling sixteenth
 * figure is the part people actually recognise, and this is the notation you
 * can read the rhythm out of at a glance.
 */
const BASS = ["A..A..C.A..E.D.C", "A..A..C.A..G.A.."] as const;

/** The offbeat chord stab, an A minor triad an octave up. */
const STAB = [220, 261.63, 329.63] as const;
const STAB_STEPS = new Set([4, 12]);
const KICK_STEPS = new Set([0, 4, 8, 12]);
const HAT_STEPS = new Set([2, 6, 10, 14]);

export type PumpJamHandle = {
  stop: () => void;
  /** How long the whole thing runs, so a caller can clear its own state. */
  durationMs: number;
};

function kick(ctx: AudioContext, out: AudioNode, at: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  // The pitch drop is the whole sound of a kick; a static sine is a beep.
  osc.frequency.setValueAtTime(120, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.11);
  gain.gain.setValueAtTime(0.9, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.18);
}

function bass(ctx: AudioContext, out: AudioNode, at: number, freq: number) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = freq;
  filter.type = "lowpass";
  // Sweeping the cutoff down over the note is what makes it read as a synth
  // bass rather than a buzz.
  filter.frequency.setValueAtTime(1400, at);
  filter.frequency.exponentialRampToValueAtTime(320, at + 0.14);
  filter.Q.value = 6;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.5, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  osc.connect(filter).connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.2);
}

function stab(ctx: AudioContext, out: AudioNode, at: number) {
  for (const freq of STAB) {
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      // Two slightly detuned copies per note: one square oscillator is thin,
      // and the beating between the pair is the chorus of the era.
      osc.detune.value = detune;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.06, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
      osc.connect(gain).connect(out);
      osc.start(at);
      osc.stop(at + 0.15);
    }
  }
}

function hat(ctx: AudioContext, out: AudioNode, at: number, noise: AudioBuffer) {
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = noise;
  filter.type = "highpass";
  filter.frequency.value = 7000;
  gain.gain.setValueAtTime(0.25, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  src.connect(filter).connect(gain).connect(out);
  src.start(at);
  src.stop(at + 0.06);
}

/** A quarter second of white noise, reused by every hat in the loop. */
function makeNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.25), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * Start the loop. Returns `null` when there is no Web Audio to start it with.
 *
 * **Call this synchronously from the gesture handler.** iOS only lets an audio
 * context leave the suspended state inside a user gesture — the same
 * constraint `interval-runner.tsx` notes about speaking on the tap. An `await`
 * before the constructor is enough to lose the gesture and the silence that
 * follows looks exactly like a bug.
 */
export function startPumpJam(): PumpJamHandle | null {
  const durationMs = TOTAL_STEPS * STEP_SECONDS * 1000;
  // Someone who muted the rest chime asked for silence from this page.
  if (restSoundMuted()) return null;
  try {
    // The same context the rest chime lives in, not a second one: two contexts
    // are two audio sessions, and the second used to take the session that
    // `rest-audio` goes to lengths to keep in the mixing category.
    const shared = sharedAudioContext();
    if (!shared) return null;
    // Typed non-null once, so the scheduling functions below can close over it.
    const ctx: AudioContext = shared;
    // Resume is a no-op where it is already allowed. Not awaited: the
    // scheduler works off `currentTime`, which only advances once it runs.
    void ctx.resume();

    const master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
    const noise = makeNoise(ctx);

    const startedAt = ctx.currentTime + 0.08;
    let nextStep = 0;
    let timer: number | null = null;
    let stopped = false;

    /**
     * Write every step whose time has come within the lookahead window. The
     * loop can't be scheduled in one go — 8 bars of nodes up front is both
     * wasteful and unstoppable — and it can't be scheduled a step at a time
     * from a timer either, because a backgrounded tab would tear the beat.
     */
    function pump() {
      const horizon = ctx.currentTime + SCHEDULE_AHEAD_SECONDS;
      while (nextStep < TOTAL_STEPS && startedAt + nextStep * STEP_SECONDS < horizon) {
        const at = startedAt + nextStep * STEP_SECONDS;
        const step = nextStep % STEPS_PER_BAR;
        const pattern = BASS[Math.floor(nextStep / STEPS_PER_BAR) % BASS.length];

        if (KICK_STEPS.has(step)) kick(ctx, master, at);
        if (HAT_STEPS.has(step)) hat(ctx, master, at, noise);
        // The stab sits out the first bar so the track arrives rather than
        // starting at full height.
        if (STAB_STEPS.has(step) && nextStep >= STEPS_PER_BAR) stab(ctx, master, at);
        const note = NOTES[pattern[step]];
        if (note != null) bass(ctx, master, at, note);

        nextStep++;
      }
      if (nextStep >= TOTAL_STEPS && timer != null) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    pump();
    timer = window.setInterval(pump, TICK_MS);
    let end: number | null = null;

    const handle: PumpJamHandle = {
      durationMs,
      stop() {
        if (stopped) return;
        stopped = true;
        if (timer != null) window.clearInterval(timer);
        if (end != null) window.clearTimeout(end);
        try {
          // Ramped, not cut: dropping the gain to zero in one sample clicks.
          const now = ctx.currentTime;
          master.gain.cancelScheduledValues(now);
          master.gain.setValueAtTime(master.gain.value, now);
          master.gain.linearRampToValueAtTime(0.0001, now + 0.06);
        } catch {
          /* Already closing. */
        }
        // Disconnect rather than close: the context is shared with the rest
        // chime, and closing it would take the next rest's sound with it.
        window.setTimeout(() => {
          try {
            master.disconnect();
          } catch {
            /* Already gone. */
          }
        }, 120);
      },
    };

    // Belt and braces: the interval above stops scheduling at the last step,
    // this releases the nodes once that step has finished sounding.
    end = window.setTimeout(handle.stop, durationMs + 400);
    return handle;
  } catch {
    /* Audio is a nicety; never let it break a workout. */
    return null;
  }
}

/**
 * `{ playing, start, stop }` for a component.
 *
 * `start` must stay callable straight out of a pointer handler, so it does no
 * awaiting and no state reading before it builds the context.
 */
export function usePumpJam() {
  const handle = useRef<PumpJamHandle | null>(null);
  const timeout = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const stop = useCallback(() => {
    handle.current?.stop();
    handle.current = null;
    if (timeout.current != null) window.clearTimeout(timeout.current);
    timeout.current = null;
    setPlaying(false);
  }, []);

  const start = useCallback(() => {
    if (handle.current) return;
    const started = startPumpJam();
    if (!started) return;
    handle.current = started;
    setPlaying(true);
    timeout.current = window.setTimeout(stop, started.durationMs);
  }, [stop]);

  // Leaving the workout — back, finish, a route change — takes the music with
  // it. Nothing about this should outlive the screen it belongs to.
  useEffect(() => stop, [stop]);

  return { playing, start, stop };
}

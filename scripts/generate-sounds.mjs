/**
 * Generates the two audio assets in `public/sounds/`.
 *
 * They are generated rather than sourced so they are reviewable — the whole
 * asset is the twenty lines of arithmetic below — and reproducible: re-run this
 * and you get the same bytes. Same deal as `generate-icons.mjs`.
 *
 *   node scripts/generate-sounds.mjs
 *
 * `rest-over.wav` is the rest-is-up chime: two sine blips, 880 Hz then 1320 Hz
 * 160 ms later, each with an instant attack and a fast exponential decay. It is
 * the beep `rest-timer.tsx` used to synthesise inline; it lives in a file now
 * because it has to be *scheduled* on a phone that is asleep, and a scheduled
 * buffer is one node where the oscillator version was six.
 *
 * `silence.wav` is the keep-alive loop. It is not digital silence: the sample
 * value alternates by one LSB (about -90 dBFS — inaudible on any hardware) so
 * that a platform which drops a media session for an all-zero stream still
 * treats it as playing audio. It has to be a file rather than a muted element
 * because iOS ignores `volume` on media elements entirely.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sounds");

/** 16-bit mono PCM WAV. `samples` are floats in [-1, 1]. */
function wav(samples, sampleRate) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // format: PCM
  header.writeUInt16LE(1, 22); // channels: mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);

  return Buffer.concat([header, data]);
}

function chime() {
  const rate = 44100;
  const length = Math.round(rate * 0.5);
  const samples = new Float32Array(length);
  // [start second, frequency]. The rising interval is the "ting ting".
  const blips = [
    [0, 880],
    [0.16, 1320],
  ];

  for (const [at, freq] of blips) {
    const from = Math.round(at * rate);
    for (let i = from; i < length; i++) {
      const t = (i - from) / rate;
      if (t > 0.22) break;
      // 3 ms attack so it starts as a strike rather than a click, then a decay
      // fast enough that the second blip lands in the tail of the first.
      const attack = Math.min(1, t / 0.003);
      const decay = Math.exp(-t * 22);
      samples[i] += Math.sin(2 * Math.PI * freq * t) * 0.5 * attack * decay;
    }
  }
  return wav(samples, rate);
}

function silence() {
  const rate = 8000;
  const samples = new Float32Array(rate); // exactly one second, loops seamlessly
  for (let i = 0; i < samples.length; i++) {
    samples[i] = (i % 2 === 0 ? 1 : -1) / 32767;
  }
  return wav(samples, rate);
}

mkdirSync(OUT, { recursive: true });
for (const [name, buffer] of [
  ["rest-over.wav", chime()],
  ["silence.wav", silence()],
]) {
  writeFileSync(join(OUT, name), buffer);
  console.log(`${name}  ${(buffer.length / 1024).toFixed(1)} KB`);
}

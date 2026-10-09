// Makes the Hearth's soft fireplace sound (CORE-047): assets/sounds/fireplace.wav.
// Run with `node scripts/make-fire-sound.mjs`. It's made from scratch here
// rather than recorded, so there's no licence to worry about, and the same
// seed always makes the same file. Swap in a real recording any time (same
// file name, a seamless loop, kept quiet).
//
// The fire is three layers:
//   rumble .... low, brown-noise roar that swells and settles like flames
//   hiss ...... a faint airy hiss on top
//   crackles .. lots of tiny clicks and now and then a pop of a log
// It loops with no seam: the slow swells fit the loop exactly, crackles
// wrap around from the end to the start, and the noise is crossfaded.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const RATE = 16000;
const SECONDS = 24;
const N = RATE * SECONDS;
const FADE = RATE * 1; // crossfade for the noise layers
const OUT = path.resolve("assets/sounds/fireplace.wav");

// A small seeded random number generator (mulberry32).
let seed = 0x6e6f6f6b; // "nook"
function random() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const white = () => random() * 2 - 1;

// Slow swells made of sines that each fit the loop a whole number of times.
function swell(i, parts) {
  let v = 0;
  for (const [cycles, amount, phase] of parts) v += amount * Math.sin((2 * Math.PI * cycles * i) / N + phase);
  return v;
}
const flameParts = [
  [3, 0.35, 0.4],
  [7, 0.25, 1.9],
  [13, 0.15, 3.1],
  [29, 0.08, 0.7],
];

// --- Noise layers, made a little long and crossfaded into a loop -------------

function noiseLayer(make) {
  const long = new Float32Array(N + FADE);
  make(long);
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = long[i];
  // The extra tail fades into the start (equal power), so the end meets the start.
  for (let i = 0; i < FADE; i++) {
    const t = i / FADE;
    out[i] = long[i] * Math.sin((t * Math.PI) / 2) + long[N + i] * Math.cos((t * Math.PI) / 2);
  }
  return out;
}

const rumble = noiseLayer((buf) => {
  let brown = 0;
  let low = 0;
  for (let i = 0; i < buf.length; i++) {
    brown = 0.995 * brown + 0.06 * white(); // brown-ish noise
    low += 0.08 * (brown - low); // soften the top end
    buf[i] = low;
  }
});

const hiss = noiseLayer((buf) => {
  let prev = 0;
  let band = 0;
  for (let i = 0; i < buf.length; i++) {
    const w = white();
    const high = w - prev; // drop the lows
    prev = w;
    band += 0.35 * (high - band); // and the harshest highs
    buf[i] = band;
  }
});

// --- Crackles and pops, wrapping round the loop ------------------------------

const crackles = new Float32Array(N);

function addAt(i, value) {
  crackles[((i % N) + N) % N] += value;
}

// A click: a burst of bright noise that dies away in a few milliseconds.
function crackle(at, loudness, decayMs) {
  const length = Math.ceil((decayMs / 1000) * RATE * 5);
  let prev = 0;
  for (let k = 0; k < length; k++) {
    const w = white();
    const bright = w - prev * 0.6;
    prev = w;
    addAt(at + k, bright * loudness * Math.exp(-k / ((decayMs / 1000) * RATE)));
  }
}

// A pop: a sharp crack with a little low thump under it, like a log settling.
function pop(at, loudness) {
  crackle(at, loudness, 4 + random() * 5);
  const pitch = 70 + random() * 110;
  const length = Math.ceil(0.12 * RATE);
  for (let k = 0; k < length; k++) {
    addAt(at + k, 0.5 * loudness * Math.sin((2 * Math.PI * pitch * k) / RATE) * Math.exp(-k / (0.03 * RATE)));
  }
}

for (let i = 0; i < N; ) {
  // Crackles come in little flurries when the flames are up.
  const flame = 0.55 + 0.45 * swell(i, flameParts);
  const perSecond = 5 + 16 * Math.max(0, flame);
  i += Math.max(1, Math.round((-Math.log(1 - random()) / perSecond) * RATE));
  // Mostly tiny, sometimes bigger (a heavy tail sounds natural).
  const size = Math.pow(random(), 3.2);
  crackle(i, 0.05 + 0.6 * size, 0.6 + random() * 2.2);
  // A quick follow-up click or two right after, as real crackles do.
  if (random() < 0.35) crackle(i + Math.round(RATE * (0.004 + random() * 0.02)), 0.04 + 0.3 * size, 0.5 + random() * 1.5);
}
for (let i = Math.round(random() * RATE); i < N; ) {
  pop(i, 0.35 + random() * 0.35);
  i += Math.round((2.5 + random() * 5) * RATE);
}

// --- Mix, gently, and write a 16-bit WAV --------------------------------------

const mix = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  const flame = 0.75 + 0.25 * swell(i, flameParts);
  mix[i] = rumble[i] * 0.3 * flame + hiss[i] * 0.06 * flame + crackles[i];
  peak = Math.max(peak, Math.abs(mix[i]));
}
// Soft-limit the loudest pops, then leave headroom.
const scale = 0.7 / peak;
const pcm = Buffer.alloc(N * 2);
for (let i = 0; i < N; i++) {
  const v = Math.tanh(mix[i] * scale * 1.6) / Math.tanh(1.6);
  pcm.writeInt16LE(Math.round(v * 0.8 * 32767), i * 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16); // fmt chunk size
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28); // bytes per second
header.writeUInt16LE(2, 32); // bytes per sample
header.writeUInt16LE(16, 34); // bits per sample
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.concat([header, pcm]));
console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${SECONDS}s, ${Math.round((44 + pcm.length) / 1024)} KB)`);

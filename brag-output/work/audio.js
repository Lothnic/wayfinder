// Generates brag-audio.wav: a 20s lo-fi chip track (square-wave pad over
// Am -> C -> G -> F) with scene-synced SFX, mixed as a proper bed.
const fs = require('fs');
const SR = 44100;
const DUR = 20.0;
const N = Math.floor(SR * DUR);
const L = new Float64Array(N), R = new Float64Array(N);
const clamp = x => Math.max(-1, Math.min(1, x));

const noteHz = n => 440 * Math.pow(2, (n - 69) / 12);
const midi = { A2: 45, C3: 48, E3: 52, F3: 53, G3: 55, A3: 57, C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, C5: 72, E5: 76 };

// ---------- scene boundaries (seconds) ----------
const CUTS = [0, 2.5, 5.5, 14.0, 17.0, 20.0];

// ---------- music bed: pads ----------
function addSample(t, ch, v) { // t in seconds
  const i = Math.floor(t * SR);
  if (i < 0 || i >= N) return;
  if (ch === 0) L[i] += v; else R[i] += v;
}
// a soft pad chord: 3 notes, square-ish filtered by lowpass over time
function padNote(freq, t0, dur, gain) {
  for (let i = Math.floor(t0 * SR); i < Math.min(N, Math.floor((t0 + dur) * SR)); i++) {
    const t = i / SR;
    const env = Math.min(1, (t - t0) * 4) * Math.min(1, (t0 + dur - t) * 3); // attack/release
    const w = Math.sin(2 * Math.PI * freq * t) * 0.6 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.2;
    addSample(t, 0, w * env * gain);
    addSample(t, 1, w * env * gain * 0.96);
  }
}
// chords: Am, C, G, F — one per 5s block, offset so it feels laid back
const CHORDS = [
  [midi.A2, midi.C4, midi.E4], // Am
  [midi.C3, midi.E4, midi.G4], // C
  [midi.G3, midi.C4, midi.E4], // G(no5) inversion
  [midi.F3, midi.A4, midi.C5], // F
];
for (let ci = 0; ci < 4; ci++) {
  const t0 = ci * 5.0;
  for (const rootnote of CHORDS[ci]) padNote(noteHz(rootnote), t0 + 0.08, 4.92, 0.09);
}
// sparse twinkling arpeggio top notes (scene 3 magic)
const ARPS = [
  [5.9, midi.E5, 0.05], [6.3, midi.C5, 0.05], [6.7, midi.G4, 0.05],
  [7.5, midi.A4, 0.045], [7.9, midi.C5, 0.045],
  [10.0, midi.E5, 0.05], [10.4, midi.D4, 0.04], [11.2, midi.C5, 0.05],
  [12.2, midi.A4, 0.04], [13.1, midi.G4, 0.04],
];
for (const [t, n, g] of ARPS) {
  for (let i = Math.floor(t * SR); i < Math.min(N, Math.floor((t + 0.35) * SR)); i++) {
    const tt = i / SR;
    const env = Math.exp(-(tt - t) * 9);
    const w = Math.sin(2 * Math.PI * noteHz(n) * tt) * 0.5;
    addSample(tt, 0, w * env * g); addSample(tt, 1, w * env * g * 0.94);
  }
}

// ---------- SFX ----------
function blip(freq, t0, dur, gain, type = 'square') {
  for (let i = Math.floor(t0 * SR); i < Math.min(N, Math.floor((t0 + dur) * SR)); i++) {
    const t = i / SR;
    const env = Math.min(1, (t - t0) * 60) * Math.min(1, (t0 + dur - t) * 20);
    let w;
    if (type === 'square') w = Math.sign(Math.sin(2 * Math.PI * freq * t)) * 0.35;
    else if (type === 'sawtooth') w = ((freq * t) % 1 - 0.5) * 2;
    else w = Math.sin(2 * Math.PI * freq * t);
    addSample(t, 0, w * env * gain); addSample(t, 1, w * env * gain);
  }
}
function sweepIn(t0, dur, gain) { // floppy seek / whoosh for scene reveals
  for (let i = Math.floor(t0 * SR); i < Math.min(N, Math.floor((t0 + dur) * SR)); i++) {
    const t = i / SR;
    const p = (t - t0) / dur;
    const f = 300 + p * p * 2500;
    const env = Math.sin(p * Math.PI) * 0.5;
    const w = Math.sin(2 * Math.PI * f * t);
    addSample(t, 0, w * env * gain); addSample(t, 1, w * env * gain);
  }
}
// timestamped SFX events
const SFX = [
  [0.15, () => { blip(880, 0.15, 0.04, 0.25); blip(1760, 0.19, 0.04, 0.22); }],       // hook title in
  [2.5, () => { sweepIn(2.5, 0.25, 0.14); blip(660, 2.62, 0.05, 0.2); }],             // reveal window spawn
  [3.2, () => blip(1100, 3.2, 0.03, 0.15)],
  [4.1, () => blip(900, 4.1, 0.03, 0.13)],
  [5.5, () => { sweepIn(5.5, 0.3, 0.12); }],                                           // work scene wipe
  [6.4, () => blip(740, 6.4, 0.03, 0.12)],  [6.8, () => blip(770, 6.8, 0.03, 0.12)],   // node pops
  [7.2, () => blip(800, 7.2, 0.03, 0.12)],  [7.9, () => blip(840, 7.9, 0.03, 0.12)],
  [8.8, () => blip(980, 8.8, 0.03, 0.13)],  [9.5, () => blip(1020, 9.5, 0.03, 0.13)], // arrows
  [10.3, () => blip(1060, 10.3, 0.03, 0.13)], [11.1, () => blip(1120, 11.1, 0.03, 0.13)],
  [12.2, () => blip(1240, 12.2, 0.03, 0.14)], // goal lands
  [14.0, () => { blip(196, 14.0, 0.3, 0.2, 'sine'); blip(98, 14.02, 0.5, 0.25, 'sine'); }], // punch sub drop
  [17.0, () => { blip(220, 17.0, 0.06, 0.18); blip(330, 17.1, 0.06, 0.16); blip(440, 17.2, 0.08, 0.16); }], // save dialog
];
for (const [t, fn] of SFX) fn();

// ---------- softkick checkerboard-chip beat, low in the mix ----------
for (let beat = 0; beat < 4 * 20; beat++) {
  const t = beat * 0.5;
  const beatInBar = beat % 4;
  if (beatInBar === 0 && t > 0.2) { // kick
    for (let i = Math.floor(t * SR); i < Math.min(N, Math.floor((t + 0.12) * SR)); i++) {
      const tt = i / SR; const p = (tt - t) / 0.12;
      const f = 110 * Math.exp(-p * 6) + 40; const env = Math.exp(-p * 7);
      const w = Math.sin(2 * Math.PI * f * tt);
      addSample(tt, 0, w * env * 0.07); addSample(tt, 1, w * env * 0.07);
    }
  }
  if (beatInBar === 2 && t > 0.2) { // tiny hat
    for (let i = Math.floor(t * SR); i < Math.min(N, Math.floor((t + 0.03) * SR)); i++) {
      const tt = i / SR; const env = Math.exp(-(tt - t) * 200);
      const w = (Math.random() * 2 - 1) * 0.12;
      addSample(tt, 0, w * env * 0.05); addSample(tt, 1, w * env * 0.05);
    }
  }
}

// ---------- master: normalize, gentle fade out ----------
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = peak > 0 ? 0.82 / peak : 1;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = t < 0.05 ? t / 0.05 : (t > DUR - 1.2 ? (DUR - t) / 1.2 : 1);
  buf.writeInt16LE(Math.round(L[i] * g * fade * 32767 * 0.5), 44 + i * 4);
  buf.writeInt16LE(Math.round(R[i] * g * fade * 32767 * 0.5), 46 + i * 4);
}
fs.writeFileSync('brag-audio.wav', buf);
console.log('wrote brag-audio.wav', N, 'frames,', (fs.statSync('brag-audio.wav').size / 1024 / 1024).toFixed(1), 'MB');

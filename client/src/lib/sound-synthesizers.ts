// All sound effects synthesized from scratch using Web Audio API
// Zero external audio files needed

type AC = AudioContext;

function createNoiseBuffer(ctx: AC, duration: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// Card deal: White noise burst through sweeping bandpass → "fwssh"
export function synthCardDeal(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.15);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(3000, now);
  filter.frequency.exponentialRampToValueAtTime(800, now + 0.12);
  filter.Q.value = 2;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  noise.connect(filter).connect(gain).connect(dest);
  noise.start(now);
  noise.stop(now + 0.15);
}

// Card flip: Square wave click + noise burst → paper "snap"
export function synthCardFlip(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  // Click
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 1800;
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.15, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
  osc.connect(clickGain).connect(dest);
  osc.start(now);
  osc.stop(now + 0.02);

  // Noise burst
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.06);
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2000;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.12, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  noise.connect(filter).connect(noiseGain).connect(dest);
  noise.start(now);
  noise.stop(now + 0.06);
}

// Chip clink: Dual sine tones with sharp attack, exponential decay → metallic "ting"
export function synthChipClink(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  [4200, 5600].forEach((freq) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain).connect(dest);
    osc.start(now);
    osc.stop(now + 0.15);
  });
}

// Chip slide: Filtered noise with amplitude modulation → rattling chips
export function synthChipSlide(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.35);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3000;
  filter.Q.value = 1.5;

  // AM modulation for rattling
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 30;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.5;
  lfo.connect(lfoGain);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  lfoGain.connect(gain.gain);

  noise.connect(filter).connect(gain).connect(dest);
  lfo.start(now);
  noise.start(now);
  noise.stop(now + 0.35);
  lfo.stop(now + 0.35);
}

// Fold: Sine pitch drop 220→110Hz → descending "giving up" tone
export function synthFold(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  osc.connect(gain).connect(dest);
  osc.start(now);
  osc.stop(now + 0.2);
}

// Check: Two quick sine pops at 800Hz → double tap
export function synthCheck(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  [0, 0.06].forEach((offset) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(0.15, now + offset + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.04);
    osc.connect(gain).connect(dest);
    osc.start(now + offset);
    osc.stop(now + offset + 0.05);
  });
}

// Call: Clean sine pop 600Hz → neutral affirmative
export function synthCall(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 600;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain).connect(dest);
  osc.start(now);
  osc.stop(now + 0.1);
}

// Raise: Sine pitch rise 400→800Hz with waveshaper distortion → aggressive ascending
export function synthRaise(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);

  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1;
    curve[i] = Math.tanh(x * 2);
  }
  shaper.curve = curve;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(shaper).connect(gain).connect(dest);
  osc.start(now);
  osc.stop(now + 0.18);
}

// Phase reveal: Sub-bass sweep 80→200Hz + noise burst → dramatic rumble
export function synthPhaseReveal(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  // Sub-bass sweep
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.5);
  const bassGain = ctx.createGain();
  bassGain.gain.setValueAtTime(0.2, now);
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc.connect(bassGain).connect(dest);
  osc.start(now);
  osc.stop(now + 0.55);

  // Noise burst
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.3);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400, now);
  filter.frequency.exponentialRampToValueAtTime(100, now + 0.3);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.1, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  noise.connect(filter).connect(noiseGain).connect(dest);
  noise.start(now);
  noise.stop(now + 0.3);
}

// Showdown fanfare: Ascending sine arpeggio C4→E4→G4→C5 with chorus detune
export function synthShowdownFanfare(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;
  const notes = [261.63, 329.63, 392.0, 523.25]; // C4, E4, G4, C5

  notes.forEach((freq, i) => {
    const offset = i * 0.12;
    // Main tone
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = freq;
    // Chorus detune
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 1.005;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(0.12, now + offset + 0.02);
    gain.gain.setValueAtTime(0.12, now + offset + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.4);

    osc1.connect(gain).connect(dest);
    osc2.connect(gain);
    osc1.start(now + offset);
    osc2.start(now + offset);
    osc1.stop(now + offset + 0.45);
    osc2.stop(now + offset + 0.45);
  });
}

// Win celebration: Fanfare + random sparkle bursts + sustained pad
export function synthWinCelebration(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  // Play fanfare first
  synthShowdownFanfare(ctx, dest);

  // Sparkle bursts (random high-freq pings)
  for (let i = 0; i < 8; i++) {
    const offset = 0.3 + Math.random() * 0.8;
    const freq = 3000 + Math.random() * 3000;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);
    osc.connect(gain).connect(dest);
    osc.start(now + offset);
    osc.stop(now + offset + 0.12);
  }

  // Sustained pad
  const pad = ctx.createOscillator();
  pad.type = 'sine';
  pad.frequency.value = 261.63; // C4
  const padGain = ctx.createGain();
  padGain.gain.setValueAtTime(0, now + 0.5);
  padGain.gain.linearRampToValueAtTime(0.06, now + 0.8);
  padGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  pad.connect(padGain).connect(dest);
  pad.start(now + 0.5);
  pad.stop(now + 1.6);
}

// Timer tick: Short sine at 1000Hz, pitch rises as time runs low
export function synthTimerTick(ctx: AC, dest: AudioNode, urgency: number = 0) {
  const now = ctx.currentTime;
  const freq = 1000 + urgency * 500; // 1000-1500Hz based on urgency (0-1)
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08 + urgency * 0.07, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  osc.connect(gain).connect(dest);
  osc.start(now);
  osc.stop(now + 0.03);
}

// Turn notify: Two-tone chime 880Hz→1174Hz
export function synthTurnNotify(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  [880, 1174].forEach((freq, i) => {
    const offset = i * 0.1;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.2);
    osc.connect(gain).connect(dest);
    osc.start(now + offset);
    osc.stop(now + offset + 0.25);
  });
}

// Ambient music: Low sawtooth pad through LFO-modulated lowpass filter
export interface AmbientHandle {
  stop: () => void;
}

export function synthAmbient(ctx: AC, dest: AudioNode): AmbientHandle {
  const now = ctx.currentTime;

  // Two low oscillators for a chord (C2 + G2)
  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = 65.41; // C2

  const osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = 98.0; // G2

  // LFO modulating lowpass cutoff
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.15; // very slow
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 100;
  lfo.connect(lfoGain);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 200;
  filter.Q.value = 3;
  lfoGain.connect(filter.frequency);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.04, now + 2); // very quiet

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain).connect(dest);

  lfo.start(now);
  osc1.start(now);
  osc2.start(now);

  return {
    stop: () => {
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 1);
      setTimeout(() => {
        try {
          osc1.stop();
          osc2.stop();
          lfo.stop();
        } catch {}
      }, 1200);
    },
  };
}

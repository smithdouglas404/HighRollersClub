// All sound effects synthesized from scratch using Web Audio API
// Polished with proper envelopes, harmonics, and reverb-like effects

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

// Simple delay-based reverb tail for one-shots
function addTail(ctx: AC, source: AudioNode, dest: AudioNode, wetGain = 0.15) {
  const wet = ctx.createGain();
  wet.gain.value = wetGain;

  const delay1 = ctx.createDelay(0.3);
  delay1.delayTime.value = 0.05;
  const delay2 = ctx.createDelay(0.3);
  delay2.delayTime.value = 0.11;

  const fb = ctx.createGain();
  fb.gain.value = 0.25;

  const lpf = ctx.createBiquadFilter();
  lpf.type = "lowpass";
  lpf.frequency.value = 3000;

  source.connect(wet);
  wet.connect(delay1);
  delay1.connect(lpf);
  lpf.connect(fb);
  fb.connect(delay2);
  delay2.connect(dest);
  delay1.connect(dest);
}

// Card deal: Layered noise burst → realistic "fwssh" of card sliding
export function synthCardDeal(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  // High-freq noise: initial attack
  const noise1 = ctx.createBufferSource();
  noise1.buffer = createNoiseBuffer(ctx, 0.12);
  const bp1 = ctx.createBiquadFilter();
  bp1.type = "bandpass";
  bp1.frequency.setValueAtTime(4000, now);
  bp1.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
  bp1.Q.value = 1.5;
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.2, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  noise1.connect(bp1).connect(g1).connect(dest);
  noise1.start(now);
  noise1.stop(now + 0.12);

  // Low thud: table impact
  const thud = ctx.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(150, now + 0.02);
  thud.frequency.exponentialRampToValueAtTime(60, now + 0.08);
  const thudGain = ctx.createGain();
  thudGain.gain.setValueAtTime(0.1, now + 0.02);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  thud.connect(thudGain).connect(dest);
  thud.start(now + 0.02);
  thud.stop(now + 0.1);
}

// Card flip: Sharp click + paper texture → satisfying snap
export function synthCardFlip(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  // Transient click
  const click = ctx.createOscillator();
  click.type = "square";
  click.frequency.value = 2200;
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.12, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);
  click.connect(clickGain).connect(dest);
  click.start(now);
  click.stop(now + 0.01);

  // Paper noise
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.06);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3000;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.08, now + 0.003);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  noise.connect(hp).connect(noiseGain).connect(dest);
  noise.start(now);
  noise.stop(now + 0.06);

  addTail(ctx, clickGain, dest, 0.08);
}

// Chip clink: Layered metallic harmonics → realistic ceramic/clay chip ting
export function synthChipClink(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;
  const mix = ctx.createGain();
  mix.gain.value = 1;
  mix.connect(dest);

  // Multiple harmonic partials for rich metallic tone
  const freqs = [3200, 4800, 6400, 8100];
  const gains = [0.12, 0.08, 0.05, 0.03];
  const decays = [0.15, 0.12, 0.08, 0.06];

  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq + (Math.random() - 0.5) * 20; // slight random detune
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gains[i], now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decays[i]);
    osc.connect(gain).connect(mix);
    osc.start(now);
    osc.stop(now + decays[i] + 0.01);
  });

  // Tiny noise transient for the "hit"
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.02);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 5000;
  bp.Q.value = 2;
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.06, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
  noise.connect(bp).connect(nGain).connect(mix);
  noise.start(now);
  noise.stop(now + 0.02);

  addTail(ctx, mix, dest, 0.12);
}

// Chip slide: Rattling chips pushed across felt
export function synthChipSlide(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.4);

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(3500, now);
  bp.frequency.linearRampToValueAtTime(2500, now + 0.3);
  bp.Q.value = 1.2;

  // Amplitude modulation for rattling texture
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 35;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.4;
  lfo.connect(lfoGain);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  lfoGain.connect(gain.gain);

  noise.connect(bp).connect(gain).connect(dest);
  lfo.start(now);
  noise.start(now);
  noise.stop(now + 0.4);
  lfo.stop(now + 0.4);
}

// Fold: Soft descending tone → dejected but not harsh
export function synthFold(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "triangle"; // softer than sine
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 800;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc.connect(filter).connect(gain).connect(dest);
  osc.start(now);
  osc.stop(now + 0.25);
}

// Check: Two clean knocks → table tap
export function synthCheck(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  [0, 0.07].forEach((offset) => {
    // Wood-like knock: filtered noise + sine transient
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 0.03);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1200;
    bp.Q.value = 3;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.1, now + offset);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.025);
    noise.connect(bp).connect(nGain).connect(dest);
    noise.start(now + offset);
    noise.stop(now + offset + 0.03);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.03);
    osc.connect(gain).connect(dest);
    osc.start(now + offset);
    osc.stop(now + offset + 0.04);
  });
}

// Call: Warm affirmative tone
export function synthCall(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 520;

  // Subtle second harmonic
  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = 780;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0, now);
  gain2.gain.linearRampToValueAtTime(0.04, now + 0.008);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain).connect(dest);
  osc2.connect(gain2).connect(dest);
  osc.start(now);
  osc2.start(now);
  osc.stop(now + 0.12);
  osc2.stop(now + 0.1);
}

// Raise: Aggressive ascending tone with edge
export function synthRaise(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(350, now);
  osc.frequency.exponentialRampToValueAtTime(700, now + 0.1);

  // Soft distortion
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1;
    curve[i] = Math.tanh(x * 1.5);
  }
  shaper.curve = curve;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2000, now);
  filter.frequency.linearRampToValueAtTime(4000, now + 0.08);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(shaper).connect(filter).connect(gain).connect(dest);
  osc.start(now);
  osc.stop(now + 0.18);

  addTail(ctx, gain, dest, 0.1);
}

// Phase reveal: Cinematic bass swell with sub-rumble
export function synthPhaseReveal(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  // Sub-bass sweep
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(60, now);
  sub.frequency.exponentialRampToValueAtTime(180, now + 0.4);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.18, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  sub.connect(subGain).connect(dest);
  sub.start(now);
  sub.stop(now + 0.55);

  // Noise texture
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.35);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(500, now);
  lp.frequency.exponentialRampToValueAtTime(100, now + 0.3);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.06, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  noise.connect(lp).connect(noiseGain).connect(dest);
  noise.start(now);
  noise.stop(now + 0.35);

  // High shimmer accent
  const shimmer = ctx.createOscillator();
  shimmer.type = "sine";
  shimmer.frequency.value = 1200;
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.setValueAtTime(0, now);
  shimmerGain.gain.linearRampToValueAtTime(0.04, now + 0.05);
  shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  shimmer.connect(shimmerGain).connect(dest);
  shimmer.start(now);
  shimmer.stop(now + 0.35);

  addTail(ctx, subGain, dest, 0.15);
}

// Showdown fanfare: Rich ascending arpeggio with chorus and reverb
export function synthShowdownFanfare(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;
  const notes = [261.63, 329.63, 392.0, 523.25]; // C4, E4, G4, C5

  const mix = ctx.createGain();
  mix.gain.value = 1;
  mix.connect(dest);

  notes.forEach((freq, i) => {
    const offset = i * 0.1;

    // Main tone
    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = freq;

    // Chorus copy
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = freq * 1.004;

    // Third voice, octave below for warmth
    const osc3 = ctx.createOscillator();
    osc3.type = "triangle";
    osc3.frequency.value = freq * 0.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(0.1, now + offset + 0.015);
    gain.gain.setValueAtTime(0.1, now + offset + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.5);

    const gain3 = ctx.createGain();
    gain3.gain.setValueAtTime(0, now + offset);
    gain3.gain.linearRampToValueAtTime(0.03, now + offset + 0.02);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.4);

    osc1.connect(gain).connect(mix);
    osc2.connect(gain);
    osc3.connect(gain3).connect(mix);

    osc1.start(now + offset);
    osc2.start(now + offset);
    osc3.start(now + offset);
    osc1.stop(now + offset + 0.55);
    osc2.stop(now + offset + 0.55);
    osc3.stop(now + offset + 0.45);
  });

  addTail(ctx, mix, dest, 0.2);
}

// Win celebration: Fanfare + sparkle cascade + warm pad swell
export function synthWinCelebration(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;

  synthShowdownFanfare(ctx, dest);

  // Sparkle cascade (pitched high pings)
  const sparkleFreqs = [3000, 3500, 4000, 4500, 5000, 5500, 4200, 3800];
  for (let i = 0; i < sparkleFreqs.length; i++) {
    const offset = 0.25 + i * 0.08 + Math.random() * 0.05;
    const freq = sparkleFreqs[i];
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.04, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
    osc.connect(gain).connect(dest);
    osc.start(now + offset);
    osc.stop(now + offset + 0.18);
  }

  // Warm pad swell (major chord)
  const padNotes = [261.63, 329.63, 392.0]; // C4, E4, G4
  padNotes.forEach((freq) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = freq * 1.003;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now + 0.4);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    osc.connect(gain).connect(dest);
    osc2.connect(gain);
    osc.start(now + 0.4);
    osc2.start(now + 0.4);
    osc.stop(now + 1.9);
    osc2.stop(now + 1.9);
  });
}

// Timer tick: Clean metronome click, urgency raises pitch
export function synthTimerTick(ctx: AC, dest: AudioNode, urgency: number = 0) {
  const now = ctx.currentTime;
  const freq = 900 + urgency * 600;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.06 + urgency * 0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

  osc.connect(gain).connect(dest);
  osc.start(now);
  osc.stop(now + 0.03);
}

// Turn notify: Pleasant two-note chime with reverb
export function synthTurnNotify(ctx: AC, dest: AudioNode) {
  const now = ctx.currentTime;
  const mix = ctx.createGain();
  mix.gain.value = 1;
  mix.connect(dest);

  const notes = [880, 1320]; // A5, E6 (perfect fifth — pleasant interval)
  notes.forEach((freq, i) => {
    const offset = i * 0.1;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    // Chorus detune
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = freq * 1.003;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(0.1, now + offset + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.3);

    osc.connect(gain).connect(mix);
    osc2.connect(gain);
    osc.start(now + offset);
    osc2.start(now + offset);
    osc.stop(now + offset + 0.35);
    osc2.stop(now + offset + 0.35);
  });

  addTail(ctx, mix, dest, 0.18);
}

// Ambient music: Warm filtered pad with slow movement
export interface AmbientHandle {
  stop: () => void;
}

export function synthAmbient(ctx: AC, dest: AudioNode): AmbientHandle {
  const now = ctx.currentTime;

  // Warm pad: C2 + E2 + G2 (major triad) through LFO-modulated lowpass
  const osc1 = ctx.createOscillator();
  osc1.type = "sawtooth";
  osc1.frequency.value = 65.41; // C2

  const osc2 = ctx.createOscillator();
  osc2.type = "sawtooth";
  osc2.frequency.value = 82.41; // E2

  const osc3 = ctx.createOscillator();
  osc3.type = "sawtooth";
  osc3.frequency.value = 98.0; // G2

  // Detuned copies for width
  const osc1b = ctx.createOscillator();
  osc1b.type = "sawtooth";
  osc1b.frequency.value = 65.41 * 1.003;
  const osc2b = ctx.createOscillator();
  osc2b.type = "sawtooth";
  osc2b.frequency.value = 82.41 * 1.004;

  // LFO on filter cutoff
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.1;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 120;
  lfo.connect(lfoGain);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 250;
  filter.Q.value = 2;
  lfoGain.connect(filter.frequency);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.035, now + 3);

  osc1.connect(filter);
  osc2.connect(filter);
  osc3.connect(filter);
  osc1b.connect(filter);
  osc2b.connect(filter);
  filter.connect(gain).connect(dest);

  lfo.start(now);
  osc1.start(now);
  osc2.start(now);
  osc3.start(now);
  osc1b.start(now);
  osc2b.start(now);

  return {
    stop: () => {
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + 1.5);
      setTimeout(() => {
        try {
          osc1.stop(); osc2.stop(); osc3.stop();
          osc1b.stop(); osc2b.stop(); lfo.stop();
        } catch {}
      }, 1700);
    },
  };
}

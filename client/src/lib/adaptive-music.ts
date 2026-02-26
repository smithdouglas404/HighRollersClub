// Adaptive Music Engine — game-state-aware ambient layers
// Manages 3 Web Audio layers that respond to game state

type MusicState = "idle" | "in_hand" | "all_in" | "showdown";

export class AdaptiveMusicEngine {
  private ctx: AudioContext;
  private dest: AudioNode;
  private state: MusicState = "idle";
  private running = false;

  // Pad layer: low sawtooth chord
  private padOsc1: OscillatorNode | null = null;
  private padOsc2: OscillatorNode | null = null;
  private padGain: GainNode | null = null;

  // Heartbeat layer: sub-bass with LFO
  private heartOsc: OscillatorNode | null = null;
  private heartGain: GainNode | null = null;
  private heartLfo: OscillatorNode | null = null;
  private heartLfoGain: GainNode | null = null;

  // Tension layer: filtered noise
  private tensionSource: AudioBufferSourceNode | null = null;
  private tensionFilter: BiquadFilterNode | null = null;
  private tensionGain: GainNode | null = null;

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx;
    this.dest = dest;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const t = this.ctx.currentTime;

    // Pad layer: C2 (65.4Hz) + G2 (98Hz) sawtooth
    this.padGain = this.ctx.createGain();
    this.padGain.gain.setValueAtTime(0.03, t);
    this.padGain.connect(this.dest);

    this.padOsc1 = this.ctx.createOscillator();
    this.padOsc1.type = "sawtooth";
    this.padOsc1.frequency.setValueAtTime(65.41, t);
    this.padOsc1.connect(this.padGain);
    this.padOsc1.start(t);

    this.padOsc2 = this.ctx.createOscillator();
    this.padOsc2.type = "sawtooth";
    this.padOsc2.frequency.setValueAtTime(98.0, t);
    this.padOsc2.connect(this.padGain);
    this.padOsc2.start(t);

    // Heartbeat layer: 50Hz sine with LFO envelope
    this.heartGain = this.ctx.createGain();
    this.heartGain.gain.setValueAtTime(0, t);
    this.heartGain.connect(this.dest);

    this.heartOsc = this.ctx.createOscillator();
    this.heartOsc.type = "sine";
    this.heartOsc.frequency.setValueAtTime(50, t);
    this.heartOsc.connect(this.heartGain);
    this.heartOsc.start(t);

    this.heartLfoGain = this.ctx.createGain();
    this.heartLfoGain.gain.setValueAtTime(0.02, t);
    this.heartLfoGain.connect(this.heartGain.gain);

    this.heartLfo = this.ctx.createOscillator();
    this.heartLfo.type = "sine";
    this.heartLfo.frequency.setValueAtTime(1.2, t);
    this.heartLfo.connect(this.heartLfoGain);
    this.heartLfo.start(t);

    // Tension layer: white noise through bandpass filter
    this.tensionGain = this.ctx.createGain();
    this.tensionGain.gain.setValueAtTime(0, t);
    this.tensionGain.connect(this.dest);

    this.tensionFilter = this.ctx.createBiquadFilter();
    this.tensionFilter.type = "bandpass";
    this.tensionFilter.frequency.setValueAtTime(3000, t);
    this.tensionFilter.Q.setValueAtTime(2, t);
    this.tensionFilter.connect(this.tensionGain);

    const bufferSize = this.ctx.sampleRate * 4;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.tensionSource = this.ctx.createBufferSource();
    this.tensionSource.buffer = noiseBuffer;
    this.tensionSource.loop = true;
    this.tensionSource.connect(this.tensionFilter);
    this.tensionSource.start(t);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    const nodes = [
      this.padOsc1, this.padOsc2, this.heartOsc, this.heartLfo, this.tensionSource,
    ];
    for (const n of nodes) {
      try { n?.stop(); } catch {}
    }
    const gains = [this.padGain, this.heartGain, this.heartLfoGain, this.tensionGain, this.tensionFilter];
    for (const g of gains) {
      try { g?.disconnect(); } catch {}
    }
    this.padOsc1 = this.padOsc2 = this.heartOsc = this.heartLfo = null;
    this.padGain = this.heartGain = this.heartLfoGain = this.tensionGain = null;
    this.tensionSource = null;
    this.tensionFilter = null;
  }

  setState(state: MusicState, opts?: { potSize?: number; blindLevel?: number }) {
    if (!this.running || state === this.state) return;
    this.state = state;
    const t = this.ctx.currentTime;

    switch (state) {
      case "idle":
        this.padGain?.gain.linearRampToValueAtTime(0.03, t + 1);
        this.heartGain?.gain.linearRampToValueAtTime(0, t + 1);
        this.tensionGain?.gain.linearRampToValueAtTime(0, t + 0.5);
        break;

      case "in_hand": {
        this.padGain?.gain.linearRampToValueAtTime(0.01, t + 0.5);
        // Heartbeat fades in; rate scales with pot/blinds ratio
        const ratio = opts?.potSize && opts?.blindLevel ? Math.min(opts.potSize / (opts.blindLevel * 10), 3) : 1;
        const heartRate = 0.8 + ratio * 0.4;
        this.heartLfo?.frequency.linearRampToValueAtTime(heartRate, t + 0.5);
        this.heartGain?.gain.linearRampToValueAtTime(0.015, t + 1);
        this.tensionGain?.gain.linearRampToValueAtTime(0, t + 0.5);
        break;
      }

      case "all_in":
        // Vacuum silence: everything fades out
        this.padGain?.gain.linearRampToValueAtTime(0, t + 0.5);
        this.heartGain?.gain.linearRampToValueAtTime(0, t + 0.5);
        this.tensionGain?.gain.linearRampToValueAtTime(0, t + 0.5);
        // Tension swells after 1s pause
        setTimeout(() => {
          if (this.state !== "all_in" || !this.running) return;
          const now = this.ctx.currentTime;
          this.tensionGain?.gain.linearRampToValueAtTime(0.02, now + 2);
        }, 1000);
        break;

      case "showdown":
        // Silence — fanfare handled elsewhere
        this.padGain?.gain.linearRampToValueAtTime(0, t + 0.3);
        this.heartGain?.gain.linearRampToValueAtTime(0, t + 0.3);
        this.tensionGain?.gain.linearRampToValueAtTime(0, t + 0.3);
        break;
    }
  }
}

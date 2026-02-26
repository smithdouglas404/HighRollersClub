// Singleton Sound Engine — manages AudioContext + master gain
// Must call init() from a user gesture (e.g. avatar select button)

import {
  synthCardDeal,
  synthCardFlip,
  synthChipClink,
  synthChipSlide,
  synthFold,
  synthCheck,
  synthCall,
  synthRaise,
  synthPhaseReveal,
  synthShowdownFanfare,
  synthWinCelebration,
  synthTimerTick,
  synthTurnNotify,
  synthAmbient,
  type AmbientHandle,
} from './sound-synthesizers';

import { AdaptiveMusicEngine } from './adaptive-music';

const STORAGE_KEY = 'poker-sound-muted';
const VOLUME_KEY = 'poker-sound-volume';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _muted: boolean = false;
  private _volume: number = 0.7;
  private ambientHandle: AmbientHandle | null = null;
  private initialized = false;
  private adaptiveMusic: AdaptiveMusicEngine | null = null;

  constructor() {
    // Restore persisted settings
    try {
      const storedMuted = localStorage.getItem(STORAGE_KEY);
      if (storedMuted !== null) this._muted = storedMuted === 'true';
      const storedVol = localStorage.getItem(VOLUME_KEY);
      if (storedVol !== null) this._volume = parseFloat(storedVol);
    } catch {}
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._muted ? 0 : this._volume;
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not available:', e);
    }
  }

  private get dest(): AudioNode | null {
    if (!this.ctx || !this.masterGain) return null;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.masterGain;
  }

  get muted() {
    return this._muted;
  }

  set muted(val: boolean) {
    this._muted = val;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(
        val ? 0 : this._volume,
        this.ctx?.currentTime ?? 0
      );
    }
    if (this.adaptiveMusic) {
      if (val) this.adaptiveMusic.stop();
      else this.adaptiveMusic.start();
    }
    try { localStorage.setItem(STORAGE_KEY, String(val)); } catch {}
  }

  get volume() {
    return this._volume;
  }

  set volume(val: number) {
    this._volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && !this._muted) {
      this.masterGain.gain.setValueAtTime(this._volume, this.ctx?.currentTime ?? 0);
    }
    try { localStorage.setItem(VOLUME_KEY, String(this._volume)); } catch {}
  }

  toggleMute(): boolean {
    this.muted = !this._muted;
    return this._muted;
  }

  // --- Spatial Audio ---

  private createSpatialDest(seatX: number, seatScale: number): AudioNode | null {
    if (!this.ctx || !this.masterGain) return null;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, (seatX - 50) / 50));
    const gain = this.ctx.createGain();
    gain.gain.value = 0.4 + 0.6 * seatScale;
    panner.connect(gain);
    gain.connect(this.masterGain);
    setTimeout(() => { try { panner.disconnect(); gain.disconnect(); } catch {} }, 5000);
    return panner;
  }

  playChipClinkAt(seatX: number, seatScale: number) {
    const d = this.createSpatialDest(seatX, seatScale);
    if (d && this.ctx) synthChipClink(this.ctx, d);
  }

  playFoldAt(seatX: number, seatScale: number) {
    const d = this.createSpatialDest(seatX, seatScale);
    if (d && this.ctx) synthFold(this.ctx, d);
  }

  playCheckAt(seatX: number, seatScale: number) {
    const d = this.createSpatialDest(seatX, seatScale);
    if (d && this.ctx) synthCheck(this.ctx, d);
  }

  playCallAt(seatX: number, seatScale: number) {
    const d = this.createSpatialDest(seatX, seatScale);
    if (d && this.ctx) synthCall(this.ctx, d);
  }

  playRaiseAt(seatX: number, seatScale: number) {
    const d = this.createSpatialDest(seatX, seatScale);
    if (d && this.ctx) synthRaise(this.ctx, d);
  }

  // --- Adaptive Music ---

  startAdaptiveMusic() {
    if (this.adaptiveMusic) return;
    if (!this.ctx || !this.masterGain) return;
    this.adaptiveMusic = new AdaptiveMusicEngine(this.ctx, this.masterGain);
    if (!this._muted) this.adaptiveMusic.start();
  }

  stopAdaptiveMusic() {
    if (this.adaptiveMusic) {
      this.adaptiveMusic.stop();
      this.adaptiveMusic = null;
    }
  }

  setMusicState(state: "idle" | "in_hand" | "all_in" | "showdown", opts?: { potSize?: number; blindLevel?: number }) {
    if (this.adaptiveMusic) {
      this.adaptiveMusic.setState(state, opts);
    }
  }

  // --- Sound methods ---

  playCardDeal() {
    const d = this.dest;
    if (d && this.ctx) synthCardDeal(this.ctx, d);
  }

  playCardFlip() {
    const d = this.dest;
    if (d && this.ctx) synthCardFlip(this.ctx, d);
  }

  playChipClink() {
    const d = this.dest;
    if (d && this.ctx) synthChipClink(this.ctx, d);
  }

  playChipSlide() {
    const d = this.dest;
    if (d && this.ctx) synthChipSlide(this.ctx, d);
  }

  playFold() {
    const d = this.dest;
    if (d && this.ctx) synthFold(this.ctx, d);
  }

  playCheck() {
    const d = this.dest;
    if (d && this.ctx) synthCheck(this.ctx, d);
  }

  playCall() {
    const d = this.dest;
    if (d && this.ctx) synthCall(this.ctx, d);
  }

  playRaise() {
    const d = this.dest;
    if (d && this.ctx) synthRaise(this.ctx, d);
  }

  playPhaseReveal() {
    const d = this.dest;
    if (d && this.ctx) synthPhaseReveal(this.ctx, d);
  }

  playShowdownFanfare() {
    const d = this.dest;
    if (d && this.ctx) synthShowdownFanfare(this.ctx, d);
  }

  playWinCelebration() {
    const d = this.dest;
    if (d && this.ctx) synthWinCelebration(this.ctx, d);
  }

  playTimerTick(urgency: number = 0) {
    const d = this.dest;
    if (d && this.ctx) synthTimerTick(this.ctx, d, urgency);
  }

  playTurnNotify() {
    const d = this.dest;
    if (d && this.ctx) synthTurnNotify(this.ctx, d);
  }

  startAmbient() {
    if (this.ambientHandle) return; // already playing
    const d = this.dest;
    if (d && this.ctx) {
      this.ambientHandle = synthAmbient(this.ctx, d);
    }
  }

  stopAmbient() {
    if (this.ambientHandle) {
      this.ambientHandle.stop();
      this.ambientHandle = null;
    }
  }
}

// Singleton export
export const soundEngine = new SoundEngine();

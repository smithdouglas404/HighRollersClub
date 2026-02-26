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
const BGM_URL_KEY = 'poker-bgm-url';
const BGM_VOL_KEY = 'poker-bgm-volume';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _muted: boolean = false;
  private _volume: number = 0.7;
  private ambientHandle: AmbientHandle | null = null;
  private initialized = false;
  private adaptiveMusic: AdaptiveMusicEngine | null = null;

  // BGM (background music from URL)
  private bgmAudio: HTMLAudioElement | null = null;
  private _bgmUrl: string = '';
  private _bgmVolume: number = 0.3;
  private _bgmPlaying: boolean = false;

  constructor() {
    // Restore persisted settings
    try {
      const storedMuted = localStorage.getItem(STORAGE_KEY);
      if (storedMuted !== null) this._muted = storedMuted === 'true';
      const storedVol = localStorage.getItem(VOLUME_KEY);
      if (storedVol !== null) this._volume = parseFloat(storedVol);
      const storedBgmUrl = localStorage.getItem(BGM_URL_KEY);
      if (storedBgmUrl) this._bgmUrl = storedBgmUrl;
      const storedBgmVol = localStorage.getItem(BGM_VOL_KEY);
      if (storedBgmVol !== null) this._bgmVolume = parseFloat(storedBgmVol);
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
    // Mute/unmute BGM too
    if (this.bgmAudio) {
      this.bgmAudio.volume = val ? 0 : this._bgmVolume;
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

  // All synthesized sound effects disabled — only BGM plays
  playChipClinkAt(_seatX: number, _seatScale: number) {}
  playFoldAt(_seatX: number, _seatScale: number) {}
  playCheckAt(_seatX: number, _seatScale: number) {}
  playCallAt(_seatX: number, _seatScale: number) {}
  playRaiseAt(_seatX: number, _seatScale: number) {}

  startAdaptiveMusic() {}
  stopAdaptiveMusic() {}
  setMusicState(_state: "idle" | "in_hand" | "all_in" | "showdown", _opts?: { potSize?: number; blindLevel?: number }) {}

  playCardDeal() {}
  playCardFlip() {}
  playChipClink() {}
  playChipSlide() {}
  playFold() {}
  playCheck() {}
  playCall() {}
  playRaise() {}
  playPhaseReveal() {}
  playShowdownFanfare() {}
  playWinCelebration() {}
  playTimerTick(_urgency: number = 0) {}
  playTurnNotify() {}

  startAmbient() {}
  stopAmbient() {
  }

  // --- Background Music (URL-based) ---

  get bgmUrl() { return this._bgmUrl; }
  get bgmVolume() { return this._bgmVolume; }
  get bgmPlaying() { return this._bgmPlaying; }

  setBgmUrl(url: string) {
    this._bgmUrl = url;
    try { localStorage.setItem(BGM_URL_KEY, url); } catch {}

    // If currently playing, switch to new URL
    if (this._bgmPlaying) {
      this.stopBgm();
      if (url) this.playBgm();
    }
  }

  setBgmVolume(val: number) {
    this._bgmVolume = Math.max(0, Math.min(1, val));
    if (this.bgmAudio && !this._muted) {
      this.bgmAudio.volume = this._bgmVolume;
    }
    try { localStorage.setItem(BGM_VOL_KEY, String(this._bgmVolume)); } catch {}
  }

  playBgm() {
    if (!this._bgmUrl) return;

    // Create or reuse audio element
    if (!this.bgmAudio || this.bgmAudio.src !== this._bgmUrl) {
      this.stopBgm();
      this.bgmAudio = new Audio(this._bgmUrl);
      this.bgmAudio.crossOrigin = 'anonymous';
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = this._muted ? 0 : this._bgmVolume;

      this.bgmAudio.addEventListener('error', () => {
        console.warn('BGM failed to load:', this._bgmUrl);
        this._bgmPlaying = false;
      });
    }

    this.bgmAudio.volume = this._muted ? 0 : this._bgmVolume;
    this.bgmAudio.play().then(() => {
      this._bgmPlaying = true;
    }).catch((e) => {
      console.warn('BGM play failed:', e);
      this._bgmPlaying = false;
    });
  }

  stopBgm() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.src = '';
      this.bgmAudio = null;
    }
    this._bgmPlaying = false;
  }

  toggleBgm(): boolean {
    if (this._bgmPlaying) {
      this.stopBgm();
    } else {
      this.playBgm();
    }
    return this._bgmPlaying;
  }
}

// Singleton export
export const soundEngine = new SoundEngine();

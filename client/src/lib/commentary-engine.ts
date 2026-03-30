// Commentary Audio Player — manages playback queue for two-voice AI commentary
// Independent volume/mute from game SFX. Plays segments line-by-line with
// natural pauses, and fires speaker change callbacks for subtitle UI.

const VOLUME_KEY = "poker-commentary-volume";
const MUTED_KEY = "poker-commentary-muted";

export interface CommentaryLineClient {
  speaker: "pbp" | "analyst";
  text: string;
  emphasis: "normal" | "excited" | "thoughtful";
  audioUrl: string | null;
  durationMs: number;
}

export interface CommentarySegmentClient {
  id: string;
  trigger: string;
  handNumber: number;
  lines: CommentaryLineClient[];
}

export type SpeakerChangeCallback = (
  speaker: "pbp" | "analyst" | null,
  text: string | null,
  emphasis: "normal" | "excited" | "thoughtful" | null,
) => void;

class CommentaryPlayer {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private queue: CommentarySegmentClient[] = [];
  private isPlaying = false;
  private _enabled = false;
  private _volume = 0.7;
  private _muted = false;
  private _currentSource: AudioBufferSourceNode | null = null;
  private _aborted = false;

  public onSpeakerChange: SpeakerChangeCallback | null = null;

  constructor() {
    try {
      const storedVol = localStorage.getItem(VOLUME_KEY);
      if (storedVol !== null) this._volume = parseFloat(storedVol);
      const storedMuted = localStorage.getItem(MUTED_KEY);
      if (storedMuted !== null) this._muted = storedMuted === "true";
    } catch {}
  }

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this._muted ? 0 : this._volume;
      this.gainNode.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  get enabled() { return this._enabled; }
  set enabled(v: boolean) {
    this._enabled = v;
    if (!v) {
      this.stop();
    }
  }

  get volume() { return this._volume; }
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.gainNode) {
      this.gainNode.gain.value = this._muted ? 0 : this._volume;
    }
    try { localStorage.setItem(VOLUME_KEY, String(this._volume)); } catch {}
  }

  get muted() { return this._muted; }
  set muted(v: boolean) {
    this._muted = v;
    if (this.gainNode) {
      this.gainNode.gain.value = v ? 0 : this._volume;
    }
    try { localStorage.setItem(MUTED_KEY, String(v)); } catch {}
  }

  enqueue(segment: CommentarySegmentClient) {
    if (!this._enabled) return;
    // Limit queue to avoid stacking up old commentary
    if (this.queue.length >= 3) {
      this.queue.shift();
    }
    this.queue.push(segment);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  stop() {
    this._aborted = true;
    this.queue = [];
    this.isPlaying = false;
    if (this._currentSource) {
      try { this._currentSource.stop(); } catch {}
      this._currentSource = null;
    }
    this.onSpeakerChange?.(null, null, null);
  }

  private async playNext() {
    if (this.queue.length === 0 || !this._enabled) {
      this.isPlaying = false;
      this.onSpeakerChange?.(null, null, null);
      return;
    }

    this.isPlaying = true;
    this._aborted = false;
    const segment = this.queue.shift()!;

    for (let i = 0; i < segment.lines.length; i++) {
      const line = segment.lines[i];
      if (this._aborted || !this._enabled) break;

      // Notify UI of current speaker
      this.onSpeakerChange?.(line.speaker, line.text, line.emphasis);

      // Try explicit audioUrl first, then fall back to commentary-audio endpoint
      const audioUrl = line.audioUrl || `/api/commentary-audio/${segment.id}/${i}`;
      const played = await this.tryPlayAudio(audioUrl);
      if (!played) {
        // Text-only fallback — show subtitle for estimated reading time
        const readTimeMs = Math.max(2000, line.text.length * 60);
        await this.delay(readTimeMs);
      }

      // Small pause between lines
      if (!this._aborted) {
        await this.delay(300);
      }
    }

    // Clear speaker after segment
    this.onSpeakerChange?.(null, null, null);

    // Pause between segments
    if (!this._aborted && this.queue.length > 0) {
      await this.delay(1000);
    }

    this.playNext();
  }

  /** Attempt to fetch and play audio from url. Returns true if played, false on failure. */
  private async tryPlayAudio(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) return false;
      this.ensureContext();
      if (!this.ctx || !this.gainNode) return false;
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      return new Promise<boolean>((resolve) => {
        if (this._aborted || !this.ctx || !this.gainNode) { resolve(false); return; }
        const source = this.ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.gainNode!);
        this._currentSource = source;
        source.onended = () => { this._currentSource = null; resolve(true); };
        source.start();
      });
    } catch {
      return false;
    }
  }

  private async playAudioUrl(url: string): Promise<void> {
    this.ensureContext();
    if (!this.ctx || !this.gainNode) return;

    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

      return new Promise<void>((resolve) => {
        if (this._aborted || !this.ctx || !this.gainNode) {
          resolve();
          return;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.gainNode!);
        this._currentSource = source;

        source.onended = () => {
          this._currentSource = null;
          resolve();
        };

        source.start();
      });
    } catch {
      // Audio fetch/decode failed — skip this line
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const commentaryPlayer = new CommentaryPlayer();

// Daily.co Video Manager — managed video/audio for poker tables
// Drop-in replacement for the old P2P WebRTC VideoManager.
// Same public API so VideoOverlay, Seat, and Game need minimal changes.

import DailyIframe, { type DailyCall } from "@daily-co/daily-js";

export interface PeerState {
  userId: string;
  stream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
}

export class VideoManager {
  private daily: DailyCall | null = null;
  private localStream: MediaStream | null = null;
  private remoteStreams = new Map<string, MediaStream>();
  private videoEnabled = true;
  private audioEnabled = true;
  private _recording = false;
  private listeners = new Set<() => void>();
  private userId: string = "";
  private tableId: string = "";
  private peerMediaState = new Map<string, { video: boolean; audio: boolean }>();

  // ── Public API (preserved from original) ──────────────────────────────

  async start(userId: string, tableId: string, _playerIds: string[]) {
    if (this.daily) return; // already active
    this.userId = userId;
    this.tableId = tableId;
    this.videoEnabled = true;
    this.audioEnabled = true;

    // Fetch meeting token from server
    let token: string;
    try {
      const res = await fetch(`/api/tables/${tableId}/video-token`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        console.warn("[video] Failed to get Daily token:", res.status);
        return;
      }
      const data = await res.json();
      token = data.token;
    } catch (err) {
      console.warn("[video] Token fetch error:", err);
      return;
    }

    // Create Daily call object
    this.daily = DailyIframe.createCallObject({
      videoSource: true,
      audioSource: true,
    });

    // Wire up event handlers
    this.daily.on("participant-joined", this.handleParticipantChange);
    this.daily.on("participant-updated", this.handleParticipantChange);
    this.daily.on("participant-left", this.handleParticipantChange);
    this.daily.on("track-started", this.handleTrackEvent);
    this.daily.on("track-stopped", this.handleTrackEvent);
    this.daily.on("recording-started", () => { this._recording = true; this.notifyListeners(); });
    this.daily.on("recording-stopped", () => { this._recording = false; this.notifyListeners(); });
    this.daily.on("error", (e) => console.error("[video] Daily error:", e));

    try {
      await this.daily.join({ token });

      // Cap outgoing video quality for low bandwidth
      await this.daily.updateSendSettings({
        video: { maxQuality: "low" },
      });
    } catch (err) {
      console.error("[video] Failed to join Daily room:", err);
      this.daily.destroy();
      this.daily = null;
      return;
    }

    this.rebuildLocalStream();
    this.rebuildRemoteStreams();
    this.notifyListeners();
  }

  stop() {
    if (this.daily) {
      try { this.daily.leave(); } catch {}
      try { this.daily.destroy(); } catch {}
      this.daily = null;
    }
    this.localStream = null;
    this.remoteStreams.clear();
    this.peerMediaState.clear();
    this._recording = false;
    this.notifyListeners();
  }

  toggleVideo() {
    if (!this.daily) return;
    this.videoEnabled = !this.videoEnabled;
    this.daily.setLocalVideo(this.videoEnabled);
    this.rebuildLocalStream();
    this.notifyListeners();
  }

  toggleAudio() {
    if (!this.daily) return;
    this.audioEnabled = !this.audioEnabled;
    this.daily.setLocalAudio(this.audioEnabled);
    this.notifyListeners();
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  isVideoEnabled(): boolean {
    return this.videoEnabled;
  }

  isAudioEnabled(): boolean {
    return this.audioEnabled;
  }

  getRemoteStream(userId: string): MediaStream | null {
    return this.remoteStreams.get(userId) || null;
  }

  getPeerMediaState(userId: string) {
    return this.peerMediaState.get(userId) || { video: true, audio: true };
  }

  onStateChange(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Daily manages participants automatically — these are no-ops
  addPeer(_peerId: string) {}
  removePeer(_peerId: string) {}

  // ── Recording (new) ───────────────────────────────────────────────────

  async startRecording(): Promise<boolean> {
    if (!this.daily) return false;
    try {
      await this.daily.startRecording();
      this._recording = true;
      this.notifyListeners();
      return true;
    } catch (e) {
      console.error("[video] Failed to start recording:", e);
      return false;
    }
  }

  async stopRecording(): Promise<void> {
    if (!this.daily) return;
    try {
      await this.daily.stopRecording();
    } catch {}
    this._recording = false;
    this.notifyListeners();
  }

  isRecording(): boolean {
    return this._recording;
  }

  // ── Internal helpers ──────────────────────────────────────────────────

  private rebuildLocalStream() {
    if (!this.daily) { this.localStream = null; return; }
    const local = this.daily.participants()?.local;
    if (!local) { this.localStream = null; return; }

    const tracks: MediaStreamTrack[] = [];
    if (local.videoTrack) tracks.push(local.videoTrack);
    if (local.audioTrack) tracks.push(local.audioTrack);
    this.localStream = tracks.length > 0 ? new MediaStream(tracks) : null;
  }

  private rebuildRemoteStreams() {
    if (!this.daily) return;
    const participants = this.daily.participants();
    this.remoteStreams.clear();
    this.peerMediaState.clear();

    for (const [sessionId, p] of Object.entries(participants)) {
      if (sessionId === "local") continue;
      const odPlayerId = p.user_id; // poker userId set in the meeting token
      if (!odPlayerId) continue;

      const tracks: MediaStreamTrack[] = [];
      if (p.videoTrack) tracks.push(p.videoTrack);
      if (p.audioTrack) tracks.push(p.audioTrack);

      if (tracks.length > 0) {
        this.remoteStreams.set(odPlayerId, new MediaStream(tracks));
      }
      this.peerMediaState.set(odPlayerId, {
        video: !(p.video as any)?.off,
        audio: !(p.audio as any)?.off,
      });
    }
  }

  // ── Daily event handlers ──────────────────────────────────────────────

  private handleParticipantChange = () => {
    this.rebuildLocalStream();
    this.rebuildRemoteStreams();
    this.notifyListeners();
  };

  private handleTrackEvent = () => {
    this.rebuildLocalStream();
    this.rebuildRemoteStreams();
    this.notifyListeners();
  };

  private notifyListeners() {
    this.listeners.forEach((fn) => fn());
  }
}

// Singleton
export const videoManager = new VideoManager();

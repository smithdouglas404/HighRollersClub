// WebRTC Video Manager — peer-to-peer video at the poker table
import { wsClient } from "./ws-client";

export interface PeerState {
  userId: string;
  stream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export class VideoManager {
  private peers = new Map<string, RTCPeerConnection>();
  private remoteStreams = new Map<string, MediaStream>();
  private localStream: MediaStream | null = null;
  private userId: string = "";
  private tableId: string = "";
  private videoEnabled = true;
  private audioEnabled = true;
  private listeners = new Set<() => void>();
  private signalUnsub: (() => void) | null = null;
  private toggleUnsub: (() => void) | null = null;
  private peerMediaState = new Map<string, { video: boolean; audio: boolean }>();

  async start(userId: string, tableId: string, playerIds: string[]) {
    this.userId = userId;
    this.tableId = tableId;

    // Get local media
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 160, height: 120, frameRate: 15 },
        audio: true,
      });
    } catch {
      // Camera/mic not available — continue without local stream
      console.warn("[video] Could not access camera/mic");
      this.localStream = null;
    }

    // Listen for WebRTC signals
    this.signalUnsub = wsClient.on("rtc_signal", (msg: any) => {
      this.handleSignal(msg.fromUserId, msg.signal);
    });

    this.toggleUnsub = wsClient.on("rtc_toggle", (msg: any) => {
      this.peerMediaState.set(msg.userId, { video: msg.video, audio: msg.audio });
      this.notifyListeners();
    });

    // Initiate connections to all existing players (higher ID initiates to avoid duplicates)
    for (const peerId of playerIds) {
      if (peerId === userId) continue;
      if (userId > peerId) {
        await this.createOffer(peerId);
      }
    }

    this.notifyListeners();
  }

  stop() {
    // Close all peer connections
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    this.remoteStreams.clear();
    this.peerMediaState.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    // Unsubscribe from signals
    this.signalUnsub?.();
    this.toggleUnsub?.();
    this.signalUnsub = null;
    this.toggleUnsub = null;

    this.notifyListeners();
  }

  toggleVideo() {
    this.videoEnabled = !this.videoEnabled;
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((t) => (t.enabled = this.videoEnabled));
    }
    wsClient.send({ type: "rtc_toggle", video: this.videoEnabled, audio: this.audioEnabled } as any);
    this.notifyListeners();
  }

  toggleAudio() {
    this.audioEnabled = !this.audioEnabled;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => (t.enabled = this.audioEnabled));
    }
    wsClient.send({ type: "rtc_toggle", video: this.videoEnabled, audio: this.audioEnabled } as any);
    this.notifyListeners();
  }

  getLocalStream() {
    return this.localStream;
  }

  isVideoEnabled() {
    return this.videoEnabled;
  }

  isAudioEnabled() {
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

  addPeer(peerId: string) {
    if (peerId === this.userId) return;
    if (this.peers.has(peerId)) return;
    if (this.userId > peerId) {
      this.createOffer(peerId);
    }
    // If peerId > userId, that peer will initiate
  }

  removePeer(peerId: string) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
    this.remoteStreams.delete(peerId);
    this.peerMediaState.delete(peerId);
    this.notifyListeners();
  }

  private async createOffer(peerId: string) {
    const pc = this.createPeerConnection(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsClient.send({
      type: "rtc_signal",
      targetUserId: peerId,
      signal: { type: "offer", sdp: offer.sdp },
    } as any);
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    if (this.peers.has(peerId)) {
      return this.peers.get(peerId)!;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.peers.set(peerId, pc);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsClient.send({
          type: "rtc_signal",
          targetUserId: peerId,
          signal: { type: "candidate", candidate: event.candidate },
        } as any);
      }
    };

    // Remote stream
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (stream) {
        this.remoteStreams.set(peerId, stream);
        this.notifyListeners();
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this.removePeer(peerId);
      }
    };

    return pc;
  }

  private async handleSignal(fromUserId: string, signal: any) {
    if (signal.type === "offer") {
      const pc = this.createPeerConnection(fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp: signal.sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsClient.send({
        type: "rtc_signal",
        targetUserId: fromUserId,
        signal: { type: "answer", sdp: answer.sdp },
      } as any);
    } else if (signal.type === "answer") {
      const pc = this.peers.get(fromUserId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: signal.sdp }));
      }
    } else if (signal.type === "candidate") {
      const pc = this.peers.get(fromUserId);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    }
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => fn());
  }
}

// Singleton
export const videoManager = new VideoManager();

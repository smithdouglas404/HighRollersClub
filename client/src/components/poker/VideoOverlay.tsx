// Video Overlay — camera/mic controls and video thumbnail at seats
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, VideoOff, Mic, MicOff, Camera } from "lucide-react";
import { videoManager } from "@/lib/video-manager";

// Small video thumbnail to be rendered inside/near a Seat
interface VideoThumbnailProps {
  userId: string;
  isLocal?: boolean;
  size?: number;
}

export function VideoThumbnail({ userId, isLocal = false, size = 48 }: VideoThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStream, setHasStream] = useState(false);

  useEffect(() => {
    const check = () => {
      const stream = isLocal ? videoManager.getLocalStream() : videoManager.getRemoteStream(userId);
      if (videoRef.current && stream) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
        setHasStream(true);
      } else {
        setHasStream(false);
      }
    };

    check();
    const unsub = videoManager.onStateChange(check);
    return () => { unsub(); };
  }, [userId, isLocal]);

  if (!hasStream) return null;

  return (
    <div
      className="absolute -top-1 -right-1 rounded-md overflow-hidden border border-cyan-500/30 shadow-lg z-10"
      style={{
        width: size,
        height: size * 0.75,
        background: "rgba(0,0,0,0.8)",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-cover"
        style={{ transform: isLocal ? "scaleX(-1)" : "none" }}
      />
    </div>
  );
}

// Floating control bar for camera/mic
interface VideoControlBarProps {
  heroId: string;
  tableId: string;
  playerIds: string[];
}

export function VideoControlBar({ heroId, tableId, playerIds }: VideoControlBarProps) {
  const [active, setActive] = useState(false);
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsub = videoManager.onStateChange(() => {
      setVideoOn(videoManager.isVideoEnabled());
      setAudioOn(videoManager.isAudioEnabled());
      forceUpdate((n) => n + 1);
    });
    return () => { unsub(); };
  }, []);

  const handleToggleVideo = useCallback(async () => {
    if (!active) {
      // Start video
      await videoManager.start(heroId, tableId, playerIds);
      setActive(true);
    } else {
      videoManager.toggleVideo();
    }
  }, [active, heroId, tableId, playerIds]);

  const handleToggleAudio = useCallback(() => {
    if (active) {
      videoManager.toggleAudio();
    }
  }, [active]);

  const handleStop = useCallback(() => {
    videoManager.stop();
    setActive(false);
  }, []);

  // When new players join, add them as peers
  useEffect(() => {
    if (!active) return;
    for (const pid of playerIds) {
      if (pid !== heroId) {
        videoManager.addPeer(pid);
      }
    }
  }, [active, playerIds, heroId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      videoManager.stop();
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-40 flex items-center gap-1.5">
      {/* Start/Camera toggle */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleToggleVideo}
        className={`p-2 rounded-lg backdrop-blur-xl border transition-all ${
          !active
            ? "bg-white/5 border-white/10 hover:border-cyan-500/30"
            : videoOn
            ? "bg-cyan-500/15 border-cyan-500/30"
            : "bg-red-500/15 border-red-500/30"
        }`}
        title={!active ? "Start camera" : videoOn ? "Turn off camera" : "Turn on camera"}
      >
        {!active ? (
          <Camera className="w-4 h-4 text-gray-400" />
        ) : videoOn ? (
          <Video className="w-4 h-4 text-cyan-400" />
        ) : (
          <VideoOff className="w-4 h-4 text-red-400" />
        )}
      </motion.button>

      {/* Mic toggle (only when active) */}
      <AnimatePresence>
        {active && (
          <motion.button
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleAudio}
            className={`p-2 rounded-lg backdrop-blur-xl border transition-all ${
              audioOn
                ? "bg-cyan-500/15 border-cyan-500/30"
                : "bg-red-500/15 border-red-500/30"
            }`}
            title={audioOn ? "Mute mic" : "Unmute mic"}
          >
            {audioOn ? (
              <Mic className="w-4 h-4 text-cyan-400" />
            ) : (
              <MicOff className="w-4 h-4 text-red-400" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Stop button (only when active) */}
      <AnimatePresence>
        {active && (
          <motion.button
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleStop}
            className="p-2 rounded-lg backdrop-blur-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
            title="End video call"
          >
            <VideoOff className="w-4 h-4 text-red-400" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

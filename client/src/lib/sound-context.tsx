import { createContext, useContext, useCallback, ReactNode } from 'react';
import { soundEngine } from './sound-engine';

interface SoundContextValue {
  init: () => void;
  playCardDeal: () => void;
  playCardFlip: () => void;
  playChipClink: () => void;
  playChipSlide: () => void;
  playFold: () => void;
  playCheck: () => void;
  playCall: () => void;
  playRaise: () => void;
  playPhaseReveal: () => void;
  playShowdownFanfare: () => void;
  playWinCelebration: () => void;
  playTimerTick: (urgency?: number) => void;
  playTurnNotify: () => void;
  startAmbient: () => void;
  stopAmbient: () => void;
  toggleMute: () => boolean;
  isMuted: () => boolean;
  // Spatial audio
  playChipClinkAt: (seatX: number, seatScale: number) => void;
  playFoldAt: (seatX: number, seatScale: number) => void;
  playCheckAt: (seatX: number, seatScale: number) => void;
  playCallAt: (seatX: number, seatScale: number) => void;
  playRaiseAt: (seatX: number, seatScale: number) => void;
  // Adaptive music
  startAdaptiveMusic: () => void;
  stopAdaptiveMusic: () => void;
  setMusicState: (state: "idle" | "in_hand" | "all_in" | "showdown", opts?: { potSize?: number; blindLevel?: number }) => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const value: SoundContextValue = {
    init: useCallback(() => soundEngine.init(), []),
    playCardDeal: useCallback(() => soundEngine.playCardDeal(), []),
    playCardFlip: useCallback(() => soundEngine.playCardFlip(), []),
    playChipClink: useCallback(() => soundEngine.playChipClink(), []),
    playChipSlide: useCallback(() => soundEngine.playChipSlide(), []),
    playFold: useCallback(() => soundEngine.playFold(), []),
    playCheck: useCallback(() => soundEngine.playCheck(), []),
    playCall: useCallback(() => soundEngine.playCall(), []),
    playRaise: useCallback(() => soundEngine.playRaise(), []),
    playPhaseReveal: useCallback(() => soundEngine.playPhaseReveal(), []),
    playShowdownFanfare: useCallback(() => soundEngine.playShowdownFanfare(), []),
    playWinCelebration: useCallback(() => soundEngine.playWinCelebration(), []),
    playTimerTick: useCallback((urgency?: number) => soundEngine.playTimerTick(urgency), []),
    playTurnNotify: useCallback(() => soundEngine.playTurnNotify(), []),
    startAmbient: useCallback(() => soundEngine.startAmbient(), []),
    stopAmbient: useCallback(() => soundEngine.stopAmbient(), []),
    toggleMute: useCallback(() => soundEngine.toggleMute(), []),
    isMuted: useCallback(() => soundEngine.muted, []),
    // Spatial audio
    playChipClinkAt: useCallback((seatX: number, seatScale: number) => soundEngine.playChipClinkAt(seatX, seatScale), []),
    playFoldAt: useCallback((seatX: number, seatScale: number) => soundEngine.playFoldAt(seatX, seatScale), []),
    playCheckAt: useCallback((seatX: number, seatScale: number) => soundEngine.playCheckAt(seatX, seatScale), []),
    playCallAt: useCallback((seatX: number, seatScale: number) => soundEngine.playCallAt(seatX, seatScale), []),
    playRaiseAt: useCallback((seatX: number, seatScale: number) => soundEngine.playRaiseAt(seatX, seatScale), []),
    // Adaptive music
    startAdaptiveMusic: useCallback(() => soundEngine.startAdaptiveMusic(), []),
    stopAdaptiveMusic: useCallback(() => soundEngine.stopAdaptiveMusic(), []),
    setMusicState: useCallback((state: "idle" | "in_hand" | "all_in" | "showdown", opts?: { potSize?: number; blindLevel?: number }) => soundEngine.setMusicState(state, opts), []),
  };

  return (
    <SoundContext.Provider value={value}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSoundEngine(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) {
    throw new Error('useSoundEngine must be used within a SoundProvider');
  }
  return ctx;
}

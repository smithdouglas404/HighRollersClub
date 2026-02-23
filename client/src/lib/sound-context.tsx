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

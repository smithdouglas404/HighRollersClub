import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface FeltPreset {
  id: string;
  label: string;
  gradient: string;
  spotlightOverlay: string;
  swatch: string; // CSS color for the swatch circle
}

export const FELT_PRESETS: FeltPreset[] = [
  {
    id: 'green',
    label: 'Classic Green',
    gradient: 'radial-gradient(ellipse at 50% 48%, #19723c 0%, #16592d 30%, #0f4724 55%, #0d4020 75%, #0b3c1e 100%)',
    spotlightOverlay: 'radial-gradient(ellipse 45% 40% at 50% 48%, rgba(255,255,240,0.08) 0%, transparent 60%)',
    swatch: '#19723c',
  },
  {
    id: 'midnight',
    label: 'Midnight Blue',
    gradient: 'radial-gradient(ellipse at 50% 48%, #1a3a6b 0%, #152d55 30%, #102345 55%, #0c1a38 75%, #091430 100%)',
    spotlightOverlay: 'radial-gradient(ellipse 45% 40% at 50% 48%, rgba(200,220,255,0.06) 0%, transparent 60%)',
    swatch: '#1a3a6b',
  },
  {
    id: 'charcoal',
    label: 'Charcoal Gray',
    gradient: 'radial-gradient(ellipse at 50% 48%, #3a3a3a 0%, #2e2e2e 30%, #242424 55%, #1e1e1e 75%, #181818 100%)',
    spotlightOverlay: 'radial-gradient(ellipse 45% 40% at 50% 48%, rgba(255,255,255,0.05) 0%, transparent 60%)',
    swatch: '#3a3a3a',
  },
  {
    id: 'teal',
    label: 'Dark Teal',
    gradient: 'radial-gradient(ellipse at 50% 48%, #1a5c5c 0%, #164d4d 30%, #0f3d3d 55%, #0b3333 75%, #082a2a 100%)',
    spotlightOverlay: 'radial-gradient(ellipse 45% 40% at 50% 48%, rgba(200,255,255,0.06) 0%, transparent 60%)',
    swatch: '#1a5c5c',
  },
];

interface GameUIContextValue {
  compactMode: boolean;
  toggleCompactMode: () => void;
  feltColor: string;
  setFeltColor: (id: string) => void;
  feltPreset: FeltPreset;
}

const GameUIContext = createContext<GameUIContextValue | null>(null);

function getInitialCompactMode(): boolean {
  try {
    return localStorage.getItem('poker-compact-mode') === 'true';
  } catch {
    return false;
  }
}

function getInitialFeltColor(): string {
  try {
    const stored = localStorage.getItem('poker-felt-color');
    if (stored && FELT_PRESETS.some(p => p.id === stored)) return stored;
  } catch {}
  return 'green';
}

export function GameUIProvider({ children }: { children: ReactNode }) {
  const [compactMode, setCompactMode] = useState(getInitialCompactMode);
  const [feltColor, setFeltColorState] = useState(getInitialFeltColor);

  const toggleCompactMode = useCallback(() => {
    setCompactMode(prev => {
      const next = !prev;
      try { localStorage.setItem('poker-compact-mode', String(next)); } catch {}
      return next;
    });
  }, []);

  const setFeltColor = useCallback((id: string) => {
    if (FELT_PRESETS.some(p => p.id === id)) {
      setFeltColorState(id);
      try { localStorage.setItem('poker-felt-color', id); } catch {}
    }
  }, []);

  const feltPreset = FELT_PRESETS.find(p => p.id === feltColor) || FELT_PRESETS[0];

  return (
    <GameUIContext.Provider value={{ compactMode, toggleCompactMode, feltColor, setFeltColor, feltPreset }}>
      {children}
    </GameUIContext.Provider>
  );
}

export function useGameUI(): GameUIContextValue {
  const ctx = useContext(GameUIContext);
  if (!ctx) {
    throw new Error('useGameUI must be used within a GameUIProvider');
  }
  return ctx;
}

import { useState, useCallback, useEffect, useRef } from "react";

interface CardType {
  suit: string;
  rank: string;
}

interface HandAction {
  playerId: string;
  action: string;
  amount?: number;
  phase: string;
}

interface HandPlayer {
  id: string;
  displayName: string;
  startChips: number;
  seatIndex: number;
}

interface ShowdownResult {
  playerId: string;
  handName: string;
  cards?: CardType[];
  isWinner: boolean;
  winAmount?: number;
}

interface HandSummary {
  handNumber: number;
  players: HandPlayer[];
  actions: HandAction[];
  communityCards: CardType[];
  pot: number;
  winners: { playerId: string; amount: number }[];
  showdownResults?: ShowdownResult[];
}

export interface ReplayPlayer {
  id: string;
  displayName: string;
  seatIndex: number;
  chips: number;
  currentBet: number;
  isFolded: boolean;
  isAllIn: boolean;
  holeCards: CardType[] | null;
}

export interface ReplaySnapshot {
  actionIndex: number;
  totalActions: number;
  currentPhase: string;
  communityCards: CardType[];
  pot: number;
  players: ReplayPlayer[];
  currentAction: HandAction | null;
  activePlayerId: string | null;
  isPlaying: boolean;
  speed: number;
  streetMarkers: { label: string; actionIndex: number }[];
}

const PHASE_CARDS: Record<string, number> = {
  "pre-flop": 0,
  flop: 3,
  turn: 4,
  river: 5,
  showdown: 5,
};

const PHASE_ORDER = ["pre-flop", "flop", "turn", "river", "showdown"];

function computeSnapshot(
  summary: HandSummary,
  actionIndex: number,
  speed: number,
  isPlaying: boolean,
): ReplaySnapshot {
  const actions = summary.actions;
  const totalActions = actions.length;

  // Initialize players
  const playerStates = new Map<string, ReplayPlayer>();
  for (const p of summary.players) {
    playerStates.set(p.id, {
      id: p.id,
      displayName: p.displayName,
      seatIndex: p.seatIndex,
      chips: p.startChips,
      currentBet: 0,
      isFolded: false,
      isAllIn: false,
      holeCards: null,
    });
  }

  let pot = 0;
  let currentPhase = "pre-flop";
  let lastPhase = "pre-flop";

  // Walk actions from 0..actionIndex
  for (let i = 0; i <= actionIndex && i < totalActions; i++) {
    const a = actions[i];
    const ps = playerStates.get(a.playerId);
    if (!ps) continue;

    // Phase transition — collect bets into pot
    if (a.phase !== lastPhase) {
      for (const [, p] of playerStates) {
        pot += p.currentBet;
        p.currentBet = 0;
      }
      lastPhase = a.phase;
    }
    currentPhase = a.phase;

    const amount = a.amount || 0;

    switch (a.action) {
      case "fold":
        ps.isFolded = true;
        break;
      case "check":
        break;
      case "call":
      case "bet":
      case "raise":
      case "post-sb":
      case "post-bb":
        ps.chips -= amount;
        ps.currentBet += amount;
        break;
      case "all-in":
        ps.currentBet += ps.chips;
        ps.chips = 0;
        ps.isAllIn = true;
        break;
    }
  }

  // Collect remaining bets into pot
  for (const [, p] of playerStates) {
    pot += p.currentBet;
  }

  // Community cards based on current phase
  const phaseCardCount = PHASE_CARDS[currentPhase] ?? 0;
  const communityCards = summary.communityCards.slice(0, phaseCardCount);

  // Reveal hole cards at showdown
  const isShowdown = currentPhase === "showdown" || actionIndex >= totalActions - 1;
  if (isShowdown && summary.showdownResults) {
    for (const sr of summary.showdownResults) {
      const ps = playerStates.get(sr.playerId);
      if (ps && sr.cards) {
        ps.holeCards = sr.cards;
      }
    }
  }

  // Current action
  const currentAction = actionIndex >= 0 && actionIndex < totalActions ? actions[actionIndex] : null;
  const activePlayerId = currentAction?.playerId ?? null;

  // Compute street markers
  const streetMarkers: { label: string; actionIndex: number }[] = [];
  let seenPhases = new Set<string>();
  for (let i = 0; i < totalActions; i++) {
    const phase = actions[i].phase;
    if (!seenPhases.has(phase)) {
      seenPhases.add(phase);
      const label = phase === "pre-flop" ? "Pre-Flop" : phase.charAt(0).toUpperCase() + phase.slice(1);
      streetMarkers.push({ label, actionIndex: i });
    }
  }

  return {
    actionIndex,
    totalActions,
    currentPhase,
    communityCards,
    pot,
    players: Array.from(playerStates.values()),
    currentAction,
    activePlayerId,
    isPlaying,
    speed,
    streetMarkers,
  };
}

export function useHandReplayState(summary: HandSummary | null) {
  const [actionIndex, setActionIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const totalActions = summary?.actions.length ?? 0;

  // Playback
  useEffect(() => {
    if (!isPlaying || !summary) return;
    intervalRef.current = setInterval(() => {
      setActionIndex(prev => {
        if (prev >= totalActions - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / speed);
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, speed, totalActions, summary]);

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    setActionIndex(prev => Math.min(prev + 1, totalActions - 1));
  }, [totalActions]);

  const stepBackward = useCallback(() => {
    setIsPlaying(false);
    setActionIndex(prev => Math.max(prev - 1, -1));
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => {
      if (!prev && actionIndex >= totalActions - 1) {
        // Reset to start if at end
        setActionIndex(-1);
      }
      return !prev;
    });
  }, [actionIndex, totalActions]);

  const goToAction = useCallback((idx: number) => {
    setIsPlaying(false);
    setActionIndex(Math.max(-1, Math.min(idx, totalActions - 1)));
  }, [totalActions]);

  const cycleSpeed = useCallback(() => {
    setSpeed(prev => {
      if (prev === 1) return 2;
      if (prev === 2) return 4;
      return 1;
    });
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); stepForward(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); stepBackward(); }
      else if (e.key === " ") { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stepForward, stepBackward, togglePlay]);

  // Compute snapshot
  const snapshot: ReplaySnapshot | null = summary
    ? computeSnapshot(summary, actionIndex, speed, isPlaying)
    : null;

  return {
    snapshot,
    stepForward,
    stepBackward,
    togglePlay,
    goToAction,
    cycleSpeed,
    setSpeed,
  };
}

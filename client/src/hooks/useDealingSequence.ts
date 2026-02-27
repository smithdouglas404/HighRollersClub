import { useState, useEffect, useRef, useCallback } from "react";
import type { Player, GameState } from "@/lib/poker-types";
import { soundEngine } from "@/lib/sound-engine";

export type DealPhase =
  | "idle"
  | "dealer-move"
  | "posting-blinds"
  | "dealing-round-1"
  | "dealing-round-2"
  | "pause"
  | "ready"
  | "community-burn"
  | "community-deal"
  | "community-flip";

export interface DealingState {
  /** How many cards each player should visually show (0, 1, or 2) */
  visiblePlayerCards: Map<string, number>;
  /** How many community cards are visually present */
  visibleCommunityCards: number;
  /** Whether community cards have flipped face-up */
  communityFlipped: boolean;
  /** Current dealing phase */
  dealPhase: DealPhase;
  /** Whether controls should be enabled */
  controlsReady: boolean;
  /** Show burn card visual */
  showBurnCard: boolean;
}

const INITIAL_STATE: DealingState = {
  visiblePlayerCards: new Map(),
  visibleCommunityCards: 0,
  communityFlipped: true,
  dealPhase: "ready",
  controlsReady: true,
  showBurnCard: false,
};

/**
 * Client-side dealing animation orchestrator.
 * Layers visual dealing sequence on top of server state.
 * The server deals all cards at once; this hook staggers the visual presentation.
 */
export function useDealingSequence(
  players: Player[],
  gameState: GameState,
  heroId: string,
  compactMode: boolean = false,
  speedMultiplier: number = 1.0,
): DealingState {
  const [state, setState] = useState<DealingState>(INITIAL_STATE);
  const prevHandNumber = useRef<number | undefined>(undefined);
  const prevPhase = useRef<string>(gameState.phase);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clear all pending timers
  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const t = setTimeout(fn, delay);
    timersRef.current.push(t);
    return t;
  }, []);

  // Get dealing order: clockwise from left of dealer
  const getDealOrder = useCallback((): string[] => {
    const dealerIdx = players.findIndex(p => p.isDealer);
    if (dealerIdx < 0) return players.map(p => p.id);
    const order: string[] = [];
    for (let i = 1; i <= players.length; i++) {
      const idx = (dealerIdx + i) % players.length;
      const p = players[idx];
      if (p.isActive && p.status !== "folded") {
        order.push(p.id);
      }
    }
    return order;
  }, [players]);

  // === HAND START: Trigger dealing sequence when handNumber changes ===
  useEffect(() => {
    const currentHand = gameState.handNumber;
    if (currentHand === undefined || currentHand === prevHandNumber.current) return;
    if (prevHandNumber.current === undefined) {
      // First hand — no animation needed for the initial load
      prevHandNumber.current = currentHand;
      // Still show all cards immediately
      const allVisible = new Map<string, number>();
      players.forEach(p => allVisible.set(p.id, 2));
      setState({
        ...INITIAL_STATE,
        visiblePlayerCards: allVisible,
        visibleCommunityCards: gameState.communityCards.length,
        communityFlipped: true,
      });
      return;
    }

    prevHandNumber.current = currentHand;
    clearTimers();

    // Compact mode: skip all animation
    if (compactMode) {
      const allVisible = new Map<string, number>();
      players.forEach(p => allVisible.set(p.id, 2));
      setState({
        visiblePlayerCards: allVisible,
        visibleCommunityCards: gameState.communityCards.length,
        communityFlipped: true,
        dealPhase: "ready",
        controlsReady: true,
        showBurnCard: false,
      });
      return;
    }

    const dealOrder = getDealOrder();
    const s = speedMultiplier; // scale factor for animations
    const DEAL_INTERVAL = 100 * s; // ms per card per player

    // Phase 1: Dealer move
    setState(prev => ({
      ...prev,
      visiblePlayerCards: new Map(players.map(p => [p.id, 0])),
      visibleCommunityCards: 0,
      communityFlipped: true,
      dealPhase: "dealer-move",
      controlsReady: false,
      showBurnCard: false,
    }));

    let elapsed = 250 * s; // dealer move time

    // Phase 2: Posting blinds (with chip sound)
    schedule(() => {
      soundEngine.playChipClink();
      setState(prev => ({ ...prev, dealPhase: "posting-blinds" }));
    }, elapsed);
    elapsed += 350 * s;

    // Phase 3: Dealing round 1 (one card each, clockwise)
    schedule(() => {
      setState(prev => ({ ...prev, dealPhase: "dealing-round-1" }));
    }, elapsed);

    for (let i = 0; i < dealOrder.length; i++) {
      const playerId = dealOrder[i];
      const delay = elapsed + i * DEAL_INTERVAL;
      schedule(() => {
        soundEngine.playCardDeal();
        setState(prev => {
          const newMap = new Map(prev.visiblePlayerCards);
          newMap.set(playerId, 1);
          return { ...prev, visiblePlayerCards: newMap };
        });
      }, delay);
    }
    elapsed += dealOrder.length * DEAL_INTERVAL + 80 * s;

    // Phase 4: Dealing round 2 (second card each, clockwise)
    schedule(() => {
      setState(prev => ({ ...prev, dealPhase: "dealing-round-2" }));
    }, elapsed);

    for (let i = 0; i < dealOrder.length; i++) {
      const playerId = dealOrder[i];
      const delay = elapsed + i * DEAL_INTERVAL;
      schedule(() => {
        soundEngine.playCardDeal();
        setState(prev => {
          const newMap = new Map(prev.visiblePlayerCards);
          newMap.set(playerId, 2);
          return { ...prev, visiblePlayerCards: newMap };
        });
      }, delay);
    }
    elapsed += dealOrder.length * DEAL_INTERVAL + 150 * s;

    // Phase 5: Ready
    schedule(() => {
      setState(prev => ({
        ...prev,
        dealPhase: "ready",
        controlsReady: true,
      }));
    }, elapsed);

  }, [gameState.handNumber, compactMode, speedMultiplier, clearTimers, schedule, getDealOrder, players]);

  // === COMMUNITY CARD REVEALS: Trigger on phase change ===
  useEffect(() => {
    const phase = gameState.phase;
    if (phase === prevPhase.current) return;
    const prevP = prevPhase.current;
    prevPhase.current = phase;

    if (compactMode) {
      setState(prev => ({
        ...prev,
        visibleCommunityCards: gameState.communityCards.length,
        communityFlipped: true,
        dealPhase: "ready",
        controlsReady: true,
        showBurnCard: false,
      }));
      return;
    }

    const s = speedMultiplier;

    // Flop: pre-flop → flop
    if (prevP === "pre-flop" && phase === "flop") {
      clearTimers();
      let elapsed = 0;

      // Burn card
      soundEngine.playCardDeal();
      setState(prev => ({
        ...prev,
        dealPhase: "community-burn",
        showBurnCard: true,
        controlsReady: false,
      }));
      elapsed += 300 * s;

      // Deal 3 cards face-down
      schedule(() => {
        soundEngine.playPhaseReveal();
        setState(prev => ({
          ...prev,
          dealPhase: "community-deal",
          showBurnCard: false,
          visibleCommunityCards: 3,
          communityFlipped: false,
        }));
      }, elapsed);
      elapsed += 400 * s;

      // Flip them face-up
      schedule(() => {
        setState(prev => ({
          ...prev,
          dealPhase: "community-flip",
          communityFlipped: true,
        }));
      }, elapsed);
      elapsed += 600 * s;

      // Ready
      schedule(() => {
        setState(prev => ({
          ...prev,
          dealPhase: "ready",
          controlsReady: true,
        }));
      }, elapsed);
    }

    // Turn: flop → turn
    if (prevP === "flop" && phase === "turn") {
      clearTimers();
      let elapsed = 0;

      soundEngine.playCardDeal();
      setState(prev => ({
        ...prev,
        dealPhase: "community-burn",
        showBurnCard: true,
        controlsReady: false,
      }));
      elapsed += 300 * s;

      schedule(() => {
        soundEngine.playPhaseReveal();
        setState(prev => ({
          ...prev,
          dealPhase: "community-deal",
          showBurnCard: false,
          visibleCommunityCards: 4,
          communityFlipped: false,
        }));
      }, elapsed);
      elapsed += 300 * s;

      schedule(() => {
        setState(prev => ({
          ...prev,
          dealPhase: "community-flip",
          communityFlipped: true,
        }));
      }, elapsed);
      elapsed += 400 * s;

      schedule(() => {
        setState(prev => ({
          ...prev,
          dealPhase: "ready",
          controlsReady: true,
        }));
      }, elapsed);
    }

    // River: turn → river
    if (prevP === "turn" && phase === "river") {
      clearTimers();
      let elapsed = 0;

      soundEngine.playCardDeal();
      setState(prev => ({
        ...prev,
        dealPhase: "community-burn",
        showBurnCard: true,
        controlsReady: false,
      }));
      elapsed += 300 * s;

      schedule(() => {
        soundEngine.playPhaseReveal();
        setState(prev => ({
          ...prev,
          dealPhase: "community-deal",
          showBurnCard: false,
          visibleCommunityCards: 5,
          communityFlipped: false,
        }));
      }, elapsed);
      elapsed += 300 * s;

      schedule(() => {
        setState(prev => ({
          ...prev,
          dealPhase: "community-flip",
          communityFlipped: true,
        }));
      }, elapsed);
      elapsed += 400 * s;

      schedule(() => {
        setState(prev => ({
          ...prev,
          dealPhase: "ready",
          controlsReady: true,
        }));
      }, elapsed);
    }

    // Showdown — reveal everything
    if (phase === "showdown") {
      clearTimers();
      const allVisible = new Map<string, number>();
      players.forEach(p => allVisible.set(p.id, 2));
      setState({
        visiblePlayerCards: allVisible,
        visibleCommunityCards: gameState.communityCards.length,
        communityFlipped: true,
        dealPhase: "ready",
        controlsReady: true,
        showBurnCard: false,
      });
    }
  }, [gameState.phase, gameState.communityCards.length, compactMode, speedMultiplier, clearTimers, schedule, players]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return state;
}

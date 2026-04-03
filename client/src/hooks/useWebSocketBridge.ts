import { useEffect } from "react";
import { useGameStore, type PlayerState } from "@/store/useGameStore";
import { useSceneStore } from "@/store/useSceneStore";
import type { Player, GameState, CardType } from "@/lib/poker-types";

/**
 * Migration plan Phase 2 — WebSocket → Zustand bridge.
 * One-way sync: reads from useMultiplayerGame() output, writes to Zustand stores.
 * Scene never writes back to WS directly.
 */

interface BridgeInput {
  players: Player[];
  gameState: GameState;
  showdown: any;
}

/**
 * Map existing Player type to blueprint PlayerState
 */
function toPlayerState(player: Player, index: number): PlayerState {
  let status: PlayerState["status"] = "active";
  if (player.status === "folded") status = "folded";
  else if (player.status === "all-in") status = "all-in";
  else if (player.status === "sitting-out" || player.isSittingOut) status = "out";

  return {
    id: player.id,
    seatIndex: index,
    displayName: player.name,
    avatar: player.avatar || "",
    stackStart: player.chips,
    stackCurrent: player.chips,
    holeCards: player.cards ? [...player.cards] : [],
    status,
    result: "neutral",
    amountDelta: 0,
    handLabel: "",
  };
}

export function useWebSocketBridge({ players, gameState, showdown }: BridgeInput) {
  const setPlayers = useGameStore((s) => s.setPlayers);
  const setPot = useGameStore((s) => s.setPot);
  const setBoardCards = useGameStore((s) => s.setBoardCards);
  const setPhase = useGameStore((s) => s.setPhase);
  const setCurrentTurnSeat = useGameStore((s) => s.setCurrentTurnSeat);
  const setDealerSeat = useGameStore((s) => s.setDealerSeat);
  const updatePlayer = useGameStore((s) => s.updatePlayer);

  // Sync players
  useEffect(() => {
    const mapped = players.map((p, i) => toPlayerState(p, i));
    setPlayers(mapped);
  }, [players, setPlayers]);

  // Sync game state
  useEffect(() => {
    setPot(gameState.pot);
    setBoardCards(gameState.communityCards);
    setPhase(gameState.phase);

    // Find current turn seat index
    const turnIdx = players.findIndex((p) => p.id === gameState.currentTurnPlayerId);
    setCurrentTurnSeat(turnIdx);

    // Find dealer seat index
    const dealerIdx = players.findIndex((p) => p.id === gameState.dealerId);
    setDealerSeat(dealerIdx);
  }, [gameState, players, setPot, setBoardCards, setPhase, setCurrentTurnSeat, setDealerSeat]);

  // Sync showdown results → update player results
  useEffect(() => {
    if (!showdown?.results) return;
    for (const result of showdown.results) {
      updatePlayer(result.playerId, {
        result: result.isWinner ? "win" : "loss",
        amountDelta: result.isWinner ? result.amount || 0 : -(result.amount || 0),
        handLabel: result.handName || "",
      });
    }
  }, [showdown, updatePlayer]);
}

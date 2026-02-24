import { useState, useEffect, useCallback, useRef } from "react";
import { wsClient } from "./ws-client";
import type { Player, GameState, CardType } from "./poker-types";
import type { PlayerResult } from "./hand-evaluator";
import type { ShowdownData } from "./game-engine";

// Convert server state to client-compatible format
function serverToClientPlayers(serverPlayers: any[]): Player[] {
  return serverPlayers.map((p) => ({
    id: p.id,
    name: p.displayName,
    chips: p.chips,
    avatar: undefined,
    cards: p.cards
      ? p.cards.map((c: any) =>
          c.hidden ? { suit: "spades" as const, rank: "A" as const, hidden: true } : c
        )
      : undefined,
    isActive: p.status !== "folded" && p.status !== "sitting-out",
    isDealer: p.isDealer || false,
    isSmallBlind: p.isSmallBlind || false,
    isBigBlind: p.isBigBlind || false,
    currentBet: p.currentBet || 0,
    status: p.status || "waiting",
    timeLeft: p.status === "thinking" ? 100 : undefined,
  }));
}

function serverToClientGameState(serverState: any): GameState {
  return {
    pot: serverState.pot || 0,
    communityCards: serverState.communityCards || [],
    currentTurnPlayerId: serverState.players?.find(
      (p: any) => p.seatIndex === serverState.currentTurnSeat
    )?.id || "",
    dealerId: serverState.players?.find(
      (p: any) => p.seatIndex === serverState.dealerSeat
    )?.id || "",
    phase: serverState.phase === "waiting" ? "pre-flop" : serverState.phase,
    minBet: serverState.minBet || 0,
    dealingPhase: "dealt",
  };
}

export type VerificationStatus = "pending" | "verifying" | "verified" | "failed" | null;
export type PlayerSeedStatus = "idle" | "committed" | "revealed";

export function useMultiplayerGame(tableId: string, userId: string) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameState>({
    pot: 0,
    communityCards: [],
    currentTurnPlayerId: "",
    dealerId: "",
    phase: "pre-flop",
    minBet: 0,
    dealingPhase: "idle",
  });
  const [showdown, setShowdown] = useState<ShowdownData | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(true);
  const [commitmentHash, setCommitmentHash] = useState<string | null>(null);
  const [shuffleProof, setShuffleProof] = useState<any>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(null);
  const [playerSeedStatus, setPlayerSeedStatus] = useState<PlayerSeedStatus>("idle");
  const [onChainCommitTx, setOnChainCommitTx] = useState<string | null>(null);
  const [onChainRevealTx, setOnChainRevealTx] = useState<string | null>(null);
  const joinedRef = useRef(false);
  const localSeedRef = useRef<string | null>(null);

  // Connect WebSocket and set up handlers
  useEffect(() => {
    wsClient.connect();

    const unsubs: (() => void)[] = [];

    unsubs.push(
      wsClient.on("_connected", () => {
        setConnected(true);
        setError(null);
      })
    );

    unsubs.push(
      wsClient.on("_disconnected", () => {
        setConnected(false);
      })
    );

    unsubs.push(
      wsClient.on("game_state", (msg: any) => {
        const state = msg.state;
        if (!state) return;

        setPlayers(serverToClientPlayers(state.players || []));
        setGameState(serverToClientGameState(state));
        setWaiting(state.phase === "waiting" || state.phase === "collecting-seeds");

        // Capture commitment hash
        if (state.commitmentHash) {
          setCommitmentHash(state.commitmentHash);
        }

        if (state.phase === "showdown" && state.showdownResults) {
          setShowdown({
            results: state.showdownResults,
            winnerIds: state.showdownResults
              .filter((r: PlayerResult) => r.isWinner)
              .map((r: PlayerResult) => r.playerId),
            pot: state.pot,
          });

          // Capture shuffle proof at showdown and auto-verify
          if (state.shuffleProof) {
            setShuffleProof(state.shuffleProof);
            setVerificationStatus("verifying");

            // Send seed reveal if we committed one
            if (localSeedRef.current) {
              wsClient.send({ type: "seed_reveal", seed: localSeedRef.current });
              setPlayerSeedStatus("revealed");
            }

            import("@shared/crypto-verify").then(({ verifyShuffleProof }) => {
              verifyShuffleProof(state.shuffleProof).then((result) => {
                setVerificationStatus(result.valid ? "verified" : "failed");
              }).catch(() => {
                setVerificationStatus("failed");
              });
            }).catch(() => {
              setVerificationStatus("failed");
            });
          }
        } else {
          setShowdown(null);
          if (state.phase !== "showdown") {
            // Reset proof on new hand, keep commitment
            if (state.phase === "pre-flop" || state.phase === "collecting-seeds") {
              setShuffleProof(null);
              setVerificationStatus("pending");
              setPlayerSeedStatus("idle");
              setOnChainCommitTx(null);
              setOnChainRevealTx(null);
              localSeedRef.current = null;
            }
          }
        }
      })
    );

    // Handle seed request — auto-generate and commit
    unsubs.push(
      wsClient.on("seed_request", (_msg: any) => {
        // Generate 32-byte random seed
        const seedBytes = new Uint8Array(32);
        crypto.getRandomValues(seedBytes);
        const seedHex = Array.from(seedBytes).map(b => b.toString(16).padStart(2, "0")).join("");
        localSeedRef.current = seedHex;

        // Compute SHA-256 commitment hash
        crypto.subtle.digest("SHA-256", new TextEncoder().encode(seedHex)).then(hashBuf => {
          const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
          wsClient.send({ type: "seed_commit", commitmentHash: hashHex });
          setPlayerSeedStatus("committed");
        }).catch(() => {});
      })
    );

    // Handle on-chain proof TX hashes
    unsubs.push(
      wsClient.on("onchain_proof", (msg: any) => {
        if (msg.commitTx) setOnChainCommitTx(msg.commitTx);
        if (msg.revealTx) setOnChainRevealTx(msg.revealTx);
      })
    );

    unsubs.push(
      wsClient.on("error", (msg: any) => {
        setError(msg.message);
        setTimeout(() => setError(null), 5000);
      })
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  // Handle actions
  const handlePlayerAction = useCallback(
    (action: string, amount?: number) => {
      wsClient.send({
        type: "player_action",
        action,
        amount,
      });
    },
    []
  );

  // Join table
  const joinTable = useCallback(
    (buyIn: number, seatIndex?: number) => {
      if (joinedRef.current) return;
      joinedRef.current = true;
      wsClient.send({
        type: "join_table",
        tableId,
        buyIn,
        seatIndex,
      });
    },
    [tableId]
  );

  // Leave table
  const leaveTable = useCallback(() => {
    wsClient.send({ type: "leave_table" });
    joinedRef.current = false;
  }, []);

  // Add bots
  const addBots = useCallback(() => {
    wsClient.send({ type: "add_bots" });
  }, []);

  // Send chat
  const sendChat = useCallback((message: string) => {
    wsClient.send({ type: "chat", message });
  }, []);

  return {
    players,
    gameState,
    handlePlayerAction,
    showdown,
    dismissShowdown: () => setShowdown(null),
    connected,
    error,
    waiting,
    joinTable,
    leaveTable,
    addBots,
    sendChat,
    commitmentHash,
    shuffleProof,
    verificationStatus,
    playerSeedStatus,
    onChainCommitTx,
    onChainRevealTx,
  };
}

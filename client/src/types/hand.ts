import type { CardType } from "@/lib/poker-types";
import type { ReplayAction } from "./replay";

/**
 * Blueprint Section 8 — Hand payload shape
 */

export interface HandReplayData {
  handId: string;
  timestampUtc: string;
  pot: number;
  table: {
    maxSeats: number;
    gameType: string;
    blinds?: { small: number; big: number };
  };
  players: PlayerSnapshot[];
  board: {
    flop: CardType[];
    turn?: CardType;
    river?: CardType;
  };
  actions: ReplayAction[];
  winners: WinnerState[];
  verification: {
    status: "verified" | "pending" | "failed";
    hash: string;
    network?: string;
    explorerUrl?: string;
  };
}

export interface PlayerSnapshot {
  id: string;
  seatIndex: number;
  displayName: string;
  avatar: string;
  stackStart: number;
  stackEnd: number;
  holeCards: CardType[];
  result: "win" | "loss" | "neutral";
  amountDelta: number;
  handLabel: string;
}

export interface WinnerState {
  playerId: string;
  seatIndex: number;
  amount: number;
  handLabel: string;
}

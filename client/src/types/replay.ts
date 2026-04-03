import type { CardType } from "@/lib/poker-types";

/**
 * Blueprint Section 8 — Replay action shape
 */

export interface ReplayAction {
  id: string;
  street: "pre-flop" | "flop" | "turn" | "river" | "showdown";
  actorSeat: number;
  type:
    | "post_blind"
    | "check"
    | "call"
    | "bet"
    | "raise"
    | "fold"
    | "reveal"
    | "win";
  amount?: number;
  potAfter?: number;
  targetSeat?: number;
  cards?: CardType[];
  timestampOffsetMs?: number;
}

export interface ReplayState {
  isPlaying: boolean;
  speed: number;
  currentStep: number;
  currentStreet: "pre-flop" | "flop" | "turn" | "river" | "showdown";
  focusedSeat: number;
  focusedEntity: string;
  timelineStatus: "idle" | "playing" | "paused" | "complete";
}

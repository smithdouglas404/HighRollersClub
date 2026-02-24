import { GameEngine } from "./engine";
import { evaluateHand } from "./hand-evaluator";
import type { CardType, Rank } from "./hand-evaluator";
import { encodeCard, evaluate5Fast, evaluate7Fast } from "./fast-evaluator";

// Numeric rank values for pre-flop heuristics
const RANK_NUM: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
};

/**
 * Simple pre-flop hand strength heuristic (returns 0-1).
 * Considers pocket pairs, high cards, suitedness, and connectedness.
 */
function preflopEquity(cards: CardType[]): number {
  if (cards.length < 2) return 0.3;

  const r1 = RANK_NUM[cards[0].rank];
  const r2 = RANK_NUM[cards[1].rank];
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const suited = cards[0].suit === cards[1].suit;
  const gap = high - low;
  const isPair = r1 === r2;

  if (isPair) {
    // Pocket pairs: AA=0.95, KK=0.90, ..., 22=0.50
    return 0.50 + (low - 2) * (0.45 / 12);
  }

  // Base score from high card rank (A high = strong)
  let score = (high - 2) / 12 * 0.50; // 0 to 0.50

  // Bonus for second card being high
  score += (low - 2) / 12 * 0.20; // 0 to 0.20

  // Suitedness bonus
  if (suited) score += 0.06;

  // Connectedness bonus (smaller gap = better)
  if (gap <= 1) score += 0.06;
  else if (gap <= 2) score += 0.04;
  else if (gap <= 3) score += 0.02;

  // Premium combos get extra boost
  if (high >= 13 && low >= 10) score += 0.08; // Broadway cards
  if (high === 14 && low >= 10) score += 0.04; // Ax suited/connected

  return Math.min(score, 0.95);
}

export class BotPlayer {
  public id: string;
  public name: string;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  act(engine: GameEngine) {
    const player = engine.getPlayer(this.id);
    if (!player || !player.cards) return;
    if (player.seatIndex !== engine.state.currentTurnSeat) return;
    if (player.status !== "thinking") return;

    const communityCards = engine.state.communityCards;
    const totalCards = player.cards.length + communityCards.length;
    const pot = engine.state.pot;
    const toCall = engine.state.minBet - player.currentBet;
    const chips = player.chips;
    const roll = Math.random();

    // ── Compute hand equity (0-1 scale) ──────────────────────────────────────
    let equity: number;

    if (totalCards >= 7) {
      // River (7 cards): use fast 7-card evaluator for fine-grained score
      const allCards = [...player.cards, ...communityCards];
      const encoded = allCards.map(encodeCard);
      const score = evaluate7Fast(encoded);
      equity = score / 7462;
    } else if (totalCards === 6) {
      // Turn (6 cards): evaluate all C(6,5)=6 five-card combos, take the best
      const allCards = [...player.cards, ...communityCards];
      const encoded = allCards.map(encodeCard);
      let best = 0;
      for (let skip = 0; skip < 6; skip++) {
        const hand5 = encoded.filter((_, i) => i !== skip);
        const score = evaluate5Fast(hand5[0], hand5[1], hand5[2], hand5[3], hand5[4]);
        if (score > best) best = score;
      }
      equity = best / 7462;
    } else if (totalCards === 5) {
      // Flop (5 cards): evaluate the single 5-card hand directly
      const allCards = [...player.cards, ...communityCards];
      const encoded = allCards.map(encodeCard);
      const score = evaluate5Fast(encoded[0], encoded[1], encoded[2], encoded[3], encoded[4]);
      equity = score / 7462;
    } else {
      // Pre-flop: use heuristic based on hole card ranks
      equity = preflopEquity(player.cards);
    }

    // ── Make decisions based on equity ───────────────────────────────────────
    if (toCall > 0) {
      // Facing a bet
      const potOdds = toCall / (pot + toCall);
      const betRelativeToChips = toCall / chips;

      if (equity > 0.85) {
        // Premium hand: always raise big
        const raiseAmount = Math.min(
          Math.floor(engine.state.minBet * 3),
          chips + player.currentBet
        );
        engine.handleAction(this.id, "raise", raiseAmount);
      } else if (equity > 0.65) {
        // Strong hand: raise or call
        if (roll > 0.35) {
          const raiseAmount = Math.min(
            Math.floor(engine.state.minBet * 2.5),
            chips + player.currentBet
          );
          engine.handleAction(this.id, "raise", raiseAmount);
        } else {
          engine.handleAction(this.id, "call");
        }
      } else if (equity > 0.45) {
        // Medium hand: call if pot odds are reasonable
        if (potOdds < equity) {
          // Pot odds justify a call
          if (roll > 0.8) {
            const raiseAmount = Math.min(
              Math.floor(engine.state.minBet * 2),
              chips + player.currentBet
            );
            engine.handleAction(this.id, "raise", raiseAmount);
          } else {
            engine.handleAction(this.id, "call");
          }
        } else if (roll > 0.7) {
          // Semi-bluff call
          engine.handleAction(this.id, "call");
        } else {
          engine.handleAction(this.id, "fold");
        }
      } else if (equity > 0.25) {
        // Speculative: call small bets, fold to big raises
        if (betRelativeToChips < 0.15 && roll > 0.4) {
          engine.handleAction(this.id, "call");
        } else if (roll > 0.88) {
          // Rare bluff raise
          const raiseAmount = Math.min(
            Math.floor(engine.state.minBet * 2),
            chips + player.currentBet
          );
          engine.handleAction(this.id, "raise", raiseAmount);
        } else {
          engine.handleAction(this.id, "fold");
        }
      } else {
        // Weak hand: fold to any bet, bluff rarely
        if (roll > 0.93) {
          // Bluff call
          engine.handleAction(this.id, "call");
        } else if (roll > 0.97) {
          // Bluff raise (very rare)
          const raiseAmount = Math.min(
            Math.floor(engine.state.minBet * 2.5),
            chips + player.currentBet
          );
          engine.handleAction(this.id, "raise", raiseAmount);
        } else {
          engine.handleAction(this.id, "fold");
        }
      }
    } else {
      // No bet to match — check or bet
      if (equity > 0.85) {
        // Premium: bet big for value
        const betSize = Math.min(Math.floor(pot * 0.75), chips);
        if (betSize >= engine.state.minRaise) {
          engine.handleAction(this.id, "raise", betSize);
        } else {
          engine.handleAction(this.id, "check");
        }
      } else if (equity > 0.65) {
        // Strong: bet for value most of the time
        if (roll > 0.25) {
          const betSize = Math.min(Math.floor(pot * 0.6), chips);
          if (betSize >= engine.state.minRaise) {
            engine.handleAction(this.id, "raise", betSize);
          } else {
            engine.handleAction(this.id, "check");
          }
        } else {
          // Slow-play / trap
          engine.handleAction(this.id, "check");
        }
      } else if (equity > 0.45) {
        // Medium: bet sometimes for value/protection
        if (roll > 0.55) {
          const betSize = Math.min(Math.floor(pot * 0.4), chips);
          if (betSize >= engine.state.minRaise) {
            engine.handleAction(this.id, "raise", betSize);
          } else {
            engine.handleAction(this.id, "check");
          }
        } else {
          engine.handleAction(this.id, "check");
        }
      } else {
        // Weak/speculative: mostly check, bluff occasionally
        if (roll > 0.88) {
          const betSize = Math.min(Math.floor(pot * 0.5), chips);
          if (betSize >= engine.state.minRaise) {
            engine.handleAction(this.id, "raise", betSize);
          } else {
            engine.handleAction(this.id, "check");
          }
        } else {
          engine.handleAction(this.id, "check");
        }
      }
    }
  }

  cleanup() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

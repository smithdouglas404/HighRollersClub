import { GameEngine } from "./engine";
import { evaluateHand } from "./hand-evaluator";

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

    const hand = evaluateHand(player.cards, engine.state.communityCards);
    const handStrength = hand.rankValue;
    const pot = engine.state.pot;
    const toCall = engine.state.minBet - player.currentBet;
    const chips = player.chips;

    const roll = Math.random();

    // Decision based on hand strength + randomness
    if (toCall > 0) {
      // Facing a bet
      const potOdds = toCall / (pot + toCall);

      if (handStrength >= 5) {
        // Strong hand (flush+): raise often
        if (roll > 0.3) {
          const raiseAmount = Math.min(engine.state.minBet * 2.5, chips + player.currentBet);
          engine.handleAction(this.id, "raise", Math.floor(raiseAmount));
        } else {
          engine.handleAction(this.id, "call");
        }
      } else if (handStrength >= 2) {
        // Medium hand (two pair+): mostly call, sometimes raise
        if (roll > 0.8) {
          const raiseAmount = Math.min(engine.state.minBet * 2, chips + player.currentBet);
          engine.handleAction(this.id, "raise", Math.floor(raiseAmount));
        } else if (roll > 0.15) {
          engine.handleAction(this.id, "call");
        } else {
          engine.handleAction(this.id, "fold");
        }
      } else if (handStrength >= 1) {
        // Pair: call if pot odds ok, fold sometimes
        if (potOdds > 0.4 && roll > 0.5) {
          engine.handleAction(this.id, "fold");
        } else {
          engine.handleAction(this.id, "call");
        }
      } else {
        // High card: mostly fold, bluff sometimes
        if (roll > 0.85) {
          engine.handleAction(this.id, "call");
        } else if (roll > 0.92) {
          const raiseAmount = Math.min(engine.state.minBet * 2, chips + player.currentBet);
          engine.handleAction(this.id, "raise", Math.floor(raiseAmount));
        } else {
          engine.handleAction(this.id, "fold");
        }
      }
    } else {
      // No bet to match - check or bet
      if (handStrength >= 4) {
        // Strong: bet for value
        const betSize = Math.min(Math.floor(pot * 0.6), chips);
        if (betSize >= engine.state.minRaise) {
          engine.handleAction(this.id, "raise", betSize);
        } else {
          engine.handleAction(this.id, "check");
        }
      } else if (handStrength >= 2) {
        // Medium: bet sometimes
        if (roll > 0.5) {
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
        // Weak: mostly check, bluff rarely
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

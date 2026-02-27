import { GameEngine } from "./engine";
import { evaluateHand } from "./hand-evaluator";
import type { CardType, Rank } from "./hand-evaluator";
import { encodeCard, evaluate5Fast, evaluate7Fast } from "./fast-evaluator";
import { broadcastToTable } from "../websocket";
import { getAIDecision, hasAIEnabled } from "./ai-bot-engine";

// Numeric rank values for pre-flop heuristics
const RANK_NUM: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
};

// ─── Bot Personality System ──────────────────────────────────────────────────

export type BotPersonality = "shark" | "professor" | "gambler" | "robot" | "rookie";

interface PersonalityProfile {
  /** Display name prefix */
  namePrefix: string;
  /** Aggression factor — higher = raises more (0.0–1.0) */
  aggression: number;
  /** Bluff frequency — how often they bluff with weak hands (0.0–1.0) */
  bluffRate: number;
  /** Tightness — minimum equity to enter a pot (0.0–1.0, higher = tighter) */
  tightness: number;
  /** Trap frequency — how often they slow-play strong hands (0.0–1.0) */
  trapRate: number;
  /** Bet sizing multiplier (relative to pot, 0.3–1.5) */
  betSizeMult: number;
  /** Chat messages for different situations */
  chat: {
    fold: string[];
    raise: string[];
    allIn: string[];
    win: string[];
    lose: string[];
    bluff: string[];
  };
}

const PERSONALITIES: Record<BotPersonality, PersonalityProfile> = {
  shark: {
    namePrefix: "Shark",
    aggression: 0.85,
    bluffRate: 0.35,
    tightness: 0.30,
    trapRate: 0.40,
    betSizeMult: 1.2,
    chat: {
      fold: ["Smart move...", "Run while you can.", "Thought so."],
      raise: ["Let's make this interesting.", "You sure about that?", "Raise. Obviously."],
      allIn: ["All in. Your move.", "I smell blood.", "Ship it."],
      win: ["Thanks for the chips.", "Too easy.", "That's what I thought."],
      lose: ["...Lucky.", "You'll need that luck.", "This isn't over."],
      bluff: ["Read 'em and weep.", "Scared money don't make money.", ""],
    },
  },
  professor: {
    namePrefix: "Prof",
    aggression: 0.45,
    bluffRate: 0.10,
    tightness: 0.55,
    trapRate: 0.15,
    betSizeMult: 0.75,
    chat: {
      fold: ["Pot odds don't justify continuing.", "Folding is often the correct play.", "EV-negative spot."],
      raise: ["The math says raise here.", "Value bet.", "Correct sizing for this spot."],
      allIn: ["All in — the equity demands it.", "Mathematically, this is a clear shove.", "GII with the nuts."],
      win: ["As expected.", "The math doesn't lie.", "Optimal play pays off."],
      lose: ["Variance. It happens.", "Bad beat, but correct decision.", "Long run will balance out."],
      bluff: ["Interesting line...", ""],
    },
  },
  gambler: {
    namePrefix: "Lucky",
    aggression: 0.70,
    bluffRate: 0.50,
    tightness: 0.15,
    trapRate: 0.10,
    betSizeMult: 1.4,
    chat: {
      fold: ["Nah, this hand is trash.", "Even I have limits... sometimes.", "Next one's mine!"],
      raise: ["YOLO!", "Let's goooo!", "Feelin' lucky!", "Raise it up baby!"],
      allIn: ["ALL IN BABY!", "Let's gamble!", "You only live once!", "SEND IT!"],
      win: ["BOOM! Called it!", "Lady luck loves me!", "Let's party!", "Who's next?!"],
      lose: ["Ugh, rigged!", "That was MY card!", "Doesn't matter, next hand!"],
      bluff: ["Wild card, baby!", "Did I have it? Maybe!", ""],
    },
  },
  robot: {
    namePrefix: "GTO-9000",
    aggression: 0.55,
    bluffRate: 0.22,
    tightness: 0.40,
    trapRate: 0.25,
    betSizeMult: 0.67,
    chat: {
      fold: ["Fold. -EV.", "Folding.", "Pass."],
      raise: ["Raise. +EV.", "Raising to balance range.", "Bet for value."],
      allIn: ["All in. Committed.", "Shoving. SPR < 1.", "All in. Range advantage."],
      win: ["Pot secured.", "Win registered.", "Expected outcome."],
      lose: ["Bad beat noted.", "Variance event.", "Recalibrating."],
      bluff: ["Bluff frequency balanced.", ""],
    },
  },
  rookie: {
    namePrefix: "Noob",
    aggression: 0.30,
    bluffRate: 0.05,
    tightness: 0.20,
    trapRate: 0.05,
    betSizeMult: 0.5,
    chat: {
      fold: ["Ugh, I fold...", "Is this good? I fold.", "Too scary for me."],
      raise: ["Am I doing this right?", "Raise?? I think??", "Here goes nothing!"],
      allIn: ["Umm... all in??", "I don't know what I'm doing!", "YIKES all in!"],
      win: ["Wait, I won?!", "OMG!", "No way!", "Beginner's luck!"],
      lose: ["Aww man...", "I knew it...", "Poker is hard :("],
      bluff: [""],
    },
  },
};

// Map of all bot personalities for random assignment
const PERSONALITY_KEYS: BotPersonality[] = ["shark", "professor", "gambler", "robot", "rookie"];

export function getRandomPersonality(): BotPersonality {
  return PERSONALITY_KEYS[Math.floor(Math.random() * PERSONALITY_KEYS.length)];
}

export function getBotDisplayName(personality: BotPersonality, index: number): string {
  const profile = PERSONALITIES[personality];
  return `${profile.namePrefix} #${index + 1}`;
}

/**
 * Simple pre-flop hand strength heuristic (returns 0-1).
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
    return 0.50 + (low - 2) * (0.45 / 12);
  }

  let score = (high - 2) / 12 * 0.50;
  score += (low - 2) / 12 * 0.20;
  if (suited) score += 0.06;
  if (gap <= 1) score += 0.06;
  else if (gap <= 2) score += 0.04;
  else if (gap <= 3) score += 0.02;
  if (high >= 13 && low >= 10) score += 0.08;
  if (high === 14 && low >= 10) score += 0.04;

  return Math.min(score, 0.95);
}

function pickChat(lines: string[]): string | null {
  const valid = lines.filter(Boolean);
  if (valid.length === 0) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}

export class BotPlayer {
  public id: string;
  public name: string;
  public personality: BotPersonality;
  private profile: PersonalityProfile;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private tableId: string | null = null;

  constructor(id: string, name: string, personality?: BotPersonality) {
    this.id = id;
    this.personality = personality || getRandomPersonality();
    this.profile = PERSONALITIES[this.personality];
    this.name = name;
  }

  setTableId(tableId: string) {
    this.tableId = tableId;
  }

  private sendChat(message: string | null) {
    if (!message || !this.tableId) return;
    // Only chat ~40% of the time to avoid spam
    if (Math.random() > 0.4) return;
    broadcastToTable(this.tableId, {
      type: "chat",
      userId: this.id,
      displayName: this.name,
      message,
    });
  }

  /** Try AI decision first, fall back to heuristic */
  async actAsync(engine: GameEngine) {
    if (hasAIEnabled()) {
      const player = engine.getPlayer(this.id);
      if (!player || !player.cards) return;
      if (player.seatIndex !== engine.state.currentTurnSeat) return;
      if (player.status !== "thinking") return;

      try {
        const seatCount = engine.state.players.length;
        const dealerIdx = engine.state.dealerSeat;
        const myIdx = player.seatIndex;
        const relPos = ((myIdx - dealerIdx + seatCount) % seatCount);
        const position = relPos <= 1 ? "blinds" : relPos <= seatCount / 3 ? "early" : relPos <= 2 * seatCount / 3 ? "middle" : "late";
        const phase = engine.state.communityCards.length === 0 ? "pre-flop" : engine.state.communityCards.length === 3 ? "flop" : engine.state.communityCards.length === 4 ? "turn" : "river";

        const recentActions: string[] = [];
        const lastAction = engine.state.lastAction;
        if (lastAction) {
          const actorName = engine.getPlayer(lastAction.playerId)?.displayName || "Player";
          recentActions.push(`${actorName} ${lastAction.action}${lastAction.amount ? " $" + lastAction.amount : ""}`);
        }

        const handAtRequest = engine.state.handNumber;
        const result = await getAIDecision({
          personality: this.personality,
          holeCards: player.cards,
          communityCards: engine.state.communityCards,
          pot: engine.state.pot,
          toCall: engine.state.minBet - player.currentBet,
          chips: player.chips,
          position,
          phase,
          numPlayers: engine.state.players.filter(p => p.status !== "folded" && p.status !== "sitting-out").length,
          minRaise: engine.state.minRaise,
          recentActions,
        });

        if (result) {
          // Re-check turn status — game state may have changed during async AI call
          const postPlayer = engine.getPlayer(this.id);
          if (!postPlayer || postPlayer.seatIndex !== engine.state.currentTurnSeat || postPlayer.status !== "thinking") {
            return; // No longer our turn or hand changed — discard AI result
          }
          // Also check hand number to avoid acting on wrong hand
          if (engine.state.handNumber !== handAtRequest) {
            return; // Hand changed during AI call — discard stale result
          }
          if (result.chatMessage) {
            this.sendChat(result.chatMessage);
          }
          engine.handleAction(this.id, result.action, result.amount);
          return; // AI handled it
        }
      } catch {
        // Fall through to heuristic
      }
    }

    // Fall back to heuristic
    this.act(engine);
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

    const p = this.profile;

    // ── Compute hand equity (0-1 scale) ──────────────────────────────────────
    let equity: number;

    if (totalCards >= 7) {
      const allCards = [...player.cards, ...communityCards];
      const encoded = allCards.map(encodeCard);
      const score = evaluate7Fast(encoded);
      equity = score / 7462;
    } else if (totalCards === 6) {
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
      const allCards = [...player.cards, ...communityCards];
      const encoded = allCards.map(encodeCard);
      const score = evaluate5Fast(encoded[0], encoded[1], encoded[2], encoded[3], encoded[4]);
      equity = score / 7462;
    } else {
      equity = preflopEquity(player.cards);
    }

    // ── Rookie "mistakes" — sometimes misread hand strength ────────────────
    if (this.personality === "rookie" && Math.random() < 0.15) {
      equity = equity * (0.6 + Math.random() * 0.8); // Random distortion
    }

    // ── Personality-adjusted thresholds ────────────────────────────────────
    const premiumThreshold = 0.85 - (p.aggression * 0.15);
    const strongThreshold = 0.65 - (p.aggression * 0.12);
    const mediumThreshold = 0.45 - (p.aggression * 0.10);
    const specThreshold = 0.25 + (p.tightness * 0.10);

    // Helper: ensure bot raise is at least minRaise to avoid silent rejection
    const safeRaise = (amount: number) => Math.max(amount, engine.state.minRaise);

    // ── Decision-making ────────────────────────────────────────────────────
    if (toCall > 0) {
      const potOdds = toCall / (pot + toCall);
      const betRelativeToChips = toCall / chips;

      if (equity > premiumThreshold) {
        // Premium hand: raise big
        const raiseAmount = Math.min(
          Math.floor(engine.state.minBet * (2.5 + p.aggression) * p.betSizeMult),
          chips + player.currentBet
        );
        // Trap sometimes (slow-play premium)
        if (roll < p.trapRate) {
          engine.handleAction(this.id, "call");
        } else {
          if (raiseAmount >= chips) {
            this.sendChat(pickChat(p.chat.allIn));
          } else {
            this.sendChat(pickChat(p.chat.raise));
          }
          engine.handleAction(this.id, "raise", safeRaise(raiseAmount));
        }
      } else if (equity > strongThreshold) {
        // Strong: raise or call based on aggression
        if (roll < p.aggression * 0.8) {
          const raiseAmount = Math.min(
            Math.floor(engine.state.minBet * (2.0 + p.aggression * 0.5) * p.betSizeMult),
            chips + player.currentBet
          );
          this.sendChat(pickChat(p.chat.raise));
          engine.handleAction(this.id, "raise", safeRaise(raiseAmount));
        } else {
          engine.handleAction(this.id, "call");
        }
      } else if (equity > mediumThreshold) {
        // Medium: call if pot odds ok, else fold
        if (potOdds < equity + (p.aggression * 0.1)) {
          if (roll < p.aggression * 0.3) {
            const raiseAmount = Math.min(
              Math.floor(engine.state.minBet * 2 * p.betSizeMult),
              chips + player.currentBet
            );
            engine.handleAction(this.id, "raise", safeRaise(raiseAmount));
          } else {
            engine.handleAction(this.id, "call");
          }
        } else if (roll < p.bluffRate * 0.5) {
          // Semi-bluff
          this.sendChat(pickChat(p.chat.bluff));
          engine.handleAction(this.id, "call");
        } else {
          this.sendChat(pickChat(p.chat.fold));
          engine.handleAction(this.id, "fold");
        }
      } else if (equity > specThreshold) {
        // Speculative
        if (betRelativeToChips < 0.15 && roll < (1 - p.tightness) * 0.6) {
          engine.handleAction(this.id, "call");
        } else if (roll < p.bluffRate) {
          // Bluff raise
          this.sendChat(pickChat(p.chat.bluff));
          const raiseAmount = Math.min(
            Math.floor(engine.state.minBet * 2 * p.betSizeMult),
            chips + player.currentBet
          );
          engine.handleAction(this.id, "raise", safeRaise(raiseAmount));
        } else {
          this.sendChat(pickChat(p.chat.fold));
          engine.handleAction(this.id, "fold");
        }
      } else {
        // Weak — fold unless bluffing
        if (roll < p.bluffRate * 0.4) {
          this.sendChat(pickChat(p.chat.bluff));
          if (roll < p.bluffRate * 0.15) {
            const raiseAmount = Math.min(
              Math.floor(engine.state.minBet * 2.5 * p.betSizeMult),
              chips + player.currentBet
            );
            engine.handleAction(this.id, "raise", safeRaise(raiseAmount));
          } else {
            engine.handleAction(this.id, "call");
          }
        } else {
          engine.handleAction(this.id, "fold");
        }
      }
    } else {
      // No bet to match — check or bet
      if (equity > premiumThreshold) {
        if (roll < p.trapRate) {
          // Trap: check with premium
          engine.handleAction(this.id, "check");
        } else {
          const betSize = Math.min(Math.floor(pot * 0.75 * p.betSizeMult), chips);
          if (betSize >= engine.state.minRaise) {
            this.sendChat(pickChat(p.chat.raise));
            engine.handleAction(this.id, "raise", betSize);
          } else {
            engine.handleAction(this.id, "check");
          }
        }
      } else if (equity > strongThreshold) {
        if (roll < p.aggression * 0.7) {
          const betSize = Math.min(Math.floor(pot * 0.6 * p.betSizeMult), chips);
          if (betSize >= engine.state.minRaise) {
            engine.handleAction(this.id, "raise", betSize);
          } else {
            engine.handleAction(this.id, "check");
          }
        } else {
          engine.handleAction(this.id, "check");
        }
      } else if (equity > mediumThreshold) {
        if (roll < p.aggression * 0.4) {
          const betSize = Math.min(Math.floor(pot * 0.4 * p.betSizeMult), chips);
          if (betSize >= engine.state.minRaise) {
            engine.handleAction(this.id, "raise", betSize);
          } else {
            engine.handleAction(this.id, "check");
          }
        } else {
          engine.handleAction(this.id, "check");
        }
      } else {
        // Weak: check or bluff
        if (roll < p.bluffRate) {
          this.sendChat(pickChat(p.chat.bluff));
          const betSize = Math.min(Math.floor(pot * 0.5 * p.betSizeMult), chips);
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

  /** Called after showdown — send win/lose chat */
  onHandResult(won: boolean) {
    if (won) {
      this.sendChat(pickChat(this.profile.chat.win));
    } else {
      this.sendChat(pickChat(this.profile.chat.lose));
    }
  }

  /** Personality-based thinking delay in ms */
  getThinkingDelay(): number {
    const BASE: Record<BotPersonality, number> = {
      shark: 1200,     // Experienced, reads fast
      professor: 2500, // Deliberate, calculates odds
      gambler: 800,    // Impulsive, acts fast
      robot: 500,      // Precise, near-instant
      rookie: 2000,    // Uncertain, hesitates
    };
    const VARIANCE: Record<BotPersonality, number> = {
      shark: 1500,
      professor: 2000,
      gambler: 1200,
      robot: 500,
      rookie: 3000,    // Very inconsistent timing
    };
    return BASE[this.personality] + Math.random() * VARIANCE[this.personality];
  }

  cleanup() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

import { type CardType, type Suit, type Rank, determineWinners, evaluateHand, type PlayerResult } from "./hand-evaluator";
import { encodeCard, evaluate7Fast, getHandCategory } from "./fast-evaluator";
import { createProvablyFairShuffle, createProvablyFairShuffleMultiParty, type ShuffleProof, type PlayerSeedData } from "./crypto-shuffle";
import type { VRFClient } from "../blockchain/vrf-client";
import type { BlindLevel } from "./blind-presets";

// ─── Types ───────────────────────────────────────────────────────────────────
export type GamePhase = "waiting" | "collecting-seeds" | "pre-flop" | "flop" | "turn" | "river" | "showdown";
export type PlayerStatus = "waiting" | "thinking" | "folded" | "all-in" | "checked" | "called" | "raised" | "sitting-out";
export type GameFormat = "cash" | "sng" | "heads_up" | "tournament" | "bomb_pot";

export interface SeatPlayer {
  id: string;
  displayName: string;
  seatIndex: number;
  chips: number;
  cards: [CardType, CardType] | null;
  status: PlayerStatus;
  currentBet: number;
  isBot: boolean;
  isConnected: boolean;
  isSittingOut: boolean;
  totalBetThisHand: number;
  timeBank: number; // remaining time bank seconds
}

export interface GameEngineState {
  phase: GamePhase;
  pot: number;
  communityCards: CardType[];
  currentTurnSeat: number;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  minBet: number;
  minRaise: number;
  handNumber: number;
  actionNumber: number; // incrementing counter for stale action rejection
  players: SeatPlayer[];
  sidePots: { amount: number; eligible: string[] }[];
  lastAction?: { playerId: string; action: string; amount?: number };
  showdownResults?: PlayerResult[];
  commitmentHash?: string;
  // Turn timer state
  turnDeadline: number; // timestamp when current turn expires
  turnTimerDuration: number; // seconds for current turn
  // Format extensions
  gameFormat: GameFormat;
  currentBlindLevel: number;
  nextLevelIn: number; // seconds until next blind level
  isBombPot: boolean;
  playersRemaining: number;
}

export interface HandSummary {
  handNumber: number;
  dealerSeat: number;
  players: { id: string; displayName: string; startChips: number; seatIndex: number }[];
  actions: { playerId: string; action: string; amount?: number; phase: GamePhase; timeSpent?: number }[];
  communityCards: CardType[];
  pot: number;
  winners: { playerId: string; amount: number }[];
  showdownResults?: PlayerResult[];
}

export interface GameEngineOpts {
  smallBlind: number;
  bigBlind: number;
  timeBankSeconds: number;
  gameFormat?: GameFormat;
  blindSchedule?: BlindLevel[];
  bombPotFrequency?: number;
  bombPotAnte?: number;
  ante?: number;
  rakePercent?: number; // e.g., 5 = 5% rake
  rakeCap?: number; // max rake per hand in chips, 0 = no cap
}

// ─── Game Engine ─────────────────────────────────────────────────────────────
export class GameEngine {
  private deck: CardType[] = [];
  public state: GameEngineState;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private showdownTimer: ReturnType<typeof setTimeout> | null = null;
  private blindLevelTimer: ReturnType<typeof setTimeout> | null = null;
  public onStateChange: (() => void) | null = null;
  public onBotTurn: ((playerId: string) => void) | null = null;
  public onHandComplete: ((proof: ShuffleProof, summary: HandSummary) => void) | null = null;
  public onBlindIncrease: ((level: BlindLevel) => void) | null = null;
  public onPlayerEliminated: ((playerId: string, displayName: string) => void) | null = null;

  private currentShuffleProof: ShuffleProof | null = null;
  private handProofs = new Map<number, ShuffleProof>();
  private actionLog: { playerId: string; action: string; amount?: number; phase: GamePhase; timeSpent?: number }[] = [];
  private handStartPlayers: { id: string; displayName: string; startChips: number; seatIndex: number }[] = [];
  private turnStartedAt: number = 0; // timestamp when current turn began

  private smallBlind: number;
  private bigBlind: number;
  private timeBankSeconds: number;
  private actedThisRound: Set<string> = new Set();

  // Format options
  private gameFormat: GameFormat;
  private blindSchedule: BlindLevel[];
  private currentBlindLevel = 0;
  private bombPotFrequency: number;
  private bombPotAnte: number;
  private baseAnte: number;
  private blindLevelStartTime = 0;
  private rakePercent: number;
  private rakeCap: number;
  public lastHandRake: number = 0; // rake taken from last hand (for persistence)

  // VPIP/PFR tracking for pre-flop voluntary actions
  public vpipPlayers: Set<string> = new Set();
  public pfrPlayers: Set<string> = new Set();

  // Seed collection for multi-party entropy
  private seedCommitments = new Map<string, string>();
  private revealedSeeds = new Map<string, string>();
  private collectedSeeds = new Map<string, string>();
  private seedTimer: ReturnType<typeof setTimeout> | null = null;

  // VRF integration
  public vrfClient: VRFClient | null = null;
  private currentVRFRequestId: string | null = null;
  private currentVRFRandomWord: string | null = null;

  constructor(
    public tableId: string,
    opts: GameEngineOpts
  ) {
    this.smallBlind = opts.smallBlind;
    this.bigBlind = opts.bigBlind;
    this.timeBankSeconds = opts.timeBankSeconds;
    this.gameFormat = opts.gameFormat || "cash";
    this.blindSchedule = opts.blindSchedule || [];
    this.bombPotFrequency = opts.bombPotFrequency || 0;
    this.bombPotAnte = opts.bombPotAnte || 0;
    this.baseAnte = opts.ante || 0;
    this.rakePercent = opts.rakePercent || 0;
    this.rakeCap = opts.rakeCap || 0;

    this.state = {
      phase: "waiting",
      pot: 0,
      communityCards: [],
      currentTurnSeat: -1,
      dealerSeat: 0,
      smallBlindSeat: -1,
      bigBlindSeat: -1,
      minBet: opts.bigBlind,
      minRaise: opts.bigBlind,
      handNumber: 0,
      actionNumber: 0,
      players: [],
      sidePots: [],
      turnDeadline: 0,
      turnTimerDuration: opts.timeBankSeconds,
      gameFormat: this.gameFormat,
      currentBlindLevel: 0,
      nextLevelIn: 0,
      isBombPot: false,
      playersRemaining: 0,
    };
  }

  // ─── Blind Schedule Management ──────────────────────────────────────────
  startBlindSchedule() {
    if (this.blindSchedule.length === 0) return;
    this.currentBlindLevel = 0;
    this.applyBlindLevel(0);
    this.scheduleNextLevel();
  }

  private applyBlindLevel(levelIndex: number) {
    if (levelIndex >= this.blindSchedule.length) return;
    const level = this.blindSchedule[levelIndex];
    this.currentBlindLevel = levelIndex;
    this.smallBlind = level.sb;
    this.bigBlind = level.bb;
    this.baseAnte = level.ante;
    this.state.currentBlindLevel = levelIndex;
    this.blindLevelStartTime = Date.now();
    this.onBlindIncrease?.(level);
  }

  private scheduleNextLevel() {
    if (this.currentBlindLevel >= this.blindSchedule.length - 1) return;
    const currentLevel = this.blindSchedule[this.currentBlindLevel];
    if (!currentLevel) return;

    this.blindLevelTimer = setTimeout(() => {
      this.currentBlindLevel++;
      this.applyBlindLevel(this.currentBlindLevel);
      this.emitState();
      this.scheduleNextLevel();
    }, currentLevel.durationSeconds * 1000);
  }

  getSecondsUntilNextLevel(): number {
    if (this.blindSchedule.length === 0 || this.currentBlindLevel >= this.blindSchedule.length - 1) return 0;
    const currentLevel = this.blindSchedule[this.currentBlindLevel];
    if (!currentLevel) return 0;
    const elapsed = (Date.now() - this.blindLevelStartTime) / 1000;
    return Math.max(0, currentLevel.durationSeconds - elapsed);
  }

  // ─── Player Management ─────────────────────────────────────────────────
  addPlayer(id: string, displayName: string, seatIndex: number, chips: number, isBot = false): SeatPlayer {
    const player: SeatPlayer = {
      id, displayName, seatIndex, chips,
      cards: null,
      status: "waiting",
      currentBet: 0,
      isBot,
      isConnected: true,
      isSittingOut: false,
      totalBetThisHand: 0,
      timeBank: 30, // 30 seconds of time bank per player
    };
    this.state.players.push(player);
    this.state.players.sort((a, b) => a.seatIndex - b.seatIndex);
    this.state.playersRemaining = this.state.players.filter(p => !p.isSittingOut).length;
    return player;
  }

  removePlayer(id: string): number | undefined {
    const idx = this.state.players.findIndex(p => p.id === id);
    if (idx === -1) return undefined;
    const seat = this.state.players[idx].seatIndex;
    const player = this.state.players[idx];

    // SNG/tournament: sit out instead of removing (unless explicitly called from lifecycle)
    if ((this.gameFormat === "sng" || this.gameFormat === "tournament") && player.chips > 0) {
      player.isSittingOut = true;
      player.status = "sitting-out";
      if (this.state.phase !== "waiting" && this.state.phase !== "showdown" && player.status !== "folded") {
        player.status = "folded";
      }
      return seat;
    }

    // If in middle of hand, fold first
    if (this.state.phase !== "waiting" && this.state.phase !== "showdown" && player.status !== "folded") {
      player.status = "folded";
    }

    this.state.players.splice(idx, 1);
    this.state.playersRemaining = this.state.players.filter(p => !p.isSittingOut).length;

    // Check if hand should end
    if (this.state.phase !== "waiting" && this.state.phase !== "showdown") {
      const active = this.activePlayers();
      if (active.length <= 1) {
        this.endHandLastStanding();
      }
    }

    return seat;
  }

  // Force remove (for SNG elimination after chips reach 0)
  forceRemovePlayer(id: string): number | undefined {
    const idx = this.state.players.findIndex(p => p.id === id);
    if (idx === -1) return undefined;
    const seat = this.state.players[idx].seatIndex;
    this.state.players.splice(idx, 1);
    this.state.playersRemaining = this.state.players.filter(p => !p.isSittingOut).length;
    return seat;
  }

  getPlayer(id: string): SeatPlayer | undefined {
    return this.state.players.find(p => p.id === id);
  }

  // ─── Game Flow ─────────────────────────────────────────────────────────
  canStartHand(): boolean {
    const ready = this.state.players.filter(p => !p.isSittingOut && p.chips > 0);
    return ready.length >= 2;
  }

  startHand() {
    if (!this.canStartHand()) return;

    this.clearTimers();
    this.state.handNumber++;

    // Update nextLevelIn
    this.state.nextLevelIn = Math.round(this.getSecondsUntilNextLevel());

    // Determine if this is a bomb pot hand
    this.state.isBombPot = false;
    if (this.bombPotFrequency > 0 && this.state.handNumber % this.bombPotFrequency === 0) {
      this.state.isBombPot = true;
    }

    // Check if there are human players for seed collection
    const eligible = this.state.players.filter(p => !p.isSittingOut && p.chips > 0);
    const humanPlayers = eligible.filter(p => !p.isBot);

    if (humanPlayers.length > 0) {
      this.beginSeedCollection();
    } else {
      // Bot-only game: skip seed collection
      this.startHandWithSeeds([]);
    }
  }

  // ─── Seed Collection ────────────────────────────────────────────────────
  private beginSeedCollection() {
    this.state.phase = "collecting-seeds";
    this.seedCommitments.clear();
    this.revealedSeeds.clear();
    this.collectedSeeds.clear();
    this.currentVRFRequestId = null;
    this.currentVRFRandomWord = null;

    // Fire VRF request in background if enabled
    if (this.vrfClient) {
      this.vrfClient.requestRandomness(this.tableId, this.state.handNumber)
        .then(result => {
          if (result) {
            this.currentVRFRequestId = result.requestId;
            result.randomWordPromise.then(word => {
              if (word) this.currentVRFRandomWord = word;
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }

    this.emitState();

    // 5-second timeout: proceed with whatever seeds we have
    this.seedTimer = setTimeout(() => {
      this.finalizeSeedCollection();
    }, 5000);
  }

  submitSeedCommitment(playerId: string, commitmentHash: string): boolean {
    if (this.state.phase !== "collecting-seeds") return false;
    const player = this.getPlayer(playerId);
    if (!player || player.isBot) return false;

    this.seedCommitments.set(playerId, commitmentHash);
    this.emitState();

    // Check if all human players have committed
    const eligible = this.state.players.filter(p => !p.isSittingOut && p.chips > 0 && !p.isBot);
    if (eligible.every(p => this.seedCommitments.has(p.id))) {
      this.clearSeedTimer();
      this.finalizeSeedCollection();
    }

    return true;
  }

  // Seed reveal happens at showdown — clients send plaintext seed
  submitSeedReveal(playerId: string, seed: string): boolean {
    if (!this.seedCommitments.has(playerId)) return false;
    this.revealedSeeds.set(playerId, seed);
    return true;
  }

  private finalizeSeedCollection() {
    this.clearSeedTimer();

    const playerSeedData: PlayerSeedData[] = [];
    this.seedCommitments.forEach((hash, playerId) => {
      playerSeedData.push({ playerId, seed: "", commitmentHash: hash });
    });

    this.startHandWithSeeds(playerSeedData);
  }

  private clearSeedTimer() {
    if (this.seedTimer) {
      clearTimeout(this.seedTimer);
      this.seedTimer = null;
    }
  }

  getSeedCommitmentCount(): number {
    return this.seedCommitments.size;
  }

  getExpectedSeedCount(): number {
    return this.state.players.filter(p => !p.isSittingOut && p.chips > 0 && !p.isBot).length;
  }

  private startHandWithSeeds(playerSeedData: PlayerSeedData[]) {
    const isBombPot = this.state.isBombPot;

    this.state.phase = isBombPot ? "flop" : "pre-flop";
    this.state.pot = 0;
    this.state.communityCards = [];
    this.state.sidePots = [];
    this.state.showdownResults = undefined;
    this.state.lastAction = undefined;
    this.state.actionNumber = 0;
    this.state.turnDeadline = 0;
    this.actedThisRound.clear();
    this.actionLog = [];
    this.vpipPlayers.clear();
    this.pfrPlayers.clear();

    // Reset players
    const eligible = this.state.players.filter(p => !p.isSittingOut && p.chips > 0);

    // Snapshot starting state for hand summary
    this.handStartPlayers = eligible.map(p => ({
      id: p.id, displayName: p.displayName, startChips: p.chips, seatIndex: p.seatIndex,
    }));
    for (const p of this.state.players) {
      p.currentBet = 0;
      p.totalBetThisHand = 0;
      p.cards = null;
      p.status = (p.isSittingOut || p.chips <= 0) ? "sitting-out" : "waiting";
    }

    // Rotate dealer
    if (this.state.handNumber > 1) {
      this.state.dealerSeat = this.nextEligibleSeat(this.state.dealerSeat);
    } else {
      this.state.dealerSeat = eligible[0].seatIndex;
    }

    if (isBombPot) {
      // Bomb pot: everyone antes, skip pre-flop
      const anteAmount = this.bombPotAnte || this.bigBlind;
      for (const p of eligible) {
        const actual = Math.min(anteAmount, p.chips);
        p.chips -= actual;
        p.currentBet = actual;
        p.totalBetThisHand = actual;
        this.state.pot += actual;
        if (p.chips === 0) p.status = "all-in";
      }
      this.state.smallBlindSeat = -1;
      this.state.bigBlindSeat = -1;
    } else {
      // Normal blinds
      if (eligible.length === 2) {
        this.state.smallBlindSeat = this.state.dealerSeat;
        this.state.bigBlindSeat = this.nextEligibleSeat(this.state.dealerSeat);
      } else {
        this.state.smallBlindSeat = this.nextEligibleSeat(this.state.dealerSeat);
        this.state.bigBlindSeat = this.nextEligibleSeat(this.state.smallBlindSeat);
      }

      const sb = this.getPlayerBySeat(this.state.smallBlindSeat);
      const bb = this.getPlayerBySeat(this.state.bigBlindSeat);
      if (sb) this.postBlind(sb, this.smallBlind);
      if (bb) this.postBlind(bb, this.bigBlind);

      // Post antes from blind schedule or base ante
      const currentAnte = this.baseAnte;
      if (currentAnte > 0) {
        for (const p of eligible) {
          if (p.seatIndex === this.state.smallBlindSeat || p.seatIndex === this.state.bigBlindSeat) continue;
          const actual = Math.min(currentAnte, p.chips);
          p.chips -= actual;
          p.totalBetThisHand += actual;
          this.state.pot += actual;
          if (p.chips === 0) p.status = "all-in";
        }
      }
    }

    this.state.minBet = isBombPot ? 0 : this.bigBlind;
    this.state.minRaise = this.bigBlind * 2;

    // Snapshot chip total after blinds/antes for integrity verification
    this.snapshotChipTotal();

    // Deal cards — provably fair shuffle
    let deck: CardType[];
    let proof: ShuffleProof;

    if (playerSeedData.length > 0 || this.currentVRFRandomWord) {
      const result = createProvablyFairShuffleMultiParty(
        this.tableId,
        this.state.handNumber,
        playerSeedData,
        this.currentVRFRandomWord || undefined
      );
      deck = result.deck;
      proof = result.proof;
      if (this.currentVRFRequestId) {
        proof.vrfRequestId = this.currentVRFRequestId;
      }
    } else {
      const result = createProvablyFairShuffle(this.tableId, this.state.handNumber);
      deck = result.deck;
      proof = result.proof;
    }

    this.deck = deck;
    this.currentShuffleProof = proof;
    this.handProofs.set(this.state.handNumber, proof);
    if (this.handProofs.size > 10) {
      const oldest = Math.min(...this.handProofs.keys());
      this.handProofs.delete(oldest);
    }
    this.state.commitmentHash = proof.commitmentHash;

    for (const p of eligible) {
      p.cards = [this.deck.pop()!, this.deck.pop()!];
    }

    if (isBombPot) {
      // Deal flop immediately for bomb pot
      this.deck.pop(); // burn
      this.state.communityCards.push(this.deck.pop()!, this.deck.pop()!, this.deck.pop()!);

      // Reset bets for flop betting round
      for (const p of this.state.players) {
        p.currentBet = 0;
      }
      this.state.minBet = 0;
      this.state.minRaise = this.bigBlind;

      const active = this.state.players.filter(
        p => p.status !== "folded" && p.status !== "sitting-out" && p.status !== "all-in"
      );
      if (active.length === 0) {
        this.runOutBoard();
      } else {
        const firstSeat = this.nextActiveSeat(this.state.dealerSeat);
        this.startTurn(firstSeat);
      }
    } else {
      // UTG acts first pre-flop
      const firstToAct = this.nextEligibleSeat(this.state.bigBlindSeat);
      this.startTurn(firstToAct);
    }

    this.emitState();
  }

  private postBlind(player: SeatPlayer, amount: number) {
    const actual = Math.min(amount, player.chips);
    player.chips -= actual;
    player.currentBet = actual;
    player.totalBetThisHand = actual;
    this.state.pot += actual;
    if (player.chips === 0) player.status = "all-in";
  }

  // ─── Elimination Detection ──────────────────────────────────────────────
  checkEliminations(): string[] {
    const eliminated: string[] = [];
    for (const p of this.state.players) {
      if (p.chips <= 0 && !p.isSittingOut && p.status !== "sitting-out") {
        eliminated.push(p.id);
        this.onPlayerEliminated?.(p.id, p.displayName);
      }
    }
    return eliminated;
  }

  // ─── Chip Integrity Verification ──────────────────────────────────────
  private handStartTotalChips = 0;

  private snapshotChipTotal() {
    // Invariant: pot + sum(all player chips) + sum(all currentBets not yet in pot) = constant
    // But pot already includes currentBets that were posted, so the true invariant is:
    // sum(all player total chip stacks at hand start) = pot + sum(all player remaining chips)
    // Simplest: total chips in play = pot + sum(player.chips) at any point
    // because currentBet chips have already been subtracted from player.chips and added to pot
    this.handStartTotalChips = this.state.pot;
    for (const p of this.state.players) {
      this.handStartTotalChips += p.chips;
    }
  }

  private verifyChipIntegrity(): boolean {
    if (this.handStartTotalChips === 0) return true;
    let currentTotal = this.state.pot;
    for (const p of this.state.players) {
      currentTotal += p.chips;
    }
    if (currentTotal !== this.handStartTotalChips) {
      console.error(
        `[CHIP INTEGRITY VIOLATION] table=${this.tableId} hand=${this.state.handNumber} ` +
        `expected=${this.handStartTotalChips} actual=${currentTotal} delta=${currentTotal - this.handStartTotalChips}`
      );
      return false;
    }
    return true;
  }

  // ─── Actions ───────────────────────────────────────────────────────────
  handleAction(playerId: string, action: string, amount?: number, actionNumber?: number): { ok: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { ok: false, error: "Player not found" };

    // Phase check
    if (this.state.phase === "waiting" || this.state.phase === "showdown" || this.state.phase === "collecting-seeds") {
      return { ok: false, error: "No active hand" };
    }

    // Seat ownership + turn check
    if (player.seatIndex !== this.state.currentTurnSeat) {
      return { ok: false, error: "Not your turn" };
    }
    if (player.status === "folded" || player.status === "all-in") {
      return { ok: false, error: "Cannot act" };
    }

    // Stale action rejection
    if (actionNumber !== undefined && actionNumber !== this.state.actionNumber) {
      return { ok: false, error: "Stale action" };
    }

    // Temporal validation: check turn deadline (human players only)
    if (this.state.turnDeadline > 0 && !player.isBot) {
      const now = Date.now();
      if (now > this.state.turnDeadline) {
        const overageSec = Math.ceil((now - this.state.turnDeadline) / 1000);
        if (player.timeBank >= overageSec) {
          player.timeBank -= overageSec;
        } else {
          return { ok: false, error: "Turn timer expired" };
        }
      }
    }

    this.clearTimers();

    switch (action) {
      case "fold":
        player.status = "folded";
        break;

      case "check": {
        if (player.currentBet < this.state.minBet) {
          return { ok: false, error: "Cannot check, there is a bet to match" };
        }
        player.status = "checked";
        break;
      }

      case "call": {
        const callNeeded = this.state.minBet - player.currentBet;
        if (callNeeded <= 0) {
          // Nothing to call — treat as check
          player.status = "checked";
          break;
        }
        const callAmount = Math.min(callNeeded, player.chips);
        player.chips -= callAmount;
        player.currentBet += callAmount;
        player.totalBetThisHand += callAmount;
        this.state.pot += callAmount;
        player.status = player.chips === 0 ? "all-in" : "called";
        break;
      }

      case "raise": {
        if (!amount || amount < this.state.minRaise) {
          if (amount && amount >= player.chips + player.currentBet) {
            // All-in is always allowed
          } else {
            return { ok: false, error: `Minimum raise is ${this.state.minRaise}` };
          }
        }
        const raiseTotal = amount || this.state.minRaise;
        const toAdd = Math.min(raiseTotal - player.currentBet, player.chips);
        const previousMinBet = this.state.minBet;
        player.chips -= toAdd;
        player.currentBet += toAdd;
        player.totalBetThisHand += toAdd;
        this.state.pot += toAdd;
        this.state.minBet = player.currentBet;
        const raiseIncrement = Math.max(player.currentBet - previousMinBet, this.bigBlind);
        this.state.minRaise = player.currentBet + raiseIncrement;
        player.status = player.chips === 0 ? "all-in" : "raised";

        // Reset acted set since a raise reopens action
        this.actedThisRound.clear();
        this.actedThisRound.add(playerId);
        break;
      }

      default:
        return { ok: false, error: "Unknown action" };
    }

    // Increment action number
    this.state.actionNumber++;

    this.state.lastAction = { playerId, action, amount };
    const timeSpent = this.turnStartedAt > 0 ? Math.round((Date.now() - this.turnStartedAt) / 100) / 10 : undefined;
    this.actionLog.push({ playerId, action, amount, phase: this.state.phase, timeSpent });
    if (action !== "raise") {
      this.actedThisRound.add(playerId);
    }

    // Track VPIP and PFR for pre-flop voluntary actions
    if (this.state.phase === "pre-flop") {
      if (action === "call" || action === "raise") {
        this.vpipPlayers.add(playerId);
      }
      if (action === "raise") {
        this.pfrPlayers.add(playerId);
      }
    }

    // Chip integrity check after every mutation
    this.verifyChipIntegrity();

    // Check if only one player left
    const active = this.activePlayers();
    if (active.length <= 1) {
      this.endHandLastStanding();
      return { ok: true };
    }

    // Check if round is over
    if (this.isRoundComplete()) {
      this.advancePhase();
    } else {
      const nextSeat = this.nextActiveSeat(player.seatIndex);
      this.startTurn(nextSeat);
    }

    this.emitState();
    return { ok: true };
  }

  private isRoundComplete(): boolean {
    const eligible = this.state.players.filter(
      p => p.status !== "folded" && p.status !== "sitting-out" && p.status !== "all-in"
    );

    // All remaining players are all-in or folded
    if (eligible.length === 0) return true;

    // Everyone who can act has acted and bets are matched
    for (const p of eligible) {
      if (!this.actedThisRound.has(p.id)) return false;
      if (p.currentBet !== this.state.minBet && p.status !== "all-in") return false;
    }

    return true;
  }

  private advancePhase() {
    this.actedThisRound.clear();

    // Reset current bets for new round
    for (const p of this.state.players) {
      p.currentBet = 0;
      if (p.status !== "folded" && p.status !== "all-in" && p.status !== "sitting-out") {
        p.status = "waiting";
      }
    }

    this.state.minBet = 0;
    this.state.minRaise = this.bigBlind;

    switch (this.state.phase) {
      case "pre-flop":
        this.state.phase = "flop";
        this.deck.pop(); // burn
        this.state.communityCards.push(this.deck.pop()!, this.deck.pop()!, this.deck.pop()!);
        break;
      case "flop":
        this.state.phase = "turn";
        this.deck.pop(); // burn
        this.state.communityCards.push(this.deck.pop()!);
        break;
      case "turn":
        this.state.phase = "river";
        this.deck.pop(); // burn
        this.state.communityCards.push(this.deck.pop()!);
        break;
      case "river":
        this.goToShowdown();
        return;
    }

    // Find first to act post-flop (left of dealer)
    const active = this.state.players.filter(
      p => p.status !== "folded" && p.status !== "sitting-out" && p.status !== "all-in"
    );

    if (active.length === 0) {
      // All remaining are all-in, run out community cards
      this.runOutBoard();
      return;
    }

    const firstSeat = this.nextActiveSeat(this.state.dealerSeat);
    this.startTurn(firstSeat);
    this.emitState();
  }

  private runOutBoard() {
    // Deal remaining community cards
    while (this.state.communityCards.length < 5) {
      this.deck.pop(); // burn
      this.state.communityCards.push(this.deck.pop()!);
    }
    this.goToShowdown();
  }

  private goToShowdown() {
    this.state.phase = "showdown";
    this.clearTimers();

    // Deal remaining community cards if needed
    while (this.state.communityCards.length < 5 && this.deck.length > 1) {
      this.deck.pop(); // burn
      this.state.communityCards.push(this.deck.pop()!);
    }

    const active = this.state.players.filter(p => p.status !== "folded" && p.status !== "sitting-out" && p.cards);

    // Fast path: use bitmask/prime evaluator for scoring, old evaluator for UI descriptions
    const communityEncoded = this.state.communityCards.map(encodeCard);
    let bestScore = 0;
    const playerScores: { id: string; score: number }[] = [];
    for (const p of active) {
      const encoded = [...p.cards!.map(encodeCard), ...communityEncoded];
      const score = evaluate7Fast(encoded);
      playerScores.push({ id: p.id, score });
      if (score > bestScore) bestScore = score;
    }

    // Build results with UI-friendly hand descriptions from old evaluator
    const results: PlayerResult[] = playerScores.map(ps => {
      const player = active.find(p => p.id === ps.id)!;
      const hand = evaluateHand(player.cards!.map(c => ({ ...c, hidden: false })), this.state.communityCards);
      return {
        playerId: ps.id,
        hand,
        isWinner: ps.score === bestScore,
      };
    });
    this.state.showdownResults = results;

    // Build fast score map for distribution (used for per-tier winner finding)
    const scoreMap = new Map<string, number>();
    for (const ps of playerScores) scoreMap.set(ps.id, ps.score);

    // Snapshot chip counts before distribution to calculate actual winnings
    const chipsBefore = new Map<string, number>();
    for (const p of this.state.players) chipsBefore.set(p.id, p.chips);

    // Calculate pot distribution
    this.distributePot(results, scoreMap);

    // Calculate actual amounts each player won
    const winnerAmounts: { playerId: string; amount: number }[] = [];
    for (const p of this.state.players) {
      const before = chipsBefore.get(p.id) || 0;
      const gained = p.chips - before;
      if (gained > 0) {
        winnerAmounts.push({ playerId: p.id, amount: gained });
      }
    }

    // Fire hand complete callback with proof and summary
    if (this.currentShuffleProof) {
      this.onHandComplete?.(this.currentShuffleProof, this.buildHandSummary(winnerAmounts));
    }

    // Check for eliminations after pot distribution (SNG/tournament)
    if (this.gameFormat === "sng" || this.gameFormat === "tournament") {
      this.checkEliminations();
    }

    this.emitState();

    // Auto-start next hand after delay
    this.showdownTimer = setTimeout(() => {
      if (this.canStartHand()) {
        this.startHand();
      } else {
        this.state.phase = "waiting";
        this.emitState();
      }
    }, 5000);
  }

  // Calculate rake from pot: percentage of total pot, capped at rakeCap
  // Returns the rake amount and adjusts the provided pot tiers
  private applyRake(potTiers: { amount: number; eligible: string[] }[]): number {
    if (this.rakePercent <= 0) return 0;
    const totalPot = potTiers.reduce((sum, t) => sum + t.amount, 0);
    let rake = Math.floor(totalPot * this.rakePercent / 100);
    if (this.rakeCap > 0) rake = Math.min(rake, this.rakeCap);
    if (rake <= 0) return 0;

    // Deduct rake from main pot (first tier) first, then side pots if needed
    let remaining = rake;
    for (const tier of potTiers) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, tier.amount);
      tier.amount -= deduct;
      remaining -= deduct;
    }
    return rake;
  }

  // Return the player closest left of the dealer (worst position = earliest to act)
  // Used for awarding odd chips in split pots per industry standard
  private worstPositionFirst(playerIds: string[]): string[] {
    const maxPlayers = this.state.players.length;
    const dealerSeat = this.state.dealerSeat;
    return [...playerIds].sort((aId, bId) => {
      const aPlayer = this.getPlayer(aId);
      const bPlayer = this.getPlayer(bId);
      if (!aPlayer || !bPlayer) return 0;
      // Distance from dealer going clockwise (left of dealer = seat after dealer)
      const aDist = (aPlayer.seatIndex - dealerSeat + maxPlayers) % maxPlayers;
      const bDist = (bPlayer.seatIndex - dealerSeat + maxPlayers) % maxPlayers;
      return aDist - bDist;
    });
  }

  private distributePot(results: PlayerResult[], scoreMap?: Map<string, number>) {
    // All players who contributed (not sitting-out, even if folded)
    const contributors = this.state.players.filter(p => p.totalBetThisHand > 0 && p.status !== "sitting-out");
    const active = this.state.players.filter(p => p.status !== "folded" && p.status !== "sitting-out");

    if (contributors.length === 0) return;

    // ── Step 1: Build contribution tiers ──────────────────────────────────
    const betLevels = Array.from(new Set(contributors.map(p => p.totalBetThisHand))).sort((a, b) => a - b);

    const tiers: { amount: number; eligible: string[] }[] = [];
    let prevLevel = 0;
    for (const level of betLevels) {
      const increment = level - prevLevel;
      if (increment <= 0) continue;
      const potContributors = contributors.filter(p => p.totalBetThisHand >= level);
      const eligible = potContributors.filter(p => active.some(a => a.id === p.id)).map(p => p.id);
      tiers.push({
        amount: increment * potContributors.length,
        eligible,
      });
      prevLevel = level;
    }

    // ── Step 2: Apply rake (after slicing, before distribution) ───────────
    this.lastHandRake = this.applyRake(tiers);

    // ── Step 3: Distribute each tier to its winners ───────────────────────
    for (const tier of tiers) {
      if (tier.amount <= 0 || tier.eligible.length === 0) continue;

      const eligibleResults = results.filter(r => tier.eligible.includes(r.playerId));
      if (eligibleResults.length === 0) continue;

      // Find best hand among eligible — use fast scores when available
      let potWinners: PlayerResult[];
      if (scoreMap && scoreMap.size > 0) {
        let bestScore = 0;
        for (const r of eligibleResults) {
          const s = scoreMap.get(r.playerId) || 0;
          if (s > bestScore) bestScore = s;
        }
        potWinners = eligibleResults.filter(r => (scoreMap.get(r.playerId) || 0) === bestScore);
      } else {
        // Fallback: old kicker-based comparison
        let bestRankValue = -1;
        let bestKickers = "";
        for (const r of eligibleResults) {
          const kStr = r.hand.kickers.join(",");
          if (r.hand.rankValue > bestRankValue || (r.hand.rankValue === bestRankValue && kStr > bestKickers)) {
            bestRankValue = r.hand.rankValue;
            bestKickers = kStr;
          }
        }
        potWinners = eligibleResults.filter(
          r => r.hand.rankValue === bestRankValue && r.hand.kickers.join(",") === bestKickers
        );
      }

      const share = Math.floor(tier.amount / potWinners.length);
      for (const w of potWinners) {
        const player = this.getPlayer(w.playerId);
        if (player) player.chips += share;
      }
      // Odd chip to worst position (closest left of button)
      const leftover = tier.amount - share * potWinners.length;
      if (leftover > 0) {
        const sorted = this.worstPositionFirst(potWinners.map(w => w.playerId));
        const first = this.getPlayer(sorted[0]);
        if (first) first.chips += leftover;
      }
    }

    // Track side pots in state for UI display (use the already-computed tiers)
    this.state.sidePots = tiers.filter(t => t.amount > 0);
  }

  private endHandLastStanding() {
    this.clearTimers();
    const active = this.activePlayers();
    if (active.length === 1) {
      active[0].chips += this.state.pot;
      this.state.lastAction = { playerId: active[0].id, action: "win" };
    }

    // Fire hand complete callback with proof and summary
    const winnerAmounts = active.length === 1
      ? [{ playerId: active[0].id, amount: this.state.pot }]
      : [];
    if (this.currentShuffleProof) {
      this.onHandComplete?.(this.currentShuffleProof, this.buildHandSummary(winnerAmounts));
    }

    // Check for eliminations after pot distribution (SNG/tournament)
    if (this.gameFormat === "sng" || this.gameFormat === "tournament") {
      this.checkEliminations();
    }

    this.state.phase = "showdown";
    this.state.showdownResults = undefined;
    this.emitState();

    this.showdownTimer = setTimeout(() => {
      if (this.canStartHand()) {
        this.startHand();
      } else {
        this.state.phase = "waiting";
        this.emitState();
      }
    }, 3000);
  }

  // ─── Turn Management ──────────────────────────────────────────────────
  private startTurn(seatIndex: number) {
    const player = this.getPlayerBySeat(seatIndex);
    if (!player) return;

    this.state.currentTurnSeat = seatIndex;
    player.status = "thinking";
    this.turnStartedAt = Date.now();

    // Set turn deadline for temporal validation
    const turnDuration = this.timeBankSeconds;
    this.state.turnDeadline = Date.now() + turnDuration * 1000;
    this.state.turnTimerDuration = turnDuration;

    // Set turn timer: main timer + time bank grace period
    const totalTimeout = (turnDuration + player.timeBank) * 1000;
    this.turnTimer = setTimeout(() => {
      // Timer exhausted (main + time bank) — auto-action
      player.timeBank = 0; // bank fully consumed
      if (player.currentBet < this.state.minBet) {
        this.handleAction(player.id, "fold");
      } else {
        this.handleAction(player.id, "check");
      }
      // Mark player as sitting out after timeout
      if (!player.isBot) {
        player.isSittingOut = true;
        player.status = "sitting-out";
      }
    }, totalTimeout);

    // Notify bot to act
    if (player.isBot) {
      this.onBotTurn?.(player.id);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────
  private activePlayers(): SeatPlayer[] {
    return this.state.players.filter(p => p.status !== "folded" && p.status !== "sitting-out");
  }

  private getPlayerBySeat(seatIndex: number): SeatPlayer | undefined {
    return this.state.players.find(p => p.seatIndex === seatIndex);
  }

  private nextEligibleSeat(currentSeat: number): number {
    const eligible = this.state.players.filter(p => !p.isSittingOut && p.chips > 0);
    if (eligible.length === 0) return currentSeat;

    let seat = currentSeat;
    for (let i = 0; i < this.state.players.length; i++) {
      seat = this.nextSeatIndex(seat);
      const p = this.getPlayerBySeat(seat);
      if (p && !p.isSittingOut && p.chips > 0) return seat;
    }
    return currentSeat;
  }

  private nextActiveSeat(currentSeat: number): number {
    let seat = currentSeat;
    for (let i = 0; i < this.state.players.length; i++) {
      seat = this.nextSeatIndex(seat);
      const p = this.getPlayerBySeat(seat);
      if (p && p.status !== "folded" && p.status !== "sitting-out" && p.status !== "all-in") {
        return seat;
      }
    }
    return currentSeat;
  }

  private nextSeatIndex(current: number): number {
    if (this.state.players.length === 0) return 0;
    const seats = this.state.players.map(p => p.seatIndex).sort((a, b) => a - b);
    const idx = seats.indexOf(current);
    if (idx === -1 || idx === seats.length - 1) return seats[0];
    return seats[idx + 1];
  }

  private clearTimers() {
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
  }

  cleanup() {
    this.clearTimers();
    this.clearSeedTimer();
    if (this.showdownTimer) { clearTimeout(this.showdownTimer); this.showdownTimer = null; }
    if (this.blindLevelTimer) { clearTimeout(this.blindLevelTimer); this.blindLevelTimer = null; }
  }

  private emitState() {
    this.state.nextLevelIn = Math.round(this.getSecondsUntilNextLevel());
    this.state.playersRemaining = this.state.players.filter(p => !p.isSittingOut && p.chips > 0).length;
    this.onStateChange?.();
  }

  // ─── State Serialization ──────────────────────────────────────────────
  private buildHandSummary(winners: { playerId: string; amount: number }[]): HandSummary {
    return {
      handNumber: this.state.handNumber,
      dealerSeat: this.state.dealerSeat,
      players: this.handStartPlayers,
      actions: this.actionLog,
      communityCards: [...this.state.communityCards],
      pot: this.state.pot,
      winners,
      showdownResults: this.state.showdownResults,
    };
  }

  getShuffleProof(handNumber: number): ShuffleProof | undefined {
    return this.handProofs.get(handNumber);
  }

  getCurrentCommitment(): string | undefined {
    return this.state.commitmentHash;
  }

  getStateForPlayer(playerId: string): any {
    const state = this.state;
    return {
      phase: state.phase,
      pot: state.pot,
      communityCards: state.communityCards,
      currentTurnSeat: state.currentTurnSeat,
      dealerSeat: state.dealerSeat,
      smallBlindSeat: state.smallBlindSeat,
      bigBlindSeat: state.bigBlindSeat,
      minBet: state.minBet,
      minRaise: state.minRaise,
      handNumber: state.handNumber,
      actionNumber: state.actionNumber,
      lastAction: state.lastAction,
      showdownResults: state.phase === "showdown" ? state.showdownResults : undefined,
      commitmentHash: state.commitmentHash,
      shuffleProof: state.phase === "showdown" && this.currentShuffleProof
        ? this.currentShuffleProof
        : undefined,
      // Turn timer
      turnDeadline: state.turnDeadline,
      turnTimerDuration: state.turnTimerDuration,
      // Format extensions
      gameFormat: state.gameFormat,
      currentBlindLevel: state.currentBlindLevel,
      nextLevelIn: state.nextLevelIn,
      isBombPot: state.isBombPot,
      playersRemaining: state.playersRemaining,
      players: state.players.map(p => ({
        id: p.id,
        displayName: p.displayName,
        seatIndex: p.seatIndex,
        chips: p.chips,
        status: p.status,
        currentBet: p.currentBet,
        isBot: p.isBot,
        isConnected: p.isConnected,
        isSittingOut: p.isSittingOut,
        timeBank: p.timeBank,
        // Only show own cards, or all cards at showdown
        cards: p.id === playerId
          ? p.cards
          : (state.phase === "showdown" && p.status !== "folded" ? p.cards : (p.cards ? [{ hidden: true }, { hidden: true }] : null)),
        isDealer: p.seatIndex === state.dealerSeat,
        isSmallBlind: p.seatIndex === state.smallBlindSeat,
        isBigBlind: p.seatIndex === state.bigBlindSeat,
      })),
    };
  }
}

import { type CardType, type Suit, type Rank, determineWinners, type PlayerResult } from "./hand-evaluator";
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
  players: SeatPlayer[];
  sidePots: { amount: number; eligible: string[] }[];
  lastAction?: { playerId: string; action: string; amount?: number };
  showdownResults?: PlayerResult[];
  commitmentHash?: string;
  // Format extensions
  gameFormat: GameFormat;
  currentBlindLevel: number;
  nextLevelIn: number; // seconds until next blind level
  isBombPot: boolean;
  playersRemaining: number;
}

export interface HandSummary {
  handNumber: number;
  players: { id: string; displayName: string; startChips: number; seatIndex: number }[];
  actions: { playerId: string; action: string; amount?: number; phase: GamePhase }[];
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
  private actionLog: { playerId: string; action: string; amount?: number; phase: GamePhase }[] = [];
  private handStartPlayers: { id: string; displayName: string; startChips: number; seatIndex: number }[] = [];

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
      players: [],
      sidePots: [],
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
    this.actedThisRound.clear();
    this.actionLog = [];

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

  // ─── Actions ───────────────────────────────────────────────────────────
  handleAction(playerId: string, action: string, amount?: number): { ok: boolean; error?: string } {
    const player = this.getPlayer(playerId);
    if (!player) return { ok: false, error: "Player not found" };
    if (this.state.phase === "waiting" || this.state.phase === "showdown" || this.state.phase === "collecting-seeds") {
      return { ok: false, error: "No active hand" };
    }
    if (player.seatIndex !== this.state.currentTurnSeat) {
      return { ok: false, error: "Not your turn" };
    }
    if (player.status === "folded" || player.status === "all-in") {
      return { ok: false, error: "Cannot act" };
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
        const callAmount = Math.min(this.state.minBet - player.currentBet, player.chips);
        player.chips -= callAmount;
        player.currentBet += callAmount;
        player.totalBetThisHand += callAmount;
        this.state.pot += callAmount;
        player.status = player.chips === 0 ? "all-in" : "called";
        break;
      }

      case "raise": {
        if (!amount || amount < this.state.minRaise) {
          // Allow all-in even if less than min raise
          if (amount && amount >= player.chips + player.currentBet) {
            // All-in
          } else {
            return { ok: false, error: `Minimum raise is ${this.state.minRaise}` };
          }
        }
        const raiseTotal = amount || this.state.minRaise;
        const toAdd = Math.min(raiseTotal - player.currentBet, player.chips);
        player.chips -= toAdd;
        player.currentBet += toAdd;
        player.totalBetThisHand += toAdd;
        this.state.pot += toAdd;
        this.state.minBet = player.currentBet;
        this.state.minRaise = player.currentBet + (player.currentBet - (this.state.minBet - toAdd + player.currentBet - toAdd > 0 ? this.bigBlind : this.bigBlind));
        this.state.minRaise = Math.max(player.currentBet + this.bigBlind, this.state.minRaise);
        player.status = player.chips === 0 ? "all-in" : "raised";

        // Reset acted set since a raise reopens action
        this.actedThisRound.clear();
        this.actedThisRound.add(playerId);
        break;
      }

      default:
        return { ok: false, error: "Unknown action" };
    }

    this.state.lastAction = { playerId, action, amount };
    this.actionLog.push({ playerId, action, amount, phase: this.state.phase });
    if (action !== "raise") {
      this.actedThisRound.add(playerId);
    }

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
    const playerHands = active.map(p => ({
      id: p.id,
      cards: p.cards!.map(c => ({ ...c, hidden: false })),
    }));

    const results = determineWinners(playerHands, this.state.communityCards);
    this.state.showdownResults = results;

    // Calculate pot distribution
    this.distributePot(results);

    // Calculate winners for summary
    const winnerAmounts: { playerId: string; amount: number }[] = [];
    const winnerResults = results.filter(r => r.isWinner);
    const share = Math.floor(this.state.pot / winnerResults.length);
    for (const w of winnerResults) {
      winnerAmounts.push({ playerId: w.playerId, amount: share });
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

  private distributePot(results: PlayerResult[]) {
    // Build side pots
    const active = this.state.players.filter(p => p.status !== "folded" && p.status !== "sitting-out");
    const allBets = active.map(p => p.totalBetThisHand).sort((a, b) => a - b);
    const uniqueBets = Array.from(new Set(allBets));

    if (uniqueBets.length <= 1 || active.every(p => p.totalBetThisHand === active[0].totalBetThisHand)) {
      // Simple pot - no side pots needed
      const winners = results.filter(r => r.isWinner);
      const share = Math.floor(this.state.pot / winners.length);
      for (const w of winners) {
        const player = this.getPlayer(w.playerId);
        if (player) player.chips += share;
      }
      // Remainder goes to first winner (closest to dealer)
      const remainder = this.state.pot - share * winners.length;
      if (remainder > 0) {
        const first = winners[0];
        const player = this.getPlayer(first.playerId);
        if (player) player.chips += remainder;
      }
      return;
    }

    // Side pot calculation
    let remainingPot = this.state.pot;
    let prevLevel = 0;

    for (const level of uniqueBets) {
      const contribution = level - prevLevel;
      const contributors = this.state.players.filter(
        p => p.totalBetThisHand >= level && p.status !== "sitting-out"
      );
      const potSize = contribution * contributors.length;
      remainingPot -= potSize;

      // Eligible winners for this pot
      const eligibleResults = results.filter(
        r => contributors.some(c => c.id === r.playerId) && active.some(a => a.id === r.playerId)
      );

      // Find best hand among eligible
      let best = eligibleResults[0];
      for (const r of eligibleResults) {
        if (r.hand.rankValue > best.hand.rankValue ||
          (r.hand.rankValue === best.hand.rankValue &&
            r.hand.kickers.join(",") > best.hand.kickers.join(","))) {
          best = r;
        }
      }

      const potWinners = eligibleResults.filter(
        r => r.hand.rankValue === best.hand.rankValue &&
          r.hand.kickers.join(",") === best.hand.kickers.join(",")
      );

      const share = Math.floor(potSize / potWinners.length);
      for (const w of potWinners) {
        const player = this.getPlayer(w.playerId);
        if (player) player.chips += share;
      }

      prevLevel = level;
    }
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

    // Set turn timer
    this.turnTimer = setTimeout(() => {
      // Auto-fold on timeout
      if (player.currentBet < this.state.minBet) {
        this.handleAction(player.id, "fold");
      } else {
        this.handleAction(player.id, "check");
      }
    }, this.timeBankSeconds * 1000);

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
      lastAction: state.lastAction,
      showdownResults: state.phase === "showdown" ? state.showdownResults : undefined,
      commitmentHash: state.commitmentHash,
      shuffleProof: state.phase === "showdown" && this.currentShuffleProof
        ? this.currentShuffleProof
        : undefined,
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

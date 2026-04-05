import { type CardType, type Suit, type Rank, determineWinners, evaluateHand, type PlayerResult } from "./hand-evaluator";
import { calculateEquity } from "./equity-calculator";
import { encodeCard, evaluate7Fast, getHandCategory } from "./fast-evaluator";
import { createProvablyFairShuffle, createProvablyFairShuffleMultiParty, type ShuffleProof, type PlayerSeedData } from "./crypto-shuffle";
import type { VRFClient } from "../blockchain/vrf-client";
import type { BlindLevel } from "./blind-presets";

// ─── Types ───────────────────────────────────────────────────────────────────
export type GamePhase = "waiting" | "collecting-seeds" | "pre-flop" | "flop" | "turn" | "river" | "showdown";
export type PlayerStatus = "waiting" | "thinking" | "folded" | "all-in" | "checked" | "called" | "raised" | "sitting-out";
export type GameFormat = "cash" | "sng" | "heads_up" | "tournament" | "bomb_pot" | "fast_fold" | "lottery_sng";

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
  voluntarySitOut: boolean; // true = player chose to sit out, false = disconnected/auto
  awaitingReady: boolean; // true = just joined, hasn't clicked "I'm Ready" yet
  missedBigBlind: boolean; // true = must post live BB on return (cash games)
  missedSmallBlind: boolean; // true = must post dead SB on return (cash games)
  waitingForBB: boolean; // true = player chose to wait for BB instead of posting missed blinds
  sitInNextHand: boolean; // true = clicked "I'm Ready" mid-hand, will join next deal
  totalBetThisHand: number;
  timeBank: number; // remaining time bank seconds
  consecutiveTimeouts: number; // WSOP rule: auto-sit-out after 2 consecutive timeouts
}

export interface InsuranceOffer {
  playerId: string;
  equity: number;
  cashOutAmount: number;
  fee: number;
}

export interface RunItBoard {
  communityCards: CardType[];
  winners: string[];
  potShare: number;
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
  // Insurance offers (all-in equity cash-out)
  insuranceOffers?: InsuranceOffer[] | null;
  insuranceResponses?: Map<string, boolean>;
  // Run it multiple
  runItPending?: boolean;
  runItResponses?: Map<string, number>;
  runItBoards?: RunItBoard[] | null;
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
  straddleEnabled?: boolean;
  bigBlindAnte?: boolean; // BBA: only BB posts ante
  speedMultiplier?: number; // 1.0 = normal, 0.5 = fast, 0.25 = turbo
  showAllHands?: boolean; // true = reveal all cards at showdown, false = winner only
  runItTwice?: "always" | "ask" | "no";
  showdownSpeed?: "fast" | "normal" | "slow";
  dealToAwayPlayers?: boolean;
  timeBankRefillHands?: number; // 0 = no refill
  sevenTwoBounty?: number; // 0 = disabled, else chips per player
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
  private lastRaiseSize: number = 0;

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
  private straddleEnabled: boolean;
  private bigBlindAnte: boolean;
  public speedMultiplier: number;
  public lastHandRake: number = 0; // rake taken from last hand (for persistence)
  public showAllHands: boolean;
  private runItTwice: "always" | "ask" | "no";
  public showdownSpeed: "fast" | "normal" | "slow";
  private dealToAwayPlayers: boolean;
  private timeBankRefillHands: number;
  private sevenTwoBounty: number;
  private handsPlayedSinceRefill = new Map<string, number>();

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
  // Blockchain identities for shuffle entropy (memberId + kycHash per player)
  public playerBlockchainIdentities = new Map<string, { memberId: string | null; kycHash: string | null }>();
  private currentVRFRequestId: string | null = null;
  private currentVRFRandomWord: string | null = null;

  constructor(
    public tableId: string,
    public opts: GameEngineOpts
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
    this.straddleEnabled = opts.straddleEnabled || false;
    this.bigBlindAnte = opts.bigBlindAnte || false;
    this.speedMultiplier = opts.speedMultiplier || 1.0;
    this.showAllHands = opts.showAllHands !== false; // default true
    this.runItTwice = opts.runItTwice || "ask";
    this.showdownSpeed = opts.showdownSpeed || "normal";
    this.dealToAwayPlayers = opts.dealToAwayPlayers || false;
    this.timeBankRefillHands = opts.timeBankRefillHands || 0;
    this.sevenTwoBounty = opts.sevenTwoBounty || 0;

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
      voluntarySitOut: false,
      awaitingReady: false,
      missedBigBlind: false,
      missedSmallBlind: false,
      waitingForBB: false,
      sitInNextHand: false,
      totalBetThisHand: 0,
      timeBank: 30, // 30 seconds of time bank per player
      consecutiveTimeouts: 0,
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
      if (this.state.phase !== "waiting" && this.state.phase !== "showdown" && player.status !== "folded") {
        player.status = "folded";
      }
      player.isSittingOut = true;
      player.status = "sitting-out";
      return seat;
    }

    // If all-in, keep player in hand until showdown to preserve pot eligibility
    if (player.status === "all-in" && this.state.phase !== "waiting" && this.state.phase !== "showdown") {
      player.isConnected = false;
      player.isSittingOut = true;
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
    this.lastRaiseSize = this.bigBlind;
    this.actionLog = [];
    this.vpipPlayers.clear();
    this.pfrPlayers.clear();

    // ── Activate players who clicked "I'm Ready" during the previous hand ──
    for (const p of this.state.players) {
      if (p.sitInNextHand) {
        p.sitInNextHand = false;
        p.isSittingOut = false;
        p.awaitingReady = false;
        if (p.status === "sitting-out") p.status = "waiting";
      }
    }

    // ── Missed blind tracking ──
    const eligible = this.state.players.filter(p => (this.dealToAwayPlayers || !p.isSittingOut) && !p.awaitingReady && p.chips > 0 && !p.waitingForBB);
    const isTournament = this.gameFormat === "sng" || this.gameFormat === "tournament";

    if (!isBombPot) {
      // Mark sitting-out players as having missed blinds (cash games)
      // In tournaments, we'll auto-post their blinds below instead
      if (!isTournament) {
        for (const p of this.state.players) {
          if (p.isSittingOut && p.chips > 0) {
            p.missedBigBlind = true;
            p.missedSmallBlind = true;
          }
        }
      }
    }

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

    let straddleSeat = -1;

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

      // Check if any waitingForBB players are now at the BB seat — restore them
      for (const p of this.state.players) {
        if (p.waitingForBB && p.chips > 0 && p.seatIndex === this.state.bigBlindSeat) {
          p.waitingForBB = false;
          p.isSittingOut = false;
          p.missedBigBlind = false;
          p.missedSmallBlind = false;
          p.status = "waiting";
        }
      }

      const sb = this.getPlayerBySeat(this.state.smallBlindSeat);
      const bb = this.getPlayerBySeat(this.state.bigBlindSeat);
      if (sb) this.postBlind(sb, this.smallBlind);
      if (bb) this.postBlind(bb, this.bigBlind);

      // Cash games: post dead SB + live BB for returning players with missed blinds
      if (!isTournament) {
        for (const p of eligible) {
          if (p.missedBigBlind || p.missedSmallBlind) {
            // Dead blind (missed SB) — goes directly to pot, NOT a live bet
            if (p.missedSmallBlind) {
              const deadAmount = Math.min(this.smallBlind, p.chips);
              p.chips -= deadAmount;
              this.state.pot += deadAmount;
              p.missedSmallBlind = false;
            }
            // Live blind (missed BB) — counts as currentBet (must be matched)
            if (p.missedBigBlind && p.chips > 0) {
              const liveAmount = Math.min(this.bigBlind, p.chips);
              p.chips -= liveAmount;
              p.currentBet = liveAmount;
              p.totalBetThisHand = liveAmount;
              this.state.pot += liveAmount;
              p.missedBigBlind = false;
            }
            if (p.chips === 0) p.status = "all-in";
          }
        }
      }

      // Post straddle (UTG posts 2x BB, becomes new effective big blind)
      if (this.straddleEnabled && eligible.length > 2) {
        const utgSeat = this.nextEligibleSeat(this.state.bigBlindSeat);
        const utg = this.getPlayerBySeat(utgSeat);
        if (utg && utg.chips > 0) {
          const straddleAmount = this.bigBlind * 2;
          this.postBlind(utg, straddleAmount);
          straddleSeat = utgSeat;
        }
      }

      // Post antes from blind schedule or base ante
      const currentAnte = this.baseAnte;
      if (currentAnte > 0) {
        if (this.bigBlindAnte) {
          // Big Blind Ante: only BB posts the ante (already posted blind via postBlind above)
          const bbPlayer = this.getPlayerBySeat(this.state.bigBlindSeat);
          if (bbPlayer && bbPlayer.chips > 0) {
            const anteAmount = Math.min(currentAnte, bbPlayer.chips);
            bbPlayer.chips -= anteAmount;
            bbPlayer.currentBet += anteAmount;
            bbPlayer.totalBetThisHand += anteAmount;
            this.state.pot += anteAmount;
            if (bbPlayer.chips === 0) bbPlayer.status = "all-in";
          }
        } else {
          // Traditional ante: every non-blind player posts
          for (const p of eligible) {
            if (p.seatIndex === this.state.smallBlindSeat || p.seatIndex === this.state.bigBlindSeat) continue;
            const actual = Math.min(currentAnte, p.chips);
            p.chips -= actual;
            p.currentBet += actual;
            p.totalBetThisHand += actual;
            this.state.pot += actual;
            if (p.chips === 0) p.status = "all-in";
          }
        }
      }
    }

    // Tournament/SNG: auto-post blinds + antes from sitting-out players (they bleed down)
    if (isTournament && !isBombPot) {
      for (const p of this.state.players) {
        if (p.isSittingOut && p.chips > 0) {
          // Post ante if applicable
          const currentAnte = this.baseAnte;
          if (currentAnte > 0) {
            const anteAmt = Math.min(currentAnte, p.chips);
            p.chips -= anteAmt;
            this.state.pot += anteAmt;
          }
          // Post SB if they're in SB position
          if (p.seatIndex === this.state.smallBlindSeat && p.chips > 0) {
            const sbAmt = Math.min(this.smallBlind, p.chips);
            p.chips -= sbAmt;
            this.state.pot += sbAmt;
          }
          // Post BB if they're in BB position
          if (p.seatIndex === this.state.bigBlindSeat && p.chips > 0) {
            const bbAmt = Math.min(this.bigBlind, p.chips);
            p.chips -= bbAmt;
            this.state.pot += bbAmt;
          }
          // If busted from auto-posted blinds, trigger elimination
          if (p.chips <= 0) {
            p.chips = 0;
            p.status = "all-in"; // will be caught by checkEliminations after hand
            this.onPlayerEliminated?.(p.id, p.displayName);
          }
        }
      }
    }

    const effectiveBB = (!isBombPot && straddleSeat >= 0) ? this.bigBlind * 2 : this.bigBlind;
    this.state.minBet = isBombPot ? 0 : effectiveBB;
    this.state.minRaise = effectiveBB * 2;

    // Snapshot chip total after blinds/antes for integrity verification
    this.snapshotChipTotal();

    // Deal cards — provably fair shuffle
    let deck: CardType[];
    let proof: ShuffleProof;

    // Collect blockchain identities of seated players
    const blockchainIds = eligible
      .map(p => {
        const bi = this.playerBlockchainIdentities.get(p.id);
        return bi ? { playerId: p.id, memberId: bi.memberId, kycHash: bi.kycHash } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (playerSeedData.length > 0 || this.currentVRFRandomWord || blockchainIds.length > 0) {
      const result = createProvablyFairShuffleMultiParty(
        this.tableId,
        this.state.handNumber,
        playerSeedData,
        this.currentVRFRandomWord || undefined,
        blockchainIds.length > 0 ? blockchainIds : undefined
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

    // Deal cards starting from the player left of the dealer (clockwise order)
    const dealOrder = this.getDealingOrder(eligible);
    for (const p of dealOrder) {
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
      // First to act pre-flop: after straddler if straddle is active, otherwise after BB (UTG)
      const firstToAct = straddleSeat >= 0
        ? this.nextEligibleSeat(straddleSeat)
        : this.nextEligibleSeat(this.state.bigBlindSeat);
      this.startTurn(firstToAct);
    }

    this.emitState();
  }

  private postBlind(player: SeatPlayer, amount: number) {
    const actual = Math.min(amount, player.chips);
    player.chips -= actual;
    player.currentBet += actual;
    player.totalBetThisHand += actual;
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

    // Reset consecutive timeout counter when player acts normally
    player.consecutiveTimeouts = 0;

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
        // Reject negative or non-numeric amounts
        if (amount !== undefined && (typeof amount !== "number" || amount <= 0 || !isFinite(amount))) {
          return { ok: false, error: "Invalid raise amount" };
        }
        // All-in is always allowed regardless of min raise
        const isAllIn = amount && amount >= player.chips + player.currentBet;
        if (!isAllIn && (!amount || amount < this.state.minRaise)) {
          return { ok: false, error: `Minimum raise is ${this.state.minRaise}` };
        }
        const raiseTotal = amount || this.state.minRaise;
        const toAdd = Math.min(raiseTotal - player.currentBet, player.chips);
        const previousMinBet = this.state.minBet;
        player.chips -= toAdd;
        player.currentBet += toAdd;
        player.totalBetThisHand += toAdd;
        this.state.pot += toAdd;
        this.state.minBet = player.currentBet;

        // Determine if this is a full raise (reopens action) or short all-in
        const actualRaiseSize = player.currentBet - previousMinBet;
        const isFullRaise = actualRaiseSize >= this.lastRaiseSize;

        if (isFullRaise) {
          this.lastRaiseSize = actualRaiseSize;
          const raiseIncrement = Math.max(actualRaiseSize, this.bigBlind);
          this.state.minRaise = player.currentBet + raiseIncrement;
          // Full raise reopens action for all players
          this.actedThisRound.clear();
          this.actedThisRound.add(playerId);
        } else {
          // Short all-in: does NOT reopen action
          this.state.minRaise = player.currentBet + this.lastRaiseSize;
          this.actedThisRound.add(playerId);
        }

        player.status = player.chips === 0 ? "all-in" : "raised";
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

  // ─── Insurance (Equity Cash-Out) ───────────────────────────────────────────

  private insuranceTimer: ReturnType<typeof setTimeout> | null = null;

  private offerInsurance() {
    const active = this.state.players.filter(p => p.status !== "folded" && p.status !== "sitting-out" && p.cards);
    if (active.length < 2) return;

    const playerCards = active.map(p => p.cards!);
    const equities = calculateEquity(playerCards, this.state.communityCards, 3000);

    const offers: InsuranceOffer[] = active.map((p, i) => {
      const equity = equities[i];
      const cashOut = Math.floor(this.state.pot * equity * 0.99);
      const fee = Math.floor(this.state.pot * equity * 0.01);
      return { playerId: p.id, equity, cashOutAmount: cashOut, fee };
    });

    this.state.insuranceOffers = offers;
    this.state.insuranceResponses = new Map();
    this.emitState();

    // 15 second timer — auto-decline all remaining
    this.insuranceTimer = setTimeout(() => {
      this.resolveInsurance();
    }, 15000);
  }

  acceptInsurance(playerId: string): { ok: boolean; error?: string } {
    if (!this.state.insuranceOffers) return { ok: false, error: "No insurance offers" };
    const offer = this.state.insuranceOffers.find(o => o.playerId === playerId);
    if (!offer) return { ok: false, error: "No offer for you" };
    if (this.state.insuranceResponses?.has(playerId)) return { ok: false, error: "Already responded" };

    this.state.insuranceResponses!.set(playerId, true);
    this.checkInsuranceComplete();
    return { ok: true };
  }

  declineInsurance(playerId: string): { ok: boolean; error?: string } {
    if (!this.state.insuranceOffers) return { ok: false, error: "No insurance offers" };
    const offer = this.state.insuranceOffers.find(o => o.playerId === playerId);
    if (!offer) return { ok: false, error: "No offer for you" };
    if (this.state.insuranceResponses?.has(playerId)) return { ok: false, error: "Already responded" };

    this.state.insuranceResponses!.set(playerId, false);
    this.checkInsuranceComplete();
    return { ok: true };
  }

  private checkInsuranceComplete() {
    if (!this.state.insuranceOffers || !this.state.insuranceResponses) return;
    const active = this.state.players.filter(p => p.status !== "folded" && p.status !== "sitting-out" && p.cards);
    if (this.state.insuranceResponses.size >= active.length) {
      this.resolveInsurance();
    }
  }

  private resolveInsurance() {
    if (this.insuranceTimer) { clearTimeout(this.insuranceTimer); this.insuranceTimer = null; }
    if (!this.state.insuranceOffers || !this.state.insuranceResponses) {
      this.state.insuranceOffers = null;
      this.proceedAfterInsurance();
      return;
    }

    const acceptors: string[] = [];
    for (const offer of this.state.insuranceOffers) {
      if (this.state.insuranceResponses.get(offer.playerId) === true) {
        const player = this.getPlayer(offer.playerId);
        if (player) {
          player.chips += offer.cashOutAmount;
          this.state.pot -= offer.cashOutAmount;
          acceptors.push(offer.playerId);
          // Remove player from active hand
          player.status = "folded";
        }
      }
    }

    // If all players took insurance, distribute any remaining dust to last acceptor
    const active = this.state.players.filter(p => p.status !== "folded" && p.status !== "sitting-out" && p.cards);
    if (active.length === 0 && this.state.pot > 0 && acceptors.length > 0) {
      const lastAcceptor = this.getPlayer(acceptors[acceptors.length - 1]);
      if (lastAcceptor) {
        lastAcceptor.chips += this.state.pot;
        this.state.pot = 0;
      }
    }

    this.state.insuranceOffers = null;
    this.state.insuranceResponses = undefined;
    this.proceedAfterInsurance();
  }

  private proceedAfterInsurance() {
    const active = this.activePlayers();
    if (active.length <= 1) {
      this.endHandLastStanding();
    } else {
      this.checkRunItMultiple();
    }
  }

  // ─── Run It Multiple ────────────────────────────────────────────────────────

  private runItTimer: ReturnType<typeof setTimeout> | null = null;

  private checkRunItMultiple() {
    const active = this.state.players.filter(p => p.status !== "folded" && p.status !== "sitting-out");
    const allAllIn = active.every(p => p.status === "all-in");
    if (!allAllIn || active.length < 2) {
      this.runOutBoard();
      return;
    }

    // Run It Twice mode: "no" = never, "always" = auto-run twice, "ask" = vote
    if (this.runItTwice === "no") {
      this.runOutBoard();
      return;
    }

    if (this.runItTwice === "always") {
      // Auto-set all votes to 2 and resolve immediately
      this.state.runItResponses = new Map();
      for (const p of active) {
        this.state.runItResponses.set(p.id, 2);
      }
      this.resolveRunIt();
      return;
    }

    // "ask" — current voting behavior
    this.state.runItPending = true;
    this.state.runItResponses = new Map();
    this.emitState();

    this.runItTimer = setTimeout(() => {
      this.resolveRunIt();
    }, 10000);
  }

  proposeRunCount(playerId: string, count: 1 | 2 | 3): { ok: boolean; error?: string } {
    if (!this.state.runItPending) return { ok: false, error: "No run-it vote active" };
    if (this.state.runItResponses?.has(playerId)) return { ok: false, error: "Already voted" };

    this.state.runItResponses!.set(playerId, count);

    const active = this.state.players.filter(p => p.status !== "folded" && p.status !== "sitting-out");
    if (this.state.runItResponses!.size >= active.length) {
      this.resolveRunIt();
    }
    this.emitState();
    return { ok: true };
  }

  private resolveRunIt() {
    if (this.runItTimer) { clearTimeout(this.runItTimer); this.runItTimer = null; }

    let runCount = 1;
    if (this.state.runItResponses && this.state.runItResponses.size > 0) {
      // Take minimum of all votes (if anyone says 1, run once)
      runCount = Math.min(...Array.from(this.state.runItResponses.values()));
    }

    this.state.runItPending = false;
    this.state.runItResponses = undefined;

    if (runCount <= 1) {
      this.runOutBoard();
      return;
    }

    // Run multiple boards — live poker style: deal from same deck, no reshuffle
    const active = this.state.players.filter(p => p.status !== "folded" && p.status !== "sitting-out" && p.cards);
    const savedCommunity = [...this.state.communityCards];
    const potPerBoard = Math.floor(this.state.pot / runCount);
    const boards: RunItBoard[] = [];

    // Single deck stub — all runs deal sequentially from here (like live play)
    const stub = [...this.deck];
    let deckIdx = 0;

    for (let b = 0; b < runCount; b++) {
      // Deal remaining community cards for this run (burn + deal per street)
      const boardCommunity = [...savedCommunity];
      while (boardCommunity.length < 5) {
        deckIdx++; // burn card
        if (deckIdx >= stub.length) break; // deck exhausted
        boardCommunity.push(stub[deckIdx]);
        deckIdx++;
        if (deckIdx >= stub.length) break; // deck exhausted
      }
      // If we couldn't deal enough cards, skip this board
      if (boardCommunity.length < 5) break;

      // Evaluate each player's hand against this board
      const boardCommunityEncoded = boardCommunity.map(encodeCard);
      let bestScore = 0;
      const scores: { id: string; score: number }[] = [];
      for (const p of active) {
        const encoded = [...p.cards!.map(encodeCard), ...boardCommunityEncoded];
        const score = evaluate7Fast(encoded);
        scores.push({ id: p.id, score });
        if (score > bestScore) bestScore = score;
      }
      const winners = scores.filter(s => s.score === bestScore).map(s => s.id);

      boards.push({ communityCards: boardCommunity, winners, potShare: potPerBoard });

      // Distribute pot for this board
      const share = Math.floor(potPerBoard / winners.length);
      for (const wId of winners) {
        const player = this.getPlayer(wId);
        if (player) player.chips += share;
      }
    }

    // Handle remainder from pot division
    const distributed = potPerBoard * runCount;
    const remainder = this.state.pot - distributed;
    if (remainder > 0 && boards.length > 0) {
      const lastWinner = this.getPlayer(boards[boards.length - 1].winners[0]);
      if (lastWinner) lastWinner.chips += remainder;
    }

    this.state.runItBoards = boards;
    // Use the first board's community cards for the main display so the
    // table view shows the primary run; the RunItResults overlay renders all boards
    this.state.communityCards = boards[0].communityCards;
    this.goToShowdown();
  }

  // Buy extra time with chips (1 big blind = +10 seconds)
  buyTime(playerId: string): { ok: boolean; error?: string; costChips?: number; extraSeconds?: number } {
    const player = this.getPlayer(playerId);
    if (!player) return { ok: false, error: "Player not found" };
    if (player.seatIndex !== this.state.currentTurnSeat) return { ok: false, error: "Not your turn" };
    if (player.status !== "thinking") return { ok: false, error: "Not in thinking state" };
    if (player.chips < this.bigBlind) return { ok: false, error: "Insufficient chips" };

    const cost = this.bigBlind;
    player.chips -= cost;
    this.state.pot += cost;
    // Note: buyTime cost is a dead chip (like rake), not a bet — don't add to totalBetThisHand
    // as it would corrupt side-pot distribution calculations

    // Extend turn deadline by 10 seconds
    const extraSeconds = 10;
    this.state.turnDeadline += extraSeconds * 1000;

    // Reset turn timer
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
    }
    const remaining = this.state.turnDeadline - Date.now() + (player.timeBank * 1000);
    this.turnTimer = setTimeout(() => {
      player.timeBank = 0;
      if (player.currentBet < this.state.minBet) {
        this.handleAction(player.id, "fold");
      } else {
        this.handleAction(player.id, "check");
      }
      if (!player.isBot) {
        player.consecutiveTimeouts++;
        if (player.consecutiveTimeouts >= 2) {
          player.isSittingOut = true;
          player.status = "sitting-out";
        }
      }
    }, Math.max(remaining, 1000));

    this.emitState();
    return { ok: true, costChips: cost, extraSeconds };
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
    this.lastRaiseSize = this.bigBlind;

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
    // Check if insurance should be offered (all-in with community cards remaining)
    const active = this.state.players.filter(p => p.status !== "folded" && p.status !== "sitting-out");
    const allAllIn = active.length >= 2 && active.every(p => p.status === "all-in");
    if (allAllIn && this.state.communityCards.length < 5 && !this.state.insuranceOffers && !this.state.runItPending) {
      this.offerInsurance();
      return;
    }

    // Deal one street at a time with 2-second delay between each
    if (this.state.communityCards.length >= 5) {
      this.goToShowdown();
      return;
    }

    if (this.state.communityCards.length === 0) {
      this.state.phase = "flop";
      this.deck.pop();
      this.state.communityCards.push(this.deck.pop()!, this.deck.pop()!, this.deck.pop()!);
    } else if (this.state.communityCards.length === 3) {
      this.state.phase = "turn";
      this.deck.pop();
      this.state.communityCards.push(this.deck.pop()!);
    } else if (this.state.communityCards.length === 4) {
      this.state.phase = "river";
      this.deck.pop();
      this.state.communityCards.push(this.deck.pop()!);
    }

    this.emitState();

    if (this.state.communityCards.length < 5) {
      setTimeout(() => this.runOutBoard(), 2000);
    } else {
      setTimeout(() => this.goToShowdown(), 2000);
    }
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

    // 7-2 Bounty: if a winner holds 7-2, collect bounty from each non-folded opponent
    if (this.sevenTwoBounty > 0) {
      for (const r of results) {
        if (!r.isWinner) continue;
        const winner = this.state.players.find(p => p.id === r.playerId);
        if (!winner?.cards) continue;
        const ranks = winner.cards.map(c => c.rank).sort();
        if (ranks[0] === "2" && ranks[1] === "7") {
          const opponents = active.filter(p => p.id !== winner.id);
          let totalBounty = 0;
          for (const opp of opponents) {
            const pay = Math.min(this.sevenTwoBounty, opp.chips);
            opp.chips -= pay;
            totalBounty += pay;
          }
          winner.chips += totalBounty;
        }
      }
    }

    // Time bank refill: track hands played and refill when threshold reached
    if (this.timeBankRefillHands > 0) {
      for (const p of active) {
        const count = (this.handsPlayedSinceRefill.get(p.id) || 0) + 1;
        if (count >= this.timeBankRefillHands) {
          p.timeBank = this.timeBankSeconds;
          this.handsPlayedSinceRefill.set(p.id, 0);
        } else {
          this.handsPlayedSinceRefill.set(p.id, count);
        }
      }
    }

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

    // Auto-start next hand after delay (scaled by speed multiplier and showdown speed)
    const showdownDelays = { fast: 2500, normal: 5000, slow: 8000 };
    const baseDelay = showdownDelays[this.showdownSpeed] || 5000;
    this.showdownTimer = setTimeout(() => {
      if (this.canStartHand()) {
        this.startHand();
      } else {
        this.state.phase = "waiting";
        this.emitState();
      }
    }, baseDelay * this.speedMultiplier);
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
    // Use a modulus large enough to cover all possible seat indices (max 10 seats)
    const MOD = 10;
    const dealerSeat = this.state.dealerSeat;
    return [...playerIds].sort((aId, bId) => {
      const aPlayer = this.getPlayer(aId);
      const bPlayer = this.getPlayer(bId);
      if (!aPlayer || !bPlayer) return 0;
      // Distance from dealer going clockwise (left of dealer = seat after dealer)
      const aDist = (aPlayer.seatIndex - dealerSeat + MOD) % MOD;
      const bDist = (bPlayer.seatIndex - dealerSeat + MOD) % MOD;
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
        // Fallback: kicker-based comparison with numeric kicker arrays
        // Kickers are already numeric (2-14) from the hand evaluator
        function compareKickers(a: number[], b: number[]): number {
          for (let i = 0; i < Math.min(a.length, b.length); i++) {
            const diff = a[i] - b[i];
            if (diff !== 0) return diff;
          }
          return 0;
        }

        let bestRankValue = -1;
        let bestKickers: number[] = [];
        for (const r of eligibleResults) {
          if (
            r.hand.rankValue > bestRankValue ||
            (r.hand.rankValue === bestRankValue && compareKickers(r.hand.kickers, bestKickers) > 0)
          ) {
            bestRankValue = r.hand.rankValue;
            bestKickers = r.hand.kickers;
          }
        }
        potWinners = eligibleResults.filter(
          r => r.hand.rankValue === bestRankValue && compareKickers(r.hand.kickers, bestKickers) === 0
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
    const potAmount = this.state.pot;
    if (active.length === 1) {
      active[0].chips += potAmount;
      this.state.lastAction = { playerId: active[0].id, action: "win" };
    }
    // Zero pot after distribution so clients don't see stale value
    this.state.pot = 0;

    // Fire hand complete callback with proof and summary
    const winnerAmounts = active.length === 1
      ? [{ playerId: active[0].id, amount: potAmount }]
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
    }, 3000 * this.speedMultiplier);
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
      // WSOP rule: track consecutive timeouts, auto-sit-out after 2
      if (!player.isBot) {
        player.consecutiveTimeouts++;
        if (player.consecutiveTimeouts >= 2) {
          player.isSittingOut = true;
          player.status = "sitting-out";
        }
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

  /** Return players in clockwise dealing order starting left of dealer (SB first, dealer last) */
  private getDealingOrder(eligible: SeatPlayer[]): SeatPlayer[] {
    if (eligible.length <= 1) return eligible;
    const sorted = [...eligible].sort((a, b) => a.seatIndex - b.seatIndex);
    // Find the first player whose seatIndex is after the dealer
    const dealerIdx = sorted.findIndex(p => p.seatIndex > this.state.dealerSeat);
    if (dealerIdx <= 0) return sorted; // dealer is at the highest seat or all seats are after
    // Rotate: players after dealer come first, then wrap to the beginning
    return [...sorted.slice(dealerIdx), ...sorted.slice(0, dealerIdx)];
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
    if (idx >= 0 && idx < seats.length - 1) {
      // Current seat exists in the list — return the next one
      return seats[idx + 1];
    }
    if (idx === seats.length - 1) {
      // Current seat is the last — wrap to first
      return seats[0];
    }
    // Current seat is NOT in the list (player left) — find the next seat clockwise
    // This is the first seat with index > current, wrapping around
    const next = seats.find(s => s > current);
    return next !== undefined ? next : seats[0];
  }

  private clearTimers() {
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
  }

  cleanup() {
    this.clearTimers();
    this.clearSeedTimer();
    if (this.showdownTimer) { clearTimeout(this.showdownTimer); this.showdownTimer = null; }
    if (this.blindLevelTimer) { clearTimeout(this.blindLevelTimer); this.blindLevelTimer = null; }
    if (this.insuranceTimer) { clearTimeout(this.insuranceTimer); this.insuranceTimer = null; }
    if (this.runItTimer) { clearTimeout(this.runItTimer); this.runItTimer = null; }
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
      // Insurance offers (only show hero's offer)
      insuranceOffer: state.insuranceOffers?.find(o => o.playerId === playerId) || null,
      insuranceActive: !!state.insuranceOffers,
      // Run it multiple
      runItPending: state.runItPending || false,
      runItBoards: state.runItBoards || null,
      // Big blind for UI
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      speedMultiplier: this.speedMultiplier,
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
        awaitingReady: p.awaitingReady || false,
        waitingForBB: p.waitingForBB || false,
        missedBlinds: (p.missedBigBlind || p.missedSmallBlind) ? true : false,
        timeBank: p.timeBank,
        // Only show own cards, or all/winner cards at showdown
        cards: p.id === playerId
          ? p.cards
          : (state.phase === "showdown" && p.status !== "folded"
            ? (this.showAllHands
              ? p.cards
              : (state.showdownResults?.some(r => r.playerId === p.id && r.isWinner) ? p.cards : (p.cards ? [{ hidden: true }, { hidden: true }] : null)))
            : (p.cards ? [{ hidden: true }, { hidden: true }] : null)),
        isDealer: p.seatIndex === state.dealerSeat,
        isSmallBlind: p.seatIndex === state.smallBlindSeat,
        isBigBlind: p.seatIndex === state.bigBlindSeat,
      })),
    };
  }
}

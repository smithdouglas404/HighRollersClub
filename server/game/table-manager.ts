import { GameEngine, type HandSummary, type GameFormat } from "./engine";
import { CollusionDetector } from "./collusion-detector";
import { BotPlayer, getRandomPersonality, getBotDisplayName } from "./bot-player";
import { storage } from "../storage";
import { sendGameStateToTable, broadcastToTable, clearClientTable } from "../websocket";
import type { ShuffleProof } from "./crypto-shuffle";
import { blockchainConfig } from "../blockchain/config";
import { VRFClient } from "../blockchain/vrf-client";
import { ContractClient } from "../blockchain/contract-client";
import { SNGLifecycle, type EliminationInfo } from "./format-lifecycle";
import { STANDARD_SNG_SCHEDULE, getDefaultPayouts, type BlindLevel, type PayoutEntry } from "./blind-presets";

// 12 cinematic avatar IDs available for players
const AVATAR_IDS = [
  "neon-viper", "chrome-siren", "gold-phantom", "shadow-king",
  "red-wolf", "ice-queen", "tech-monk", "cyber-punk",
  "steel-ghost", "neon-fox", "dark-ace", "bolt-runner",
] as const;

// Bots start at index 4 ("red-wolf") to avoid clashing with human defaults
const BOT_AVATAR_START_INDEX = 4;

export interface TableInstance {
  engine: GameEngine;
  bots: BotPlayer[];
  lifecycle: SNGLifecycle | null;
  avatarMap: Map<string, string>; // playerId → avatarId
  handCountdownTimer: ReturnType<typeof setTimeout> | null; // prevent stacking
  config: {
    maxPlayers: number;
    smallBlind: number;
    bigBlind: number;
    minBuyIn: number;
    maxBuyIn: number;
    timeBankSeconds: number;
    allowBots: boolean;
    replaceBots: boolean;
    gameFormat: GameFormat;
    buyInAmount: number;
    startingChips: number;
  };
  getStateForPlayer(playerId: string): any;
}

class TableManager {
  private tables = new Map<string, TableInstance>();
  private vrfClient: VRFClient | null = null;
  private contractClient: ContractClient | null = null;
  private collusionDetector = new CollusionDetector();
  private handsTracked = 0;
  // Players flagged as "pending leave" — will be cashed out after the current hand ends
  private pendingLeaves = new Map<string, Set<string>>(); // tableId → Set<userId>
  // Auto-cashout timers for disconnected players (5 min)
  private autoCashoutTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // Lock set to prevent concurrent join_table for the same user
  private joiningUsers = new Set<string>();

  constructor() {
    if (blockchainConfig.enabled) {
      try {
        this.vrfClient = new VRFClient();
        this.contractClient = new ContractClient();
      } catch {
        console.warn("Blockchain clients failed to initialize, running without blockchain");
      }
    }
  }

  getTable(tableId: string): TableInstance | undefined {
    return this.tables.get(tableId);
  }

  private async ensureTable(tableId: string): Promise<TableInstance> {
    let instance = this.tables.get(tableId);
    if (instance) return instance;

    // Load table config from storage
    const tableRow = await storage.getTable(tableId);
    if (!tableRow) throw new Error("Table not found");

    const gameFormat = (tableRow.gameFormat || "cash") as GameFormat;
    const blindSchedule = (tableRow.blindSchedule as BlindLevel[]) || [];

    // Convert gameSpeed string to multiplier
    const speedMap: Record<string, number> = { normal: 1.0, fast: 0.5, turbo: 0.25 };
    const speedMultiplier = speedMap[(tableRow as any).gameSpeed] || 1.0;

    const engine = new GameEngine(tableId, {
      smallBlind: tableRow.smallBlind,
      bigBlind: tableRow.bigBlind,
      timeBankSeconds: tableRow.timeBankSeconds,
      gameFormat,
      blindSchedule,
      bombPotFrequency: tableRow.bombPotFrequency || 0,
      bombPotAnte: tableRow.bombPotAnte || 0,
      ante: tableRow.ante,
      rakePercent: tableRow.rakePercent || 0,
      rakeCap: tableRow.rakeCap || 0,
      straddleEnabled: tableRow.straddleEnabled || false,
      bigBlindAnte: (tableRow as any).bigBlindAnte || false,
      speedMultiplier,
    });

    // Pass VRF client if available
    if (this.vrfClient) {
      engine.vrfClient = this.vrfClient;
    }

    // Create lifecycle for SNG
    let lifecycle: SNGLifecycle | null = null;
    if (gameFormat === "sng") {
      lifecycle = new SNGLifecycle(
        tableRow.maxPlayers,
        tableRow.buyInAmount || tableRow.minBuyIn,
        tableRow.startingChips || 1500,
        (tableRow.payoutStructure as PayoutEntry[]) || null,
        blindSchedule.length > 0 ? blindSchedule : STANDARD_SNG_SCHEDULE,
      );
    }

    // Track phase for commitment broadcasts
    let lastPhase = "waiting";

    // When state changes, broadcast to all connected clients
    engine.onStateChange = () => {
      // Broadcast seed request when collecting seeds
      if (engine.state.phase === "collecting-seeds" && lastPhase !== "collecting-seeds") {
        broadcastToTable(tableId, {
          type: "seed_request",
          handNumber: engine.state.handNumber,
          deadline: Date.now() + 5000,
        } as any);
      }

      // Broadcast bomb pot starting
      if (engine.state.isBombPot && engine.state.phase === "flop" && lastPhase !== "flop") {
        broadcastToTable(tableId, {
          type: "bomb_pot_starting",
        } as any);
      }

      // Broadcast commitment hash when a new hand starts
      if ((engine.state.phase === "pre-flop" || (engine.state.isBombPot && engine.state.phase === "flop")) && lastPhase !== engine.state.phase) {
        const commitment = engine.getCurrentCommitment();
        if (commitment) {
          broadcastToTable(tableId, {
            type: "shuffle_commitment",
            commitmentHash: commitment,
            handNumber: engine.state.handNumber,
          } as any);

          // Fire blockchain commitment in background
          if (this.contractClient) {
            this.contractClient.commitHand(
              tableId,
              engine.state.handNumber,
              commitment,
              undefined
            ).then((result) => {
              if (result?.txHash) {
                broadcastToTable(tableId, {
                  type: "onchain_proof",
                  commitTx: result.txHash,
                  revealTx: null,
                } as any);
              }
            }).catch(() => {});
          }
        }
      }
      lastPhase = engine.state.phase;

      // Broadcast format info
      if (gameFormat !== "cash") {
        broadcastToTable(tableId, {
          type: "format_info",
          gameFormat,
          currentBlindLevel: engine.state.currentBlindLevel,
          nextLevelIn: engine.state.nextLevelIn,
          playersRemaining: engine.state.playersRemaining,
          isBombPot: engine.state.isBombPot,
        } as any);
      }

      sendGameStateToTable(tableId);
    };

    // When a hand completes, persist proof and broadcast reveal
    engine.onHandComplete = (proof: ShuffleProof, summary: HandSummary) => {
      const winnerIds = summary.winners.map(w => w.playerId);

      // Persist to storage with real summary + relational hand history
      storage.createGameHand({
        tableId,
        handNumber: proof.handNumber,
        dealerSeat: summary.dealerSeat,
        communityCards: summary.communityCards,
        potTotal: summary.pot,
        totalRake: engine.lastHandRake,
        winnerIds,
        summary: summary as any,
        serverSeed: proof.serverSeed,
        commitmentHash: proof.commitmentHash,
        deckOrder: proof.deckOrder,
        playerSeeds: proof.playerSeeds || null,
        vrfRequestId: proof.vrfRequestId || null,
        vrfRandomWord: proof.vrfRandomWord || null,
        onChainCommitTx: null,
        onChainRevealTx: null,
      }).then((savedHand) => {
        // Persist relational hand_players records
        const playerRecords = summary.players.map(p => {
          const enginePlayer = engine.getPlayer(p.id);
          const isWinner = winnerIds.includes(p.id);
          const endStack = enginePlayer ? enginePlayer.chips : 0;
          const finalAction = enginePlayer
            ? (enginePlayer.status === "folded" ? "fold" : enginePlayer.status === "all-in" ? "all-in" : "showdown")
            : "fold";
          return {
            handId: savedHand.id,
            userId: p.id,
            seatIndex: p.seatIndex,
            holeCards: enginePlayer?.cards || null,
            startStack: p.startChips,
            endStack,
            netResult: endStack - p.startChips,
            isWinner,
            finalAction,
          };
        });
        storage.createHandPlayers(playerRecords).catch(() => {});

        // Persist relational hand_actions records
        const actionRecords = summary.actions.map((a, idx) => ({
          handId: savedHand.id,
          playerId: a.playerId,
          street: a.phase,
          actionType: a.action,
          amount: a.amount || 0,
          timeSpent: a.timeSpent ? Math.round(a.timeSpent * 1000) : null, // convert seconds to ms
          sequenceNum: idx,
        }));
        storage.createHandActions(actionRecords).catch(() => {});
      }).catch(() => {});

      // Fire blockchain reveal in background
      if (this.contractClient) {
        const playerSeedStrings = (proof.playerSeeds || []).map(ps => ps.seed);
        this.contractClient.revealHand(
          tableId,
          proof.handNumber,
          proof.serverSeed,
          playerSeedStrings,
          proof.deckOrder
        ).then((result) => {
          if (result?.txHash) {
            broadcastToTable(tableId, {
              type: "onchain_proof",
              commitTx: null,
              revealTx: result.txHash,
            } as any);
          }
        }).catch(() => {});
      }

      // Record rake as a transaction for the house ledger
      const rakeAmount = engine.lastHandRake;
      if (rakeAmount > 0) {
        // Attribute rake proportionally to non-bot players who were in the hand
        const humanPlayers = summary.players.filter(p => !p.id.startsWith("bot-"));
        if (humanPlayers.length > 0) {
          const perPlayerRake = Math.floor(rakeAmount / humanPlayers.length);
          const remainder = rakeAmount - perPlayerRake * humanPlayers.length;
          for (let i = 0; i < humanPlayers.length; i++) {
            const p = humanPlayers[i];
            // First player absorbs any rounding remainder
            const playerRake = perPlayerRake + (i === 0 ? remainder : 0);
            if (playerRake <= 0) continue;
            storage.createTransaction({
              userId: p.id,
              type: "rake",
              amount: -playerRake,
              balanceBefore: 0, // rake is from in-game pot, not wallet
              balanceAfter: 0,
              tableId,
              description: `Rake from hand #${proof.handNumber}`,
              walletType: null,
              relatedTransactionId: null,
              paymentId: null,
              metadata: null,
            }).catch(() => {});
          }
        }
      }

      // Update player stats for missions (non-bot players only)
      for (const p of summary.players) {
        if (!p.id.startsWith("bot-")) {
          storage.incrementPlayerStat(p.id, "handsPlayed", 1).catch(() => {});
        }
      }
      for (const w of summary.winners) {
        if (!w.playerId.startsWith("bot-")) {
          storage.incrementPlayerStat(w.playerId, "potsWon", 1).catch(() => {});
        }
      }

      // Track VPIP and PFR for pre-flop voluntary actions
      for (const vpipId of engine.vpipPlayers) {
        if (!vpipId.startsWith("bot-")) {
          storage.incrementPlayerStat(vpipId, "vpip", 1).catch(() => {});
        }
      }
      for (const pfrId of engine.pfrPlayers) {
        if (!pfrId.startsWith("bot-")) {
          storage.incrementPlayerStat(pfrId, "pfr", 1).catch(() => {});
        }
      }

      // Track bomb pot plays
      if (engine.state.isBombPot) {
        for (const p of summary.players) {
          if (!p.id.startsWith("bot-")) {
            storage.incrementPlayerStat(p.id, "bombPotsPlayed", 1).catch(() => {});
          }
        }
      }

      // Feed hand to collusion detector
      this.collusionDetector.recordHand(summary);
      this.handsTracked++;
      if (this.handsTracked % 10 === 0) {
        const alerts = this.collusionDetector.checkAlerts();
        for (const alert of alerts) {
          console.warn(`[COLLUSION ALERT] ${alert.severity.toUpperCase()}: ${alert.reason} between ${alert.player1} and ${alert.player2} — ${alert.details}`);
        }
      }

      // Notify bots of hand result for personality chat
      const winnerIdSet = new Set(winnerIds);
      if (instance) {
        for (const bot of instance.bots) {
          const wasInHand = summary.players.some(p => p.id === bot.id);
          if (wasInHand) {
            bot.onHandResult(winnerIdSet.has(bot.id));
          }
        }
      }

      // Track heads-up wins (2-player format only)
      if (gameFormat === "heads_up") {
        for (const w of summary.winners) {
          if (!w.playerId.startsWith("bot-")) {
            storage.incrementPlayerStat(w.playerId, "headsUpWins", 1).catch(() => {});
          }
        }
      }

      // Update league standings for club tables
      if (tableRow.clubId) {
        this.updateLeagueStandings(tableRow.clubId, summary.winners.map(w => w.playerId)).catch(() => {});
      }

      // Process pending leaves — cash out players who requested leave during the hand
      this.processPendingLeaves(tableId).catch(err => {
        console.error(`[table-manager] Error processing pending leaves for ${tableId}:`, err);
      });

      // Broadcast seed reveal at showdown
      broadcastToTable(tableId, {
        type: "shuffle_reveal",
        proof,
      } as any);
    };

    // Blind level increase callback
    engine.onBlindIncrease = (level: BlindLevel) => {
      broadcastToTable(tableId, {
        type: "blind_increase",
        level: level.level,
        sb: level.sb,
        bb: level.bb,
        ante: level.ante,
      } as any);
    };

    // Player eliminated callback (SNG/tournament)
    engine.onPlayerEliminated = (playerId: string, displayName: string) => {
      if (lifecycle) {
        const info = lifecycle.handleElimination(playerId, displayName);
        if (info) {
          broadcastToTable(tableId, {
            type: "player_eliminated",
            playerId: info.playerId,
            displayName: info.displayName,
            finishPlace: info.finishPlace,
            prizeAmount: info.prizeAmount,
          } as any);

          // Credit prize to user balance
          if (info.prizeAmount > 0 && !playerId.startsWith("bot-")) {
            this.creditPrize(playerId, info.prizeAmount, tableId).catch(() => {});
          }

          // Remove eliminated player from engine
          engine.forceRemovePlayer(playerId);

          // Check if SNG is complete
          if (lifecycle.isComplete()) {
            this.handleSNGComplete(tableId, lifecycle);
          }
        }
      }
    };

    // When a bot needs to act — delay varies by personality (scaled by speed)
    engine.onBotTurn = (botId: string) => {
      const inst = this.tables.get(tableId);
      if (!inst) return;
      const bot = inst.bots.find(b => b.id === botId);
      if (bot) {
        const delay = bot.getThinkingDelay() * engine.speedMultiplier;
        setTimeout(() => {
          bot.actAsync(engine).catch(() => bot.act(engine));
        }, delay);
      }
    };

    const avatarMap = new Map<string, string>();

    instance = {
      engine,
      bots: [],
      lifecycle,
      avatarMap,
      handCountdownTimer: null,
      config: {
        maxPlayers: tableRow.maxPlayers,
        smallBlind: tableRow.smallBlind,
        bigBlind: tableRow.bigBlind,
        minBuyIn: tableRow.minBuyIn,
        maxBuyIn: tableRow.maxBuyIn,
        timeBankSeconds: tableRow.timeBankSeconds,
        allowBots: tableRow.allowBots,
        replaceBots: tableRow.replaceBots ?? true,
        gameFormat,
        buyInAmount: tableRow.buyInAmount || tableRow.minBuyIn,
        startingChips: tableRow.startingChips || 1500,
      },
      getStateForPlayer: (playerId: string) => {
        const baseState = engine.getStateForPlayer(playerId);
        // Inject avatarId into each player from the avatarMap
        baseState.players = baseState.players.map((p: any) => ({
          ...p,
          avatarId: avatarMap.get(p.id) || null,
        }));
        return baseState;
      },
    };

    this.tables.set(tableId, instance);
    return instance;
  }

  private async creditPrize(userId: string, amount: number, tableId: string) {
    const user = await storage.getUser(userId);
    if (!user) return;

    // Determine wallet type from the table's game format
    const instance = this.tables.get(tableId);
    const format = instance?.config.gameFormat || "cash";
    const walletType = format === "sng" ? "sng" : format === "tournament" ? "tournament" : "main";

    await storage.ensureWallets(userId);
    const { newBalance } = await storage.atomicAddToWallet(userId, walletType as any, amount);
    await storage.createTransaction({
      userId,
      type: "prize",
      amount,
      balanceBefore: newBalance - amount,
      balanceAfter: newBalance,
      tableId,
      description: `Tournament prize (${amount} chips)`,
      walletType: walletType,
      relatedTransactionId: null,
      paymentId: null,
      metadata: null,
    });
  }

  private handleSNGComplete(tableId: string, lifecycle: SNGLifecycle) {
    const results = lifecycle.getResults();
    broadcastToTable(tableId, {
      type: "tournament_complete",
      results,
      prizePool: lifecycle.prizePool,
    } as any);

    // Track SNG win for 1st place finisher
    const winner = results.find((r: any) => r.finishPlace === 1);
    if (winner && !winner.playerId.startsWith("bot-")) {
      storage.incrementPlayerStat(winner.playerId, "sngWins", 1).catch(() => {});
    }

    // Clean up table after delay
    setTimeout(() => {
      const instance = this.tables.get(tableId);
      if (instance) {
        instance.engine.cleanup();
        instance.bots.forEach(b => b.cleanup());
        this.clearTableTimers(tableId);
        this.tables.delete(tableId);
      }
    }, 10000);
  }

  async joinTable(
    tableId: string,
    userId: string,
    displayName: string,
    buyIn: number,
    requestedSeat?: number
  ): Promise<{ ok: boolean; error?: string }> {
    // Prevent concurrent join_table for the same user (avoids double deduction)
    const lockKey = `${userId}:${tableId}`;
    if (this.joiningUsers.has(lockKey)) {
      return { ok: false, error: "Join already in progress" };
    }
    this.joiningUsers.add(lockKey);
    try {
      return await this._joinTableInner(tableId, userId, displayName, buyIn, requestedSeat);
    } finally {
      this.joiningUsers.delete(lockKey);
    }
  }

  private async _joinTableInner(
    tableId: string,
    userId: string,
    displayName: string,
    buyIn: number,
    requestedSeat?: number
  ): Promise<{ ok: boolean; error?: string }> {
    const instance = await this.ensureTable(tableId);
    const { engine, config, lifecycle } = instance;

    // SNG path: fixed buy-in
    if (config.gameFormat === "sng" && lifecycle) {
      const fixedBuyIn = config.buyInAmount;

      // Check if player already registered
      if (lifecycle.registeredPlayers.has(userId)) {
        return { ok: false, error: "Already registered" };
      }
      if (lifecycle.status !== "registering") {
        return { ok: false, error: "Tournament already started" };
      }

      // Atomically deduct fixed buy-in from SNG wallet
      const user = await storage.getUser(userId);
      if (!user) return { ok: false, error: "User not found" };

      await storage.ensureWallets(userId);
      const deductResult = await storage.atomicDeductFromWallet(userId, "sng", fixedBuyIn);
      if (!deductResult.success) {
        return { ok: false, error: "Insufficient chips in SNG wallet" };
      }

      await storage.createTransaction({
        userId,
        type: "buyin",
        amount: -fixedBuyIn,
        balanceBefore: deductResult.newBalance + fixedBuyIn,
        balanceAfter: deductResult.newBalance,
        tableId,
        description: `SNG buy-in`,
        walletType: "sng",
        relatedTransactionId: null,
        paymentId: null,
        metadata: null,
      });

      // Register in lifecycle
      lifecycle.register(userId, displayName, fixedBuyIn);

      // Find available seat
      const occupiedSeats = new Set(engine.state.players.map(p => p.seatIndex));
      let seat = requestedSeat;
      if (seat === undefined || occupiedSeats.has(seat)) {
        for (let i = 0; i < config.maxPlayers; i++) {
          if (!occupiedSeats.has(i)) { seat = i; break; }
        }
      }
      if (seat === undefined) return { ok: false, error: "No seats available" };

      // Add with starting chips (not buy-in amount)
      engine.addPlayer(userId, displayName, seat, config.startingChips, false);
      await storage.addTablePlayer(tableId, userId, seat, config.startingChips);

      // Use the player's profile avatar if set, otherwise assign first unused
      const usedAvatarsSNG = new Set(instance.avatarMap.values());
      const sngAvatar = (user.avatarId && AVATAR_IDS.includes(user.avatarId as any))
        ? user.avatarId
        : AVATAR_IDS.find(a => !usedAvatarsSNG.has(a)) || AVATAR_IDS[0];
      instance.avatarMap.set(userId, sngAvatar);

      broadcastToTable(tableId, {
        type: "player_joined",
        player: { id: userId, displayName, seatIndex: seat, chips: config.startingChips, avatarId: sngAvatar },
      }, userId);

      // Auto-start when full
      if (lifecycle.canStart()) {
        lifecycle.start();
        engine.startBlindSchedule();
        broadcastToTable(tableId, {
          type: "tournament_status",
          status: "playing",
          prizePool: lifecycle.prizePool,
        } as any);
        setTimeout(() => engine.startHand(), 2000);
      }

      return { ok: true };
    }

    // Normal cash game path
    if (buyIn < config.minBuyIn || buyIn > config.maxBuyIn) {
      return { ok: false, error: `Buy-in must be between ${config.minBuyIn} and ${config.maxBuyIn}` };
    }

    // Check if player already at table
    if (engine.getPlayer(userId)) {
      return { ok: false, error: "Already at this table" };
    }

    // Bot replacement: if enabled and table is full, remove one bot to make room
    if (config.replaceBots && engine.state.players.length >= config.maxPlayers) {
      const botPlayers = engine.state.players.filter(p => p.isBot);
      if (botPlayers.length > 0) {
        // Prefer a bot that's already folded or one in waiting/showdown phase
        const isActiveHand = engine.state.phase !== "waiting" && engine.state.phase !== "showdown";
        const foldedBot = isActiveHand
          ? botPlayers.find(p => { const bp = engine.getPlayer(p.id); return bp && bp.status === "folded"; })
          : null;
        const botToRemove = foldedBot || botPlayers[botPlayers.length - 1];

        if (isActiveHand && !foldedBot) {
          // All bots are still in hand — mark the last bot as sitting out so it's removed after hand
          const bp = engine.getPlayer(botToRemove.id);
          if (bp) bp.isSittingOut = true;
        } else {
          // Safe to remove immediately
          engine.forceRemovePlayer(botToRemove.id);
          const idx = instance.bots.findIndex(b => b.id === botToRemove.id);
          if (idx !== -1) {
            instance.bots[idx].cleanup();
            instance.bots.splice(idx, 1);
          }
          instance.avatarMap.delete(botToRemove.id);
        }
      }
    }

    // Check max players
    if (engine.state.players.length >= config.maxPlayers) {
      return { ok: false, error: "Table is full" };
    }

    // Atomically deduct from cash_game wallet
    const user = await storage.getUser(userId);
    if (!user) return { ok: false, error: "User not found" };

    await storage.ensureWallets(userId);
    const walletType = config.gameFormat === "sng" ? "sng" : config.gameFormat === "tournament" ? "tournament" : "cash_game";
    const deductResult = await storage.atomicDeductFromWallet(userId, walletType as any, buyIn);
    if (!deductResult.success) {
      return { ok: false, error: `Insufficient chips in ${walletType} wallet` };
    }

    await storage.createTransaction({
      userId,
      type: "buyin",
      amount: -buyIn,
      balanceBefore: deductResult.newBalance + buyIn,
      balanceAfter: deductResult.newBalance,
      tableId,
      description: `Buy-in at table`,
      walletType: walletType,
      relatedTransactionId: null,
      paymentId: null,
      metadata: null,
    });

    // Find available seat
    const occupiedSeats = new Set(engine.state.players.map(p => p.seatIndex));
    let seat = requestedSeat;
    if (seat === undefined || occupiedSeats.has(seat)) {
      for (let i = 0; i < config.maxPlayers; i++) {
        if (!occupiedSeats.has(i)) { seat = i; break; }
      }
    }
    if (seat === undefined) return { ok: false, error: "No seats available" };

    engine.addPlayer(userId, displayName, seat, buyIn, false);

    // New players join in "away" mode — must click "I'm Ready" to start playing
    const newPlayer = engine.getPlayer(userId);
    if (newPlayer) {
      newPlayer.isSittingOut = true;
      newPlayer.awaitingReady = true;
      newPlayer.status = "sitting-out";
    }

    // Use the player's profile avatar if set, otherwise assign first unused
    const usedAvatars = new Set(instance.avatarMap.values());
    const humanAvatar = (user.avatarId && AVATAR_IDS.includes(user.avatarId as any))
      ? user.avatarId
      : AVATAR_IDS.find(a => !usedAvatars.has(a)) || AVATAR_IDS[0];
    instance.avatarMap.set(userId, humanAvatar);

    // Track in storage
    await storage.addTablePlayer(tableId, userId, seat, buyIn);

    // Broadcast join
    broadcastToTable(tableId, {
      type: "player_joined",
      player: { id: userId, displayName, seatIndex: seat, chips: buyIn, avatarId: humanAvatar },
    }, userId);

    // Auto-fill bots for cash games when a human joins an empty-ish table
    if (config.gameFormat === "cash" && config.allowBots) {
      const humanCount = engine.state.players.filter(p => !p.isBot).length;
      const botCount = instance.bots.length;
      // Only auto-fill if this is the first human and no bots yet
      if (humanCount === 1 && botCount === 0) {
        setTimeout(() => {
          this.addBots(tableId).then(() => {
            sendGameStateToTable(tableId);
          }).catch(() => {});
        }, 1500);
        return { ok: true };
      }
    }

    // Auto-start if enough players ready
    this.maybeStartCountdown(tableId, instance);

    return { ok: true };
  }

  /** Trigger hand-start countdown if 2+ non-sitting-out players with chips */
  private maybeStartCountdown(tableId: string, instance: { engine: any; handCountdownTimer: ReturnType<typeof setTimeout> | null }) {
    const { engine } = instance;
    if (engine.state.phase === "waiting" && engine.canStartHand()) {
      if (instance.handCountdownTimer) {
        clearTimeout(instance.handCountdownTimer);
        instance.handCountdownTimer = null;
      }
      const countdownSec = Math.max(1, Math.round(5 * engine.speedMultiplier));
      broadcastToTable(tableId, {
        type: "hand_countdown",
        seconds: countdownSec,
      } as any);
      instance.handCountdownTimer = setTimeout(() => {
        const inst = this.tables.get(tableId);
        if (inst) inst.handCountdownTimer = null;
        if (inst && inst.engine.state.phase === "waiting" && inst.engine.canStartHand()) {
          inst.engine.startHand();
        }
      }, countdownSec * 1000);
    }
  }

  async leaveTable(tableId: string, userId: string): Promise<void> {
    const instance = this.tables.get(tableId);
    if (!instance) return;

    const player = instance.engine.getPlayer(userId);
    if (!player) return;

    // SNG during registration: refund buy-in
    if (instance.config.gameFormat === "sng" && instance.lifecycle && instance.lifecycle.status === "registering") {
      const reg = instance.lifecycle.registeredPlayers.get(userId);
      if (reg && reg.buyIn > 0) {
        // Refund buy-in to SNG wallet
        const { newBalance } = await storage.atomicAddToWallet(userId, "sng", reg.buyIn);
        await storage.createTransaction({
          userId,
          type: "refund",
          amount: reg.buyIn,
          balanceBefore: newBalance - reg.buyIn,
          balanceAfter: newBalance,
          tableId,
          description: "SNG buy-in refund (left before start)",
          walletType: "sng",
          relatedTransactionId: null,
          paymentId: null,
          metadata: null,
        });
      }
      instance.lifecycle.registeredPlayers.delete(userId);
      instance.lifecycle.prizePool -= (reg?.buyIn || 0);
      instance.engine.forceRemovePlayer(userId);
      instance.avatarMap.delete(userId);
      await storage.removeTablePlayer(tableId, userId);
      broadcastToTable(tableId, { type: "player_left", userId, displayName: player.displayName, seatIndex: player.seatIndex });
      return;
    }

    // SNG in play: forfeit (eliminate with last place)
    if (instance.config.gameFormat === "sng" && instance.lifecycle && instance.lifecycle.status === "playing") {
      const info = instance.lifecycle.forfeit(userId, player.displayName);
      if (info) {
        broadcastToTable(tableId, {
          type: "player_eliminated",
          playerId: info.playerId,
          displayName: info.displayName,
          finishPlace: info.finishPlace,
          prizeAmount: info.prizeAmount,
        } as any);

        if (info.prizeAmount > 0) {
          await this.creditPrize(userId, info.prizeAmount, tableId);
        }

        instance.engine.forceRemovePlayer(userId);
        instance.avatarMap.delete(userId);
        await storage.removeTablePlayer(tableId, userId);
        broadcastToTable(tableId, { type: "player_left", userId, displayName: player.displayName, seatIndex: player.seatIndex });

        if (instance.lifecycle.isComplete()) {
          this.handleSNGComplete(tableId, instance.lifecycle);
        }
        return;
      }
    }

    // ─── Cash Game: Check if player is in an active hand ──────────────────
    const phase = instance.engine.state.phase;
    const isInActiveHand = phase !== "waiting" && phase !== "showdown"
      && player.status !== "folded" && player.status !== "sitting-out";

    if (isInActiveHand) {
      // Player is in a hand — flag as "pending leave" instead of immediate removal.
      // They will be auto-folded/removed once the hand completes.
      let pending = this.pendingLeaves.get(tableId);
      if (!pending) {
        pending = new Set();
        this.pendingLeaves.set(tableId, pending);
      }
      pending.add(userId);

      // Mark sitting out so no new hands start for them
      player.isSittingOut = true;

      broadcastToTable(tableId, {
        type: "info",
        message: `${player.displayName} will leave after this hand`,
      } as any);
      return;
    }

    // ─── Not in hand — immediate cash-out ─────────────────────────────────
    await this.processCashOut(tableId, userId, instance);
  }

  /** Atomic cash-out: return chips to wallet and remove player from table */
  private async processCashOut(tableId: string, userId: string, instance: TableInstance): Promise<void> {
    const player = instance.engine.getPlayer(userId);
    if (!player) return;

    const cashOut = player.chips;
    const seatIndex = player.seatIndex;
    const displayName = player.displayName || "Player";

    // Remove from engine first (folds if mid-hand)
    instance.engine.removePlayer(userId);
    instance.avatarMap.delete(userId);

    // Return chips to wallet balance atomically (same wallet type used for buy-in)
    if (cashOut > 0) {
      const format = instance.config.gameFormat;
      const walletType = format === "sng" ? "sng" : format === "tournament" ? "tournament" : "cash_game";
      await storage.ensureWallets(userId);
      const { success, newBalance } = await storage.atomicAddToWallet(userId, walletType as any, cashOut);
      if (success) {
        await storage.createTransaction({
          userId,
          type: "cashout",
          amount: cashOut,
          balanceBefore: newBalance - cashOut,
          balanceAfter: newBalance,
          tableId,
          description: `Cash-out from table`,
          walletType: walletType,
          relatedTransactionId: null,
          paymentId: null,
          metadata: null,
        });
      }
    }

    await storage.removeTablePlayer(tableId, userId);

    // Clear the websocket client's table reference (important for pending leaves)
    clearClientTable(userId);

    // Remove from pending leaves if present
    this.pendingLeaves.get(tableId)?.delete(userId);

    // Cancel any auto-cashout timer for this player
    const cashoutTimerKey = `cashout:${tableId}:${userId}`;
    const cashoutTimer = this.autoCashoutTimers.get(cashoutTimerKey);
    if (cashoutTimer) {
      clearTimeout(cashoutTimer);
      this.autoCashoutTimers.delete(cashoutTimerKey);
    }

    broadcastToTable(tableId, { type: "player_left", userId, displayName, seatIndex });

    // Cancel hand countdown if no longer enough players to start
    if (instance.handCountdownTimer && !instance.engine.canStartHand()) {
      clearTimeout(instance.handCountdownTimer);
      instance.handCountdownTimer = null;
      broadcastToTable(tableId, { type: "hand_countdown", seconds: 0 } as any);
    }

    // Clean up empty table
    if (instance.engine.state.players.length === 0) {
      instance.engine.cleanup();
      instance.bots.forEach(b => b.cleanup());
      this.clearTableTimers(tableId);
      this.tables.delete(tableId);
    }
  }

  /** Process all pending leaves for a table (called after hand completion) */
  private async processPendingLeaves(tableId: string): Promise<void> {
    const pending = this.pendingLeaves.get(tableId);
    if (!pending || pending.size === 0) return;

    const instance = this.tables.get(tableId);
    if (!instance) {
      this.pendingLeaves.delete(tableId);
      return;
    }

    const userIds = Array.from(pending);
    for (const userId of userIds) {
      await this.processCashOut(tableId, userId, instance);
    }
    this.pendingLeaves.delete(tableId);
    sendGameStateToTable(tableId);
  }

  handleAction(
    tableId: string,
    userId: string,
    action: string,
    amount?: number,
    actionNumber?: number
  ): { ok: boolean; error?: string } {
    const instance = this.tables.get(tableId);
    if (!instance) return { ok: false, error: "Table not found" };

    // Verify player is actually seated at this table (seat ownership check)
    const player = instance.engine.getPlayer(userId);
    if (!player) return { ok: false, error: "Not seated at this table" };

    return instance.engine.handleAction(userId, action, amount, actionNumber);
  }

  handleBuyTime(tableId: string, userId: string): { ok: boolean; error?: string; costChips?: number; extraSeconds?: number } {
    const instance = this.tables.get(tableId);
    if (!instance) return { ok: false, error: "Table not found" };
    return instance.engine.buyTime(userId);
  }

  handleInsuranceResponse(tableId: string, userId: string, accept: boolean): { ok: boolean; error?: string } {
    const instance = this.tables.get(tableId);
    if (!instance) return { ok: false, error: "Table not found" };
    return accept
      ? instance.engine.acceptInsurance(userId)
      : instance.engine.declineInsurance(userId);
  }

  handleRunItVote(tableId: string, userId: string, count: 1 | 2 | 3): { ok: boolean; error?: string } {
    const instance = this.tables.get(tableId);
    if (!instance) return { ok: false, error: "Table not found" };
    return instance.engine.proposeRunCount(userId, count);
  }

  setSitOut(tableId: string, userId: string, sitOut: boolean) {
    const instance = this.tables.get(tableId);
    if (!instance) return;
    const player = instance.engine.getPlayer(userId);
    if (player) {
      player.isSittingOut = sitOut;
      player.voluntarySitOut = sitOut; // track intent: true = player chose to sit out
      player.awaitingReady = false; // clear "awaiting ready" on any sit-in/sit-out action
      if (sitOut) {
        player.status = "sitting-out";
      } else if (player.status === "sitting-out") {
        player.status = "waiting";
      }
      // If a player just marked ready, check if we can start a hand
      if (!sitOut) {
        this.maybeStartCountdown(tableId, instance);
      }
    }
  }

  // Track disconnect grace timers for reconnection
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // Clear all disconnect & auto-cashout timers for a table (prevents leaks on table deletion)
  private clearTableTimers(tableId: string) {
    for (const [key, timer] of this.disconnectTimers) {
      if (key.startsWith(`${tableId}:`)) {
        clearTimeout(timer);
        this.disconnectTimers.delete(key);
      }
    }
    for (const [key, timer] of this.autoCashoutTimers) {
      if (key.startsWith(`cashout:${tableId}:`)) {
        clearTimeout(timer);
        this.autoCashoutTimers.delete(key);
      }
    }
  }

  handleDisconnect(tableId: string, userId: string) {
    const instance = this.tables.get(tableId);
    if (!instance) return;
    const player = instance.engine.getPlayer(userId);
    if (!player) return;

    player.isConnected = false;

    // If it's their turn, auto-fold after a short timeout
    if (player.seatIndex === instance.engine.state.currentTurnSeat) {
      const handAtDisconnect = instance.engine.state.handNumber;
      setTimeout(() => {
        const inst = this.tables.get(tableId);
        if (!inst) return;
        const p = inst.engine.getPlayer(userId);
        if (!p || p.isConnected) return;
        // Only fold if we're still in the same hand
        if (inst.engine.state.handNumber !== handAtDisconnect) return;
        if (p.seatIndex === inst.engine.state.currentTurnSeat) {
          inst.engine.handleAction(userId, "fold");
          sendGameStateToTable(tableId);
        }
      }, 10000);
    }

    // Start reconnection grace period (60 seconds)
    // If player doesn't reconnect, mark them as sitting-out
    const timerKey = `${tableId}:${userId}`;
    // Clear any existing timer
    const existingTimer = this.disconnectTimers.get(timerKey);
    if (existingTimer) clearTimeout(existingTimer);

    const graceTimer = setTimeout(() => {
      this.disconnectTimers.delete(timerKey);
      const inst = this.tables.get(tableId);
      if (!inst) return;
      const p = inst.engine.getPlayer(userId);
      if (!p || p.isConnected) return;

      // Grace period expired — mark sitting out
      p.isSittingOut = true;
      if (p.status !== "folded") {
        p.status = "sitting-out";
      }

      // If it's somehow their turn, force fold
      if (p.seatIndex === inst.engine.state.currentTurnSeat) {
        inst.engine.handleAction(userId, "fold");
      }

      broadcastToTable(tableId, {
        type: "player_left",
        userId,
        displayName: p.displayName,
        seatIndex: p.seatIndex,
      });
      sendGameStateToTable(tableId);

      // Start 5-minute auto-cashout timer — if still disconnected, cash them out entirely
      const cashoutTimerKey = `cashout:${tableId}:${userId}`;
      const existingCashout = this.autoCashoutTimers.get(cashoutTimerKey);
      if (existingCashout) clearTimeout(existingCashout);

      const autoCashout = setTimeout(async () => {
        this.autoCashoutTimers.delete(cashoutTimerKey);
        const tableInst = this.tables.get(tableId);
        if (!tableInst) return;
        const disconnPlayer = tableInst.engine.getPlayer(userId);
        if (!disconnPlayer || disconnPlayer.isConnected) return;

        // Auto-cashout: return chips to wallet and remove from table
        console.log(`[table-manager] Auto-cashout for disconnected player ${userId} at table ${tableId}`);
        await this.processCashOut(tableId, userId, tableInst);
        sendGameStateToTable(tableId);
      }, 5 * 60 * 1000); // 5 minutes

      this.autoCashoutTimers.set(cashoutTimerKey, autoCashout);
    }, 60000);

    this.disconnectTimers.set(timerKey, graceTimer);
  }

  handleReconnect(tableId: string, userId: string) {
    const instance = this.tables.get(tableId);
    if (!instance) return;
    const player = instance.engine.getPlayer(userId);
    if (!player) return;

    player.isConnected = true;

    // Cancel disconnect grace timer
    const timerKey = `${tableId}:${userId}`;
    const timer = this.disconnectTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(timerKey);
    }

    // Cancel auto-cashout timer
    const cashoutTimerKey = `cashout:${tableId}:${userId}`;
    const cashoutTimer = this.autoCashoutTimers.get(cashoutTimerKey);
    if (cashoutTimer) {
      clearTimeout(cashoutTimer);
      this.autoCashoutTimers.delete(cashoutTimerKey);
    }

    // Note: Do NOT remove from pendingLeaves here — if the player explicitly clicked
    // "Leave" and their connection flickered, we should still honor their leave intent
    // after the current hand ends.

    // If player was marked sitting out from disconnect (not voluntary, not pending leave,
    // and not awaiting ready), restore them
    const isPendingLeave = this.pendingLeaves.get(tableId)?.has(userId) ?? false;
    if (player.isSittingOut && player.chips > 0 && !player.voluntarySitOut && !isPendingLeave && !player.awaitingReady) {
      player.isSittingOut = false;
      player.status = "waiting";
    }

    sendGameStateToTable(tableId);
  }

  async addBots(tableId: string): Promise<void> {
    const instance = await this.ensureTable(tableId);
    const { engine, config } = instance;

    const BOT_NAMES = ["CryptoKing", "Satoshi", "Whale_0x", "HODLer", "Degen", "NeonAce"];
    const BOT_PERSONALITIES = ["shark", "professor", "gambler", "robot", "rookie", "shark"] as const;
    let botIndex = instance.bots.length;

    // Collect already-used avatars so bots don't duplicate
    const usedAvatars = new Set(instance.avatarMap.values());
    let avatarOffset = 0;

    // Stagger bot joins to feel more natural (not all at once)
    const botsToAdd: Array<{ botId: string; botName: string; seat: number; chips: number; personality: typeof BOT_PERSONALITIES[number]; avatar: string }> = [];

    while (engine.state.players.length + botsToAdd.length < config.maxPlayers && botIndex < BOT_NAMES.length) {
      const occupiedSeats = new Set([
        ...engine.state.players.map(p => p.seatIndex),
        ...botsToAdd.map(b => b.seat),
      ]);
      let seat: number | undefined;
      for (let i = 0; i < config.maxPlayers; i++) {
        if (!occupiedSeats.has(i)) { seat = i; break; }
      }
      if (seat === undefined) break;

      const botId = `bot-${tableId}-${botIndex}`;
      const botName = BOT_NAMES[botIndex];

      // SNG bots get starting chips, cash bots get random buy-in
      const botChips = config.gameFormat === "sng"
        ? config.startingChips
        : config.minBuyIn + Math.floor(Math.random() * (config.maxBuyIn - config.minBuyIn));

      // Assign a unique avatar to the bot
      let botAvatar: string | null = null;
      for (let i = 0; i < AVATAR_IDS.length; i++) {
        const candidateIdx = (BOT_AVATAR_START_INDEX + avatarOffset + i) % AVATAR_IDS.length;
        const candidate = AVATAR_IDS[candidateIdx];
        if (!usedAvatars.has(candidate)) {
          botAvatar = candidate;
          usedAvatars.add(candidate);
          avatarOffset = avatarOffset + i + 1;
          break;
        }
      }
      if (!botAvatar) {
        botAvatar = AVATAR_IDS[(BOT_AVATAR_START_INDEX + botIndex) % AVATAR_IDS.length];
      }

      const personality = BOT_PERSONALITIES[botIndex % BOT_PERSONALITIES.length];
      botsToAdd.push({ botId, botName, seat, chips: botChips, personality, avatar: botAvatar });
      botIndex++;
    }

    // Add first bot immediately, stagger the rest with 1.5-4s cumulative delays
    let cumulativeDelay = 0;
    for (let i = 0; i < botsToAdd.length; i++) {
      if (i > 0) cumulativeDelay += 1500 + Math.random() * 2500;
      const delay = cumulativeDelay;
      const addBot = (b: typeof botsToAdd[0]) => {
        const inst = this.tables.get(tableId);
        if (!inst) return; // table may have been deleted

        inst.engine.addPlayer(b.botId, b.botName, b.seat, b.chips, true);
        const bot = new BotPlayer(b.botId, b.botName, b.personality);
        bot.setTableId(tableId);
        inst.bots.push(bot);
        inst.avatarMap.set(b.botId, b.avatar);

        // Register bot in SNG lifecycle — bots don't pay real buy-in, use 0 to avoid inflating prize pool
        if (inst.lifecycle && config.gameFormat === "sng") {
          inst.lifecycle.register(b.botId, b.botName, 0);
        }

        // Broadcast join notification
        broadcastToTable(tableId, {
          type: "player_joined",
          player: { id: b.botId, displayName: b.botName, seatIndex: b.seat, chips: b.chips, avatarId: b.avatar },
        });

        sendGameStateToTable(tableId);

        // SNG auto-start when full
        if (config.gameFormat === "sng" && inst.lifecycle && inst.lifecycle.canStart()) {
          inst.lifecycle.start();
          inst.engine.startBlindSchedule();
          broadcastToTable(tableId, {
            type: "tournament_status",
            status: "playing",
            prizePool: inst.lifecycle.prizePool,
          } as any);
          setTimeout(() => inst.engine.startHand(), 1000);
          return;
        }

        // Auto-start hand if enough players and still waiting
        this.maybeStartCountdown(tableId, inst);
      };

      if (delay === 0) {
        addBot(botsToAdd[i]);
      } else {
        setTimeout(() => addBot(botsToAdd[i]), delay);
      }
    }
  }

  handleSeedCommit(tableId: string, userId: string, commitmentHash: string) {
    const instance = this.tables.get(tableId);
    if (!instance) return;
    instance.engine.submitSeedCommitment(userId, commitmentHash);
  }

  handleSeedReveal(tableId: string, userId: string, seed: string) {
    const instance = this.tables.get(tableId);
    if (!instance) return;
    instance.engine.submitSeedReveal(userId, seed);
  }

  // Get all active table IDs
  getActiveTableIds(): string[] {
    return Array.from(this.tables.keys());
  }

  // Update league standings when a hand finishes on a club table
  private async updateLeagueStandings(clubId: string, winnerPlayerIds: string[]) {
    const season = await storage.getActiveLeagueSeason();
    if (!season) return;

    const standings: { clubId: string; clubName?: string; points: number; wins: number; losses: number }[] =
      (season.standings as any[] || []);

    let entry = standings.find(s => s.clubId === clubId);
    if (!entry) {
      // Look up club name
      const club = await storage.getClub(clubId);
      entry = { clubId, clubName: club?.name || "Unknown", points: 0, wins: 0, losses: 0 };
      standings.push(entry);
    }

    // Each hand won by a human = +1 point, +1 win for the club
    const humanWinners = winnerPlayerIds.filter(id => !id.startsWith("bot-"));
    if (humanWinners.length > 0) {
      entry.wins += 1;
      entry.points += 1;
    } else {
      entry.losses += 1;
    }

    await storage.updateLeagueStandings(season.id, standings);
  }
}

export const tableManager = new TableManager();

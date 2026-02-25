import { GameEngine, type HandSummary, type GameFormat } from "./engine";
import { BotPlayer } from "./bot-player";
import { storage } from "../storage";
import { sendGameStateToTable, broadcastToTable } from "../websocket";
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

    // When a bot needs to act
    engine.onBotTurn = (botId: string) => {
      const inst = this.tables.get(tableId);
      if (!inst) return;
      const bot = inst.bots.find(b => b.id === botId);
      if (bot) {
        setTimeout(() => {
          bot.act(engine);
        }, 1000 + Math.random() * 2000);
      }
    };

    const avatarMap = new Map<string, string>();

    instance = {
      engine,
      bots: [],
      lifecycle,
      avatarMap,
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
    await storage.updateUser(userId, { chipBalance: user.chipBalance + amount });
    await storage.createTransaction({
      userId,
      type: "prize",
      amount,
      balanceBefore: user.chipBalance,
      balanceAfter: user.chipBalance + amount,
      tableId,
      description: `Tournament prize (${amount} chips)`,
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

      // Deduct fixed buy-in from user balance
      const user = await storage.getUser(userId);
      if (!user) return { ok: false, error: "User not found" };
      if (user.chipBalance < fixedBuyIn) {
        return { ok: false, error: "Insufficient chips for buy-in" };
      }

      // Re-read to prevent race condition (optimistic locking)
      const freshUser = await storage.getUser(userId);
      if (!freshUser || freshUser.chipBalance < fixedBuyIn) {
        return { ok: false, error: "Insufficient chips for buy-in" };
      }

      await storage.updateUser(userId, { chipBalance: freshUser.chipBalance - fixedBuyIn });
      await storage.createTransaction({
        userId,
        type: "buyin",
        amount: -fixedBuyIn,
        balanceBefore: freshUser.chipBalance,
        balanceAfter: freshUser.chipBalance - fixedBuyIn,
        tableId,
        description: `SNG buy-in`,
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
      const sngAvatar = (freshUser.avatarId && AVATAR_IDS.includes(freshUser.avatarId as any))
        ? freshUser.avatarId
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
        const botToRemove = botPlayers[botPlayers.length - 1];

        // Fold bot if mid-hand
        if (engine.state.phase !== "waiting" && engine.state.phase !== "showdown") {
          const bp = engine.getPlayer(botToRemove.id);
          if (bp && bp.status !== "folded") {
            engine.handleAction(botToRemove.id, "fold");
          }
        }

        // Remove from engine + bots array + avatar map
        engine.forceRemovePlayer(botToRemove.id);
        const idx = instance.bots.findIndex(b => b.id === botToRemove.id);
        if (idx !== -1) {
          instance.bots[idx].cleanup();
          instance.bots.splice(idx, 1);
        }
        instance.avatarMap.delete(botToRemove.id);
      }
    }

    // Check max players
    if (engine.state.players.length >= config.maxPlayers) {
      return { ok: false, error: "Table is full" };
    }

    // Deduct from user balance
    const user = await storage.getUser(userId);
    if (!user) return { ok: false, error: "User not found" };
    if (user.chipBalance < buyIn) {
      return { ok: false, error: "Insufficient chips" };
    }

    // Re-read to prevent race condition (optimistic locking)
    const freshUser = await storage.getUser(userId);
    if (!freshUser || freshUser.chipBalance < buyIn) {
      return { ok: false, error: "Insufficient chips" };
    }

    await storage.updateUser(userId, { chipBalance: freshUser.chipBalance - buyIn });
    await storage.createTransaction({
      userId,
      type: "buyin",
      amount: -buyIn,
      balanceBefore: freshUser.chipBalance,
      balanceAfter: freshUser.chipBalance - buyIn,
      tableId,
      description: `Buy-in at table`,
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

    // Auto-start if enough players
    if (engine.state.phase === "waiting" && engine.canStartHand()) {
      setTimeout(() => engine.startHand(), 2000);
    }

    return { ok: true };
  }

  async leaveTable(tableId: string, userId: string): Promise<void> {
    const instance = this.tables.get(tableId);
    if (!instance) return;

    const player = instance.engine.getPlayer(userId);
    if (!player) return;

    // SNG: forfeit (eliminate with last place)
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

    const cashOut = player.chips;
    const seatIndex = player.seatIndex;
    instance.engine.removePlayer(userId);
    instance.avatarMap.delete(userId);

    // Return chips to balance
    if (cashOut > 0) {
      const user = await storage.getUser(userId);
      if (user) {
        await storage.updateUser(userId, { chipBalance: user.chipBalance + cashOut });
        await storage.createTransaction({
          userId,
          type: "cashout",
          amount: cashOut,
          balanceBefore: user.chipBalance,
          balanceAfter: user.chipBalance + cashOut,
          tableId,
          description: `Cash-out from table`,
        });
      }
    }

    await storage.removeTablePlayer(tableId, userId);

    broadcastToTable(tableId, { type: "player_left", userId, displayName: player?.displayName || "Player", seatIndex });

    // Clean up empty table
    if (instance.engine.state.players.length === 0) {
      instance.engine.cleanup();
      instance.bots.forEach(b => b.cleanup());
      this.tables.delete(tableId);
    }
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

  setSitOut(tableId: string, userId: string, sitOut: boolean) {
    const instance = this.tables.get(tableId);
    if (!instance) return;
    const player = instance.engine.getPlayer(userId);
    if (player) {
      player.isSittingOut = sitOut;
      if (sitOut) player.status = "sitting-out";
    }
  }

  // Track disconnect grace timers for reconnection
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  handleDisconnect(tableId: string, userId: string) {
    const instance = this.tables.get(tableId);
    if (!instance) return;
    const player = instance.engine.getPlayer(userId);
    if (!player) return;

    player.isConnected = false;

    // If it's their turn, auto-fold after a short timeout
    if (player.seatIndex === instance.engine.state.currentTurnSeat) {
      setTimeout(() => {
        if (!player.isConnected) {
          instance.engine.handleAction(userId, "fold");
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

    // If player was marked sitting out from disconnect, restore them
    if (player.isSittingOut && player.chips > 0) {
      player.isSittingOut = false;
      player.status = "waiting";
    }

    sendGameStateToTable(tableId);
  }

  async addBots(tableId: string): Promise<void> {
    const instance = await this.ensureTable(tableId);
    const { engine, config } = instance;

    const BOT_NAMES = ["CryptoKing", "Satoshi", "Whale_0x", "HODLer", "Degen", "NeonAce"];
    let botIndex = instance.bots.length;

    // Collect already-used avatars so bots don't duplicate
    const usedAvatars = new Set(instance.avatarMap.values());
    let avatarOffset = 0;

    while (engine.state.players.length < config.maxPlayers && botIndex < BOT_NAMES.length) {
      const occupiedSeats = new Set(engine.state.players.map(p => p.seatIndex));
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

      engine.addPlayer(botId, botName, seat, botChips, true);
      const bot = new BotPlayer(botId, botName);
      instance.bots.push(bot);

      // Assign a unique avatar to the bot, starting from BOT_AVATAR_START_INDEX
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
      // Fallback if all avatars taken (very unlikely with 12 avatars and 6 bots)
      if (!botAvatar) {
        botAvatar = AVATAR_IDS[(BOT_AVATAR_START_INDEX + botIndex) % AVATAR_IDS.length];
      }
      instance.avatarMap.set(botId, botAvatar);

      // Register bot in SNG lifecycle
      if (instance.lifecycle && config.gameFormat === "sng") {
        instance.lifecycle.register(botId, botName, config.buyInAmount);
      }

      botIndex++;
    }

    // SNG auto-start when full
    if (config.gameFormat === "sng" && instance.lifecycle && instance.lifecycle.canStart()) {
      instance.lifecycle.start();
      engine.startBlindSchedule();
      broadcastToTable(tableId, {
        type: "tournament_status",
        status: "playing",
        prizePool: instance.lifecycle.prizePool,
      } as any);
      setTimeout(() => engine.startHand(), 1000);
      return;
    }

    // Start hand if enough players
    if (engine.state.phase === "waiting" && engine.canStartHand()) {
      setTimeout(() => engine.startHand(), 1000);
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

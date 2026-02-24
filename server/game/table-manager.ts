import { GameEngine, type HandSummary } from "./engine";
import { BotPlayer } from "./bot-player";
import { storage } from "../storage";
import { sendGameStateToTable, broadcastToTable } from "../websocket";
import type { ShuffleProof } from "./crypto-shuffle";
import { blockchainConfig } from "../blockchain/config";
import { VRFClient } from "../blockchain/vrf-client";
import { ContractClient } from "../blockchain/contract-client";

export interface TableInstance {
  engine: GameEngine;
  bots: BotPlayer[];
  config: {
    maxPlayers: number;
    smallBlind: number;
    bigBlind: number;
    minBuyIn: number;
    maxBuyIn: number;
    timeBankSeconds: number;
    allowBots: boolean;
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

    const engine = new GameEngine(tableId, {
      smallBlind: tableRow.smallBlind,
      bigBlind: tableRow.bigBlind,
      timeBankSeconds: tableRow.timeBankSeconds,
    });

    // Pass VRF client if available
    if (this.vrfClient) {
      engine.vrfClient = this.vrfClient;
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

      // Broadcast commitment hash when a new hand starts
      if (engine.state.phase === "pre-flop" && lastPhase !== "pre-flop") {
        const commitment = engine.getCurrentCommitment();
        if (commitment) {
          broadcastToTable(tableId, {
            type: "shuffle_commitment",
            commitmentHash: commitment,
            handNumber: engine.state.handNumber,
          } as any);

          // Fire blockchain commitment in background and broadcast TX hash
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

      sendGameStateToTable(tableId);
    };

    // When a hand completes, persist proof and broadcast reveal
    engine.onHandComplete = (proof: ShuffleProof, summary: HandSummary) => {
      const winnerIds = summary.winners.map(w => w.playerId);

      // Persist to storage with real summary
      storage.createGameHand({
        tableId,
        handNumber: proof.handNumber,
        communityCards: summary.communityCards,
        potTotal: summary.pot,
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
      }).catch(() => {});

      // Fire blockchain reveal in background and broadcast TX hash
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

      // Broadcast seed reveal at showdown
      broadcastToTable(tableId, {
        type: "shuffle_reveal",
        proof,
      } as any);
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

    instance = {
      engine,
      bots: [],
      config: {
        maxPlayers: tableRow.maxPlayers,
        smallBlind: tableRow.smallBlind,
        bigBlind: tableRow.bigBlind,
        minBuyIn: tableRow.minBuyIn,
        maxBuyIn: tableRow.maxBuyIn,
        timeBankSeconds: tableRow.timeBankSeconds,
        allowBots: tableRow.allowBots,
      },
      getStateForPlayer: (playerId: string) => engine.getStateForPlayer(playerId),
    };

    this.tables.set(tableId, instance);
    return instance;
  }

  async joinTable(
    tableId: string,
    userId: string,
    displayName: string,
    buyIn: number,
    requestedSeat?: number
  ): Promise<{ ok: boolean; error?: string }> {
    const instance = await this.ensureTable(tableId);
    const { engine, config } = instance;

    // Validate buy-in
    if (buyIn < config.minBuyIn || buyIn > config.maxBuyIn) {
      return { ok: false, error: `Buy-in must be between ${config.minBuyIn} and ${config.maxBuyIn}` };
    }

    // Check if player already at table
    if (engine.getPlayer(userId)) {
      return { ok: false, error: "Already at this table" };
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

    await storage.updateUser(userId, { chipBalance: user.chipBalance - buyIn });
    await storage.createTransaction({
      userId,
      type: "buyin",
      amount: -buyIn,
      balanceBefore: user.chipBalance,
      balanceAfter: user.chipBalance - buyIn,
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

    // Track in storage
    await storage.addTablePlayer(tableId, userId, seat, buyIn);

    // Broadcast join
    broadcastToTable(tableId, {
      type: "player_joined",
      player: { id: userId, displayName, seatIndex: seat, chips: buyIn },
    }, userId);

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

    const cashOut = player.chips;
    const seatIndex = player.seatIndex;
    instance.engine.removePlayer(userId);

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

    broadcastToTable(tableId, { type: "player_left", userId, seatIndex });

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
    amount?: number
  ): { ok: boolean; error?: string } {
    const instance = this.tables.get(tableId);
    if (!instance) return { ok: false, error: "Table not found" };
    return instance.engine.handleAction(userId, action, amount);
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

  handleDisconnect(tableId: string, userId: string) {
    const instance = this.tables.get(tableId);
    if (!instance) return;
    const player = instance.engine.getPlayer(userId);
    if (player) {
      player.isConnected = false;
      // Auto fold after a short timeout if disconnected during their turn
      if (player.seatIndex === instance.engine.state.currentTurnSeat) {
        setTimeout(() => {
          if (!player.isConnected) {
            instance.engine.handleAction(userId, "fold");
          }
        }, 10000);
      }
    }
  }

  handleReconnect(tableId: string, userId: string) {
    const instance = this.tables.get(tableId);
    if (!instance) return;
    const player = instance.engine.getPlayer(userId);
    if (player) {
      player.isConnected = true;
    }
  }

  async addBots(tableId: string): Promise<void> {
    const instance = await this.ensureTable(tableId);
    const { engine, config } = instance;

    const BOT_NAMES = ["CryptoKing", "Satoshi", "Whale_0x", "HODLer", "Degen", "NeonAce"];
    let botIndex = instance.bots.length;

    while (engine.state.players.length < config.maxPlayers && botIndex < BOT_NAMES.length) {
      const occupiedSeats = new Set(engine.state.players.map(p => p.seatIndex));
      let seat: number | undefined;
      for (let i = 0; i < config.maxPlayers; i++) {
        if (!occupiedSeats.has(i)) { seat = i; break; }
      }
      if (seat === undefined) break;

      const botId = `bot-${tableId}-${botIndex}`;
      const botName = BOT_NAMES[botIndex];
      const botChips = config.minBuyIn + Math.floor(Math.random() * (config.maxBuyIn - config.minBuyIn));

      engine.addPlayer(botId, botName, seat, botChips, true);
      const bot = new BotPlayer(botId, botName);
      instance.bots.push(bot);
      botIndex++;
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
}

export const tableManager = new TableManager();

import { GameEngine } from "./engine";
import { BotPlayer } from "./bot-player";
import { storage } from "../storage";
import { sendGameStateToTable, broadcastToTable } from "../websocket";

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

    // When state changes, broadcast to all connected clients
    engine.onStateChange = () => {
      sendGameStateToTable(tableId);
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

  // Get all active table IDs
  getActiveTableIds(): string[] {
    return Array.from(this.tables.keys());
  }
}

export const tableManager = new TableManager();

import { randomUUID } from "crypto";
import { tableManager } from "./table-manager";
import { sendToUser, sendGameStateToTable, getClients } from "../websocket";
import { storage } from "../storage";
import { insertTableSchema } from "@shared/schema";
import type { ServerMessage } from "../websocket";

// ─── Fast-Fold Pool Types ─────────────────────────────────────────────────────

export interface FastFoldPoolConfig {
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayersPerTable: number;
  ante?: number;
  rakePercent?: number;
  rakeCap?: number;
}

export interface PoolPlayer {
  userId: string;
  displayName: string;
  chips: number;
  currentTableId: string | null;
  /** true when the player has folded and is waiting for a new table */
  inWaitingQueue: boolean;
}

export interface FastFoldPool {
  poolId: string;
  config: FastFoldPoolConfig;
  players: Map<string, PoolPlayer>;
  /** Table IDs belonging to this pool */
  tableIds: Set<string>;
  /** Players waiting to be assigned to a new table */
  waitingQueue: string[];
  createdAt: number;
}

// ─── Fast-Fold Manager ────────────────────────────────────────────────────────

class FastFoldManager {
  private pools = new Map<string, FastFoldPool>();
  /** Reverse lookup: userId -> poolId */
  private playerPools = new Map<string, string>();
  /** Reverse lookup: tableId -> poolId */
  private tablePools = new Map<string, string>();

  // ─── Pool CRUD ──────────────────────────────────────────────────────────

  createPool(config: FastFoldPoolConfig): FastFoldPool {
    const poolId = randomUUID();
    const pool: FastFoldPool = {
      poolId,
      config,
      players: new Map(),
      tableIds: new Set(),
      waitingQueue: [],
      createdAt: Date.now(),
    };
    this.pools.set(poolId, pool);
    console.log(`[fast-fold] Pool ${poolId} created: ${config.name} (${config.smallBlind}/${config.bigBlind})`);
    return pool;
  }

  getPool(poolId: string): FastFoldPool | undefined {
    return this.pools.get(poolId);
  }

  getAllPools(): FastFoldPool[] {
    return Array.from(this.pools.values());
  }

  /** Remove an empty pool */
  removePool(poolId: string): boolean {
    const pool = this.pools.get(poolId);
    if (!pool) return false;
    if (pool.players.size > 0) return false;
    // Clean up table mappings
    for (const tableId of pool.tableIds) {
      this.tablePools.delete(tableId);
    }
    this.pools.delete(poolId);
    return true;
  }

  // ─── Player Join / Leave ────────────────────────────────────────────────

  async addPlayer(
    poolId: string,
    userId: string,
    displayName: string,
    buyIn: number
  ): Promise<{ ok: boolean; error?: string; tableId?: string }> {
    const pool = this.pools.get(poolId);
    if (!pool) return { ok: false, error: "Pool not found" };

    // Already in a pool?
    if (this.playerPools.has(userId)) {
      return { ok: false, error: "Already in a fast-fold pool" };
    }

    // Validate buy-in
    const { minBuyIn, maxBuyIn } = pool.config;
    if (buyIn < minBuyIn || buyIn > maxBuyIn) {
      return { ok: false, error: `Buy-in must be between ${minBuyIn} and ${maxBuyIn}` };
    }

    // Deduct from cash_game wallet
    await storage.ensureWallets(userId);
    const deductResult = await storage.atomicDeductFromWallet(userId, "cash_game", buyIn);
    if (!deductResult.success) {
      return { ok: false, error: "Insufficient chips in cash game wallet" };
    }

    await storage.createTransaction({
      userId,
      type: "buyin",
      amount: -buyIn,
      balanceBefore: deductResult.newBalance + buyIn,
      balanceAfter: deductResult.newBalance,
      tableId: null,
      description: `Fast-fold pool buy-in (${pool.config.name})`,
      walletType: "cash_game",
      relatedTransactionId: null,
      paymentId: null,
      metadata: null,
    });

    const poolPlayer: PoolPlayer = {
      userId,
      displayName,
      chips: buyIn,
      currentTableId: null,
      inWaitingQueue: true,
    };

    pool.players.set(userId, poolPlayer);
    this.playerPools.set(userId, poolId);

    // Add to waiting queue
    pool.waitingQueue.push(userId);

    // Try to seat the player immediately
    this.assignWaitingPlayers(pool);

    // Broadcast updated pool info
    this.broadcastPoolInfo(pool);

    const assignedTable = pool.players.get(userId)?.currentTableId ?? undefined;
    return { ok: true, tableId: assignedTable };
  }

  async removePlayer(userId: string): Promise<{ ok: boolean; error?: string }> {
    const poolId = this.playerPools.get(userId);
    if (!poolId) return { ok: false, error: "Not in a fast-fold pool" };

    const pool = this.pools.get(poolId);
    if (!pool) return { ok: false, error: "Pool not found" };

    const poolPlayer = pool.players.get(userId);
    if (!poolPlayer) return { ok: false, error: "Player not found in pool" };

    // Remove from waiting queue
    pool.waitingQueue = pool.waitingQueue.filter(id => id !== userId);

    // If seated at a table, leave it
    if (poolPlayer.currentTableId) {
      const instance = tableManager.getTable(poolPlayer.currentTableId);
      if (instance) {
        const enginePlayer = instance.engine.getPlayer(userId);
        if (enginePlayer) {
          // Get current chips from engine before leaving
          poolPlayer.chips = enginePlayer.chips;
        }
      }
      await tableManager.leaveTable(poolPlayer.currentTableId, userId);
    }

    // Return chips to wallet
    if (poolPlayer.chips > 0) {
      await storage.ensureWallets(userId);
      const { newBalance } = await storage.atomicAddToWallet(userId, "cash_game", poolPlayer.chips);
      await storage.createTransaction({
        userId,
        type: "cashout",
        amount: poolPlayer.chips,
        balanceBefore: newBalance - poolPlayer.chips,
        balanceAfter: newBalance,
        tableId: null,
        description: `Fast-fold pool cash-out (${pool.config.name})`,
        walletType: "cash_game",
        relatedTransactionId: null,
        paymentId: null,
        metadata: null,
      });
    }

    pool.players.delete(userId);
    this.playerPools.delete(userId);

    // Clean up empty tables
    this.scaleDown(pool);

    // Broadcast updated pool info
    this.broadcastPoolInfo(pool);

    return { ok: true };
  }

  // ─── Fold Handling (core fast-fold mechanic) ────────────────────────────

  /**
   * Called when a player folds at a fast-fold table.
   * Immediately removes them from the current table and queues them for a new one.
   */
  handleFold(userId: string, tableId: string): void {
    const poolId = this.tablePools.get(tableId);
    if (!poolId) return; // Not a fast-fold table

    const pool = this.pools.get(poolId);
    if (!pool) return;

    const poolPlayer = pool.players.get(userId);
    if (!poolPlayer) return;

    // Get current chip count from engine before removal
    const instance = tableManager.getTable(tableId);
    if (instance) {
      const enginePlayer = instance.engine.getPlayer(userId);
      if (enginePlayer) {
        poolPlayer.chips = enginePlayer.chips;
      }
      // Force remove from current table immediately (already folded so safe)
      instance.engine.forceRemovePlayer(userId);
      instance.avatarMap.delete(userId);
      storage.removeTablePlayer(tableId, userId).catch(() => {});
    }

    poolPlayer.currentTableId = null;
    poolPlayer.inWaitingQueue = true;
    pool.waitingQueue.push(userId);

    // Update the client's WS table association to null
    const clients = getClients();
    const client = clients.get(userId);
    if (client) {
      client.tableId = null;
    }

    // Immediately try to assign to a new table (within ~1 second)
    setTimeout(() => {
      this.assignWaitingPlayers(pool);
    }, 500);

    // Send game state update to the table (player removed)
    sendGameStateToTable(tableId);
  }

  /**
   * Called when a hand completes at a fast-fold table.
   * All players at the table who are still in the pool get queued for new hands.
   */
  handleHandComplete(tableId: string): void {
    const poolId = this.tablePools.get(tableId);
    if (!poolId) return;

    const pool = this.pools.get(poolId);
    if (!pool) return;

    const instance = tableManager.getTable(tableId);
    if (!instance) return;

    // Move all remaining players back to waiting queue
    const players = [...instance.engine.state.players];
    for (const p of players) {
      const poolPlayer = pool.players.get(p.id);
      if (!poolPlayer) continue;

      // Update chip count
      const enginePlayer = instance.engine.getPlayer(p.id);
      if (enginePlayer) {
        poolPlayer.chips = enginePlayer.chips;
      }

      // Remove from current table
      instance.engine.forceRemovePlayer(p.id);
      instance.avatarMap.delete(p.id);
      storage.removeTablePlayer(tableId, p.id).catch(() => {});

      // Clear WS table association
      const clients = getClients();
      const client = clients.get(p.id);
      if (client) {
        client.tableId = null;
      }

      poolPlayer.currentTableId = null;
      poolPlayer.inWaitingQueue = true;

      // Only re-queue if they still have chips
      if (poolPlayer.chips > 0) {
        pool.waitingQueue.push(p.id);
      } else {
        // Busted - remove from pool
        pool.players.delete(p.id);
        this.playerPools.delete(p.id);
        sendToUser(p.id, { type: "error", message: "You ran out of chips and have been removed from the pool" });
      }
    }

    // Immediately reassign everyone
    this.assignWaitingPlayers(pool);
    this.broadcastPoolInfo(pool);
  }

  // ─── Table Scaling & Assignment ─────────────────────────────────────────

  /**
   * Try to fill tables with waiting players.
   * Creates new tables if needed (every 6-9 players).
   */
  private async assignWaitingPlayers(pool: FastFoldPool): Promise<void> {
    if (pool.waitingQueue.length === 0) return;

    // Find tables that need players (phase === "waiting" and have open seats)
    const availableTables: { tableId: string; openSeats: number }[] = [];
    for (const tableId of pool.tableIds) {
      const instance = tableManager.getTable(tableId);
      if (!instance) continue;

      const currentPlayers = instance.engine.state.players.length;
      const maxPlayers = pool.config.maxPlayersPerTable;
      const openSeats = maxPlayers - currentPlayers;

      if (openSeats > 0 && instance.engine.state.phase === "waiting") {
        availableTables.push({ tableId, openSeats });
      }
    }

    // If no tables available, create one
    if (availableTables.length === 0 && pool.waitingQueue.length >= 2) {
      const newTableId = await this.createPoolTable(pool);
      if (newTableId) {
        availableTables.push({ tableId: newTableId, openSeats: pool.config.maxPlayersPerTable });
      }
    }

    // Seat waiting players at available tables
    for (const table of availableTables) {
      while (table.openSeats > 0 && pool.waitingQueue.length > 0) {
        const userId = pool.waitingQueue.shift()!;
        const poolPlayer = pool.players.get(userId);
        if (!poolPlayer || poolPlayer.chips <= 0) continue;

        // Join the table through normal table manager path (but bypass wallet deduction)
        const instance = tableManager.getTable(table.tableId);
        if (!instance) break;

        // Find open seat
        const occupiedSeats = new Set(instance.engine.state.players.map(p => p.seatIndex));
        let seat: number | undefined;
        for (let i = 0; i < pool.config.maxPlayersPerTable; i++) {
          if (!occupiedSeats.has(i)) { seat = i; break; }
        }
        if (seat === undefined) break;

        // Add directly to engine (wallet already deducted at pool join time)
        instance.engine.addPlayer(userId, poolPlayer.displayName, seat, poolPlayer.chips, false);
        await storage.addTablePlayer(table.tableId, userId, seat, poolPlayer.chips);

        // Mark player as ready (not sitting out) in fast-fold mode
        const enginePlayer = instance.engine.getPlayer(userId);
        if (enginePlayer) {
          enginePlayer.isSittingOut = false;
          enginePlayer.awaitingReady = false;
          enginePlayer.status = "waiting";
        }

        poolPlayer.currentTableId = table.tableId;
        poolPlayer.inWaitingQueue = false;
        table.openSeats--;

        // Update WS client table association
        const clients = getClients();
        const client = clients.get(userId);
        if (client) {
          client.tableId = table.tableId;
        }

        // Notify client of reassignment
        sendToUser(userId, {
          type: "fast_fold_reassign",
          newTableId: table.tableId,
        } as any);

        // Send game state to the newly assigned player
        sendGameStateToTable(table.tableId);
      }
    }

    // If there are still waiting players and enough for a new table, create more
    if (pool.waitingQueue.length >= 2) {
      const newTableId = await this.createPoolTable(pool);
      if (newTableId) {
        // Recurse to seat remaining players
        await this.assignWaitingPlayers(pool);
      }
    }

    // Try to start hands on tables that have enough players
    for (const tableId of pool.tableIds) {
      const instance = tableManager.getTable(tableId);
      if (!instance) continue;
      if (instance.engine.state.phase === "waiting" && instance.engine.canStartHand()) {
        instance.engine.startHand();
      }
    }
  }

  /**
   * Create a new table for the pool. Returns the new table ID or null on failure.
   */
  private async createPoolTable(pool: FastFoldPool): Promise<string | null> {
    try {
      const tableNum = pool.tableIds.size + 1;
      const parsed = insertTableSchema.parse({
        name: `${pool.config.name} #${tableNum}`,
        maxPlayers: pool.config.maxPlayersPerTable,
        smallBlind: pool.config.smallBlind,
        bigBlind: pool.config.bigBlind,
        minBuyIn: pool.config.minBuyIn,
        maxBuyIn: pool.config.maxBuyIn,
        ante: pool.config.ante ?? 0,
        timeBankSeconds: 15,
        isPrivate: false,
        allowBots: false,
        replaceBots: false,
        gameFormat: "fast_fold" as const,
        gameSpeed: "fast" as const,
        rakePercent: pool.config.rakePercent ?? 0,
        rakeCap: pool.config.rakeCap ?? 0,
      });
      const table = await storage.createTable({
        ...parsed,
        createdById: "system",
      });

      pool.tableIds.add(table.id);
      this.tablePools.set(table.id, pool.poolId);

      console.log(`[fast-fold] Created pool table ${table.id} for pool ${pool.poolId}`);
      return table.id;
    } catch (err) {
      console.error("[fast-fold] Failed to create pool table:", err);
      return null;
    }
  }

  /** Remove empty tables from the pool (keep at least 1) */
  private scaleDown(pool: FastFoldPool): void {
    if (pool.tableIds.size <= 1) return;

    for (const tableId of pool.tableIds) {
      if (pool.tableIds.size <= 1) break;

      const instance = tableManager.getTable(tableId);
      if (!instance) {
        pool.tableIds.delete(tableId);
        this.tablePools.delete(tableId);
        continue;
      }

      // Only remove tables with no players
      if (instance.engine.state.players.length === 0 && instance.engine.state.phase === "waiting") {
        instance.engine.cleanup();
        pool.tableIds.delete(tableId);
        this.tablePools.delete(tableId);
        storage.deleteTable(tableId).catch(() => {});
        console.log(`[fast-fold] Removed empty pool table ${tableId}`);
      }
    }
  }

  // ─── Query Methods ──────────────────────────────────────────────────────

  isPlayerInPool(userId: string): boolean {
    return this.playerPools.has(userId);
  }

  getPlayerPoolId(userId: string): string | undefined {
    return this.playerPools.get(userId);
  }

  isTableInPool(tableId: string): boolean {
    return this.tablePools.has(tableId);
  }

  getTablePoolId(tableId: string): string | undefined {
    return this.tablePools.get(tableId);
  }

  getPoolState(poolId: string): {
    poolId: string;
    name: string;
    smallBlind: number;
    bigBlind: number;
    minBuyIn: number;
    maxBuyIn: number;
    playerCount: number;
    tablesActive: number;
    waitingCount: number;
  } | null {
    const pool = this.pools.get(poolId);
    if (!pool) return null;
    return {
      poolId: pool.poolId,
      name: pool.config.name,
      smallBlind: pool.config.smallBlind,
      bigBlind: pool.config.bigBlind,
      minBuyIn: pool.config.minBuyIn,
      maxBuyIn: pool.config.maxBuyIn,
      playerCount: pool.players.size,
      tablesActive: pool.tableIds.size,
      waitingCount: pool.waitingQueue.length,
    };
  }

  // ─── Broadcast Helpers ──────────────────────────────────────────────────

  private broadcastPoolInfo(pool: FastFoldPool): void {
    const info: ServerMessage = {
      type: "fast_fold_pool_info",
      poolId: pool.poolId,
      playerCount: pool.players.size,
      tablesActive: pool.tableIds.size,
    } as any;

    for (const [userId] of pool.players) {
      sendToUser(userId, info);
    }
  }
}

export const fastFoldManager = new FastFoldManager();

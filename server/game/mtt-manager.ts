import { GameEngine, type GameFormat } from "./engine";
import { storage } from "../storage";
import { tableManager, type TableInstance } from "./table-manager";
import { broadcastToTable, sendGameStateToTable } from "../websocket";
import { MTT_SCHEDULE, getDefaultPayouts, getLargeFieldPayouts, type BlindLevel, type PayoutEntry } from "./blind-presets";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MTTRegistration {
  userId: string;
  username: string;
  displayName: string;
}

export interface MTTElimination {
  playerId: string;
  displayName: string;
  place: number;
  prizeAmount: number;
  tableId: string;
}

export interface PendingMove {
  playerId: string;
  fromTableId: string;
  toTableId: string;
  chips: number;
  displayName: string;
}

export type MTTStatus = "starting" | "running" | "final_table" | "complete";

// ─── Active MTT Registry ────────────────────────────────────────────────────
// Exported so routes and other modules can look up running MTTs
export const activeMTTs = new Map<string, MTTManager>();

// ─── MTT Manager ────────────────────────────────────────────────────────────

export class MTTManager {
  tournamentId: string;
  tableIds: Set<string> = new Set();
  eliminatedPlayers: MTTElimination[] = [];
  registrations: MTTRegistration[];
  maxPlayersPerTable: number;
  status: MTTStatus = "starting";
  prizePool: number;
  startingChips: number;
  buyInAmount: number;
  blindSchedule: BlindLevel[];
  payoutStructure: PayoutEntry[] | null;
  clubId: string | null;

  // Track remaining player count per table (tableId -> count)
  private tablePlayerCounts = new Map<string, number>();
  // Moves scheduled for end-of-hand
  private pendingMoves: PendingMove[] = [];
  // Tables waiting for hand to finish before merging
  private tablesBeingClosed = new Set<string>();

  constructor(
    tournamentId: string,
    registrations: MTTRegistration[],
    opts: {
      maxPlayersPerTable?: number;
      prizePool?: number;
      startingChips?: number;
      buyInAmount?: number;
      blindSchedule?: BlindLevel[];
      payoutStructure?: PayoutEntry[] | null;
      clubId?: string | null;
    } = {},
  ) {
    this.tournamentId = tournamentId;
    this.registrations = [...registrations];
    this.maxPlayersPerTable = opts.maxPlayersPerTable ?? 9;
    this.prizePool = opts.prizePool ?? 0;
    this.startingChips = opts.startingChips ?? 1500;
    this.buyInAmount = opts.buyInAmount ?? 100;
    this.blindSchedule = opts.blindSchedule ?? MTT_SCHEDULE;
    this.payoutStructure = opts.payoutStructure ?? null;
    this.clubId = opts.clubId ?? null;
  }

  // ─── Start Tournament ───────────────────────────────────────────────────

  async start(): Promise<void> {
    const players = [...this.registrations];
    // Shuffle players randomly for seating
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }

    const numTables = Math.ceil(players.length / this.maxPlayersPerTable);
    const tables: MTTRegistration[][] = Array.from({ length: numTables }, () => []);

    // Distribute players round-robin across tables for even distribution
    for (let i = 0; i < players.length; i++) {
      tables[i % numTables].push(players[i]);
    }

    // Create a table row in storage for each MTT table, then initialize via tableManager
    for (let t = 0; t < numTables; t++) {
      const tablePlayers = tables[t];
      const tableLabel = numTables === 1
        ? `MTT Final Table`
        : `MTT Table ${t + 1}`;

      const tableRow = await storage.createTable({
        name: tableLabel,
        maxPlayers: this.maxPlayersPerTable,
        smallBlind: this.blindSchedule[0]?.sb ?? 10,
        bigBlind: this.blindSchedule[0]?.bb ?? 20,
        minBuyIn: this.startingChips,
        maxBuyIn: this.startingChips,
        ante: this.blindSchedule[0]?.ante ?? 0,
        timeBankSeconds: 30,
        isPrivate: true,
        clubId: this.clubId ?? undefined,
        allowBots: false,
        replaceBots: false,
        gameFormat: "tournament" as const,
        blindSchedule: this.blindSchedule,
        buyInAmount: this.buyInAmount,
        startingChips: this.startingChips,
        payoutStructure: this.payoutStructure ?? undefined,
        createdById: "system",
        gameSpeed: "normal" as const,
        bombPotFrequency: 0,
        bombPotAnte: 0,
        rakePercent: 0,
        rakeCap: 0,
        straddleEnabled: false,
        awayTimeoutMinutes: 5,
      });

      this.tableIds.add(tableRow.id);
      this.tablePlayerCounts.set(tableRow.id, tablePlayers.length);

      // Link table to tournament in storage
      await storage.updateTable(tableRow.id, { tournamentId: this.tournamentId });

      // Force-load the table instance in TableManager so we can wire up callbacks
      const instance = await this.getOrCreateTableInstance(tableRow.id);

      // Seat all players at this table
      for (let s = 0; s < tablePlayers.length; s++) {
        const reg = tablePlayers[s];
        instance.engine.addPlayer(reg.userId, reg.displayName, s, this.startingChips, false);
        await storage.addTablePlayer(tableRow.id, reg.userId, s, this.startingChips);
      }

      // Wire MTT-specific callbacks onto the engine
      this.wireEngineCallbacks(tableRow.id, instance);
    }

    this.status = "running";

    // Start blind schedules and first hand on every table (staggered slightly)
    let delay = 0;
    for (const tableId of this.tableIds) {
      const instance = tableManager.getTable(tableId);
      if (!instance) continue;
      setTimeout(() => {
        instance.engine.startBlindSchedule();
        instance.engine.startHand();
      }, delay);
      delay += 500; // stagger table starts by 500ms
    }

    // Update tournament status in DB
    await storage.updateTournament(this.tournamentId, { status: "running" });

    // Broadcast tournament started to all tables
    for (const tableId of this.tableIds) {
      broadcastToTable(tableId, {
        type: "tournament_status",
        status: "running",
        prizePool: this.prizePool,
        totalPlayers: this.registrations.length,
        tablesRemaining: this.tableIds.size,
      } as any);
    }
  }

  // ─── Engine Callback Wiring ─────────────────────────────────────────────

  private wireEngineCallbacks(tableId: string, instance: TableInstance): void {
    const engine = instance.engine;

    // Override the onPlayerEliminated callback for MTT awareness
    const originalElimCallback = engine.onPlayerEliminated;

    engine.onPlayerEliminated = (playerId: string, displayName: string) => {
      this.onPlayerEliminated(tableId, playerId, displayName);
    };

    // Wrap onHandComplete to trigger rebalance / merge checks
    const originalHandComplete = engine.onHandComplete;
    engine.onHandComplete = (proof, summary) => {
      // Call original first (persists hand, broadcasts reveal, etc.)
      originalHandComplete?.(proof, summary);

      // Then run MTT post-hand logic
      this.onHandComplete(tableId);
    };
  }

  // ─── Player Elimination ─────────────────────────────────────────────────

  onPlayerEliminated(tableId: string, playerId: string, displayName: string): void {
    // Already eliminated?
    if (this.eliminatedPlayers.some(e => e.playerId === playerId)) return;

    const totalRemaining = this.getTotalRemainingPlayers();
    const place = totalRemaining; // e.g., if 10 remain, this player finishes 10th

    // Determine prize
    const payouts = this.getPayoutStructure();
    const payoutEntry = payouts.find(p => p.place === place);
    const prizeAmount = payoutEntry ? Math.floor(this.prizePool * payoutEntry.percentage / 100) : 0;

    const elimination: MTTElimination = {
      playerId,
      displayName,
      place,
      prizeAmount,
      tableId,
    };
    this.eliminatedPlayers.push(elimination);

    // Update table player count
    const count = this.tablePlayerCounts.get(tableId) ?? 0;
    this.tablePlayerCounts.set(tableId, Math.max(0, count - 1));

    // Remove from engine
    const instance = tableManager.getTable(tableId);
    if (instance) {
      instance.engine.forceRemovePlayer(playerId);
    }

    // Broadcast elimination to all MTT tables
    for (const tid of this.tableIds) {
      broadcastToTable(tid, {
        type: "player_eliminated",
        playerId,
        displayName,
        finishPlace: place,
        prizeAmount,
        remainingPlayers: this.getTotalRemainingPlayers(),
        tablesRemaining: this.getActiveTableCount(),
      } as any);
    }

    // Credit prize
    if (prizeAmount > 0 && !playerId.startsWith("bot-")) {
      this.creditPrize(playerId, prizeAmount).catch(() => {});
    }

    // Update tournament registration in DB
    this.updateRegistrationStatus(playerId, "eliminated", place, prizeAmount).catch(() => {});

    // Check if tournament is complete
    if (this.isComplete()) {
      this.completeTournament();
    }
  }

  // ─── Post-Hand Logic ────────────────────────────────────────────────────

  onHandComplete(tableId: string): void {
    if (this.status === "complete") return;

    // Process any pending player moves for this table
    this.processPendingMoves(tableId);

    // Check for table operations
    this.checkFinalTable();
    if (this.status !== "final_table") {
      this.checkMerge();
      this.checkRebalance();
    }

    // Auto-start next hand if table still has players and isn't being closed
    if (!this.tablesBeingClosed.has(tableId)) {
      const instance = tableManager.getTable(tableId);
      if (instance && instance.engine.canStartHand()) {
        setTimeout(() => {
          const inst = tableManager.getTable(tableId);
          if (inst && inst.engine.state.phase === "waiting" && inst.engine.canStartHand()) {
            inst.engine.startHand();
          }
        }, 3000); // 3 second pause between MTT hands
      }
    }
  }

  // ─── Rebalance ──────────────────────────────────────────────────────────
  // If tables differ by 2+ players, move from the largest to the smallest

  private checkRebalance(): void {
    const activeTables = this.getActiveTableIds();
    if (activeTables.length <= 1) return;

    const tableSizes = activeTables.map(tid => ({
      tableId: tid,
      count: this.tablePlayerCounts.get(tid) ?? 0,
    }));

    tableSizes.sort((a, b) => a.count - b.count);

    const smallest = tableSizes[0];
    const largest = tableSizes[tableSizes.length - 1];

    if (largest.count - smallest.count >= 2) {
      // Move one player from largest to smallest
      this.schedulePlayerMove(largest.tableId, smallest.tableId);
    }
  }

  // ─── Merge Tables ───────────────────────────────────────────────────────
  // If total players fit on fewer tables, close the smallest and redistribute

  private checkMerge(): void {
    const activeTables = this.getActiveTableIds();
    if (activeTables.length <= 1) return;

    const totalPlayers = this.getTotalRemainingPlayers();
    const neededTables = Math.ceil(totalPlayers / this.maxPlayersPerTable);

    if (neededTables < activeTables.length) {
      // Close the smallest table and redistribute its players
      const tableSizes = activeTables.map(tid => ({
        tableId: tid,
        count: this.tablePlayerCounts.get(tid) ?? 0,
      }));
      tableSizes.sort((a, b) => a.count - b.count);

      const tableToClose = tableSizes[0];
      this.mergeTableInto(tableToClose.tableId);
    }
  }

  // ─── Final Table ────────────────────────────────────────────────────────
  // When remaining players fit on a single table, merge everything into one

  private checkFinalTable(): void {
    if (this.status === "final_table" || this.status === "complete") return;

    const totalPlayers = this.getTotalRemainingPlayers();
    const activeTables = this.getActiveTableIds();

    if (totalPlayers <= this.maxPlayersPerTable && activeTables.length > 1) {
      this.status = "final_table";

      // Pick the largest table as the surviving final table
      const tableSizes = activeTables.map(tid => ({
        tableId: tid,
        count: this.tablePlayerCounts.get(tid) ?? 0,
      }));
      tableSizes.sort((a, b) => b.count - a.count);
      const finalTableId = tableSizes[0].tableId;

      // Move all players from other tables to the final table
      for (const { tableId } of tableSizes.slice(1)) {
        this.mergeTableInto(tableId, finalTableId);
      }

      // Update DB status
      storage.updateTournament(this.tournamentId, { status: "final_table" }).catch(() => {});

      // Broadcast final table announcement to all tables
      for (const tid of this.tableIds) {
        broadcastToTable(tid, {
          type: "tournament_status",
          status: "final_table",
          finalTableId,
          remainingPlayers: totalPlayers,
        } as any);
      }
    }
  }

  // ─── Player Movement ────────────────────────────────────────────────────

  private schedulePlayerMove(fromTableId: string, toTableId: string): void {
    const fromInstance = tableManager.getTable(fromTableId);
    if (!fromInstance) return;

    // Pick a player to move — prefer a player who is not currently in a hand
    // (i.e., status is "waiting" or the engine phase is "waiting")
    const candidates = fromInstance.engine.state.players.filter(
      p => !p.isSittingOut && p.chips > 0,
    );
    if (candidates.length === 0) return;

    // Prefer a player that just folded or is waiting
    const candidate =
      candidates.find(p => p.status === "waiting" || p.status === "folded") ??
      candidates[candidates.length - 1];

    // If the table is mid-hand, schedule the move for after the hand
    if (fromInstance.engine.state.phase !== "waiting") {
      this.pendingMoves.push({
        playerId: candidate.id,
        fromTableId,
        toTableId,
        chips: candidate.chips,
        displayName: candidate.displayName,
      });
    } else {
      this.executePlayerMove(candidate.id, candidate.displayName, candidate.chips, fromTableId, toTableId);
    }
  }

  private processPendingMoves(tableId: string): void {
    const movesForTable = this.pendingMoves.filter(m => m.fromTableId === tableId);
    this.pendingMoves = this.pendingMoves.filter(m => m.fromTableId !== tableId);

    for (const move of movesForTable) {
      // Re-read the player's current chips (may have changed during the hand)
      const fromInstance = tableManager.getTable(move.fromTableId);
      if (!fromInstance) continue;

      const player = fromInstance.engine.getPlayer(move.playerId);
      if (!player || player.chips <= 0) continue; // player was eliminated during the hand

      this.executePlayerMove(
        move.playerId,
        move.displayName,
        player.chips,
        move.fromTableId,
        move.toTableId,
      );
    }
  }

  private executePlayerMove(
    playerId: string,
    displayName: string,
    chips: number,
    fromTableId: string,
    toTableId: string,
  ): void {
    const fromInstance = tableManager.getTable(fromTableId);
    const toInstance = tableManager.getTable(toTableId);
    if (!fromInstance || !toInstance) return;

    // Remove from source table
    fromInstance.engine.forceRemovePlayer(playerId);
    storage.removeTablePlayer(fromTableId, playerId).catch(() => {});

    // Find a seat at the destination table
    const occupiedSeats = new Set(toInstance.engine.state.players.map(p => p.seatIndex));
    let seat: number | undefined;
    for (let i = 0; i < this.maxPlayersPerTable; i++) {
      if (!occupiedSeats.has(i)) {
        seat = i;
        break;
      }
    }
    if (seat === undefined) {
      console.error(`[MTT] No seat available at table ${toTableId} for player ${playerId}`);
      return;
    }

    // Add to destination table
    toInstance.engine.addPlayer(playerId, displayName, seat, chips, false);
    storage.addTablePlayer(toTableId, playerId, seat, chips).catch(() => {});

    // Update internal counts
    const fromCount = this.tablePlayerCounts.get(fromTableId) ?? 0;
    this.tablePlayerCounts.set(fromTableId, Math.max(0, fromCount - 1));
    const toCount = this.tablePlayerCounts.get(toTableId) ?? 0;
    this.tablePlayerCounts.set(toTableId, toCount + 1);

    // Broadcast table change notifications
    broadcastToTable(fromTableId, {
      type: "player_moved",
      playerId,
      displayName,
      toTableId,
      reason: "rebalance",
    } as any);

    broadcastToTable(toTableId, {
      type: "player_joined",
      player: { id: playerId, displayName, seatIndex: seat, chips },
    } as any);

    sendGameStateToTable(fromTableId);
    sendGameStateToTable(toTableId);
  }

  private mergeTableInto(closingTableId: string, targetTableId?: string): void {
    const closingInstance = tableManager.getTable(closingTableId);
    if (!closingInstance) return;

    // If mid-hand, schedule the merge for after hand completes
    if (closingInstance.engine.state.phase !== "waiting") {
      this.tablesBeingClosed.add(closingTableId);
      // Schedule all players as pending moves
      const players = closingInstance.engine.state.players.filter(p => p.chips > 0);
      for (const player of players) {
        const target = targetTableId ?? this.findBestTargetTable(closingTableId);
        if (target) {
          this.pendingMoves.push({
            playerId: player.id,
            fromTableId: closingTableId,
            toTableId: target,
            chips: player.chips,
            displayName: player.displayName,
          });
        }
      }
      return;
    }

    // Immediate merge: move all players from closing table to target(s)
    const players = [...closingInstance.engine.state.players].filter(p => p.chips > 0);

    for (const player of players) {
      const target = targetTableId ?? this.findBestTargetTable(closingTableId);
      if (!target) {
        console.error(`[MTT] No target table for merge from ${closingTableId}`);
        break;
      }
      this.executePlayerMove(player.id, player.displayName, player.chips, closingTableId, target);
    }

    // Clean up the closed table
    this.closeTable(closingTableId);
  }

  private findBestTargetTable(excludeTableId: string): string | undefined {
    // Find the table with the fewest players (that isn't the closing one)
    let best: string | undefined;
    let bestCount = Infinity;

    for (const tableId of this.tableIds) {
      if (tableId === excludeTableId) continue;
      if (this.tablesBeingClosed.has(tableId)) continue;

      const count = this.tablePlayerCounts.get(tableId) ?? 0;
      if (count < this.maxPlayersPerTable && count < bestCount) {
        bestCount = count;
        best = tableId;
      }
    }

    return best;
  }

  private closeTable(tableId: string): void {
    const instance = tableManager.getTable(tableId);
    if (instance) {
      instance.engine.cleanup();
    }

    this.tableIds.delete(tableId);
    this.tablePlayerCounts.delete(tableId);
    this.tablesBeingClosed.delete(tableId);

    broadcastToTable(tableId, {
      type: "tournament_status",
      status: "table_closed",
      message: "This table has been closed. Players have been moved.",
    } as any);

    // Delete the table row from storage
    storage.deleteTable(tableId).catch(() => {});
  }

  // ─── Tournament Completion ──────────────────────────────────────────────

  private async completeTournament(): Promise<void> {
    this.status = "complete";

    // Find the winner (last player standing)
    const eliminatedIds = new Set(this.eliminatedPlayers.map(e => e.playerId));
    let winner: MTTRegistration | undefined;
    for (const reg of this.registrations) {
      if (!eliminatedIds.has(reg.userId)) {
        winner = reg;
        break;
      }
    }

    if (winner) {
      const payouts = this.getPayoutStructure();
      const firstPayout = payouts.find(p => p.place === 1);
      const prizeAmount = firstPayout
        ? Math.floor(this.prizePool * firstPayout.percentage / 100)
        : this.prizePool;

      this.eliminatedPlayers.push({
        playerId: winner.userId,
        displayName: winner.displayName,
        place: 1,
        prizeAmount,
        tableId: "", // winner isn't "eliminated" from a specific table
      });

      // Credit winner prize
      if (!winner.userId.startsWith("bot-")) {
        await this.creditPrize(winner.userId, prizeAmount);
        storage.incrementPlayerStat(winner.userId, "sngWins", 1).catch(() => {});
      }

      // Update winner registration
      await this.updateRegistrationStatus(winner.userId, "winner", 1, prizeAmount);
    }

    // Update tournament status in DB
    await storage.updateTournament(this.tournamentId, { status: "complete" });

    // Broadcast tournament complete to all remaining tables
    const results = this.getStandings();
    for (const tableId of this.tableIds) {
      broadcastToTable(tableId, {
        type: "tournament_complete",
        results,
        prizePool: this.prizePool,
      } as any);
    }

    // Clean up all tables after a delay
    setTimeout(() => {
      for (const tableId of this.tableIds) {
        const instance = tableManager.getTable(tableId);
        if (instance) {
          instance.engine.cleanup();
        }
        storage.deleteTable(tableId).catch(() => {});
      }
      this.tableIds.clear();
      this.tablePlayerCounts.clear();

      // Remove from active MTTs registry
      activeMTTs.delete(this.tournamentId);
    }, 15000);
  }

  // ─── Utilities ──────────────────────────────────────────────────────────

  private getPayoutStructure(): PayoutEntry[] {
    if (this.payoutStructure && this.payoutStructure.length > 0) {
      return this.payoutStructure;
    }
    // Use large field payouts for fields > 18
    if (this.registrations.length > 18) {
      return getLargeFieldPayouts(this.registrations.length);
    }
    return getDefaultPayouts(this.registrations.length);
  }

  getTotalRemainingPlayers(): number {
    return this.registrations.length - this.eliminatedPlayers.length;
  }

  private getActiveTableIds(): string[] {
    return Array.from(this.tableIds).filter(tid => {
      const count = this.tablePlayerCounts.get(tid) ?? 0;
      return count > 0 && !this.tablesBeingClosed.has(tid);
    });
  }

  private getActiveTableCount(): number {
    return this.getActiveTableIds().length;
  }

  getStandings(): MTTElimination[] {
    return [...this.eliminatedPlayers].sort((a, b) => a.place - b.place);
  }

  isComplete(): boolean {
    return this.getTotalRemainingPlayers() <= 1;
  }

  getTableInfo(): { tableId: string; playerCount: number }[] {
    return Array.from(this.tableIds).map(tid => ({
      tableId: tid,
      playerCount: this.tablePlayerCounts.get(tid) ?? 0,
    }));
  }

  private async creditPrize(userId: string, amount: number): Promise<void> {
    try {
      await storage.ensureWallets(userId);
      const { newBalance } = await storage.atomicAddToWallet(userId, "tournament", amount);
      await storage.createTransaction({
        userId,
        type: "prize",
        amount,
        balanceBefore: newBalance - amount,
        balanceAfter: newBalance,
        tableId: null,
        description: `MTT prize: ${amount} chips (Tournament: ${this.tournamentId})`,
        walletType: "tournament",
        relatedTransactionId: null,
        paymentId: null,
        metadata: null,
      });
    } catch (err) {
      console.error(`[MTT] Failed to credit prize to ${userId}:`, err);
    }
  }

  private async updateRegistrationStatus(
    userId: string,
    status: string,
    place: number,
    prizeAmount: number,
  ): Promise<void> {
    try {
      const regs = await storage.getTournamentRegistrations(this.tournamentId);
      const reg = regs.find(r => r.userId === userId);
      if (reg) {
        await storage.updateTournamentRegistration(reg.id, {
          status,
          finishPlace: place,
          prizeAmount,
        });
      }
    } catch (err) {
      console.error(`[MTT] Failed to update registration for ${userId}:`, err);
    }
  }

  private async getOrCreateTableInstance(tableId: string): Promise<TableInstance> {
    // Try to get from tableManager first
    let instance = tableManager.getTable(tableId);
    if (instance) return instance;

    // Force ensureTable by calling a lightweight operation
    // The tableManager lazily creates instances via ensureTable
    // We need to trigger this — use a dummy join/leave pattern, or
    // simply replicate the essentials. The cleanest approach is to
    // call the internal ensureTable via a public accessor.
    // Since ensureTable is private, we use a workaround: the table
    // manager will create the instance when any operation accesses it.
    // We trigger this by getting the table — which calls ensureTable.
    // Actually, tableManager has no public ensureTable. We work around
    // this by directly accessing the private method through the join flow.
    // Best approach: we'll add a public method via a cast for now.
    const tm = tableManager as any;
    if (typeof tm.ensureTable === "function") {
      instance = await tm.ensureTable(tableId);
    }
    if (!instance) {
      throw new Error(`Failed to initialize table instance for ${tableId}`);
    }
    return instance;
  }
}

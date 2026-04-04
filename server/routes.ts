import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { createHash } from "crypto";
import { storage } from "./storage";
import { registerAuthRoutes, requireAuth } from "./auth";
import { insertTableSchema, insertClubSchema, createAllianceSchema, updateAllianceSchema, createLeagueSeasonSchema, updateLeagueSeasonSchema, leagueStandingsSchema, createTournamentSchema, users, gameHands, handPlayers, playerStats, tables } from "@shared/schema";
import { sql } from "drizzle-orm";
import { setupWebSocket, sendGameStateToTable, getClients, sendToUser } from "./websocket";
import { getBlindPreset } from "./game/blind-presets";
import { tableManager } from "./game/table-manager";
import { analyzeHand } from "./game/hand-analyzer";
import { geofenceMiddleware } from "./middleware/geofence";
import { setAnthropicApiKey, getAnthropicApiKey, hasAIEnabled } from "./game/ai-bot-engine";
import { hasDatabase, getDb } from "./db";
import { MTTManager, activeMTTs } from "./game/mtt-manager";
import { getTournamentSchedule, setTournamentSchedule, type ScheduledTournament } from "./scheduler";
import { fastFoldManager, type FastFoldPoolConfig } from "./game/fast-fold-manager";

// ─── Tier System Constants ──────────────────────────────────────────────────
const TIER_ORDER = ["free", "bronze", "silver", "gold", "platinum"] as const;
type Tier = typeof TIER_ORDER[number];

const TIER_DEFINITIONS = [
  {
    id: "free", name: "Free", price: 0,
    benefits: ["Play cash games", "Basic statistics"],
  },
  {
    id: "bronze", name: "Bronze", price: 1000,
    benefits: ["Coaching access", "Daily challenges"],
  },
  {
    id: "silver", name: "Silver", price: 5000,
    benefits: ["Multi-table play", "Replay sharing"],
  },
  {
    id: "gold", name: "Gold", price: 15000,
    benefits: ["Create clubs", "Host tournaments with rake", "KYC eligible"],
  },
  {
    id: "platinum", name: "Platinum", price: 50000,
    benefits: ["Marketplace selling", "Priority support", "Advanced API access"],
  },
];

function tierRank(tier: string): number {
  const idx = TIER_ORDER.indexOf(tier as Tier);
  return idx >= 0 ? idx : 0;
}

function requireTier(minTier: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const user = await storage.getUser(req.user.id);
    if (!user) return res.status(401).json({ message: "User not found" });
    // Check tier expiry — if expired, revert to free
    if (user.tier !== "free" && user.tierExpiresAt && new Date(user.tierExpiresAt) < new Date()) {
      await storage.updateUser(user.id, { tier: "free", tierExpiresAt: null });
      user.tier = "free";
    }
    if (tierRank(user.tier) < tierRank(minTier)) {
      return res.status(403).json({ message: `Requires ${minTier} tier or higher` });
    }
    next();
  };
}

// Global kill switch — blocks buy-ins and withdrawals if integrity check fails
let globalSystemLocked = false;
let globalLockReason = "";

// In-memory social link settings
let socialLinks: { twitter: string; discord: string; telegram: string } = {
  twitter: "",
  discord: "",
  telegram: "",
};

export function isSystemLocked(): boolean {
  return globalSystemLocked;
}

export async function registerRoutes(app: Express, sessionMiddleware: RequestHandler): Promise<Server> {
  // Auth routes
  registerAuthRoutes(app);

  // ─── Server Info ───────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      storage: hasDatabase() ? "database" : "memory",
      warning: hasDatabase() ? null : "Using in-memory storage — all data will be lost on restart",
    });
  });

  // ─── Online Users ──────────────────────────────────────────────────────
  app.get("/api/online-users", requireAuth, (_req, res) => {
    const clients = getClients();
    const onlineIds = Array.from(clients.keys());
    res.json(onlineIds);
  });

  // ─── Notification Routes ──────────────────────────────────────────────────
  app.get("/api/notifications", requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const items = await storage.getNotifications(req.user!.id, limit);
      res.json(items);
    } catch (err) { next(err); }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res, next) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.user!.id);
      res.json({ count });
    } catch (err) { next(err); }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res, next) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res, next) => {
    try {
      await storage.markAllNotificationsRead(req.user!.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ─── Table Routes ────────────────────────────────────────────────────────
  // List all public tables (+ user's private tables)
  app.get("/api/tables", requireAuth, async (req, res, next) => {
    try {
      const allTables = await storage.getTables();
      const tablesWithPlayers = await Promise.all(
        allTables.map(async (table) => {
          // Use live engine state for player count and status when available
          const instance = tableManager.getTable(table.id);
          const playerCount = instance
            ? instance.engine.state.players.length  // includes bots
            : (await storage.getTablePlayers(table.id)).length;
          const status = instance
            ? (instance.engine.state.phase !== "waiting" ? "playing" : "waiting")
            : table.status;
          return {
            ...table,
            playerCount,
            status,
            password: undefined, // never expose password
          };
        })
      );
      // Show public tables, or private tables the user created
      let visible = tablesWithPlayers.filter(t => {
        if (!t.isPrivate) return true;
        return req.user && t.createdById === req.user.id;
      });

      // Optional format filter
      const format = req.query.format as string;
      if (format && format !== "all") {
        visible = visible.filter(t => t.gameFormat === format);
      }

      // Optional variant filter
      const variant = req.query.variant as string;
      if (variant && variant !== "all") {
        visible = visible.filter(t => t.pokerVariant === variant);
      }

      res.json(visible);
    } catch (err) {
      next(err);
    }
  });

  // Get single table
  // Resolve invite code to table ID
  app.get("/api/tables/invite/:code", async (req, res, next) => {
    try {
      const table = await storage.getTableByInviteCode(req.params.code);
      if (!table) return res.status(404).json({ message: "Invalid invite code" });
      res.json({ tableId: table.id, name: table.name, inviteCode: table.inviteCode });
    } catch (err) { next(err); }
  });

  app.get("/api/tables/:id", async (req, res, next) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) return res.status(404).json({ message: "Table not found" });
      const players = await storage.getTablePlayers(table.id);
      const occupiedSeats = players.map(p => p.seatIndex);
      // Include return buy-in minimum if the requesting user has one
      const userId = (req as any).user?.id;
      const returnMinBuyIn = userId ? tableManager.getReturnMinBuyIn(table.id, userId) : null;
      res.json({ ...table, password: undefined, players, occupiedSeats, returnMinBuyIn });
    } catch (err) {
      next(err);
    }
  });

  // REST endpoint for joining a table (professional: REST for join/leave, WS for gameplay)
  app.post("/api/tables/:id/join", requireAuth, geofenceMiddleware(), async (req, res, next) => {
    try {
      const { buyIn, seatIndex, password } = req.body;
      if (!buyIn || buyIn <= 0) return res.status(400).json({ message: "Invalid buy-in amount" });

      // Check private table password
      const tableForAuth = await storage.getTable(req.params.id);
      if (tableForAuth?.isPrivate && tableForAuth.password) {
        if (password !== tableForAuth.password) {
          return res.status(403).json({ message: "Incorrect table password" });
        }
      }

      const result = await tableManager.joinTable(req.params.id, req.user!.id, req.user!.displayName || req.user!.username, buyIn, seatIndex);
      if (!result.ok) return res.status(400).json({ message: result.error });
      sendGameStateToTable(req.params.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // REST endpoint for leaving a table
  app.post("/api/tables/:id/leave", requireAuth, async (req, res, next) => {
    try {
      await tableManager.leaveTable(req.params.id, req.user!.id);
      sendGameStateToTable(req.params.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ─── Video (Daily.co) ──────────────────────────────────────────────────
  app.post("/api/tables/:id/video-token", requireAuth, async (req, res, next) => {
    try {
      if (!process.env.DAILY_API_KEY) {
        return res.status(503).json({ message: "Video not configured" });
      }
      const tableId = req.params.id;
      const user = req.user!;
      const table = await storage.getTable(tableId);
      if (!table) return res.status(404).json({ message: "Table not found" });

      const isOwner = String(table.createdById) === String(user.id);
      const { createMeetingToken } = await import("./video/daily-rooms");
      const token = await createMeetingToken(
        tableId,
        String(user.id),
        user.displayName || user.username || "Player",
        isOwner,
      );
      res.json({ token });
    } catch (err) { next(err); }
  });

  // Create table
  app.post("/api/tables", requireAuth, async (req, res, next) => {
    try {
      // Resolve blindPreset to blindSchedule for SNG/Tournament tables
      const body = { ...req.body };
      if ((body.gameFormat === "sng" || body.gameFormat === "tournament") && body.blindPreset && !body.blindSchedule) {
        body.blindSchedule = getBlindPreset(body.blindPreset);
      }
      // Lottery SNG: force hyper-turbo schedule, 3 players, 500 starting chips
      if (body.gameFormat === "lottery_sng") {
        body.blindSchedule = getBlindPreset("hyper_turbo");
        body.maxPlayers = 3;
        body.startingChips = 500;
        body.payoutStructure = [{ place: 1, percentage: 100 }];
      }
      delete body.blindPreset; // Not a schema field

      const parsed = insertTableSchema.safeParse(body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid table config", errors: parsed.error.flatten() });
      }
      const table = await storage.createTable({
        ...parsed.data,
        createdById: req.user!.id,
      });
      res.status(201).json({ ...table, password: undefined });
    } catch (err) {
      next(err);
    }
  });

  // Delete table (only creator)
  app.delete("/api/tables/:id", requireAuth, async (req, res, next) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) return res.status(404).json({ message: "Table not found" });
      if (table.createdById !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      await storage.deleteTable(req.params.id);
      res.json({ message: "Table deleted" });
    } catch (err) {
      next(err);
    }
  });

  // ─── Lottery SNG (Spin & Go) ─────────��────────────────────────────────────
  const LOTTERY_BUY_IN_TIERS = [100, 250, 500, 1000, 2500, 5000] as const;

  // In-memory queue for each buy-in tier: maps tier → array of waiting table IDs
  const lotteryQueues = new Map<number, string[]>();
  for (const tier of LOTTERY_BUY_IN_TIERS) {
    lotteryQueues.set(tier, []);
  }

  app.get("/api/lottery-sng/tiers", requireAuth, async (_req, res) => {
    const tiers = LOTTERY_BUY_IN_TIERS.map(buyIn => {
      const queue = lotteryQueues.get(buyIn) || [];
      // Count registered players across all queued tables for this tier
      let totalQueued = 0;
      for (const tableId of queue) {
        const instance = tableManager.getTable(tableId);
        if (instance && instance.lifecycle && instance.lifecycle.status === "registering") {
          totalQueued += instance.lifecycle.registeredPlayers.size;
        }
      }
      return {
        buyIn,
        playersQueued: totalQueued,
        prizePoolRange: {
          min: buyIn * 3 * 2,   // 2x multiplier
          max: buyIn * 3 * 1000, // 1000x multiplier (jackpot)
        },
      };
    });
    res.json(tiers);
  });

  app.post("/api/lottery-sng/register", requireAuth, async (req, res, next) => {
    try {
      const { buyIn } = req.body;
      if (!buyIn || !LOTTERY_BUY_IN_TIERS.includes(buyIn)) {
        return res.status(400).json({ message: `Invalid buy-in. Available tiers: ${LOTTERY_BUY_IN_TIERS.join(", ")}` });
      }

      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Find an existing lottery table for this tier that has room
      const queue = lotteryQueues.get(buyIn) || [];
      let tableId: string | null = null;

      for (const queuedTableId of queue) {
        const instance = tableManager.getTable(queuedTableId);
        if (instance && instance.lifecycle && instance.lifecycle.status === "registering" && instance.lifecycle.registeredPlayers.size < 3) {
          // Don't let player register twice
          if (!instance.lifecycle.registeredPlayers.has(userId)) {
            tableId = queuedTableId;
            break;
          }
        }
      }

      // If no suitable table, create a new one
      if (!tableId) {
        const blindSchedule = getBlindPreset("hyper_turbo");
        const tableData = insertTableSchema.parse({
          name: `Spin & Go ${buyIn}`,
          maxPlayers: 3,
          smallBlind: 10,
          bigBlind: 20,
          minBuyIn: buyIn,
          maxBuyIn: buyIn,
          ante: 0,
          timeBankSeconds: 15,
          isPrivate: false,
          allowBots: false,
          replaceBots: false,
          gameFormat: "lottery_sng",
          blindSchedule,
          buyInAmount: buyIn,
          startingChips: 500,
          payoutStructure: [{ place: 1, percentage: 100 }],
        });
        const newTable = await storage.createTable({
          ...tableData,
          createdById: userId,
        });
        tableId = newTable.id;
        queue.push(tableId);
        lotteryQueues.set(buyIn, queue);
      }

      // Join the table via table manager
      const result = await tableManager.joinTable(
        tableId,
        userId,
        user.displayName || user.username || "Player",
        buyIn,
      );

      if (!result.ok) {
        return res.status(400).json({ message: result.error });
      }

      // Clean up completed tables from queue
      const updatedQueue = (lotteryQueues.get(buyIn) || []).filter(id => {
        const inst = tableManager.getTable(id);
        return inst && inst.lifecycle && inst.lifecycle.status === "registering";
      });
      lotteryQueues.set(buyIn, updatedQueue);

      res.json({ tableId, message: "Registered for Lottery SNG" });
    } catch (err) {
      next(err);
    }
  });

  // ─── Fast-Fold Pools ───��───────────────────��─────────────────────────────
  app.get("/api/fast-fold/pools", requireAuth, async (_req, res) => {
    const pools = fastFoldManager.getAllPools();
    const poolStates = pools.map(p => fastFoldManager.getPoolState(p.poolId)).filter(Boolean);
    res.json(poolStates);
  });

  app.post("/api/fast-fold/pools", requireAuth, async (req, res) => {
    const user = req.user!;
    // Only admins can create pools
    const dbUser = await storage.getUser(user.id);
    if (!dbUser || dbUser.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }
    const { name, smallBlind, bigBlind, minBuyIn, maxBuyIn, maxPlayersPerTable, ante, rakePercent, rakeCap } = req.body;
    if (!name || !smallBlind || !bigBlind || !minBuyIn || !maxBuyIn) {
      return res.status(400).json({ message: "Missing required fields: name, smallBlind, bigBlind, minBuyIn, maxBuyIn" });
    }
    const config: FastFoldPoolConfig = {
      name,
      smallBlind: Number(smallBlind),
      bigBlind: Number(bigBlind),
      minBuyIn: Number(minBuyIn),
      maxBuyIn: Number(maxBuyIn),
      maxPlayersPerTable: Number(maxPlayersPerTable) || 6,
      ante: Number(ante) || 0,
      rakePercent: Number(rakePercent) || 0,
      rakeCap: Number(rakeCap) || 0,
    };
    const pool = fastFoldManager.createPool(config);
    res.status(201).json(fastFoldManager.getPoolState(pool.poolId));
  });

  app.post("/api/fast-fold/pools/:poolId/join", requireAuth, async (req, res) => {
    const { poolId } = req.params;
    const { buyIn } = req.body;
    if (!buyIn || Number(buyIn) <= 0) {
      return res.status(400).json({ message: "Valid buyIn required" });
    }
    const user = req.user!;
    const result = await fastFoldManager.addPlayer(
      poolId,
      user.id,
      user.displayName || user.username,
      Number(buyIn)
    );
    if (!result.ok) {
      return res.status(400).json({ message: result.error });
    }
    res.json({ ok: true, tableId: result.tableId, poolState: fastFoldManager.getPoolState(poolId) });
  });

  app.post("/api/fast-fold/pools/:poolId/leave", requireAuth, async (req, res) => {
    const result = await fastFoldManager.removePlayer(req.user!.id);
    if (!result.ok) {
      return res.status(400).json({ message: result.error });
    }
    res.json({ ok: true });
  });

  // ─── User's Clubs ───────────────────────────────────────────────────────
  app.get("/api/me/clubs", requireAuth, async (req, res, next) => {
    try {
      const userClubs = await storage.getUserClubs(req.user!.id);
      // Enrich with memberCount
      const enriched = await Promise.all(
        userClubs.map(async (club) => {
          const members = await storage.getClubMembers(club.id);
          return { ...club, memberCount: members.length };
        })
      );
      res.json(enriched);
    } catch (err) {
      next(err);
    }
  });

  // ─── Club Routes ─────────────────────────────────────────────────────────
  app.get("/api/clubs", async (req, res, next) => {
    try {
      const allClubs = await storage.getClubs();
      // Enrich with memberCount
      const enriched = await Promise.all(
        allClubs.map(async (club) => {
          const members = await storage.getClubMembers(club.id);
          return { ...club, memberCount: members.length };
        })
      );
      // #27: Filter out private clubs for unauthenticated users
      const visible = req.user
        ? enriched
        : enriched.filter(c => c.isPublic);
      res.json(visible);
    } catch (err) {
      next(err);
    }
  });

  // ─── Club Rankings (public) ──────────────────────────────────────────────
  app.get("/api/clubs/rankings", async (_req, res, next) => {
    try {
      const allClubs = await storage.getClubs();
      if (allClubs.length === 0) return res.json([]);

      // Gather all tournaments and registrations once
      const allTournaments = await storage.getTournaments();
      const completeTournaments = allTournaments.filter(t => t.status === "complete" && t.clubId);

      // Build club-level tournament win counts
      const clubTournamentWins = new Map<string, number>();
      for (const t of completeTournaments) {
        const regs = await storage.getTournamentRegistrations(t.id);
        const winner = regs.find(r => r.finishPlace === 1);
        if (winner && t.clubId) {
          clubTournamentWins.set(t.clubId, (clubTournamentWins.get(t.clubId) || 0) + 1);
        }
      }

      // 7 days ago cutoff for active players
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const rankings = await Promise.all(allClubs.map(async (club) => {
        const members = await storage.getClubMembers(club.id);
        const userIds = members.map(m => m.userId);
        if (userIds.length === 0) {
          return {
            clubId: club.id,
            clubName: club.name,
            memberCount: 0,
            activePlayers7d: 0,
            totalHandsPlayed: 0,
            combinedWinRate: 0,
            totalChipsWon: 0,
            tournamentWins: clubTournamentWins.get(club.id) || 0,
            rank: 0,
          };
        }

        const statsMap = await storage.getPlayerStatsBatch(userIds);
        const userData = await Promise.all(userIds.map(id => storage.getUser(id)));

        let totalHands = 0;
        let totalPots = 0;
        let totalChips = 0;

        for (const uid of userIds) {
          const stats = statsMap.get(uid);
          const user = userData.find(u => u?.id === uid);
          totalHands += stats?.handsPlayed ?? 0;
          totalPots += stats?.potsWon ?? 0;
          totalChips += stats?.totalWinnings ?? 0;
          if (!totalChips && user) {
            // fallback: use chipBalance above starting amount
            totalChips += Math.max(0, (user.chipBalance ?? 0) - 1000);
          }
        }

        // Approximate active players in last 7 days using playerStats.updatedAt
        let activePlayers7d = 0;
        for (const uid of userIds) {
          const stats = statsMap.get(uid);
          if (stats && stats.updatedAt && new Date(stats.updatedAt) >= weekAgo && stats.handsPlayed > 0) {
            activePlayers7d++;
          }
        }

        const combinedWinRate = totalHands > 0
          ? Math.round((totalPots / totalHands) * 1000) / 10
          : 0;

        return {
          clubId: club.id,
          clubName: club.name,
          memberCount: userIds.length,
          activePlayers7d,
          totalHandsPlayed: totalHands,
          combinedWinRate,
          totalChipsWon: totalChips,
          tournamentWins: clubTournamentWins.get(club.id) || 0,
          rank: 0,
        };
      }));

      // Sort by total hands played (primary ranking)
      rankings.sort((a, b) => b.totalHandsPlayed - a.totalHandsPlayed);

      // Assign ranks and limit to top 50
      const top50 = rankings.slice(0, 50).map((r, i) => ({ ...r, rank: i + 1 }));

      res.json(top50);
    } catch (err) {
      next(err);
    }
  });

  // User's pending club join requests (must be before /api/clubs/:id)
  app.get("/api/clubs/my-pending-requests", requireAuth, async (req, res, next) => {
    try {
      const requests = await storage.getUserPendingRequests(req.user!.id);
      res.json(requests);
    } catch (err) {
      next(err);
    }
  });

  // ─── Club Social Feed ────────────────────────────────────────────────────
  app.get("/api/clubs/my-feed", requireAuth, async (req, res, next) => {
    try {
      const userClubs = await storage.getUserClubs(req.user!.id);
      if (userClubs.length === 0) return res.json([]);

      type FeedItem = {
        type: "big_pot" | "tournament_win" | "member_join" | "announcement" | "table_started";
        clubId: string;
        clubName: string;
        playerName: string;
        description: string;
        timestamp: string;
        amount?: number;
      };

      const feed: FeedItem[] = [];

      for (const club of userClubs) {
        // Fetch announcements
        const announcements = await storage.getClubAnnouncements(club.id);
        for (const a of announcements.slice(0, 5)) {
          const author = await storage.getUser(a.authorId);
          feed.push({
            type: "announcement",
            clubId: club.id,
            clubName: club.name,
            playerName: author?.displayName || author?.username || "Unknown",
            description: a.title,
            timestamp: a.createdAt.toISOString(),
          });
        }

        // Fetch club events
        const events = await storage.getClubEvents(club.id);
        for (const ev of events.slice(0, 5)) {
          const evType = ev.eventType === "tournament" ? "tournament_win" as const : "table_started" as const;
          feed.push({
            type: evType,
            clubId: club.id,
            clubName: club.name,
            playerName: "",
            description: ev.name + (ev.description ? ` - ${ev.description}` : ""),
            timestamp: (ev.startTime || ev.createdAt).toISOString(),
          });
        }

        // Fetch recent member joins
        const members = await storage.getClubMembers(club.id);
        const recentMembers = members
          .filter(m => m.joinedAt)
          .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())
          .slice(0, 3);
        for (const m of recentMembers) {
          const memberUser = await storage.getUser(m.userId);
          feed.push({
            type: "member_join",
            clubId: club.id,
            clubName: club.name,
            playerName: memberUser?.displayName || memberUser?.username || "Unknown",
            description: `${memberUser?.displayName || memberUser?.username || "Someone"} joined the club`,
            timestamp: new Date(m.joinedAt).toISOString(),
          });
        }
      }

      // Sort newest first, return top 20
      feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json(feed.slice(0, 20));
    } catch (err) {
      next(err);
    }
  });

  // Active clubs with online member counts
  app.get("/api/clubs/my-active", requireAuth, async (req, res, next) => {
    try {
      const userClubs = await storage.getUserClubs(req.user!.id);
      if (userClubs.length === 0) return res.json([]);

      // Gather all active table player user IDs
      const allTables = await storage.getTables();
      const activePlayerIds = new Set<string>();
      for (const table of allTables) {
        const players = await storage.getTablePlayers(table.id);
        for (const p of players) {
          activePlayerIds.add(p.userId);
        }
      }

      const result = await Promise.all(
        userClubs.map(async (club) => {
          const members = await storage.getClubMembers(club.id);
          const onlineCount = members.filter(m => activePlayerIds.has(m.userId)).length;
          return {
            id: club.id,
            name: club.name,
            memberCount: members.length,
            onlineCount,
          };
        })
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/clubs/:id", async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      res.json({ ...club, memberCount: members.length });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/clubs/:id/members", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      // Enrich with user data
      const enriched = await Promise.all(
        members.map(async (m) => {
          const user = await storage.getUser(m.userId);
          return {
            ...m,
            username: user?.username || "Unknown",
            displayName: user?.displayName || user?.username || "Unknown",
            avatarId: user?.avatarId || null,
            chipBalance: user?.chipBalance ?? 0,
          };
        })
      );
      res.json(enriched);
    } catch (err) {
      next(err);
    }
  });

  // Get stats for all members of a club
  app.get("/api/clubs/:id/members/stats", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      const userIds = members.map(m => m.userId);
      const statsMap = await storage.getPlayerStatsBatch(userIds);
      // Return as object keyed by userId
      const result: Record<string, any> = {};
      for (const uid of userIds) {
        const s = statsMap.get(uid);
        result[uid] = {
          handsPlayed: s?.handsPlayed ?? 0,
          potsWon: s?.potsWon ?? 0,
          bestWinStreak: s?.bestWinStreak ?? 0,
          currentWinStreak: s?.currentWinStreak ?? 0,
          totalWinnings: s?.totalWinnings ?? 0,
          vpip: s?.vpip ?? 0,
          pfr: s?.pfr ?? 0,
          showdownCount: s?.showdownCount ?? 0,
        };
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/clubs", requireAuth, requireTier("gold"), async (req, res, next) => {
    try {
      const parsed = insertClubSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid club data", errors: parsed.error.flatten() });
      }
      const club = await storage.createClub({
        ...parsed.data,
        ownerId: req.user!.id,
      });
      res.status(201).json(club);
    } catch (err) {
      next(err);
    }
  });

  // Update club settings (owner/admin only)
  app.put("/api/clubs/:id", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      const member = members.find(m => m.userId === req.user!.id);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { name, description, isPublic, avatarUrl, ownerId,
        timezone, language, rakePercent, maxBuyInCap, creditLimit,
        require2fa, adminApprovalRequired, antiCollusion, themeColor } = req.body;
      // Ownership transfer: only the current owner can transfer
      const updateData: any = { name, description, isPublic, avatarUrl };
      // Club settings fields — only set if provided (not undefined)
      if (timezone !== undefined) updateData.timezone = timezone;
      if (language !== undefined) updateData.language = language;
      if (rakePercent !== undefined) updateData.rakePercent = rakePercent;
      if (maxBuyInCap !== undefined) updateData.maxBuyInCap = maxBuyInCap;
      if (creditLimit !== undefined) updateData.creditLimit = creditLimit;
      if (require2fa !== undefined) updateData.require2fa = require2fa;
      if (adminApprovalRequired !== undefined) updateData.adminApprovalRequired = adminApprovalRequired;
      if (antiCollusion !== undefined) updateData.antiCollusion = antiCollusion;
      if (themeColor !== undefined) updateData.themeColor = themeColor;
      if (ownerId && ownerId !== club.ownerId) {
        if (club.ownerId !== req.user!.id) {
          return res.status(403).json({ message: "Only the club owner can transfer ownership" });
        }
        // Verify new owner is a member
        if (!members.some(m => m.userId === ownerId)) {
          return res.status(400).json({ message: "New owner must be a club member" });
        }
        updateData.ownerId = ownerId;
        // Update old owner's role from "owner" to "admin"
        await storage.updateClubMemberRole(club.id, req.user!.id, "admin");
        // Update new owner's role to "owner"
        await storage.updateClubMemberRole(club.id, ownerId, "owner");
      }
      const updated = await storage.updateClub(club.id, updateData);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Delete club (owner only)
  app.delete("/api/clubs/:id", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      if (club.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Only the club owner can delete the club" });
      }
      await storage.deleteClub(club.id);
      res.json({ message: "Club deleted" });
    } catch (err) {
      next(err);
    }
  });

  // Send invite or request to join
  app.post("/api/clubs/:id/invite", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const { userId, username, type } = req.body; // type: "invite" | "request"
      let targetUserId = type === "request" ? req.user!.id : userId;
      // Support invite by username
      if (!targetUserId && username) {
        const targetUser = await storage.getUserByUsername(username);
        if (!targetUser) return res.status(404).json({ message: `User "${username}" not found` });
        targetUserId = targetUser.id;
      }
      if (!targetUserId) return res.status(400).json({ message: "userId or username required" });

      // #28: Check for duplicate pending invitation
      const existing = await storage.getClubInvitations(club.id);
      if (existing.some(i => i.userId === targetUserId && i.status === "pending")) {
        return res.status(409).json({ message: "A pending invitation already exists for this user" });
      }

      const inv = await storage.createClubInvitation({
        clubId: club.id,
        userId: targetUserId,
        type: type || "invite",
        status: "pending",
      });
      res.status(201).json(inv);
    } catch (err) {
      next(err);
    }
  });

  // Accept/decline invitation
  app.put("/api/clubs/:id/invitations/:invId", requireAuth, async (req, res, next) => {
    try {
      const { status } = req.body;
      if (status !== "accepted" && status !== "declined") {
        return res.status(400).json({ message: "Status must be 'accepted' or 'declined'" });
      }
      // Fetch invitation first to verify ownership
      const existingInv = await storage.getClubInvitation(req.params.invId);
      if (!existingInv) return res.status(404).json({ message: "Invitation not found" });
      // Only the invitee or a club admin can accept/decline
      const isInvitee = existingInv.userId === req.user!.id;
      if (!isInvitee) {
        const members = await storage.getClubMembers(req.params.id);
        const requester = members.find(m => m.userId === req.user!.id);
        if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
          return res.status(403).json({ message: "Not authorized to modify this invitation" });
        }
      }
      const inv = await storage.updateClubInvitation(req.params.invId, { status });
      if (!inv) return res.status(404).json({ message: "Invitation not found" });
      if (status === "accepted") {
        await storage.addClubMember(req.params.id, inv.userId);
      }
      res.json(inv);
    } catch (err) {
      next(err);
    }
  });

  // Get club invitations (only club members can view)
  app.get("/api/clubs/:id/invitations", requireAuth, async (req, res, next) => {
    try {
      // Verify requester is a member of this club
      const clubMembers = await storage.getClubMembers(req.params.id);
      if (!clubMembers.some(m => m.userId === req.user!.id)) {
        return res.status(403).json({ message: "You must be a club member to view invitations" });
      }
      const invitations = await storage.getClubInvitations(req.params.id);
      // Filter out old resolved invitations (>7 days) to prevent accumulation
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const filtered = invitations.filter(inv => {
        if (inv.status === "pending") return true;
        return new Date(inv.createdAt).getTime() > sevenDaysAgo;
      });
      // Enrich with user data
      const enriched = await Promise.all(
        filtered.map(async (inv) => {
          const user = await storage.getUser(inv.userId);
          return {
            ...inv,
            username: user?.username || "Unknown",
            displayName: user?.displayName || user?.username || "Unknown",
            avatarId: user?.avatarId || null,
          };
        })
      );
      res.json(enriched);
    } catch (err) {
      next(err);
    }
  });

  // Promote/demote member role
  app.put("/api/clubs/:id/members/:userId/role", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      const requester = members.find(m => m.userId === req.user!.id);
      if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { role } = req.body;
      if (!["admin", "member"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      await storage.updateClubMemberRole(req.params.id, req.params.userId, role);
      res.json({ message: "Role updated" });
    } catch (err) {
      next(err);
    }
  });

  // Kick member
  app.delete("/api/clubs/:id/members/:userId", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      const requester = members.find(m => m.userId === req.user!.id);
      if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (req.params.userId === club.ownerId) {
        return res.status(400).json({ message: "Cannot kick the owner" });
      }
      await storage.removeClubMember(req.params.id, req.params.userId);
      res.json({ message: "Member removed" });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/clubs/:id/join", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      // Private clubs require an accepted invitation — cannot join directly
      if (!club.isPublic) {
        return res.status(403).json({ message: "This is a private club. You need an invitation to join." });
      }
      const members = await storage.getClubMembers(club.id);
      if (members.some(m => m.userId === req.user!.id)) {
        return res.status(409).json({ message: "Already a member" });
      }
      await storage.addClubMember(club.id, req.user!.id);
      res.json({ message: "Joined club" });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/clubs/:id/leave", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      if (club.ownerId === req.user!.id) {
        return res.status(400).json({ message: "Owner cannot leave club" });
      }
      await storage.removeClubMember(club.id, req.user!.id);
      res.json({ message: "Left club" });
    } catch (err) {
      next(err);
    }
  });

  // Club Announcements
  app.get("/api/clubs/:id/announcements", async (req, res, next) => {
    try {
      const announcements = await storage.getClubAnnouncements(req.params.id);
      const enriched = await Promise.all(
        announcements.map(async (a) => {
          const user = await storage.getUser(a.authorId);
          return { ...a, authorName: user?.displayName || user?.username || "Unknown" };
        })
      );
      res.json(enriched);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/clubs/:id/announcements", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      const member = members.find(m => m.userId === req.user!.id);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const { title, content, pinned } = req.body;
      if (!title || !title.trim()) {
        return res.status(400).json({ message: "Announcement title is required" });
      }
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Announcement content is required" });
      }
      const ann = await storage.createClubAnnouncement({
        clubId: club.id,
        authorId: req.user!.id,
        title,
        content,
        pinned: pinned || false,
      });

      // Notify all club members about the announcement
      try {
        for (const m of members) {
          if (m.userId !== req.user!.id) {
            await storage.createNotification(
              m.userId,
              "club_announcement",
              `${club.name}: ${title}`,
              content.length > 120 ? content.slice(0, 120) + "..." : content,
              { clubId: club.id, announcementId: ann.id },
            );
          }
        }
      } catch (_) { /* non-critical */ }

      res.status(201).json(ann);
    } catch (err) {
      next(err);
    }
  });

  // Club Events
  app.get("/api/clubs/:id/events", async (req, res, next) => {
    try {
      const events = await storage.getClubEvents(req.params.id);
      res.json(events);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/clubs/:id/events", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      // Only club owner/admin can create events
      const members = await storage.getClubMembers(club.id);
      const requester = members.find(m => m.userId === req.user!.id);
      if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
        return res.status(403).json({ message: "Only club admins can create events" });
      }
      const { eventType, name, description, startTime, tableId } = req.body;
      const ev = await storage.createClubEvent({
        clubId: club.id,
        eventType,
        name,
        description: description || null,
        startTime: startTime ? new Date(startTime) : null,
        tableId: tableId || null,
      });
      res.status(201).json(ev);
    } catch (err) {
      next(err);
    }
  });

  // ─── Club Challenges ────────────────────────────────────────────────────
  app.get("/api/clubs/:id/challenges", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const challenges = await storage.getClubChallenges(club.id);
      const now = new Date();
      // Return active (not expired or recently completed within 7 days) challenges
      const relevant = challenges.filter(c => {
        if (c.completedAt) {
          const completedAgo = now.getTime() - new Date(c.completedAt).getTime();
          return completedAgo < 7 * 24 * 60 * 60 * 1000;
        }
        return new Date(c.expiresAt).getTime() > now.getTime();
      });
      res.json(relevant);
    } catch (err) { next(err); }
  });

  app.post("/api/clubs/:id/challenges/generate", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      const requester = members.find(m => m.userId === req.user!.id);
      if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
        return res.status(403).json({ message: "Only club admins can generate challenges" });
      }
      const challengeTemplates = [
        { title: "Play 500 Hands", description: "Play 500 hands as a club this week", type: "hands_played", targetValue: 500 },
        { title: "Win 10 Tournaments", description: "Club members win 10 tournaments combined", type: "tournaments_won", targetValue: 10 },
        { title: "5 Active Members", description: "Have 5 different members play today", type: "members_active", targetValue: 5 },
        { title: "Win 50 Pots", description: "Win 50 pots as a club this week", type: "pots_won", targetValue: 50 },
      ];
      const shuffled = challengeTemplates.sort(() => Math.random() - 0.5);
      const count = 3 + Math.floor(Math.random() * 2);
      const selected = shuffled.slice(0, count);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const created = [];
      for (const tmpl of selected) {
        const rewardChips = 1000 + Math.floor(Math.random() * 4001);
        const challenge = await storage.createClubChallenge({
          clubId: club.id,
          title: tmpl.title,
          description: tmpl.description,
          targetValue: tmpl.targetValue,
          currentValue: 0,
          rewardChips,
          rewardDescription: `${rewardChips.toLocaleString()} chips`,
          type: tmpl.type,
          expiresAt,
          completedAt: null,
        });
        created.push(challenge);
      }
      res.status(201).json(created);
    } catch (err) { next(err); }
  });

  // ─── Club Tournaments ───────────────────────────────────────────────────
  app.get("/api/clubs/:id/tournaments", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const tourneys = await storage.getClubTournaments(club.id);
      const enriched = await Promise.all(
        tourneys.map(async (t) => {
          const regs = await storage.getTournamentRegistrations(t.id);
          return { ...t, registeredCount: regs.length, registrations: regs };
        })
      );
      res.json(enriched);
    } catch (err) { next(err); }
  });

  // ─── Club Leaderboard ─────────────────────────────────────────────────
  app.get("/api/clubs/:id/leaderboard", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });

      const metric = (req.query.metric as string) || "chips";
      const validMetrics = ["chips", "wins", "winRate", "handsPlayed", "tournamentsWon"];
      if (!validMetrics.includes(metric)) return res.status(400).json({ message: "Invalid metric" });

      const members = await storage.getClubMembers(club.id);
      const userIds = members.map(m => m.userId);
      if (userIds.length === 0) return res.json([]);

      const statsMap = await storage.getPlayerStatsBatch(userIds);
      const userData = await Promise.all(userIds.map(id => storage.getUser(id)));
      const userMap = new Map<string, any>();
      userData.forEach(u => { if (u) userMap.set(u.id, u); });

      let tournamentWinsMap = new Map<string, number>();
      if (metric === "tournamentsWon") {
        const clubTourneys = await storage.getClubTournaments(club.id);
        for (const t of clubTourneys) {
          if (t.status === "complete") {
            const regs = await storage.getTournamentRegistrations(t.id);
            for (const r of regs) {
              if (r.finishPlace === 1 && userIds.includes(r.userId)) {
                tournamentWinsMap.set(r.userId, (tournamentWinsMap.get(r.userId) || 0) + 1);
              }
            }
          }
        }
      }

      const entries = userIds.map(uid => {
        const user = userMap.get(uid);
        const stats = statsMap.get(uid);
        if (!user) return null;
        let value = 0;
        switch (metric) {
          case "chips": value = user.chipBalance; break;
          case "wins": value = stats?.potsWon ?? 0; break;
          case "winRate":
            value = stats && stats.handsPlayed >= 10
              ? Math.round((stats.potsWon / stats.handsPlayed) * 100) : 0;
            break;
          case "handsPlayed": value = stats?.handsPlayed ?? 0; break;
          case "tournamentsWon": value = tournamentWinsMap.get(uid) || 0; break;
        }
        return { userId: uid, username: user.username, displayName: user.displayName, avatarId: user.avatarId, value };
      }).filter(Boolean);

      entries.sort((a: any, b: any) => b.value - a.value);
      res.json(entries);
    } catch (err) { next(err); }
  });

  // ─── Club Quick Stats ─────────────────────────────────────────────────
  app.get("/api/clubs/:id/quick-stats", requireAuth, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });

      let mostActiveTable: { name: string; playerCount: number } | null = null;
      let topWinnerThisWeek: { displayName: string; amount: number } | null = null;
      let biggestPotToday: { amount: number; winnerName: string } | null = null;

      if (hasDatabase()) {
        const db = getDb();

        // 1. Most Active Table: table with most current players
        const activeRows = await db.execute(sql`
          SELECT t.name, COUNT(tp.id)::int AS player_count
          FROM tables t
          INNER JOIN table_players tp ON tp.table_id = t.id
          WHERE t.club_id = ${club.id}
          GROUP BY t.id, t.name
          ORDER BY player_count DESC
          LIMIT 1
        `);
        const activeResult = (activeRows as any).rows ?? activeRows;
        if (activeResult.length > 0 && Number(activeResult[0].player_count) > 0) {
          mostActiveTable = {
            name: activeResult[0].name as string,
            playerCount: Number(activeResult[0].player_count),
          };
        }

        // 2. Top Winner This Week: highest net_result sum in last 7 days among club members
        const winnerRows = await db.execute(sql`
          SELECT u.display_name, u.username, SUM(hp.net_result)::int AS total_won
          FROM hand_players hp
          INNER JOIN game_hands gh ON gh.id = hp.hand_id
          INNER JOIN tables t ON t.id = gh.table_id
          INNER JOIN club_members cm ON cm.club_id = t.club_id AND cm.user_id = hp.user_id
          INNER JOIN users u ON u.id = hp.user_id
          WHERE t.club_id = ${club.id}
            AND gh.created_at >= NOW() - INTERVAL '7 days'
          GROUP BY hp.user_id, u.display_name, u.username
          ORDER BY total_won DESC
          LIMIT 1
        `);
        const winnerResult = (winnerRows as any).rows ?? winnerRows;
        if (winnerResult.length > 0 && Number(winnerResult[0].total_won) > 0) {
          topWinnerThisWeek = {
            displayName: (winnerResult[0].display_name || winnerResult[0].username) as string,
            amount: Number(winnerResult[0].total_won),
          };
        }

        // 3. Biggest Pot Today: largest pot in last 24 hours for this club's tables
        const potRows = await db.execute(sql`
          SELECT gh.pot_total, u.display_name, u.username
          FROM game_hands gh
          INNER JOIN tables t ON t.id = gh.table_id
          LEFT JOIN LATERAL (
            SELECT hp2.user_id
            FROM hand_players hp2
            WHERE hp2.hand_id = gh.id AND hp2.is_winner = true
            LIMIT 1
          ) w ON true
          LEFT JOIN users u ON u.id = w.user_id
          WHERE t.club_id = ${club.id}
            AND gh.created_at >= NOW() - INTERVAL '1 day'
            AND gh.pot_total > 0
          ORDER BY gh.pot_total DESC
          LIMIT 1
        `);
        const potResult = (potRows as any).rows ?? potRows;
        if (potResult.length > 0 && Number(potResult[0].pot_total) > 0) {
          biggestPotToday = {
            amount: Number(potResult[0].pot_total),
            winnerName: (potResult[0].display_name || potResult[0].username || "Unknown") as string,
          };
        }
      }

      res.json({ mostActiveTable, topWinnerThisWeek, biggestPotToday });
    } catch (err) { next(err); }
  });

  // ─── Profile Routes ──────────────────────────────────────────────────────
  app.put("/api/profile/avatar", requireAuth, async (req, res, next) => {
    try {
      const { avatarId, displayName, tauntVoice } = req.body;
      const updates: Record<string, any> = {};
      if (avatarId && typeof avatarId === "string") updates.avatarId = avatarId;
      if (displayName && typeof displayName === "string") updates.displayName = displayName.trim().slice(0, 50);
      if (tauntVoice && typeof tauntVoice === "string") updates.tauntVoice = tauntVoice.slice(0, 30);
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "avatarId, displayName, or tauntVoice required" });
      }
      await storage.updateUser(req.user!.id, updates);
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      next(err);
    }
  });

  // ─── Wallet Routes ───────────────────────────────────────────────────────
  app.get("/api/wallet/balance", requireAuth, async (req, res, next) => {
    try {
      const userWallets = await storage.getUserWallets(req.user!.id);
      const balances: Record<string, number> = {};
      let total = 0;
      for (const w of userWallets) {
        balances[w.walletType] = w.balance;
        total += w.balance;
      }
      // Backward compat: also return flat balance
      res.json({ balance: total, balances, wallets: userWallets });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/wallet/balances", requireAuth, async (req, res, next) => {
    try {
      await storage.ensureWallets(req.user!.id);
      const userWallets = await storage.getUserWallets(req.user!.id);
      const balances: Record<string, number> = { main: 0, cash_game: 0, sng: 0, tournament: 0, bonus: 0 };
      let total = 0;
      for (const w of userWallets) {
        balances[w.walletType] = w.balance;
        total += w.balance;
      }
      res.json({ balances, total, wallets: userWallets });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/wallet/daily-status", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Determine bonus amount (2x with Elite Pass)
      const inv = await storage.getUserInventory(user.id);
      const items = await storage.getShopItems();
      const elitePass = items.find(i => i.category === "premium" && i.rarity === "legendary");
      const hasElitePass = elitePass ? inv.some(i => i.itemId === elitePass.id) : false;
      const bonusAmount = hasElitePass ? 2000 : 1000;

      if (user.lastDailyClaim) {
        const nextClaimAt = new Date(user.lastDailyClaim.getTime() + 24 * 60 * 60 * 1000);
        if (nextClaimAt.getTime() > Date.now()) {
          return res.json({ canClaim: false, nextClaimAt, bonusAmount });
        }
      }
      res.json({ canClaim: true, nextClaimAt: null, bonusAmount });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/wallet/claim-daily", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const now = new Date();
      if (user.lastDailyClaim) {
        const hoursSince = (now.getTime() - user.lastDailyClaim.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) {
          return res.status(429).json({
            message: "Daily bonus already claimed",
            nextClaimAt: new Date(user.lastDailyClaim.getTime() + 24 * 60 * 60 * 1000),
          });
        }
      }

      // Atomically set lastDailyClaim to prevent race conditions
      // (re-read user to get fresh state after the check)
      await storage.updateUser(user.id, { lastDailyClaim: now });

      // Check if user has Elite Pass for 2x bonus
      const userInventory = await storage.getUserInventory(user.id);
      const allShopItems = await storage.getShopItems();
      const elitePass = allShopItems.find(i => i.category === "premium" && i.rarity === "legendary");
      const hasElitePass = elitePass ? userInventory.some(inv => inv.itemId === elitePass.id) : false;
      const bonus = hasElitePass ? 2000 : 1000;

      // Credit bonus wallet (ensure wallets exist first)
      await storage.ensureWallets(user.id);
      const { success, newBalance } = await storage.atomicAddToWallet(user.id, "bonus", bonus);
      if (!success) return res.status(500).json({ message: "Failed to credit bonus" });

      // Also update legacy chipBalance for backward compat
      await storage.atomicAddChips(user.id, bonus);

      await storage.createTransaction({
        userId: user.id,
        type: "bonus",
        amount: bonus,
        balanceBefore: newBalance - bonus,
        balanceAfter: newBalance,
        tableId: null,
        description: "Daily login bonus",
        walletType: "bonus",
        relatedTransactionId: null,
        paymentId: null,
        metadata: null,
      });

      const totalBal = await storage.getUserTotalBalance(user.id);
      res.json({ balance: totalBal, bonus, nextClaimAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/wallet/transactions", requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const txs = await storage.getTransactions(req.user!.id, limit, offset);

      // Add human-readable display types for the frontend
      const displayTypeMap: Record<string, string> = {
        buyin: "Table Buy-in",
        cashout: "Table Exit",
        deposit: "Funds Added",
        withdraw: "Added Chips to Table",
        bonus: "Bonus",
        rake: "Rake Collected",
        prize: "Tournament Prize",
      };

      const formatted = txs.map(tx => ({
        ...tx,
        displayType: displayTypeMap[tx.type] || "Adjustment",
        status: "Completed",
      }));

      res.json(formatted);
    } catch (err) {
      next(err);
    }
  });

  // Session profit/loss summaries — grouped by table
  app.get("/api/wallet/sessions", requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 50);
      const sessions = await storage.getSessionSummaries(req.user!.id, limit);
      res.json(sessions);
    } catch (err) {
      next(err);
    }
  });

  // ─── Session History (stack-over-time) ─────────────────────────────────────
  app.get("/api/sessions/history", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);

      if (!hasDatabase()) {
        return res.json([]);
      }

      const db = getDb();

      // Fetch all hands for this user, joined with game_hands and tables
      const rows = await db.execute(sql`
        SELECT
          gh.id AS hand_id,
          gh.table_id,
          gh.hand_number,
          gh.created_at,
          t.name AS table_name,
          hp.start_stack,
          hp.end_stack,
          hp.net_result
        FROM hand_players hp
        INNER JOIN game_hands gh ON gh.id = hp.hand_id
        INNER JOIN tables t ON t.id = gh.table_id
        WHERE hp.user_id = ${userId}
        ORDER BY gh.created_at ASC
      `);

      const allHands = (rows as any).rows ?? rows;
      if (!allHands || allHands.length === 0) {
        return res.json([]);
      }

      // Group hands into sessions: same table, gap <= 30 min
      const SESSION_GAP_MS = 30 * 60 * 1000;
      interface HandRow {
        hand_id: string;
        table_id: string;
        hand_number: number;
        created_at: string | Date;
        table_name: string;
        start_stack: number;
        end_stack: number;
        net_result: number;
      }

      interface Session {
        tableId: string;
        tableName: string;
        hands: HandRow[];
      }

      const sessions: Session[] = [];
      let current: Session | null = null;
      let lastTime = 0;

      for (const row of allHands as HandRow[]) {
        const t = new Date(row.created_at).getTime();
        const sameTable = current && row.table_id === current.tableId;
        const withinGap = current && (t - lastTime) <= SESSION_GAP_MS;

        if (sameTable && withinGap) {
          current!.hands.push(row);
        } else {
          current = {
            tableId: row.table_id,
            tableName: row.table_name,
            hands: [row],
          };
          sessions.push(current);
        }
        lastTime = t;
      }

      // Build response: newest sessions first, limited
      const result = sessions
        .slice(-limit)
        .reverse()
        .map((s) => {
          const firstHand = s.hands[0];
          const lastHand = s.hands[s.hands.length - 1];
          const startingStack = Number(firstHand.start_stack);
          const endingStack = Number(lastHand.end_stack);
          return {
            sessionId: `${s.tableId}-${new Date(firstHand.created_at).getTime()}`,
            tableName: s.tableName,
            startTime: new Date(firstHand.created_at).toISOString(),
            endTime: new Date(lastHand.created_at).toISOString(),
            handsPlayed: s.hands.length,
            startingStack,
            endingStack,
            netResult: endingStack - startingStack,
            stackHistory: s.hands.map(h => ({
              handNumber: Number(h.hand_number),
              chips: Number(h.end_stack),
            })),
          };
        });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // ─── Wallet Transfer ─────────────────────────────────────────────────────
  app.post("/api/wallet/transfer", requireAuth, async (req, res, next) => {
    try {
      const { from, to, amount } = req.body;
      if (!from || !to || !amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid transfer: from, to, and amount > 0 required" });
      }
      const validTypes = ["main", "cash_game", "sng", "tournament", "bonus"];
      if (!validTypes.includes(from) || !validTypes.includes(to)) {
        return res.status(400).json({ message: "Invalid wallet type" });
      }
      if (from === to) return res.status(400).json({ message: "Cannot transfer to the same wallet" });
      if (from === "bonus") return res.status(400).json({ message: "Cannot transfer from bonus wallet" });

      await storage.ensureWallets(req.user!.id);
      const { success, fromBalance, toBalance } = await storage.atomicTransferBetweenWallets(
        req.user!.id, from, to, amount
      );
      if (!success) return res.status(400).json({ message: "Insufficient funds or wallet locked" });

      // Log both sides of the transfer
      const txId1 = require("crypto").randomUUID();
      const txId2 = require("crypto").randomUUID();
      await storage.createTransaction({
        userId: req.user!.id, type: "transfer", amount: -amount,
        balanceBefore: fromBalance + amount, balanceAfter: fromBalance,
        tableId: null, description: `Transfer to ${to} wallet`,
        walletType: from, relatedTransactionId: txId2, paymentId: null, metadata: null,
      });
      await storage.createTransaction({
        userId: req.user!.id, type: "transfer", amount: amount,
        balanceBefore: toBalance - amount, balanceAfter: toBalance,
        tableId: null, description: `Transfer from ${from} wallet`,
        walletType: to, relatedTransactionId: txId1, paymentId: null, metadata: null,
      });

      const allWallets = await storage.getUserWallets(req.user!.id);
      const balances: Record<string, number> = {};
      for (const w of allWallets) balances[w.walletType] = w.balance;

      res.json({ success: true, balances });
    } catch (err) {
      next(err);
    }
  });

  // ─── Payment / Deposit Routes ─────────────────────────────────────────────
  app.get("/api/payments/currencies", async (_req, res, next) => {
    try {
      const currencies = await storage.getSupportedCurrencies();
      res.json(currencies);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/payments/gateways", async (_req, res, next) => {
    try {
      const { getPaymentService } = await import("./payments/payment-service");
      const svc = getPaymentService();
      res.json(svc.getAvailableGateways());
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/payments/deposit", requireAuth, async (req, res, next) => {
    try {
      const { amount, currency, gateway, allocation } = req.body;
      if (!amount || !currency || !gateway || !allocation || !Array.isArray(allocation)) {
        return res.status(400).json({ message: "amount, currency, gateway, and allocation[] required" });
      }
      if (amount < 100) return res.status(400).json({ message: "Minimum deposit is $1.00 (100 cents)" });

      const allocSum = allocation.reduce((s: number, a: any) => s + (a.amount || 0), 0);
      if (allocSum !== amount) {
        return res.status(400).json({ message: `Allocation sum (${allocSum}) must equal deposit amount (${amount})` });
      }

      const { getPaymentService } = await import("./payments/payment-service");
      const svc = getPaymentService();
      const result = await svc.initiateDeposit(req.user!.id, amount, currency, gateway, allocation);
      res.json(result);
    } catch (err: any) {
      if (err.message?.includes("not configured")) {
        return res.status(400).json({ message: err.message });
      }
      next(err);
    }
  });

  app.get("/api/payments/:id", requireAuth, async (req, res, next) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment || payment.userId !== req.user!.id) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(payment);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/payments", requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const userPayments = await storage.getUserPayments(req.user!.id, limit, offset);
      res.json(userPayments);
    } catch (err) {
      next(err);
    }
  });

  // ─── Payment Webhooks (no auth — verified by signature) ───────────────────
  app.post("/api/payments/webhook/:provider", async (req, res, next) => {
    try {
      const provider = req.params.provider;
      const { getPaymentService } = await import("./payments/payment-service");
      const svc = getPaymentService();
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === "string") headers[k.toLowerCase()] = v;
      }
      // For Stripe, pass raw body (Buffer) for signature verification
      const webhookBody = provider === "stripe" && (req as any).rawBody
        ? (req as any).rawBody
        : req.body;
      const result = await svc.processWebhook(provider, webhookBody, headers);
      res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error(`[Webhook] Error processing ${req.params.provider} webhook:`, err.message);
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Withdrawal Routes ────────────────────────────────────────────────────
  app.post("/api/wallet/withdraw", requireAuth, async (req, res, next) => {
    try {
      const { amount, currency, address } = req.body;
      if (!amount || !currency || !address) {
        return res.status(400).json({ message: "amount, currency, and address required" });
      }
      if (amount <= 0) return res.status(400).json({ message: "Amount must be positive" });

      const { getPaymentService } = await import("./payments/payment-service");
      const svc = getPaymentService();
      const result = await svc.initiateWithdrawal(req.user!.id, amount, currency, address);
      res.json(result);
    } catch (err: any) {
      if (err.message?.includes("Insufficient") || err.message?.includes("Invalid")) {
        return res.status(400).json({ message: err.message });
      }
      next(err);
    }
  });

  app.get("/api/wallet/withdrawals", requireAuth, async (req, res, next) => {
    try {
      const requests = await storage.getUserWithdrawalRequests(req.user!.id);
      res.json(requests);
    } catch (err) {
      next(err);
    }
  });

  // ─── Hand Routes ─────────────────────────────────────────────────────────
  app.get("/api/hands/:id", async (req, res, next) => {
    try {
      const hand = await storage.getGameHand(req.params.id);
      if (!hand) return res.status(404).json({ message: "Hand not found" });
      res.json(hand);
    } catch (err) {
      next(err);
    }
  });

  // ─── Hand Verification Route ──────────────────────────────────────────────
  app.get("/api/hands/:id/verify", requireAuth, async (req, res, next) => {
    try {
      const hand = await storage.getGameHand(req.params.id);
      if (!hand) return res.status(404).json({ message: "Hand not found" });
      if (!hand.serverSeed || !hand.commitmentHash || !hand.deckOrder) {
        return res.status(404).json({ message: "No proof data for this hand" });
      }
      res.json({
        serverSeed: hand.serverSeed,
        commitmentHash: hand.commitmentHash,
        deckOrder: hand.deckOrder,
        handNumber: hand.handNumber,
        tableId: hand.tableId,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Hand History Routes ────────────────────────────────────────────────
  app.get("/api/tables/:id/hands", requireAuth, async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const hands = await storage.getGameHands(req.params.id, limit);
      res.json(hands);
    } catch (err) {
      next(err);
    }
  });

  // Hand players (per-player records for a specific hand) — strip hole cards for non-showdown players
  app.get("/api/hands/:id/players", requireAuth, async (req, res, next) => {
    try {
      const players = await storage.getHandPlayers(req.params.id);
      const safePlayers = players.map((p: any) => {
        // Only reveal hole cards for the requesting user or if player went to showdown
        if (p.userId === req.user!.id || p.finalAction === "showdown") {
          return p;
        }
        const { holeCards, ...rest } = p;
        return rest;
      });
      res.json(safePlayers);
    } catch (err) {
      next(err);
    }
  });

  // Hand actions (action-by-action replay log)
  app.get("/api/hands/:id/actions", async (req, res, next) => {
    try {
      const actions = await storage.getHandActions(req.params.id);
      res.json(actions);
    } catch (err) {
      next(err);
    }
  });

  // Player hand history (all hands a user participated in)
  app.get("/api/players/:id/hands", requireAuth, async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const hands = await storage.getPlayerHandHistory(req.params.id, limit);
      res.json(hands);
    } catch (err) {
      next(err);
    }
  });

  // ─── Player Stats Routes ──────────────────────────────────────────────
  app.get("/api/stats/me", requireAuth, async (req, res, next) => {
    try {
      const stats = await storage.getPlayerStats(req.user!.id);
      if (!stats) {
        return res.json({
          handsPlayed: 0, potsWon: 0,
          bestWinStreak: 0, currentWinStreak: 0, totalWinnings: 0,
          vpip: 0, pfr: 0, showdownCount: 0, sngWins: 0,
        });
      }
      res.json({
        handsPlayed: stats.handsPlayed,
        potsWon: stats.potsWon,
        bestWinStreak: stats.bestWinStreak,
        currentWinStreak: stats.currentWinStreak,
        totalWinnings: stats.totalWinnings,
        vpip: stats.vpip,
        pfr: stats.pfr,
        showdownCount: stats.showdownCount,
        sngWins: stats.sngWins,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Stats Breakdown by Variant / Format ───────────────────────────────
  app.get("/api/stats/me/breakdown", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;

      if (!hasDatabase()) {
        // In-memory fallback: return empty breakdown
        const emptyGroup = { handsPlayed: 0, potsWon: 0, winRate: 0, totalChipsWon: 0, totalChipsLost: 0, netResult: 0 };
        return res.json({
          byVariant: { nlhe: { ...emptyGroup }, plo: { ...emptyGroup }, plo5: { ...emptyGroup }, short_deck: { ...emptyGroup } },
          byFormat: { cash: { ...emptyGroup }, sng: { ...emptyGroup }, tournament: { ...emptyGroup } },
        });
      }

      const db = getDb();

      // Query hand_players joined with game_hands joined with tables to get variant and format
      const rows = await db.execute(sql`
        SELECT
          t.poker_variant AS variant,
          t.game_format AS format,
          hp.net_result,
          hp.is_winner
        FROM hand_players hp
        INNER JOIN game_hands gh ON gh.id = hp.hand_id
        INNER JOIN tables t ON t.id = gh.table_id
        WHERE hp.user_id = ${userId}
      `);

      const byVariant: Record<string, { handsPlayed: number; potsWon: number; totalChipsWon: number; totalChipsLost: number; netResult: number }> = {};
      const byFormat: Record<string, { handsPlayed: number; potsWon: number; totalChipsWon: number; totalChipsLost: number; netResult: number }> = {};

      const ensureGroup = (map: typeof byVariant, key: string) => {
        if (!map[key]) map[key] = { handsPlayed: 0, potsWon: 0, totalChipsWon: 0, totalChipsLost: 0, netResult: 0 };
        return map[key];
      };

      // Ensure all known variants/formats exist
      for (const v of ["nlhe", "plo", "plo5", "short_deck"]) ensureGroup(byVariant, v);
      for (const f of ["cash", "sng", "tournament"]) ensureGroup(byFormat, f);

      const resultRows = (rows as any).rows ?? rows;
      for (const row of resultRows) {
        const variant = (row.variant as string) || "nlhe";
        const rawFormat = (row.format as string) || "cash";
        // Normalize format: heads_up and bomb_pot count as cash, sng stays sng, tournament stays tournament
        const format = rawFormat === "tournament" ? "tournament" : rawFormat === "sng" ? "sng" : "cash";
        const net = Number(row.net_result) || 0;
        const won = row.is_winner === true || row.is_winner === "true";

        const vg = ensureGroup(byVariant, variant);
        vg.handsPlayed++;
        if (won) vg.potsWon++;
        if (net > 0) vg.totalChipsWon += net;
        else vg.totalChipsLost += Math.abs(net);
        vg.netResult += net;

        const fg = ensureGroup(byFormat, format);
        fg.handsPlayed++;
        if (won) fg.potsWon++;
        if (net > 0) fg.totalChipsWon += net;
        else fg.totalChipsLost += Math.abs(net);
        fg.netResult += net;
      }

      // Add winRate to each group
      const addWinRate = (map: typeof byVariant) => {
        const result: Record<string, any> = {};
        for (const [key, g] of Object.entries(map)) {
          result[key] = {
            ...g,
            winRate: g.handsPlayed > 0 ? Math.round((g.potsWon / g.handsPlayed) * 10000) / 100 : 0,
          };
        }
        return result;
      };

      res.json({
        byVariant: addWinRate(byVariant),
        byFormat: addWinRate(byFormat),
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Head-to-Head Stats ────────────────────────────────────────────────
  app.get("/api/stats/head-to-head/top", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;

      if (!hasDatabase()) {
        return res.json([]);
      }

      const db = getDb();

      const rows = await db.execute(sql`
        SELECT
          opp.user_id AS opponent_id,
          u.display_name AS opponent_name,
          u.username AS opponent_username,
          COUNT(*) AS hands_played,
          SUM(CASE WHEN me.is_winner THEN 1 ELSE 0 END) AS user_wins,
          SUM(CASE WHEN opp.is_winner THEN 1 ELSE 0 END) AS opponent_wins,
          SUM(CASE WHEN me.is_winner AND opp.is_winner THEN 1 ELSE 0 END) AS split_pots,
          SUM(me.net_result) AS user_net_chips,
          MAX(gh.created_at) AS last_played
        FROM hand_players me
        INNER JOIN hand_players opp ON opp.hand_id = me.hand_id AND opp.user_id != me.user_id
        INNER JOIN game_hands gh ON gh.id = me.hand_id
        INNER JOIN users u ON u.id = opp.user_id
        WHERE me.user_id = ${userId}
        GROUP BY opp.user_id, u.display_name, u.username
        ORDER BY COUNT(*) DESC
        LIMIT 5
      `);

      const resultRows = (rows as any).rows ?? rows;
      const results = resultRows.map((row: any) => ({
        opponentId: row.opponent_id,
        opponentName: row.opponent_name || row.opponent_username || "Unknown",
        handsPlayedTogether: Number(row.hands_played) || 0,
        userWins: Number(row.user_wins) || 0,
        opponentWins: Number(row.opponent_wins) - Number(row.split_pots) || 0,
        splitPots: Number(row.split_pots) || 0,
        userNetChips: Number(row.user_net_chips) || 0,
        lastPlayed: row.last_played || null,
      }));

      res.json(results);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/stats/head-to-head/:opponentId", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const opponentId = req.params.opponentId;

      if (!hasDatabase()) {
        return res.json({
          opponentId,
          opponentName: "Unknown",
          handsPlayedTogether: 0,
          userWins: 0,
          opponentWins: 0,
          splitPots: 0,
          userNetChips: 0,
          lastPlayed: null,
        });
      }

      const db = getDb();

      const oppRows = await db.execute(sql`
        SELECT display_name, username FROM users WHERE id = ${opponentId}
      `);
      const oppResultRows = (oppRows as any).rows ?? oppRows;
      const opponent = oppResultRows[0];
      if (!opponent) {
        return res.status(404).json({ message: "Opponent not found" });
      }

      const rows = await db.execute(sql`
        SELECT
          me.is_winner AS me_won,
          opp.is_winner AS opp_won,
          me.net_result AS my_net,
          gh.created_at
        FROM hand_players me
        INNER JOIN hand_players opp ON opp.hand_id = me.hand_id AND opp.user_id = ${opponentId}
        INNER JOIN game_hands gh ON gh.id = me.hand_id
        WHERE me.user_id = ${userId}
        ORDER BY gh.created_at DESC
      `);

      const resultRows = (rows as any).rows ?? rows;

      let userWins = 0;
      let opponentWins = 0;
      let splitPots = 0;
      let userNetChips = 0;
      let lastPlayed: string | null = null;

      for (const row of resultRows) {
        const meWon = row.me_won === true || row.me_won === "true";
        const oppWon = row.opp_won === true || row.opp_won === "true";
        const net = Number(row.my_net) || 0;

        if (meWon && oppWon) {
          splitPots++;
          userWins++;
        } else if (meWon) {
          userWins++;
        } else if (oppWon) {
          opponentWins++;
        }

        userNetChips += net;

        if (!lastPlayed && row.created_at) {
          lastPlayed = new Date(row.created_at).toISOString();
        }
      }

      res.json({
        opponentId,
        opponentName: opponent.display_name || opponent.username || "Unknown",
        handsPlayedTogether: resultRows.length,
        userWins,
        opponentWins,
        splitPots,
        userNetChips,
        lastPlayed,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Play Style Coach ─────────────────────────────────────────────────
  app.get("/api/coaching/recommendations", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const stats = await storage.getPlayerStats(userId);

      const handsPlayed = stats?.handsPlayed ?? 0;
      const potsWon = stats?.potsWon ?? 0;
      const vpipCount = stats?.vpip ?? 0;
      const pfrCount = stats?.pfr ?? 0;
      const showdownCount = stats?.showdownCount ?? 0;

      const vpipPct = handsPlayed > 0 ? Math.round((vpipCount / handsPlayed) * 100) : 0;
      const pfrPct = handsPlayed > 0 ? Math.round((pfrCount / handsPlayed) * 100) : 0;
      const showdownPct = handsPlayed > 0 ? Math.round((showdownCount / handsPlayed) * 100) : 0;
      const winRate = handsPlayed > 0 ? Math.round((potsWon / handsPlayed) * 100) : 0;

      // Try to get additional data from handPlayers if DB is available
      let additionalHands = 0;
      if (hasDatabase()) {
        try {
          const db = getDb();
          const rows = await db.select({ count: sql<number>`count(*)` }).from(handPlayers).where(sql`${handPlayers.userId} = ${userId}`);
          additionalHands = Number(rows[0]?.count ?? 0);
        } catch (_) { /* ignore — use playerStats only */ }
      }

      const totalAnalyzed = Math.max(handsPlayed, additionalHands);

      const recommendations: { category: string; severity: string; title: string; detail: string }[] = [];

      // Minimum hands gate
      if (totalAnalyzed < 100) {
        recommendations.push({
          category: "General",
          severity: "warning",
          title: "Need More Data",
          detail: `Play more hands to get meaningful recommendations. We need at least 100 hands. You've played ${totalAnalyzed} so far.`,
        });
      }

      // VPIP analysis
      if (vpipPct > 35) {
        recommendations.push({
          category: "Preflop",
          severity: "critical",
          title: "Too Loose Preflop",
          detail: `Your VPIP is ${vpipPct}% — you're playing too many hands. Optimal range is 18-25% for full ring. Tighten up, especially from early position.`,
        });
      } else if (vpipPct < 15 && handsPlayed >= 100) {
        recommendations.push({
          category: "Preflop",
          severity: "warning",
          title: "Too Tight Preflop",
          detail: `Your VPIP is ${vpipPct}% — you're playing too tight. You're missing profitable spots. Open your range from late position.`,
        });
      } else if (vpipPct >= 18 && vpipPct <= 25) {
        recommendations.push({
          category: "Preflop",
          severity: "good",
          title: "Optimal VPIP",
          detail: `Your VPIP of ${vpipPct}% is in the optimal range. Keep it up.`,
        });
      }

      // PFR analysis
      if (handsPlayed >= 100 && pfrPct < vpipPct / 2) {
        recommendations.push({
          category: "Preflop",
          severity: "warning",
          title: "Too Much Calling",
          detail: `Your PFR is ${pfrPct}% vs VPIP of ${vpipPct}% — you're calling too much preflop instead of raising. Raise or fold more, call less.`,
        });
      } else if (handsPlayed >= 100 && pfrPct > vpipPct * 0.8) {
        recommendations.push({
          category: "Preflop",
          severity: "warning",
          title: "Raising Too Often",
          detail: `You're raising nearly every hand you play. Consider flatting more in position.`,
        });
      }

      // Showdown analysis
      if (showdownPct > 40) {
        recommendations.push({
          category: "Postflop",
          severity: "warning",
          title: "Too Many Showdowns",
          detail: `You're going to showdown ${showdownPct}% of the time — you might be calling too many rivers. Consider folding weak hands on the river.`,
        });
      } else if (showdownPct < 15 && handsPlayed >= 100) {
        recommendations.push({
          category: "Postflop",
          severity: "warning",
          title: "Folding Too Often",
          detail: `You rarely go to showdown (${showdownPct}%) — opponents may be pushing you off hands. Stand your ground with medium-strength hands.`,
        });
      }

      // Win rate
      if (winRate < 15 && handsPlayed >= 100) {
        recommendations.push({
          category: "Overall",
          severity: "critical",
          title: "Low Win Rate",
          detail: `Your win rate of ${winRate}% is below average. Focus on hand selection and position.`,
        });
      } else if (winRate > 40) {
        recommendations.push({
          category: "Overall",
          severity: "good",
          title: "Excellent Win Rate",
          detail: `Excellent win rate of ${winRate}%! You're playing well above average.`,
        });
      }

      // Determine play style
      const isLoose = vpipPct > 25;
      const isAggressive = pfrPct > 15;
      let overallRating: string;
      if (isLoose && isAggressive) overallRating = "Loose-Aggressive";
      else if (isLoose && !isAggressive) overallRating = "Loose-Passive";
      else if (!isLoose && isAggressive) overallRating = "Tight-Aggressive";
      else overallRating = "Tight-Passive";

      // Calculate a score (0-100)
      let score = 50;
      if (vpipPct >= 18 && vpipPct <= 25) score += 15;
      else if (vpipPct > 35 || vpipPct < 10) score -= 15;
      else score -= 5;
      if (pfrPct >= vpipPct * 0.5 && pfrPct <= vpipPct * 0.8) score += 10;
      else score -= 5;
      if (showdownPct >= 20 && showdownPct <= 35) score += 10;
      else if (showdownPct > 40 || showdownPct < 15) score -= 10;
      if (winRate > 40) score += 15;
      else if (winRate > 25) score += 5;
      else if (winRate < 15) score -= 10;
      score = Math.max(0, Math.min(100, score));

      res.json({
        handsAnalyzed: totalAnalyzed,
        overallRating,
        score,
        recommendations,
        stats: {
          vpip: vpipPct,
          pfr: pfrPct,
          showdownPct,
          winRate,
          handsPlayed: totalAnalyzed,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Commentary Audio ─────────────────────────────────────────────────
  app.get("/api/commentary-audio/:segmentId/:lineIndex", requireAuth, (req, res) => {
    const { getAudioBuffer } = require("./game/tts-engine");
    const { segmentId, lineIndex } = req.params;
    const entry = getAudioBuffer(segmentId, parseInt(lineIndex));
    if (!entry) {
      res.status(404).json({ error: "Audio not found or expired" });
      return;
    }
    res.set("Content-Type", "audio/mpeg");
    res.set("Cache-Control", "private, max-age=60");
    res.send(entry.buffer);
  });

  // ─── Leaderboard ─────────────────────────────────────────────────────
  app.get("/api/leaderboard", requireAuth, async (req, res, next) => {
    try {
      const metric = (req.query.metric as string) || "chips";
      if (!["chips", "wins", "winRate"].includes(metric)) {
        return res.status(400).json({ error: "Invalid metric. Use chips, wins, or winRate" });
      }
      const period = (req.query.period as string) || "all";
      if (!["today", "week", "month", "all"].includes(period)) {
        return res.status(400).json({ error: "Invalid period. Use today, week, month, or all" });
      }

      const data = await storage.getLeaderboard(
        metric as "chips" | "wins" | "winRate",
        50,
        period as "today" | "week" | "month" | "all",
      );

      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  // ─── Missions Routes ──────────────────────────────────────────────────

  // Helper: check if a mission period has expired and needs reset
  function isMissionPeriodStale(periodStart: Date | null, periodType: string): boolean {
    if (!periodStart) return true;
    const now = Date.now();
    const start = new Date(periodStart).getTime();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    if (periodType === "daily" && now - start > TWENTY_FOUR_HOURS) return true;
    if (periodType === "weekly" && now - start > SEVEN_DAYS) return true;
    return false;
  }

  // Helper: reset stale user missions and player stats for a given user.
  // Returns true if any missions were reset.
  async function resetStaleMissions(userId: string, allMissions: any[], userMs: any[]): Promise<boolean> {
    let didReset = false;
    let resetDaily = false;
    const stats = await storage.getPlayerStats(userId);

    const baselineFieldMap: Record<string, string> = {
      hands_played: "handsPlayed",
      pots_won: "potsWon",
      bluff_wins: "bluffWins",
      preflop_folds: "preflopFolds",
      big_pot_wins: "bigPotWins",
      plo_hands: "ploHands",
      tournament_hands: "tournamentHands",
      sng_win: "sngWins",
      vpip: "vpip",
      win_streak: "bestWinStreak",
      consecutive_wins: "currentWinStreak",
      bomb_pot: "bombPotsPlayed",
      heads_up_win: "headsUpWins",
    };

    for (const um of userMs) {
      const mission = allMissions.find((m: any) => m.id === um.missionId);
      if (!mission) continue;
      if (isMissionPeriodStale(um.periodStart, mission.periodType)) {
        const statField = baselineFieldMap[mission.type];
        const newBaseline = stats && statField && typeof (stats as any)[statField] === "number"
          ? (stats as any)[statField] as number
          : 0;
        await storage.updateUserMission(um.id, {
          progress: 0,
          claimedAt: null,
          completedAt: null,
          periodStart: new Date(),
          baselineValue: newBaseline,
        });
        didReset = true;
        if (mission.periodType === "daily") {
          resetDaily = true;
        }
      }
    }
    // Reset tracked stats only when a daily mission period has elapsed
    if (resetDaily) {
      await storage.resetDailyStats(userId);
    }
    return didReset;
  }

  app.get("/api/missions", requireAuth, async (req, res, next) => {
    try {
      const allMissions = await storage.getMissions();
      let userMs = await storage.getUserMissions(req.user!.id);

      // Lazy reset: check for stale mission periods and reset them
      const didReset = await resetStaleMissions(req.user!.id, allMissions, userMs);
      // Re-fetch after reset so we have fresh data
      if (didReset) {
        userMs = await storage.getUserMissions(req.user!.id);
      }

      const stats = await storage.getPlayerStats(req.user!.id);

      const result = allMissions.map(m => {
        const userMission = userMs.find(um => um.missionId === m.id);
        const baseline = userMission?.baselineValue ?? 0;
        let progress = 0;
        if (stats) {
          switch (m.type) {
            case "hands_played": progress = Math.max(0, stats.handsPlayed - baseline); break;
            case "pots_won": progress = Math.max(0, stats.potsWon - baseline); break;
            case "win_streak": progress = Math.max(0, stats.bestWinStreak - baseline); break;
            case "consecutive_wins": progress = Math.max(0, stats.currentWinStreak - baseline); break;
            case "sng_win": progress = Math.max(0, ((stats as any).sngWins ?? 0) - baseline); break;
            case "bomb_pot": progress = Math.max(0, ((stats as any).bombPotsPlayed ?? 0) - baseline); break;
            case "heads_up_win": progress = Math.max(0, ((stats as any).headsUpWins ?? 0) - baseline); break;
            default: progress = userMission?.progress || 0;
          }
        }
        return {
          ...m,
          progress: Math.min(progress, m.target),
          completed: progress >= m.target,
          claimed: !!userMission?.claimedAt,
          userMissionId: userMission?.id,
        };
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/missions/:id/claim", requireAuth, async (req, res, next) => {
    try {
      const allMissions = await storage.getMissions();
      const mission = allMissions.find(m => m.id === req.params.id);
      if (!mission) return res.status(404).json({ message: "Mission not found" });

      // Lazy reset: check all user missions for staleness before evaluating claim
      let userMs = await storage.getUserMissions(req.user!.id);
      const didReset = await resetStaleMissions(req.user!.id, allMissions, userMs);
      if (didReset) {
        userMs = await storage.getUserMissions(req.user!.id);
      }

      const stats = await storage.getPlayerStats(req.user!.id);
      const userMission = userMs.find(um => um.missionId === mission.id);
      const baseline = userMission?.baselineValue ?? 0;
      let progress = 0;
      if (stats) {
        switch (mission.type) {
          case "hands_played": progress = Math.max(0, stats.handsPlayed - baseline); break;
          case "pots_won": progress = Math.max(0, stats.potsWon - baseline); break;
          case "win_streak": progress = Math.max(0, stats.bestWinStreak - baseline); break;
          case "consecutive_wins": progress = Math.max(0, stats.currentWinStreak - baseline); break;
          case "sng_win": progress = Math.max(0, ((stats as any).sngWins ?? 0) - baseline); break;
          case "bomb_pot": progress = Math.max(0, ((stats as any).bombPotsPlayed ?? 0) - baseline); break;
          case "heads_up_win": progress = Math.max(0, ((stats as any).headsUpWins ?? 0) - baseline); break;
        }
      }

      if (progress < mission.target) {
        return res.status(400).json({ message: "Mission not completed" });
      }

      // Check if already claimed
      const existing = userMs.find(um => um.missionId === mission.id && um.claimedAt);
      if (existing) {
        return res.status(400).json({ message: "Already claimed" });
      }

      // Create or update user mission
      if (userMission) {
        await storage.updateUserMission(userMission.id, {
          claimedAt: new Date(),
          completedAt: new Date(),
          progress,
        });
      } else {
        await storage.createUserMission({
          userId: req.user!.id,
          missionId: mission.id,
          progress,
          completedAt: new Date(),
          claimedAt: new Date(),
          periodStart: new Date(),
          baselineValue: baseline,
        });
      }

      // Credit reward to bonus wallet
      await storage.ensureWallets(req.user!.id);
      const { success: credited, newBalance } = await storage.atomicAddToWallet(req.user!.id, "bonus", mission.reward);
      if (credited) {
        await storage.createTransaction({
          userId: req.user!.id,
          type: "bonus",
          amount: mission.reward,
          balanceBefore: newBalance - mission.reward,
          balanceAfter: newBalance,
          tableId: null,
          description: `Mission reward: ${mission.label}`,
          walletType: "bonus",
          relatedTransactionId: null,
          paymentId: null,
          metadata: null,
        });
      }

      res.json({ message: "Reward claimed", reward: mission.reward });
    } catch (err) {
      next(err);
    }
  });

  // ─── Hand Analysis Routes ────────────────────────────────────────────
  app.post("/api/analyze-hand", requireAuth, async (req, res, next) => {
    try {
      const { holeCards, communityCards, pot, position } = req.body;
      if (!holeCards || !Array.isArray(holeCards)) {
        return res.status(400).json({ message: "holeCards required" });
      }

      // Simple analysis based on hand strength and position
      const analysis = analyzeHand(holeCards, communityCards || [], pot || 0, position || "middle");

      await storage.createHandAnalysis({
        userId: req.user!.id,
        handId: typeof req.body.handId === "string" ? req.body.handId.slice(0, 100) : null,
        holeCards,
        communityCards: communityCards || null,
        pot: pot || 0,
        position: position || null,
        analysis,
      });

      // Return the analysis directly (matches AIAnalysisPanel's AnalysisResult shape)
      res.json(analysis);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/analyses", requireAuth, async (req, res, next) => {
    try {
      const analyses = await storage.getUserHandAnalyses(req.user!.id);
      res.json(analyses);
    } catch (err) {
      next(err);
    }
  });

  // ─── Shop Routes ─────────────────────────────────────────────────────
  app.get("/api/shop/items", async (req, res, next) => {
    try {
      const category = req.query.category as string;
      const items = await storage.getShopItems(category || undefined);
      res.json(items);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/shop/purchase", requireAuth, async (req, res, next) => {
    try {
      const { itemId } = req.body;
      const item = await storage.getShopItem(itemId);
      if (!item) return res.status(404).json({ message: "Item not found" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Check if already owned
      const inventory = await storage.getUserInventory(user.id);
      if (inventory.some(i => i.itemId === itemId)) {
        return res.status(400).json({ message: "Already owned" });
      }

      // Deduct from main wallet for shop purchases
      await storage.ensureWallets(user.id);
      const { success, newBalance: balanceAfterPurchase } = await storage.atomicDeductFromWallet(user.id, "main", item.price);
      if (!success) {
        return res.status(400).json({ message: "Insufficient chips in main wallet" });
      }

      await storage.createTransaction({
        userId: user.id,
        type: "purchase",
        amount: -item.price,
        balanceBefore: balanceAfterPurchase + item.price,
        balanceAfter: balanceAfterPurchase,
        tableId: null,
        description: `Purchased: ${item.name}`,
        walletType: "main",
        relatedTransactionId: null,
        paymentId: null,
        metadata: null,
      });

      const inv = await storage.addToInventory(user.id, itemId);

      // Grant bonus chips if item description mentions chips (e.g., VIP Chip Bundle)
      const chipMatch = item.description?.match(/(\d[\d,]*)\s*chips/i);
      if (chipMatch) {
        const bonusChips = parseInt(chipMatch[1].replace(/,/g, ""), 10);
        if (bonusChips > 0) {
          const { success: addOk, newBalance: balAfterBonus } = await storage.atomicAddChips(user.id, bonusChips);
          if (addOk) {
            await storage.createTransaction({
              userId: user.id,
              type: "deposit",
              amount: bonusChips,
              balanceBefore: balAfterBonus - bonusChips,
              balanceAfter: balAfterBonus,
              tableId: null,
              description: `Bonus chips from: ${item.name}`,
              walletType: "bonus",
              relatedTransactionId: null,
              paymentId: null,
              metadata: null,
            });
          }
        }
      }

      res.json({ message: "Purchased", item: inv });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/shop/inventory", requireAuth, async (req, res, next) => {
    try {
      const inventory = await storage.getUserInventory(req.user!.id);
      // Enrich with item data
      const enriched = await Promise.all(
        inventory.map(async (inv) => {
          const item = await storage.getShopItem(inv.itemId);
          return { ...inv, item };
        })
      );
      res.json(enriched);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/shop/equip", requireAuth, async (req, res, next) => {
    try {
      const { inventoryId } = req.body;
      await storage.equipItem(inventoryId);
      res.json({ message: "Equipped" });
    } catch (err) {
      next(err);
    }
  });

  // ─── Wishlist Routes (database-persisted) ────────────────────────────
  app.get("/api/shop/wishlist", requireAuth, async (req, res, next) => {
    try {
      const items = await storage.getWishlist(req.user!.id);
      res.json(items);
    } catch (err) { next(err); }
  });

  app.post("/api/shop/wishlist/:itemId", requireAuth, async (req, res, next) => {
    try {
      await storage.addToWishlist(req.user!.id, req.params.itemId);
      res.json({ message: "Added" });
    } catch (err) { next(err); }
  });

  app.delete("/api/shop/wishlist/:itemId", requireAuth, async (req, res, next) => {
    try {
      await storage.removeFromWishlist(req.user!.id, req.params.itemId);
      res.json({ message: "Removed" });
    } catch (err) { next(err); }
  });

  // ─── Tournament Routes ──────────────────────────────────────────────────
  app.get("/api/tournaments", async (_req, res, next) => {
    try {
      const tourneys = await storage.getTournaments();
      res.json(tourneys);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/tournaments/:id", async (req, res, next) => {
    try {
      const tourney = await storage.getTournament(req.params.id);
      if (!tourney) return res.status(404).json({ message: "Tournament not found" });
      const regs = await storage.getTournamentRegistrations(tourney.id);
      res.json({ ...tourney, registrations: regs });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/tournaments", requireAuth, async (req, res, next) => {
    try {
      const parsed = createTournamentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
      const { name, buyIn, startingChips, maxPlayers, clubId, startAt, pokerVariant,
        registrationFee, lateRegistration, payoutStructureType, guaranteedPrize,
        adminFeePercent, timeBankSeconds } = parsed.data;
      const { blindPreset } = req.body;

      // Gate tournament hosting with rake: require Gold+ tier
      if ((adminFeePercent ?? 0) > 0) {
        const tourUser = await storage.getUser(req.user!.id);
        if (!tourUser || tierRank(tourUser.tier) < tierRank("gold")) {
          return res.status(403).json({ message: "Gold tier or higher required to host tournaments with admin fees" });
        }
      }

      const blindSchedule = blindPreset ? getBlindPreset(blindPreset) : getBlindPreset("mtt");

      // If club tournament, verify user is admin/owner
      if (clubId) {
        const club = await storage.getClub(clubId);
        if (!club) return res.status(404).json({ message: "Club not found" });
        const members = await storage.getClubMembers(clubId);
        const member = members.find((m: any) => m.userId === req.user!.id);
        if (!member || (member.role !== "owner" && member.role !== "admin")) {
          return res.status(403).json({ message: "Only club admins can create club tournaments" });
        }
      }

      const tourney = await storage.createTournament({
        name,
        buyIn,
        startingChips,
        blindSchedule,
        maxPlayers,
        pokerVariant,
        status: "registering",
        prizePool: 0,
        createdById: req.user!.id,
        clubId: clubId || null,
        startAt: startAt ? new Date(startAt) : null,
        registrationFee: registrationFee ?? 0,
        lateRegistration: lateRegistration ?? false,
        payoutStructureType: payoutStructureType ?? "top_15",
        guaranteedPrize: guaranteedPrize ?? 0,
        adminFeePercent: adminFeePercent ?? 0,
        timeBankSeconds: timeBankSeconds ?? 30,
      });

      // Auto-create club event for club tournaments
      if (clubId) {
        await storage.createClubEvent({
          clubId,
          eventType: "tournament",
          name: tourney.name,
          description: `Tournament: ${tourney.name} | Buy-in: ${tourney.buyIn} chips`,
          startTime: tourney.startAt,
          tableId: null,
        });
      }

      res.status(201).json(tourney);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/tournaments/:id/register", requireAuth, async (req, res, next) => {
    try {
      const tourney = await storage.getTournament(req.params.id);
      if (!tourney) return res.status(404).json({ message: "Tournament not found" });
      if (tourney.status !== "registering") {
        return res.status(400).json({ message: "Registration closed" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user || user.chipBalance < tourney.buyIn) {
        return res.status(400).json({ message: "Insufficient chips" });
      }

      // Deduct buy-in FIRST to prevent race condition (balance can't go negative with atomic op)
      await storage.ensureWallets(user.id);
      const { success: deducted, newBalance: balAfterBuyIn } = await storage.atomicDeductFromWallet(user.id, "tournament", tourney.buyIn);
      if (!deducted) {
        return res.status(400).json({ message: "Insufficient chips in tournament wallet" });
      }

      // Atomic registration: try to insert with unique constraint + count check
      const reg = await storage.registerForTournamentAtomic(
        tourney.id,
        req.user!.id,
        tourney.maxPlayers,
      );

      if (!reg) {
        // Registration failed — refund the buy-in
        await storage.atomicAddToWallet(user.id, "tournament", tourney.buyIn);
        const regs = await storage.getTournamentRegistrations(tourney.id);
        if (regs.some(r => r.userId === req.user!.id)) {
          return res.status(400).json({ message: "Already registered" });
        }
        return res.status(400).json({ message: "Tournament full" });
      }
      await storage.createTransaction({
        userId: user.id,
        type: "buyin",
        amount: -tourney.buyIn,
        balanceBefore: balAfterBuyIn + tourney.buyIn,
        balanceAfter: balAfterBuyIn,
        tableId: null,
        description: `Tournament buy-in: ${tourney.name}`,
        walletType: "tournament",
        relatedTransactionId: null,
        paymentId: null,
        metadata: null,
      });

      // Update prize pool
      await storage.updateTournament(tourney.id, {
        prizePool: tourney.prizePool + tourney.buyIn,
      });

      // Notify user of successful registration
      try {
        await storage.createNotification(
          req.user!.id,
          "tournament_starting",
          `Registered: ${tourney.name}`,
          `You are registered for ${tourney.name}. Buy-in: ${tourney.buyIn} chips.`,
          { tournamentId: tourney.id },
        );
      } catch (_) { /* non-critical */ }

      res.status(201).json(reg);
    } catch (err) {
      next(err);
    }
  });

  // Start an MTT tournament
  app.post("/api/tournaments/:id/start", requireAuth, async (req, res, next) => {
    try {
      const tourney = await storage.getTournament(req.params.id);
      if (!tourney) return res.status(404).json({ message: "Tournament not found" });

      if (tourney.status !== "registering") {
        return res.status(400).json({ message: "Tournament already started or completed" });
      }

      // Verify user is admin or tournament creator
      const userId = req.user!.id;
      let isAuthorized = tourney.createdById === userId;

      if (!isAuthorized && tourney.clubId) {
        const members = await storage.getClubMembers(tourney.clubId);
        const member = members.find((m: any) => m.userId === userId);
        if (member && (member.role === "owner" || member.role === "admin")) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        return res.status(403).json({ message: "Only the tournament creator or club admin can start this tournament" });
      }

      // Check minimum registrations
      const regs = await storage.getTournamentRegistrations(tourney.id);
      if (regs.length < 2) {
        return res.status(400).json({ message: "Need at least 2 registered players to start" });
      }

      // Already running?
      if (activeMTTs.has(tourney.id)) {
        return res.status(400).json({ message: "Tournament is already running" });
      }

      // Resolve display names for all registrations
      const registrations = await Promise.all(
        regs.map(async (r) => {
          const user = await storage.getUser(r.userId);
          return {
            userId: r.userId,
            username: user?.username ?? r.userId,
            displayName: user?.displayName ?? user?.username ?? r.userId,
          };
        }),
      );

      // Create and start the MTT
      const blindSchedule = (tourney.blindSchedule as any[]) || undefined;
      const mtt = new MTTManager(tourney.id, registrations, {
        maxPlayersPerTable: Math.min(9, tourney.maxPlayers),
        prizePool: tourney.prizePool,
        startingChips: tourney.startingChips,
        buyInAmount: tourney.buyIn,
        blindSchedule,
        clubId: tourney.clubId,
        pokerVariant: tourney.pokerVariant as "nlhe" | "plo" | "plo5" | "short_deck",
      });

      activeMTTs.set(tourney.id, mtt);
      await mtt.start();

      res.json({
        message: "Tournament started",
        tournamentId: tourney.id,
        tables: mtt.getTableInfo(),
        totalPlayers: registrations.length,
      });
    } catch (err) {
      next(err);
    }
  });

  // Get live MTT status
  app.get("/api/tournaments/:id/status", async (req, res, next) => {
    try {
      const tourney = await storage.getTournament(req.params.id);
      if (!tourney) return res.status(404).json({ message: "Tournament not found" });

      const mtt = activeMTTs.get(tourney.id);
      if (!mtt) {
        // Not running in memory — return DB status
        const regs = await storage.getTournamentRegistrations(tourney.id);
        return res.json({
          tournamentId: tourney.id,
          status: tourney.status,
          registrations: regs.length,
          maxPlayers: tourney.maxPlayers,
          prizePool: tourney.prizePool,
          tables: [],
          standings: [],
        });
      }

      res.json({
        tournamentId: tourney.id,
        status: mtt.status,
        totalPlayers: mtt.registrations.length,
        remainingPlayers: mtt.getTotalRemainingPlayers(),
        tables: mtt.getTableInfo(),
        standings: mtt.getStandings(),
        prizePool: mtt.prizePool,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Alliance & League Routes ──────────────────────────────────────────

  // List all alliances
  app.get("/api/alliances", async (_req, res, next) => {
    try {
      const alliances = await storage.getClubAlliances();
      res.json(alliances);
    } catch (err) {
      next(err);
    }
  });

  // Alliance detail — enriched with club data
  app.get("/api/alliances/:id", async (req, res, next) => {
    try {
      const alliance = await storage.getClubAlliance(req.params.id);
      if (!alliance) return res.status(404).json({ message: "Alliance not found" });
      const allClubs = await storage.getClubs();
      const clubMap = new Map(allClubs.map((c: any) => [c.id, c]));
      const clubs = (alliance.clubIds as string[]).map(id => {
        const club = clubMap.get(id);
        return club
          ? { id: club.id, name: club.name, ownerId: club.ownerId, memberCount: 0 }
          : { id, name: "Unknown Club", ownerId: null, memberCount: 0 };
      });
      // Enrich with member counts in parallel
      await Promise.all(clubs.map(async (c) => {
        if (c.ownerId) {
          const members = await storage.getClubMembers(c.id);
          c.memberCount = members.length;
        }
      }));
      res.json({ ...alliance, clubs });
    } catch (err) {
      next(err);
    }
  });

  // Create alliance — requires selecting a founding club
  app.post("/api/alliances", requireAuth, async (req, res, next) => {
    try {
      const parsed = createAllianceSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
      const { name, clubId } = parsed.data;

      const club = await storage.getClub(clubId);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(clubId);
      const member = members.find((m: any) => m.userId === req.user!.id);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ message: "You must be an owner or admin of the club" });
      }

      const existing = await storage.getClubAllianceByClubId(clubId);
      if (existing) return res.status(409).json({ message: "This club is already in an alliance" });

      const alliance = await storage.createClubAlliance({ name: name.trim(), clubIds: [clubId] });
      res.status(201).json(alliance);
    } catch (err) {
      next(err);
    }
  });

  // Update alliance name
  app.put("/api/alliances/:id", requireAuth, async (req, res, next) => {
    try {
      const alliance = await storage.getClubAlliance(req.params.id);
      if (!alliance) return res.status(404).json({ message: "Alliance not found" });

      const foundingClubId = (alliance.clubIds as string[])[0];
      const members = await storage.getClubMembers(foundingClubId);
      const member = members.find((m: any) => m.userId === req.user!.id);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ message: "Only founding club leaders can edit the alliance" });
      }

      const parsed = updateAllianceSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const updated = await storage.updateClubAlliance(req.params.id, {
        name: parsed.data.name,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Delete alliance
  app.delete("/api/alliances/:id", requireAuth, async (req, res, next) => {
    try {
      const alliance = await storage.getClubAlliance(req.params.id);
      if (!alliance) return res.status(404).json({ message: "Alliance not found" });

      const foundingClubId = (alliance.clubIds as string[])[0];
      const members = await storage.getClubMembers(foundingClubId);
      const member = members.find((m: any) => m.userId === req.user!.id);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ message: "Only founding club leaders can delete the alliance" });
      }

      await storage.deleteClubAlliance(req.params.id);
      res.json({ message: "Alliance deleted" });
    } catch (err) {
      next(err);
    }
  });

  // Join alliance with a club
  app.post("/api/alliances/:id/join", requireAuth, async (req, res, next) => {
    try {
      const alliance = await storage.getClubAlliance(req.params.id);
      if (!alliance) return res.status(404).json({ message: "Alliance not found" });

      const { clubId } = req.body;
      if (!clubId) return res.status(400).json({ message: "clubId is required" });

      const club = await storage.getClub(clubId);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(clubId);
      const member = members.find((m: any) => m.userId === req.user!.id);
      if (!member || (member.role !== "owner" && member.role !== "admin")) {
        return res.status(403).json({ message: "You must be an owner or admin of the club" });
      }

      const existingAlliance = await storage.getClubAllianceByClubId(clubId);
      if (existingAlliance) return res.status(409).json({ message: "This club is already in an alliance" });

      const clubIds = alliance.clubIds as string[];
      if (clubIds.includes(clubId)) return res.status(409).json({ message: "Club is already in this alliance" });

      const updatedClubIds = [...clubIds, clubId];
      const updated = await storage.updateClubAlliance(req.params.id, { clubIds: updatedClubIds });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Remove a club from alliance
  app.post("/api/alliances/:id/remove-club", requireAuth, async (req, res, next) => {
    try {
      const alliance = await storage.getClubAlliance(req.params.id);
      if (!alliance) return res.status(404).json({ message: "Alliance not found" });

      const { clubId } = req.body;
      if (!clubId) return res.status(400).json({ message: "clubId is required" });
      const clubIds = alliance.clubIds as string[];

      if (!clubIds.includes(clubId)) {
        return res.status(404).json({ message: "Club is not in this alliance" });
      }

      const foundingClubId = clubIds[0];
      if (clubId === foundingClubId) {
        return res.status(400).json({ message: "Cannot remove the founding club. Delete the alliance instead." });
      }

      const foundingMembers = await storage.getClubMembers(foundingClubId);
      const isFoundingLeader = foundingMembers.some((m: any) => m.userId === req.user!.id && (m.role === "owner" || m.role === "admin"));
      const targetMembers = await storage.getClubMembers(clubId);
      const isTargetLeader = targetMembers.some((m: any) => m.userId === req.user!.id && (m.role === "owner" || m.role === "admin"));

      if (!isFoundingLeader && !isTargetLeader) {
        return res.status(403).json({ message: "Not authorized to remove this club" });
      }

      const updatedClubIds = clubIds.filter((id: string) => id !== clubId);
      const updated = await storage.updateClubAlliance(req.params.id, { clubIds: updatedClubIds });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Get the alliance a club belongs to
  app.get("/api/clubs/:id/alliance", async (req, res, next) => {
    try {
      const alliance = await storage.getClubAllianceByClubId(req.params.id);
      if (!alliance) return res.json(null);
      res.json(alliance);
    } catch (err) {
      next(err);
    }
  });

  // List all league seasons
  app.get("/api/leagues", async (_req, res, next) => {
    try {
      const seasons = await storage.getLeagueSeasons();
      res.json(seasons);
    } catch (err) {
      next(err);
    }
  });

  // League season detail
  app.get("/api/leagues/:id", async (req, res, next) => {
    try {
      const season = await storage.getLeagueSeason(req.params.id);
      if (!season) return res.status(404).json({ message: "League season not found" });
      res.json(season);
    } catch (err) {
      next(err);
    }
  });

  // Create league season (admin only)
  app.post("/api/leagues", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const parsed = createLeagueSeasonSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid input" });
      const { name, startDate, endDate } = parsed.data;

      const season = await storage.createLeagueSeason({
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        standings: [],
      });
      res.status(201).json(season);
    } catch (err) {
      next(err);
    }
  });

  // Update league season (admin only)
  app.put("/api/leagues/:id", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const season = await storage.getLeagueSeason(req.params.id);
      if (!season) return res.status(404).json({ message: "League season not found" });

      const parsed = updateLeagueSeasonSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const updated = await storage.updateLeagueSeason(req.params.id, {
        ...(parsed.data.name && { name: parsed.data.name }),
        ...(parsed.data.startDate && { startDate: new Date(parsed.data.startDate) }),
        ...(parsed.data.endDate && { endDate: new Date(parsed.data.endDate) }),
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Delete league season (admin only)
  app.delete("/api/leagues/:id", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const season = await storage.getLeagueSeason(req.params.id);
      if (!season) return res.status(404).json({ message: "League season not found" });

      await storage.deleteLeagueSeason(req.params.id);
      res.json({ message: "League season deleted" });
    } catch (err) {
      next(err);
    }
  });

  // Manually update league standings (admin only)
  app.post("/api/leagues/:id/standings", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const season = await storage.getLeagueSeason(req.params.id);
      if (!season) return res.status(404).json({ message: "League season not found" });

      const parsed = leagueStandingsSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      await storage.updateLeagueStandings(req.params.id, parsed.data.standings);
      const updated = await storage.getLeagueSeason(req.params.id);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Complete a league season (admin only)
  app.post("/api/leagues/:id/complete", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const season = await storage.getLeagueSeason(req.params.id);
      if (!season) return res.status(404).json({ message: "League season not found" });

      const updated = await storage.updateLeagueSeason(req.params.id, { endDate: new Date() });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // ─── AI Bot Settings ──────────────────────────────────────────────────────
  app.get("/api/ai-settings", requireAuth, (_req, res) => {
    res.json({
      aiEnabled: hasAIEnabled(),
      hasKey: !!getAnthropicApiKey(),
      // Never return the actual key — just whether one is set
    });
  });

  app.post("/api/ai-settings", requireAuth, (req, res, next) => {
    try {
      if (req.user!.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      const { apiKey } = req.body;
      if (typeof apiKey === "string" && apiKey.startsWith("sk-")) {
        setAnthropicApiKey(apiKey);
        return res.json({ success: true, aiEnabled: true });
      } else if (apiKey === null || apiKey === "") {
        setAnthropicApiKey(null);
        return res.json({ success: true, aiEnabled: false });
      } else {
        return res.status(400).json({ error: "Invalid API key format — must start with 'sk-'" });
      }
    } catch (err) {
      next(err);
    }
  });

  // ─── Admin: Rake & Revenue Reports ─────────────────────────────────────

  const requireAdmin: RequestHandler = (req, res, next) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  };

  // Daily rake report by table
  app.get("/api/admin/rake-report", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
      const report = await storage.getRakeReport(days);
      res.json(report);
    } catch (err) {
      next(err);
    }
  });

  // Rake contributed by each player (for rakeback calculations)
  app.get("/api/admin/rake-by-player", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
      const report = await storage.getRakeByPlayer(days);
      res.json(report);
    } catch (err) {
      next(err);
    }
  });

  // Revenue summary: gross rake, total rakeback paid, net revenue
  app.get("/api/admin/revenue-summary", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const totals = await storage.getTransactionTotals();
      const totalsMap = new Map(totals.map(t => [t.type, t.total]));

      const grossRake = Math.abs(totalsMap.get("rake") || 0);
      const rakebackPaid = Math.abs(totalsMap.get("rakeback") || 0);
      const netRevenue = grossRake - rakebackPaid;
      const totalDeposits = totalsMap.get("deposit") || 0;
      const totalBonuses = totalsMap.get("bonus") || 0;
      const totalBuyins = Math.abs(totalsMap.get("buyin") || 0);
      const totalCashouts = totalsMap.get("cashout") || 0;
      const totalPrizes = totalsMap.get("prize") || 0;

      res.json({
        grossRake,
        rakebackPaid,
        netRevenue,
        totalDeposits,
        totalBonuses,
        totalBuyins,
        totalCashouts,
        totalPrizes,
      });
    } catch (err) {
      next(err);
    }
  });

  // Trial balance: the golden equation audit
  // Total Deposits + Bonuses - Total Withdrawals = Sum of Player Wallets + Total Rake
  app.get("/api/admin/trial-balance", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const totals = await storage.getTransactionTotals();
      const totalsMap = new Map(totals.map(t => [t.type, t.total]));
      const playerBalanceSum = await storage.getAllPlayerBalanceSum();

      // Money in: deposits, bonuses, prizes (created from thin air)
      const moneyIn = (totalsMap.get("deposit") || 0) + (totalsMap.get("bonus") || 0);
      // Money in escrow at tables (buyins - cashouts)
      const escrowedAtTables = Math.abs(totalsMap.get("buyin") || 0)
        - (totalsMap.get("cashout") || 0);
      // Withdrawals are money leaving the system, tracked separately
      const totalWithdrawals = Math.abs(totalsMap.get("withdraw") || 0);
      // Rake taken by the house
      const totalRake = Math.abs(totalsMap.get("rake") || 0);
      // Rakeback returned to players
      const totalRakeback = totalsMap.get("rakeback") || 0;
      // Prizes paid out
      const totalPrizes = totalsMap.get("prize") || 0;

      // Expected balance: all money IN, minus money OUT (rake, withdrawals)
      // Player wallets should equal: moneyIn - totalRake + totalRakeback - totalWithdrawals
      // Minus any chips currently sitting at tables (escrow)
      const expectedBalance = moneyIn - totalRake + totalRakeback - totalWithdrawals;
      const discrepancy = playerBalanceSum + escrowedAtTables - expectedBalance;

      const healthy = Math.abs(discrepancy) <= 1; // allow 1 chip rounding

      res.json({
        playerBalanceSum,
        escrowedAtTables,
        moneyIn,
        totalWithdrawals,
        totalRake,
        totalRakeback,
        totalPrizes,
        expectedBalance,
        discrepancy,
        healthy,
        breakdown: Object.fromEntries(totalsMap),
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Admin: Rakeback Processing ──────────────────────────────────────────

  // Process rakeback for all players (e.g., 20% weekly)
  app.post("/api/admin/process-rakeback", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { rakebackPercent = 20, days = 7 } = req.body;
      const percent = Math.min(Math.max(Number(rakebackPercent), 1), 100);
      const lookbackDays = Math.min(Math.max(Number(days), 1), 90);

      const rakeByPlayer = await storage.getRakeByPlayer(lookbackDays);
      const payouts: { userId: string; amount: number }[] = [];

      for (const entry of rakeByPlayer) {
        const rakebackAmount = Math.floor(entry.totalRake * percent / 100);
        if (rakebackAmount <= 0) continue;

        const user = await storage.getUser(entry.userId);
        if (!user) continue;

        await storage.updateUser(entry.userId, { chipBalance: user.chipBalance + rakebackAmount });
        await storage.createTransaction({
          userId: entry.userId,
          type: "rakeback",
          amount: rakebackAmount,
          balanceBefore: user.chipBalance,
          balanceAfter: user.chipBalance + rakebackAmount,
          tableId: null,
          description: `Rakeback payout (${percent}% of ${entry.totalRake} rake over ${lookbackDays} days)`,
          walletType: "bonus",
          relatedTransactionId: null,
          paymentId: null,
          metadata: null,
        });

        payouts.push({ userId: entry.userId, amount: rakebackAmount });
      }

      res.json({
        processed: payouts.length,
        totalPaid: payouts.reduce((sum, p) => sum + p.amount, 0),
        payouts,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Admin: Kill Switch ───────────────────────────────────────────────────

  // Global lock status
  app.get("/api/admin/system-status", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      res.json({ locked: globalSystemLocked, reason: globalLockReason });
    } catch (err) {
      next(err);
    }
  });

  // Toggle global lock
  app.post("/api/admin/system-lock", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { locked, reason } = req.body;
      globalSystemLocked = !!locked;
      globalLockReason = reason || (locked ? "Manual admin lock" : "");
      console.warn(`[ADMIN] System lock ${locked ? "ENGAGED" : "RELEASED"}: ${globalLockReason}`);
      res.json({ locked: globalSystemLocked, reason: globalLockReason });
    } catch (err) {
      next(err);
    }
  });

  // ─── Admin: Payments & Withdrawals ──────────────────────────────────────
  app.get("/api/admin/payments", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      // Return all payments (admin view)
      const allPayments = await storage.getAllPayments(200, 0);
      res.json(allPayments);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/admin/withdrawals", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const status = req.query.status as string | undefined;
      const requests = await storage.getWithdrawalRequests(status || "pending");
      res.json(requests);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/admin/withdrawals/:id/approve", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { getPaymentService } = await import("./payments/payment-service");
      const svc = getPaymentService();
      await svc.approveWithdrawal(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/admin/withdrawals/:id/reject", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { getPaymentService } = await import("./payments/payment-service");
      const svc = getPaymentService();
      const note = typeof req.body.note === "string" ? req.body.note.slice(0, 500) : "";
      await svc.rejectWithdrawal(req.params.id, req.user!.id, note);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ─── Admin Stats ──────────────────────────────────────────────────────────

  app.get("/api/admin/stats", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      const allTables = await storage.getTables();
      const activeTables = allTables.filter(t => t.status !== "closed");

      // Use getTransactionTotals for deposit/withdrawal sums
      const totals = await storage.getTransactionTotals();
      const depositTotal = totals.find(t => t.type === "deposit")?.total ?? 0;
      const withdrawalTotal = totals.find(t => t.type === "withdrawal")?.total ?? 0;

      // Count users
      let totalUsers = 0;
      if ((storage as any).db) {
        const result = await (storage as any).db.select({ count: sql`count(*)` }).from(users);
        totalUsers = Number(result[0]?.count ?? 0);
      } else {
        totalUsers = (storage as any).users?.size ?? 0;
      }

      res.json({
        totalUsers,
        activeTables: activeTables.length,
        totalDeposits: depositTotal,
        totalWithdrawals: Math.abs(withdrawalTotal),
        totalTables: allTables.length,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Admin Collusion Alerts ─────────────────────────────────────────────

  app.get("/api/admin/collusion-alerts", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const status = req.query.status as string | undefined;
      const alerts = await storage.getCollusionAlerts(status);
      res.json(alerts);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/admin/collusion-alerts/:id/review", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!status || !["reviewed", "dismissed"].includes(status)) {
        return res.status(400).json({ message: "Status must be 'reviewed' or 'dismissed'" });
      }
      const alert = await storage.reviewCollusionAlert(req.params.id, req.user!.id, status);
      if (!alert) return res.status(404).json({ message: "Alert not found" });
      res.json(alert);
    } catch (err) {
      next(err);
    }
  });

  // ─── Player Notes ──────────────────────────────────────────────────────

  app.get("/api/player-notes", requireAuth, async (req, res, next) => {
    try {
      const notes = await storage.getPlayerNotes(req.user!.id);
      res.json(notes);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/player-notes/:targetId", requireAuth, async (req, res, next) => {
    try {
      const note = await storage.getPlayerNote(req.user!.id, req.params.targetId);
      res.json(note ?? null);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/player-notes/:targetId", requireAuth, async (req, res, next) => {
    try {
      const { note, color } = req.body;
      if (!note || typeof note !== "string") {
        return res.status(400).json({ message: "Note text is required" });
      }
      const result = await storage.upsertPlayerNote(
        req.user!.id,
        req.params.targetId,
        note.slice(0, 500),
        color || "gray",
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/player-notes/:targetId", requireAuth, async (req, res, next) => {
    try {
      await storage.deletePlayerNote(req.user!.id, req.params.targetId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ─── Speech Translation ────────────────────────────────────────────────
  app.post("/api/translate", requireAuth, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "Text is required" });
      }
      if (text.length > 500) {
        return res.status(400).json({ message: "Text too long" });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.json({ translated: text, original: text, detected: "unknown" });
      }

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a translator. Translate the following text to English. Return ONLY the translated text, nothing else. If the text is already in English, return it unchanged." },
          { role: "user", content: text },
        ],
        max_tokens: 200,
        temperature: 0.1,
      });

      const translated = completion.choices[0]?.message?.content?.trim() || text;
      res.json({ translated, original: text, detected: "auto" });
    } catch (err) {
      console.error("[translate] Error:", err);
      res.json({ translated: req.body?.text || "", original: req.body?.text || "", detected: "error" });
    }
  });

  // ─── Premium Subscription ─────────────────────────────────────────────────
  const PREMIUM_COST_CHIPS = 5000;
  const PREMIUM_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  app.get("/api/subscribe/status", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const now = Date.now();
      const isPremium = !!user.premiumUntil && new Date(user.premiumUntil).getTime() > now;
      res.json({
        isPremium,
        expiresAt: isPremium ? user.premiumUntil : null,
      });
    } catch (err) { next(err); }
  });

  app.post("/api/subscribe/premium", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Deduct from main wallet
      await storage.ensureWallets(user.id);
      const wallets = await storage.getUserWallets(user.id);
      const mainWallet = wallets.find(w => w.walletType === "main");
      if (!mainWallet || mainWallet.balance < PREMIUM_COST_CHIPS) {
        return res.status(400).json({
          message: `Insufficient chips. You need ${PREMIUM_COST_CHIPS.toLocaleString()} chips in your main wallet.`,
          required: PREMIUM_COST_CHIPS,
          available: mainWallet?.balance ?? 0,
        });
      }

      // Deduct chips
      const result = await storage.atomicAddToWallet(user.id, "main", -PREMIUM_COST_CHIPS);
      if (!result.success) {
        return res.status(400).json({ message: "Failed to deduct chips. Try again." });
      }

      // Set or extend premium
      const now = Date.now();
      const currentExpiry = user.premiumUntil ? new Date(user.premiumUntil).getTime() : 0;
      const baseTime = currentExpiry > now ? currentExpiry : now;
      const newExpiry = new Date(baseTime + PREMIUM_DURATION_MS);

      await storage.updateUser(user.id, { premiumUntil: newExpiry });

      res.json({
        message: "Premium activated!",
        isPremium: true,
        expiresAt: newExpiry,
        chipsDeducted: PREMIUM_COST_CHIPS,
        newBalance: result.newBalance,
      });
    } catch (err) { next(err); }
  });

  // ─── Admin Announcements (in-memory) ─────────────────────────────────────
  const adminAnnouncements: { id: string; title: string; message: string; createdAt: string; createdBy: string }[] = [];

  app.get("/api/admin/announcements", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      res.json(adminAnnouncements);
    } catch (err) { next(err); }
  });

  app.post("/api/admin/announcements", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { title, message } = req.body;
      if (!title || !message) {
        return res.status(400).json({ message: "title and message are required" });
      }
      const announcement = {
        id: require("crypto").randomUUID(),
        title: String(title).slice(0, 200),
        message: String(message).slice(0, 2000),
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      };
      adminAnnouncements.unshift(announcement);
      // Keep at most 100 announcements in memory
      if (adminAnnouncements.length > 100) adminAnnouncements.length = 100;
      res.status(201).json(announcement);
    } catch (err) { next(err); }
  });

  // ─── Global Stats ───────────────────────────────────────────────────────────
  app.get("/api/stats/global", async (_req, res, next) => {
    try {
      // Count total players from users table
      const allUsers = await storage.getLeaderboard("chips", 999999);
      const totalPlayers = allUsers.length;

      // Count total hands from gameHands table
      let totalHandsDealt = 0;
      let totalChipsWon = 0;
      try {
        if (hasDatabase()) {
          const db = getDb();
          const handsResult = await db.select({ count: sql<number>`count(*)` }).from(gameHands);
          totalHandsDealt = Number(handsResult[0]?.count ?? 0);
          const chipsResult = await db.select({ total: sql<number>`coalesce(sum(${gameHands.potTotal}), 0)` }).from(gameHands);
          totalChipsWon = Number(chipsResult[0]?.total ?? 0);
        } else {
          // In-memory: approximate from tables
          const tables = await storage.getTables();
          for (const t of tables) {
            const hands = await storage.getGameHands(t.id, 999999);
            totalHandsDealt += hands.length;
            totalChipsWon += hands.reduce((sum, h) => sum + (h.potTotal || 0), 0);
          }
        }
      } catch {
        // If counting fails, return 0s gracefully
      }

      res.json({ totalPlayers, totalHandsDealt, totalChipsWon });
    } catch (err) { next(err); }
  });

  // ─── PATCH /api/profile (alias for PUT /api/profile/avatar) ──────────────
  app.patch("/api/profile", requireAuth, async (req, res, next) => {
    try {
      const { avatarId, displayName, tauntVoice } = req.body;
      const updates: Record<string, any> = {};
      if (avatarId && typeof avatarId === "string") updates.avatarId = avatarId;
      if (displayName && typeof displayName === "string") updates.displayName = displayName.trim().slice(0, 50);
      if (tauntVoice && typeof tauntVoice === "string") updates.tauntVoice = tauntVoice.slice(0, 30);
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "avatarId, displayName, or tauntVoice required" });
      }
      await storage.updateUser(req.user!.id, updates);
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      next(err);
    }
  });

  // ─── POST /api/profile/wallet ─────────────────────────────────────────────
  app.post("/api/profile/wallet", requireAuth, async (req, res, next) => {
    try {
      const { walletAddress } = req.body;
      // Allow null/empty to unlink
      const address = walletAddress && typeof walletAddress === "string" ? walletAddress.trim() : null;
      await storage.updateUser(req.user!.id, { walletAddress: address });
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (err) {
      next(err);
    }
  });

  // ─── Analytics Endpoints ──────────────────────────────────────────────────

  // Club Activity: recent events, member joins, table creations for user's clubs
  app.get("/api/analytics/club-activity", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const userClubs = await storage.getUserClubs(userId);
      const clubIds = userClubs.map(c => c.id);

      const activity: { type: string; description: string; timestamp: string; clubId: string }[] = [];

      for (const clubId of clubIds) {
        const club = await storage.getClub(clubId);
        const clubName = club?.name ?? "Unknown Club";

        // Club events (tournaments, cash games, etc.)
        const events = await storage.getClubEvents(clubId);
        for (const ev of events) {
          activity.push({
            type: ev.eventType ?? "event",
            description: `${ev.name} scheduled in ${clubName}`,
            timestamp: ev.createdAt ? new Date(ev.createdAt).toISOString() : new Date().toISOString(),
            clubId,
          });
        }

        // Member joins
        const members = await storage.getClubMembers(clubId);
        for (const m of members) {
          const username = m.user?.displayName ?? m.user?.username ?? "A player";
          activity.push({
            type: "member_join",
            description: `${username} joined ${clubName}`,
            timestamp: m.joinedAt ? new Date(m.joinedAt).toISOString() : new Date().toISOString(),
            clubId,
          });
        }

        // Club announcements
        const announcements = await storage.getClubAnnouncements(clubId);
        for (const a of announcements) {
          activity.push({
            type: "announcement",
            description: `Announcement in ${clubName}: ${a.title ?? a.content?.slice(0, 60) ?? "New announcement"}`,
            timestamp: a.createdAt ? new Date(a.createdAt).toISOString() : new Date().toISOString(),
            clubId,
          });
        }
      }

      // Sort by timestamp descending and take top 20
      activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      res.json(activity.slice(0, 20));
    } catch (err) {
      next(err);
    }
  });

  // Table Volume: tables created per day for the last 30 days
  app.get("/api/analytics/table-volume", requireAuth, async (_req, res, next) => {
    try {
      const allTables = await storage.getTables();
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Build a map of date -> count
      const countMap: Record<string, number> = {};

      // Pre-fill all 30 days with 0
      for (let d = 0; d < 30; d++) {
        const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
        const key = date.toISOString().slice(0, 10);
        countMap[key] = 0;
      }

      for (const table of allTables) {
        if (!table.createdAt) continue;
        const created = new Date(table.createdAt);
        if (created < thirtyDaysAgo) continue;
        const key = created.toISOString().slice(0, 10);
        if (key in countMap) {
          countMap[key]++;
        }
      }

      // Convert to sorted array (oldest first)
      const result = Object.entries(countMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Retention: active players vs total
  app.get("/api/analytics/retention", requireAuth, async (_req, res, next) => {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get all users for total count
      const allUsers = await storage.getLeaderboard("chips", 999999);
      const total = allUsers.length;

      // Get all game hands to determine who played recently
      const allTables = await storage.getTables();
      const active7dSet = new Set<string>();
      const active30dSet = new Set<string>();

      for (const table of allTables) {
        const hands = await storage.getGameHands(table.id, 500);
        for (const hand of hands) {
          if (!hand.createdAt) continue;
          const handDate = new Date(hand.createdAt);
          const winnerIds = (hand.winnerIds as string[] | null) ?? [];
          if (handDate >= sevenDaysAgo) {
            for (const id of winnerIds) active7dSet.add(id);
          }
          if (handDate >= thirtyDaysAgo) {
            for (const id of winnerIds) active30dSet.add(id);
          }
        }
      }

      // Count users created in the last week
      let newThisWeek = 0;
      if (hasDatabase()) {
        const db = getDb();
        const result = await db.select({ count: sql<number>`count(*)` })
          .from(users)
          .where(sql`${users.createdAt} >= ${sevenDaysAgo}`);
        newThisWeek = Number(result[0]?.count ?? 0);
      }

      res.json({
        active7d: active7dSet.size,
        active30d: active30dSet.size,
        total,
        newThisWeek,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─── Social Link Settings ──────────────────────────────────────────────
  app.get("/api/settings/social", (_req, res) => {
    res.json(socialLinks);
  });

  app.put("/api/settings/social", requireAuth, async (req, res) => {
    if (req.user!.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    const { twitter, discord, telegram } = req.body;
    if (typeof twitter === "string") socialLinks.twitter = twitter;
    if (typeof discord === "string") socialLinks.discord = discord;
    if (typeof telegram === "string") socialLinks.telegram = telegram;
    res.json(socialLinks);
  });

  // ─── Support Contact ────────────────────────────────────────────────────
  const supportMessages: Array<{ id: string; name: string; email: string; subject: string; message: string; createdAt: string }> = [];

  app.post("/api/support/contact", (req, res) => {
    const { name, email, subject, message } = req.body || {};
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: "All fields are required: name, email, subject, message" });
    }
    if (typeof name !== "string" || typeof email !== "string" || typeof subject !== "string" || typeof message !== "string") {
      return res.status(400).json({ message: "All fields must be strings" });
    }
    if (name.length > 100 || email.length > 200 || subject.length > 200 || message.length > 5000) {
      return res.status(400).json({ message: "One or more fields exceed maximum length" });
    }
    const entry = {
      id: require("crypto").randomUUID(),
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
      createdAt: new Date().toISOString(),
    };
    supportMessages.push(entry);
    res.json({ success: true, id: entry.id });
  });

  // ─── Club Wars ──────────────────────────────────────────────────────────
  app.get("/api/club-wars", requireAuth, async (req, res, next) => {
    try {
      const { clubId, status } = req.query;
      const wars = await storage.getClubWars(
        clubId as string | undefined,
        status as string | undefined
      );
      res.json(wars);
    } catch (err) { next(err); }
  });

  app.post("/api/club-wars/matchmake", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      if (user.role !== "admin") return res.status(403).json({ message: "Admin only" });

      const allClubs = await storage.getClubs();
      if (allClubs.length < 2) return res.status(400).json({ message: "Need at least 2 clubs" });

      // Sort by ELO and pair adjacent clubs
      const sorted = [...allClubs].sort((a, b) => (a.eloRating ?? 1200) - (b.eloRating ?? 1200));
      const pairs: any[] = [];
      for (let i = 0; i + 1 < sorted.length; i += 2) {
        const c1 = sorted[i], c2 = sorted[i + 1];
        const war = await storage.createClubWar({
          club1Id: c1.id,
          club2Id: c2.id,
          club1Name: c1.name,
          club2Name: c2.name,
          status: "pending",
          winnerId: null,
          club1Score: 0,
          club2Score: 0,
          club1Elo: c1.eloRating ?? 1200,
          club2Elo: c2.eloRating ?? 1200,
          eloChange: null,
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          completedAt: null,
        });
        pairs.push(war);
      }
      res.json(pairs);
    } catch (err) { next(err); }
  });

  app.post("/api/club-wars/:id/complete", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      if (user.role !== "admin") return res.status(403).json({ message: "Admin only" });

      const war = await storage.getClubWars();
      const found = war.find(w => w.id === req.params.id);
      if (!found) return res.status(404).json({ message: "War not found" });
      if (found.status === "completed") return res.status(400).json({ message: "Already completed" });

      const { club1Score, club2Score } = req.body;
      if (typeof club1Score !== "number" || typeof club2Score !== "number") {
        return res.status(400).json({ message: "Scores required" });
      }

      const winnerId = club1Score > club2Score ? found.club1Id : club1Score < club2Score ? found.club2Id : null;
      const K = 32;
      const elo1 = found.club1Elo ?? 1200;
      const elo2 = found.club2Elo ?? 1200;
      const expected1 = 1 / (1 + Math.pow(10, (elo2 - elo1) / 400));
      const actual1 = club1Score > club2Score ? 1 : club1Score < club2Score ? 0 : 0.5;
      const eloChange = Math.round(K * (actual1 - expected1));

      const updated = await storage.updateClubWar(req.params.id, {
        club1Score,
        club2Score,
        winnerId,
        eloChange,
        status: "completed",
        completedAt: new Date(),
      });

      // Update club ELO ratings
      await storage.updateClub(found.club1Id, { eloRating: elo1 + eloChange });
      await storage.updateClub(found.club2Id, { eloRating: elo2 - eloChange });

      // Notify members of both clubs about war completion
      try {
        const [club1, club2] = await Promise.all([
          storage.getClub(found.club1Id),
          storage.getClub(found.club2Id),
        ]);
        const club1Name = club1?.name ?? "Club 1";
        const club2Name = club2?.name ?? "Club 2";
        const resultText = winnerId === found.club1Id
          ? `${club1Name} won!`
          : winnerId === found.club2Id
          ? `${club2Name} won!`
          : "It's a draw!";
        const notifyClub = async (clubId: string) => {
          const members = await storage.getClubMembers(clubId);
          for (const m of members) {
            await storage.createNotification(
              m.userId,
              "club_announcement",
              `Club War Complete: ${club1Name} vs ${club2Name}`,
              `${resultText} Score: ${club1Score}-${club2Score}. ELO change: ${eloChange > 0 ? "+" : ""}${eloChange}.`,
              { warId: req.params.id, club1Id: found.club1Id, club2Id: found.club2Id },
            );
          }
        };
        await Promise.all([notifyClub(found.club1Id), notifyClub(found.club2Id)]);
      } catch (_) { /* non-critical */ }

      res.json(updated);
    } catch (err) { next(err); }
  });

  // ─── Avatar Marketplace ────────────────────────────────────────────────
  app.get("/api/marketplace", requireAuth, async (req, res, next) => {
    try {
      const listings = await storage.getListings("active");
      res.json(listings);
    } catch (err) { next(err); }
  });

  app.post("/api/marketplace/list", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const { itemId, price } = req.body;
      if (!itemId || !price || price < 1) return res.status(400).json({ message: "itemId and price required" });

      // Verify ownership
      const inventory = await storage.getUserInventory(user.id);
      const owns = inventory.find(i => i.itemId === itemId);
      if (!owns) return res.status(400).json({ message: "You don't own this item" });

      const listing = await storage.createListing({
        sellerId: user.id,
        itemId,
        price,
        status: "active",
        buyerId: null,
        platformFee: Math.floor(price * 0.1),
        soldAt: null,
      });
      res.json(listing);
    } catch (err) { next(err); }
  });

  app.post("/api/marketplace/:id/buy", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const listings = await storage.getListings("active");
      const listing = listings.find(l => l.id === req.params.id);
      if (!listing) return res.status(404).json({ message: "Listing not found" });
      if (listing.sellerId === user.id) return res.status(400).json({ message: "Cannot buy your own listing" });

      const fee = Math.floor(listing.price * 0.1);
      const sellerPayout = listing.price - fee;

      // Deduct from buyer
      const deduct = await storage.atomicDeductChips(user.id, listing.price);
      if (!deduct.success) return res.status(400).json({ message: "Insufficient chips" });

      // Pay seller
      await storage.atomicAddChips(listing.sellerId, sellerPayout);

      // Transfer item — remove from seller, give to buyer
      await storage.removeFromInventory(listing.sellerId, listing.itemId);
      await storage.addToInventory(user.id, listing.itemId);

      // Mark sold
      const updated = await storage.buyListing(req.params.id, user.id);
      res.json({ listing: updated, fee, sellerPayout });
    } catch (err) { next(err); }
  });

  app.post("/api/marketplace/:id/cancel", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const listings = await storage.getListings();
      const listing = listings.find(l => l.id === req.params.id);
      if (!listing) return res.status(404).json({ message: "Listing not found" });
      if (listing.sellerId !== user.id) return res.status(403).json({ message: "Not your listing" });

      const updated = await storage.cancelListing(req.params.id);
      res.json(updated);
    } catch (err) { next(err); }
  });

  // ─── Staking System ────────────────────────────────────────────────────
  app.get("/api/stakes/my", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const myStakes = await storage.getStakesForPlayer(user.id);
      // Enrich with display names and tournament info
      const enriched = await Promise.all(myStakes.map(async (s) => {
        const [backer, player, tournament] = await Promise.all([
          storage.getUser(s.backerId),
          storage.getUser(s.playerId),
          storage.getTournament(s.tournamentId),
        ]);
        return {
          ...s,
          backerName: backer?.displayName ?? backer?.username ?? s.backerId.slice(0, 8),
          playerName: player?.displayName ?? player?.username ?? s.playerId.slice(0, 8),
          tournamentName: tournament?.name ?? s.tournamentId.slice(0, 8),
          tournamentStatus: tournament?.status ?? "unknown",
        };
      }));
      res.json(enriched);
    } catch (err) { next(err); }
  });

  app.post("/api/stakes/offer", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const { playerId, tournamentId, stakePercent, buyInShare } = req.body;
      if (!playerId || !tournamentId || !stakePercent || !buyInShare) {
        return res.status(400).json({ message: "playerId, tournamentId, stakePercent, buyInShare required" });
      }

      // Deduct buy-in share from backer
      const deduct = await storage.atomicDeductChips(user.id, buyInShare);
      if (!deduct.success) return res.status(400).json({ message: "Insufficient chips" });

      const stake = await storage.createStake({
        backerId: user.id,
        playerId,
        tournamentId,
        stakePercent,
        buyInShare,
        status: "pending",
        payout: null,
      });
      res.json(stake);
    } catch (err) { next(err); }
  });

  app.post("/api/stakes/:id/accept", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const stake = await storage.getStake(req.params.id);
      if (!stake) return res.status(404).json({ message: "Stake not found" });
      if (stake.playerId !== user.id) return res.status(403).json({ message: "Not your stake to accept" });
      if (stake.status !== "pending") return res.status(400).json({ message: "Stake not pending" });

      const updated = await storage.updateStake(req.params.id, { status: "accepted" });
      res.json(updated);
    } catch (err) { next(err); }
  });

  app.post("/api/stakes/:id/settle", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const stake = await storage.getStake(req.params.id);
      if (!stake) return res.status(404).json({ message: "Stake not found" });
      if (stake.backerId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (stake.status !== "accepted" && stake.status !== "active") {
        return res.status(400).json({ message: "Stake not in settleable state" });
      }

      const { payout } = req.body;
      if (typeof payout !== "number" || payout < 0) return res.status(400).json({ message: "payout required" });

      // Calculate backer's share
      const backerShare = Math.floor(payout * (stake.stakePercent / 100));
      if (backerShare > 0) {
        await storage.atomicAddChips(stake.backerId, backerShare);
      }
      // Player gets the rest
      const playerShare = payout - backerShare;
      if (playerShare > 0) {
        await storage.atomicAddChips(stake.playerId, playerShare);
      }

      const updated = await storage.updateStake(req.params.id, { status: "settled", payout });

      // Notify both backer and player about settlement
      try {
        const backerUser = await storage.getUser(stake.backerId);
        const playerUser = await storage.getUser(stake.playerId);
        const backerName = backerUser?.displayName ?? "Backer";
        const playerName = playerUser?.displayName ?? "Player";
        if (backerShare > 0) {
          await storage.createNotification(
            stake.backerId,
            "leaderboard_change",
            "Stake Settled",
            `Your stake on ${playerName} paid out ${backerShare.toLocaleString()} chips (${stake.stakePercent}% of ${payout.toLocaleString()}).`,
            { stakeId: req.params.id },
          );
        }
        if (playerShare > 0) {
          await storage.createNotification(
            stake.playerId,
            "leaderboard_change",
            "Stake Settled",
            `Stake from ${backerName} settled. You received ${playerShare.toLocaleString()} chips.`,
            { stakeId: req.params.id },
          );
        }
      } catch (_) { /* non-critical */ }

      res.json(updated);
    } catch (err) { next(err); }
  });

  app.post("/api/stakes/:id/cancel", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as any;
      const stake = await storage.getStake(req.params.id);
      if (!stake) return res.status(404).json({ message: "Stake not found" });
      if (stake.backerId !== user.id && stake.playerId !== user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (stake.status !== "pending" && stake.status !== "accepted") {
        return res.status(400).json({ message: "Cannot cancel at this stage" });
      }

      // Refund backer
      await storage.atomicAddChips(stake.backerId, stake.buyInShare);

      const updated = await storage.updateStake(req.params.id, { status: "cancelled" });
      res.json(updated);
    } catch (err) { next(err); }
  });

  // ─── Coaching - Live Analysis ────────────────────────────────────────────
  app.post("/api/coaching/live-analysis", requireAuth, async (req, res, next) => {
    try {
      const { holeCards, communityCards, pot, currentBet, position, phase } = req.body;
      if (!holeCards || !Array.isArray(holeCards) || holeCards.length < 2) {
        return res.status(400).json({ message: "holeCards required (array of 2+)" });
      }

      // Deduct 50 chips
      const user = await storage.getUser(req.user!.id);
      if (!user || user.chipBalance < 50) {
        return res.status(400).json({ message: "Insufficient chips (50 required)" });
      }
      await storage.atomicDeductChips(req.user!.id, 50);

      // Algorithmic poker math — no AI needed
      const ranks = "23456789TJQKA";
      const cardRank = (c: string) => ranks.indexOf(c[0]);
      const r1 = cardRank(holeCards[0]);
      const r2 = cardRank(holeCards[1]);
      const suited = holeCards[0]?.[1] === holeCards[1]?.[1];
      const paired = r1 === r2;

      // Hand strength 1-10
      let strength = Math.max(r1, r2) * 0.5 + Math.min(r1, r2) * 0.3;
      if (paired) strength += 3;
      if (suited) strength += 1.5;
      if (r1 >= 10 && r2 >= 10) strength += 2;
      strength = Math.min(10, Math.max(1, Math.round(strength)));

      // Position modifier
      const positionBonus: Record<string, number> = {
        "BTN": 1.5, "CO": 1.2, "MP": 0, "EP": -1, "SB": -0.5, "BB": 0.5,
      };
      const posMod = positionBonus[position] || 0;

      // Pot odds calculation
      const potSize = pot || 100;
      const betToCall = currentBet || 0;
      const potOdds = betToCall > 0 ? betToCall / (potSize + betToCall) : 0;

      const communityLen = Array.isArray(communityCards) ? communityCards.length : 0;
      const streetBonus = communityLen >= 3 ? 0.5 : 0;

      const winProb = Math.min(0.95, Math.max(0.05, (strength + posMod + streetBonus) / 12));
      const ev = Math.round((winProb * potSize - (1 - winProb) * betToCall) * 100) / 100;

      let action: string;
      let confidence: number;
      if (strength + posMod >= 7) {
        action = "RAISE";
        confidence = Math.min(95, 60 + strength * 3);
      } else if (ev > 0 || potOdds < winProb) {
        action = "CALL";
        confidence = Math.min(85, 50 + strength * 2);
      } else {
        action = "FOLD";
        confidence = Math.min(90, 55 + (10 - strength) * 3);
      }

      const explanations: Record<string, string> = {
        RAISE: `Strong hand (${strength}/10) in ${position || "position"} with positive EV.`,
        CALL: `Decent odds — pot odds ${(potOdds * 100).toFixed(0)}% vs ${(winProb * 100).toFixed(0)}% equity.`,
        FOLD: `Weak holding (${strength}/10) — negative EV in this spot.`,
      };

      res.json({ action, ev, confidence: Math.round(confidence), explanation: explanations[action] });
    } catch (err) { next(err); }
  });

  // ─── API Keys ─────────────────────────────────────────────────────────────
  app.post("/api/api-keys", requireAuth, async (req, res, next) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== "string" || name.length > 50) {
        return res.status(400).json({ message: "Name required (max 50 chars)" });
      }
      const crypto = require("crypto");
      const rawKey = "sk_" + crypto.randomBytes(32).toString("hex");
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
      const apiKey = await storage.createApiKey(req.user!.id, keyHash, name.trim());
      res.status(201).json({ id: apiKey.id, name: apiKey.name, key: rawKey, createdAt: apiKey.createdAt });
    } catch (err) { next(err); }
  });

  app.get("/api/api-keys", requireAuth, async (req, res, next) => {
    try {
      const keys = await storage.getApiKeysByUser(req.user!.id);
      res.json(keys.map(k => ({ id: k.id, name: k.name, lastUsed: k.lastUsed, createdAt: k.createdAt })));
    } catch (err) { next(err); }
  });

  app.delete("/api/api-keys/:id", requireAuth, async (req, res, next) => {
    try {
      const keys = await storage.getApiKeysByUser(req.user!.id);
      if (!keys.find(k => k.id === req.params.id)) return res.status(404).json({ message: "API key not found" });
      await storage.deleteApiKey(req.params.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  // ─── Public Stats API (API key required) ─────────────────────────────────
  const apiKeyRateLimits = new Map<string, { count: number; resetAt: number }>();

  app.get("/api/v1/stats/:userId", async (req, res, next) => {
    try {
      const apiKeyHeader = req.headers["x-api-key"] as string;
      if (!apiKeyHeader) return res.status(401).json({ message: "X-API-Key header required" });

      const crypto = require("crypto");
      const keyHash = crypto.createHash("sha256").update(apiKeyHeader).digest("hex");
      const apiKey = await storage.getApiKeyByHash(keyHash);
      if (!apiKey) return res.status(401).json({ message: "Invalid API key" });

      const now = Date.now();
      let rl = apiKeyRateLimits.get(apiKey.id);
      if (!rl || rl.resetAt < now) {
        rl = { count: 0, resetAt: now + 60_000 };
        apiKeyRateLimits.set(apiKey.id, rl);
      }
      rl.count++;
      if (rl.count > 100) return res.status(429).json({ message: "Rate limit exceeded (100/min)" });

      storage.updateApiKeyLastUsed(apiKey.id).catch(() => {});

      const stats = await storage.getPlayerStats(req.params.userId);
      if (!stats) return res.status(404).json({ message: "Player not found" });

      const handsPlayed = stats.handsPlayed || 1;
      res.json({
        userId: req.params.userId,
        handsPlayed: stats.handsPlayed,
        potsWon: stats.potsWon,
        vpip: Math.round((stats.vpip / handsPlayed) * 100 * 10) / 10,
        pfr: Math.round((stats.pfr / handsPlayed) * 100 * 10) / 10,
        winRate: Math.round((stats.potsWon / handsPlayed) * 100 * 10) / 10,
        totalWinnings: stats.totalWinnings,
        bestWinStreak: stats.bestWinStreak,
        sngWins: stats.sngWins,
        headsUpWins: stats.headsUpWins,
      });
    } catch (err) { next(err); }
  });

  // ─── Daily Missions ──────────────────────────────────────────────────────
  const MISSION_TEMPLATES = {
    daily: [
      { type: "hands_played", label: "Grinder", description: "Play {target} hands", target: 20, reward: 500 },
      { type: "pots_won", label: "Winner Winner", description: "Win {target} pots", target: 5, reward: 750 },
      { type: "bluff_wins", label: "Bluff Master", description: "Win {target} hands on a fold", target: 3, reward: 1000 },
      { type: "preflop_folds", label: "Patient Player", description: "Fold preflop {target} times", target: 10, reward: 300 },
      { type: "big_pot_wins", label: "Big Fish", description: "Win a pot over 10K chips", target: 1, reward: 1500 },
      { type: "vpip", label: "Action Player", description: "Voluntarily enter {target} pots", target: 15, reward: 400 },
    ],
    weekly: [
      { type: "hands_played", label: "Marathon", description: "Play {target} hands this week", target: 100, reward: 3000 },
      { type: "pots_won", label: "Shark Week", description: "Win {target} pots this week", target: 30, reward: 5000 },
      { type: "plo_hands", label: "Omaha Explorer", description: "Play {target} PLO hands", target: 20, reward: 2000 },
      { type: "tournament_hands", label: "Tournament Grinder", description: "Play {target} tournament hands", target: 50, reward: 4000 },
      { type: "sng_win", label: "SNG Champion", description: "Win a Sit & Go", target: 1, reward: 3000 },
      { type: "big_pot_wins", label: "Whale Hunter", description: "Win {target} big pots", target: 5, reward: 5000 },
    ],
  };

  app.post("/api/missions/generate-daily", requireAuth, async (req, res, next) => {
    try {
      const shuffle = <T>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
      const dailyPicks = shuffle(MISSION_TEMPLATES.daily).slice(0, 3 + Math.round(Math.random()));
      const weeklyPicks = shuffle(MISSION_TEMPLATES.weekly).slice(0, 3 + Math.round(Math.random()));

      // Snapshot current stats so progress is relative to mission creation
      const stats = await storage.getPlayerStats(req.user!.id);
      const baselineFieldMap: Record<string, keyof NonNullable<typeof stats>> = {
        hands_played: "handsPlayed",
        pots_won: "potsWon",
        bluff_wins: "bluffWins",
        preflop_folds: "preflopFolds",
        big_pot_wins: "bigPotWins",
        plo_hands: "ploHands",
        tournament_hands: "tournamentHands",
        sng_win: "sngWins",
        vpip: "vpip",
        win_streak: "bestWinStreak",
        consecutive_wins: "currentWinStreak",
        bomb_pot: "bombPotsPlayed",
        heads_up_win: "headsUpWins",
      };

      const created = [];
      for (const t of [...dailyPicks, ...weeklyPicks]) {
        const isWeekly = MISSION_TEMPLATES.weekly.includes(t as any);
        const mission = await storage.createMission({
          type: t.type,
          label: t.label,
          description: t.description.replace("{target}", String(t.target)),
          target: t.target,
          reward: t.reward,
          periodType: isWeekly ? "weekly" : "daily",
          isActive: true,
        });
        const statField = baselineFieldMap[t.type];
        const baseline = stats && statField && typeof (stats as any)[statField] === "number"
          ? (stats as any)[statField] as number
          : 0;
        await storage.createUserMission({
          userId: req.user!.id,
          missionId: mission.id,
          progress: 0,
          completedAt: null,
          claimedAt: null,
          periodStart: new Date(),
          baselineValue: baseline,
        });
        created.push({ ...mission, progress: 0 });
      }
      res.json(created);
    } catch (err) { next(err); }
  });

  app.get("/api/missions/active", requireAuth, async (req, res, next) => {
    try {
      const userMissionsList = await storage.getUserMissions(req.user!.id);
      const allMissions = await storage.getMissions();
      const missionMap = new Map(allMissions.map(m => [m.id, m]));
      const stats = await storage.getPlayerStats(req.user!.id);

      const active = userMissionsList
        .filter(um => !um.claimedAt)
        .map(um => {
          const mission = missionMap.get(um.missionId);
          if (!mission || !mission.isActive) return null;

          let liveProgress = um.progress;
          if (stats) {
            const fieldMap: Record<string, keyof typeof stats> = {
              hands_played: "handsPlayed",
              pots_won: "potsWon",
              bluff_wins: "bluffWins",
              preflop_folds: "preflopFolds",
              big_pot_wins: "bigPotWins",
              plo_hands: "ploHands",
              tournament_hands: "tournamentHands",
              sng_win: "sngWins",
              vpip: "vpip",
            };
            const field = fieldMap[mission.type];
            if (field && typeof stats[field] === "number") {
              const baseline = um.baselineValue ?? 0;
              liveProgress = Math.min(Math.max(0, (stats[field] as number) - baseline), mission.target);
            }
          }

          return {
            id: um.id,
            missionId: mission.id,
            type: mission.type,
            label: mission.label,
            description: mission.description,
            target: mission.target,
            reward: mission.reward,
            periodType: mission.periodType,
            progress: liveProgress,
            completed: liveProgress >= mission.target,
            claimed: !!um.claimedAt,
          };
        })
        .filter(Boolean);

      res.json(active);
    } catch (err) { next(err); }
  });

  // ─── Admin: Tournament Schedule ──────────────────────────────────────────
  app.get("/api/admin/tournament-schedule", requireAuth, async (req, res) => {
    const schedule = getTournamentSchedule();
    res.json({ schedule });
  });

  app.put("/api/admin/tournament-schedule", requireAuth, async (req, res) => {
    const { schedule } = req.body;
    if (!Array.isArray(schedule)) {
      return res.status(400).json({ message: "schedule must be an array" });
    }
    for (const entry of schedule) {
      if (!entry.name || typeof entry.hourUTC !== "number" || typeof entry.buyIn !== "number" ||
          typeof entry.startingChips !== "number" || typeof entry.maxPlayers !== "number") {
        return res.status(400).json({ message: "Each entry requires name, hourUTC, buyIn, startingChips, maxPlayers" });
      }
    }
    setTournamentSchedule(schedule as ScheduledTournament[]);
    res.json({ message: "Schedule updated", schedule: getTournamentSchedule() });
  });

  // ─── Tier System Routes ──────────────────────────────────────────────────

  app.get("/api/tiers", (_req, res) => {
    res.json(TIER_DEFINITIONS);
  });

  app.post("/api/tiers/upgrade", requireAuth, async (req, res, next) => {
    try {
      const { tier } = req.body;
      if (!tier || !TIER_ORDER.includes(tier)) {
        return res.status(400).json({ message: "Invalid tier" });
      }
      if (tier === "free") {
        return res.status(400).json({ message: "Cannot upgrade to free tier" });
      }
      const tierDef = TIER_DEFINITIONS.find(t => t.id === tier);
      if (!tierDef) return res.status(400).json({ message: "Unknown tier" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (tierRank(user.tier) >= tierRank(tier) && user.tierExpiresAt && new Date(user.tierExpiresAt) > new Date()) {
        return res.status(400).json({ message: "You already have this tier or higher" });
      }

      if (user.chipBalance < tierDef.price) {
        return res.status(400).json({ message: "Insufficient chips" });
      }

      const { success } = await storage.atomicDeductChips(user.id, tierDef.price);
      if (!success) {
        return res.status(400).json({ message: "Insufficient chips" });
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
      const updated = await storage.updateUser(user.id, { tier, tierExpiresAt: expiresAt });
      res.json(updated);
    } catch (err) { next(err); }
  });

  // ─── KYC Routes ──────────────────────────────────────────────────────────

  app.get("/api/kyc/status", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        kycStatus: user.kycStatus,
        kycData: user.kycData,
        kycVerifiedAt: user.kycVerifiedAt,
        kycRejectionReason: user.kycRejectionReason,
        kycBlockchainTxHash: user.kycBlockchainTxHash,
      });
    } catch (err) { next(err); }
  });

  app.post("/api/kyc/submit", requireAuth, requireTier("gold"), async (req, res, next) => {
    try {
      const { fullName, dateOfBirth, country, idType } = req.body;
      if (!fullName || !dateOfBirth || !country || !idType) {
        return res.status(400).json({ message: "All fields required: fullName, dateOfBirth, country, idType" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.kycStatus === "pending") {
        return res.status(400).json({ message: "KYC application already pending" });
      }
      if (user.kycStatus === "verified") {
        return res.status(400).json({ message: "KYC already verified" });
      }

      const kycData = { fullName, dateOfBirth, country, idType, submittedAt: new Date().toISOString() };
      const updated = await storage.updateUser(user.id, {
        kycStatus: "pending",
        kycData,
        kycRejectionReason: null,
      });
      res.json(updated);
    } catch (err) { next(err); }
  });

  // Admin KYC routes
  app.get("/api/admin/kyc/pending", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== "admin") return res.status(403).json({ message: "Admin only" });
      const pending = await storage.getAllUsersByKycStatus("pending");
      const sanitized = pending.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        memberId: u.memberId,
        kycStatus: u.kycStatus,
        kycData: u.kycData,
        tier: u.tier,
        createdAt: u.createdAt,
      }));
      res.json(sanitized);
    } catch (err) { next(err); }
  });

  app.post("/api/admin/kyc/:userId/verify", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== "admin") return res.status(403).json({ message: "Admin only" });
      const user = await storage.getUser(req.params.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.kycStatus !== "pending") {
        return res.status(400).json({ message: "User KYC is not pending" });
      }
      const updated = await storage.updateUser(user.id, {
        kycStatus: "verified",
        kycVerifiedAt: new Date(),
      });
      res.json(updated);
    } catch (err) { next(err); }
  });

  app.post("/api/admin/kyc/:userId/reject", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== "admin") return res.status(403).json({ message: "Admin only" });
      const { reason } = req.body;
      const user = await storage.getUser(req.params.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.kycStatus !== "pending") {
        return res.status(400).json({ message: "User KYC is not pending" });
      }
      const updated = await storage.updateUser(user.id, {
        kycStatus: "rejected",
        kycRejectionReason: reason || "Application rejected",
      });
      res.json(updated);
    } catch (err) { next(err); }
  });

  // ─── Blockchain Member ID Routes ──────────────────────────────────────────

  app.get("/api/member/:memberId", async (req, res, next) => {
    try {
      const user = await storage.getUserByMemberId(req.params.memberId);
      if (!user) return res.status(404).json({ message: "Member not found" });
      res.json({
        memberId: user.memberId,
        username: user.username,
        displayName: user.displayName,
        avatarId: user.avatarId,
        tier: user.tier,
        kycStatus: user.kycStatus,
        kycVerifiedAt: user.kycVerifiedAt,
        kycBlockchainTxHash: user.kycBlockchainTxHash,
        createdAt: user.createdAt,
      });
    } catch (err) { next(err); }
  });

  app.post("/api/kyc/record-on-chain", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.kycStatus !== "verified") {
        return res.status(400).json({ message: "KYC must be verified first" });
      }
      if (user.kycBlockchainTxHash) {
        return res.status(400).json({ message: "Already recorded on-chain", txHash: user.kycBlockchainTxHash });
      }

      // Simulate on-chain recording — in production this would call a smart contract on Base/Polygon
      const txHash = "0x" + createHash("sha256")
        .update(user.id + JSON.stringify(user.kycData) + Date.now().toString())
        .digest("hex");

      await storage.updateUser(user.id, { kycBlockchainTxHash: txHash });
      res.json({ txHash, message: "KYC verification recorded on-chain (simulated)" });
    } catch (err) { next(err); }
  });

  // ─── Responsible Gambling ─────────────────────────────────────────────────

  app.get("/api/responsible-gambling/settings", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        selfExcludedUntil: user.selfExcludedUntil,
        depositLimitDaily: user.depositLimitDaily ?? 0,
        depositLimitWeekly: user.depositLimitWeekly ?? 0,
        depositLimitMonthly: user.depositLimitMonthly ?? 0,
        sessionTimeLimitMinutes: user.sessionTimeLimitMinutes ?? 0,
        lossLimitDaily: user.lossLimitDaily ?? 0,
        coolOffUntil: user.coolOffUntil,
      });
    } catch (err) { next(err); }
  });

  app.put("/api/responsible-gambling/settings", requireAuth, async (req, res, next) => {
    try {
      const { depositLimitDaily, depositLimitWeekly, depositLimitMonthly, sessionTimeLimitMinutes, lossLimitDaily } = req.body;
      const updates: Record<string, any> = {};
      if (depositLimitDaily !== undefined) updates.depositLimitDaily = Math.max(0, Math.floor(Number(depositLimitDaily)));
      if (depositLimitWeekly !== undefined) updates.depositLimitWeekly = Math.max(0, Math.floor(Number(depositLimitWeekly)));
      if (depositLimitMonthly !== undefined) updates.depositLimitMonthly = Math.max(0, Math.floor(Number(depositLimitMonthly)));
      if (sessionTimeLimitMinutes !== undefined) updates.sessionTimeLimitMinutes = Math.max(0, Math.floor(Number(sessionTimeLimitMinutes)));
      if (lossLimitDaily !== undefined) updates.lossLimitDaily = Math.max(0, Math.floor(Number(lossLimitDaily)));
      if (Object.keys(updates).length === 0) return res.status(400).json({ message: "No valid settings provided" });
      const updated = await storage.updateUser(req.user!.id, updates);
      res.json({
        selfExcludedUntil: updated?.selfExcludedUntil ?? null,
        depositLimitDaily: updated?.depositLimitDaily ?? 0,
        depositLimitWeekly: updated?.depositLimitWeekly ?? 0,
        depositLimitMonthly: updated?.depositLimitMonthly ?? 0,
        sessionTimeLimitMinutes: updated?.sessionTimeLimitMinutes ?? 0,
        lossLimitDaily: updated?.lossLimitDaily ?? 0,
        coolOffUntil: updated?.coolOffUntil ?? null,
      });
    } catch (err) { next(err); }
  });

  app.post("/api/responsible-gambling/self-exclude", requireAuth, async (req, res, next) => {
    try {
      const { days } = req.body;
      if (!days || days < 1) return res.status(400).json({ message: "days must be >= 1" });
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.selfExcludedUntil) {
        const remainingMs = new Date(user.selfExcludedUntil).getTime() - Date.now();
        if (remainingMs > 24 * 60 * 60 * 1000) {
          return res.status(400).json({ message: "Cannot modify self-exclusion. Current exclusion cannot be reversed early.", selfExcludedUntil: user.selfExcludedUntil });
        }
      }
      const daysToAdd = days === 0 ? 3650 : Math.floor(Number(days));
      const excludeUntil = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);
      await storage.updateUser(req.user!.id, { selfExcludedUntil: excludeUntil });
      res.json({ selfExcludedUntil: excludeUntil, message: `Self-excluded until ${excludeUntil.toISOString()}` });
    } catch (err) { next(err); }
  });

  app.post("/api/responsible-gambling/cool-off", requireAuth, async (req, res, next) => {
    try {
      const coolOffUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.updateUser(req.user!.id, { coolOffUntil });
      res.json({ coolOffUntil, message: "Cool-off period activated for 24 hours" });
    } catch (err) { next(err); }
  });

  // Responsible gambling enforcement on game routes
  function responsibleGamblingCheck(req: any, res: any, next: any) {
    if (!req.user) return next();
    const now = new Date();
    if (req.user.selfExcludedUntil && new Date(req.user.selfExcludedUntil) > now) {
      return res.status(403).json({ message: `Self-excluded until ${new Date(req.user.selfExcludedUntil).toISOString()}`, reason: "self_exclusion", until: req.user.selfExcludedUntil });
    }
    if (req.user.coolOffUntil && new Date(req.user.coolOffUntil) > now) {
      return res.status(403).json({ message: `Cool-off period active until ${new Date(req.user.coolOffUntil).toISOString()}`, reason: "cool_off", until: req.user.coolOffUntil });
    }
    next();
  }
  app.use("/api/tables/:id/join", requireAuth, responsibleGamblingCheck);

  // Deposit limit enforcement
  app.use("/api/payments/deposit", requireAuth, async (req: any, res: any, next: any) => {
    if (req.method !== "POST" || !req.user) return next();
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) return next();
      const amount = req.body?.amount || 0;
      const txns = await storage.getTransactions(req.user.id, 1000, 0);
      const now = Date.now();
      const deposits = txns.filter((t: any) => t.type === "deposit");
      const dailySum = deposits.filter((t: any) => new Date(t.createdAt).getTime() > now - 86400000).reduce((s: number, t: any) => s + t.amount, 0);
      const weeklySum = deposits.filter((t: any) => new Date(t.createdAt).getTime() > now - 604800000).reduce((s: number, t: any) => s + t.amount, 0);
      const monthlySum = deposits.filter((t: any) => new Date(t.createdAt).getTime() > now - 2592000000).reduce((s: number, t: any) => s + t.amount, 0);
      if (user.depositLimitDaily && user.depositLimitDaily > 0 && dailySum + amount > user.depositLimitDaily) {
        return res.status(400).json({ message: `Daily deposit limit of ${user.depositLimitDaily} would be exceeded` });
      }
      if (user.depositLimitWeekly && user.depositLimitWeekly > 0 && weeklySum + amount > user.depositLimitWeekly) {
        return res.status(400).json({ message: `Weekly deposit limit of ${user.depositLimitWeekly} would be exceeded` });
      }
      if (user.depositLimitMonthly && user.depositLimitMonthly > 0 && monthlySum + amount > user.depositLimitMonthly) {
        return res.status(400).json({ message: `Monthly deposit limit of ${user.depositLimitMonthly} would be exceeded` });
      }
      next();
    } catch (err) { next(err); }
  });

  // Session time tracking
  const sessionJoinTimes = new Map<string, { tableId: string; joinedAt: number; warningTimer?: ReturnType<typeof setTimeout>; disconnectTimer?: ReturnType<typeof setTimeout> }>();
  function startSessionTimers(userId: string, tableId: string, limitMinutes: number) {
    clearSessionTimers(userId);
    const entry: typeof sessionJoinTimes extends Map<string, infer V> ? V : never = { tableId, joinedAt: Date.now() };
    if (limitMinutes > 0) {
      entry.warningTimer = setTimeout(() => {
        sendToUser(userId, { type: "info", message: `You've been playing for ${limitMinutes} minutes. Consider taking a break.` });
      }, limitMinutes * 60 * 1000);
      entry.disconnectTimer = setTimeout(() => {
        sendToUser(userId, { type: "error", message: `Session time limit reached (${limitMinutes * 2} minutes). You have been disconnected.` });
        const client = getClients().get(userId);
        if (client && client.tableId) { tableManager.leaveTable(client.tableId, userId).catch(() => {}); client.tableId = null; }
      }, limitMinutes * 2 * 60 * 1000);
    }
    sessionJoinTimes.set(userId, entry);
  }
  function clearSessionTimers(userId: string) {
    const entry = sessionJoinTimes.get(userId);
    if (entry) { if (entry.warningTimer) clearTimeout(entry.warningTimer); if (entry.disconnectTimer) clearTimeout(entry.disconnectTimer); sessionJoinTimes.delete(userId); }
  }
  app.use("/api/tables/:id/join", (req: any, res: any, next: any) => {
    if (req.method !== "POST") return next();
    const originalJson = res.json.bind(res);
    res.json = function(body: any) {
      if (res.statusCode < 400 && req.user?.sessionTimeLimitMinutes > 0) startSessionTimers(req.user.id, req.params.id, req.user.sessionTimeLimitMinutes);
      return originalJson(body);
    };
    next();
  });

  // ─── AI Premium Session Report ──────────────────────────────────────────
  app.post("/api/coaching/session-report", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "User not found" });

      // Check Gold+ tier (premiumUntil) or deduct 500 chips
      const isGoldPlus = user.premiumUntil && new Date(user.premiumUntil) > new Date();
      if (!isGoldPlus) {
        if (user.chipBalance < 500) {
          return res.status(400).json({ message: "Insufficient chips. Session report costs 500 chips or is free with Gold+ tier." });
        }
        await storage.atomicDeductChips(userId, 500);
      }

      if (!hasDatabase()) {
        return res.json({
          sessionId: require("crypto").randomUUID(),
          handsAnalyzed: 0,
          netResult: 0,
          positionBreakdown: [],
          leaks: [],
          topWinningHands: [],
          topLosingHands: [],
          recommendations: ["Play more hands to generate a session report."],
        });
      }

      const db = getDb();

      const recentHandPlayers = await db
        .select()
        .from(handPlayers)
        .where(sql`${handPlayers.userId} = ${userId}`)
        .orderBy(sql`${handPlayers.id} desc`)
        .limit(50);

      if (recentHandPlayers.length === 0) {
        return res.json({
          sessionId: require("crypto").randomUUID(),
          handsAnalyzed: 0,
          netResult: 0,
          positionBreakdown: [],
          leaks: [],
          topWinningHands: [],
          topLosingHands: [],
          recommendations: ["No hands found. Play some hands first!"],
        });
      }

      const handIds = recentHandPlayers.map(hp => hp.handId);
      const hands = await db
        .select()
        .from(gameHands)
        .where(sql`${gameHands.id} = ANY(${handIds})`);

      const handMap = new Map(hands.map(h => [h.id, h]));

      const seatToPosition = (seatIdx: number, dealerSeat: number | null, maxPlayers: number): string => {
        if (!dealerSeat && dealerSeat !== 0) return "MP";
        const positions = maxPlayers <= 6
          ? ["BTN", "SB", "BB", "EP", "MP", "CO"]
          : ["BTN", "SB", "BB", "EP", "EP", "MP", "MP", "CO", "CO", "CO"];
        const offset = (seatIdx - dealerSeat + maxPlayers) % maxPlayers;
        return positions[offset] ?? "MP";
      };

      const positionData: Record<string, { hands: number; vpip: number; wins: number; chipsWon: number; chipsLost: number }> = {};
      const allPositions = ["BTN", "CO", "MP", "EP", "SB", "BB"];
      for (const pos of allPositions) {
        positionData[pos] = { hands: 0, vpip: 0, wins: 0, chipsWon: 0, chipsLost: 0 };
      }

      let totalNet = 0;
      const handResults: Record<string, { wins: number; losses: number; netChips: number }> = {};

      for (const hp of recentHandPlayers) {
        const hand = handMap.get(hp.handId);
        const position = seatToPosition(hp.seatIndex, hand?.dealerSeat ?? 0, 6);
        const posData = positionData[position] ?? positionData["MP"];

        posData.hands++;
        totalNet += hp.netResult;

        if (hp.isWinner) posData.wins++;
        if (hp.finalAction !== "fold") posData.vpip++;
        if (hp.netResult > 0) posData.chipsWon += hp.netResult;
        if (hp.netResult < 0) posData.chipsLost += Math.abs(hp.netResult);

        if (hp.holeCards && Array.isArray(hp.holeCards) && hp.holeCards.length >= 2) {
          const cards = hp.holeCards as string[];
          const ranks = "23456789TJQKA";
          const getRank = (c: string) => typeof c === "string" ? c[0] : "";
          const getSuit = (c: string) => typeof c === "string" ? c[1] : "";
          const r1 = getRank(cards[0]);
          const r2 = getRank(cards[1]);
          const suited = getSuit(cards[0]) === getSuit(cards[1]);
          const ri1 = ranks.indexOf(r1);
          const ri2 = ranks.indexOf(r2);
          const high = ri1 >= ri2 ? r1 : r2;
          const low = ri1 >= ri2 ? r2 : r1;
          const handName = high === low ? `${high}${low}` : `${high}${low}${suited ? "s" : "o"}`;

          if (!handResults[handName]) handResults[handName] = { wins: 0, losses: 0, netChips: 0 };
          handResults[handName].netChips += hp.netResult;
          if (hp.netResult > 0) handResults[handName].wins++;
          if (hp.netResult < 0) handResults[handName].losses++;
        }
      }

      const positionBreakdown = allPositions
        .filter(pos => positionData[pos].hands > 0)
        .map(pos => {
          const d = positionData[pos];
          return {
            position: pos,
            hands: d.hands,
            vpip: d.hands > 0 ? Math.round((d.vpip / d.hands) * 100) : 0,
            winRate: d.hands > 0 ? Math.round((d.wins / d.hands) * 100) : 0,
          };
        });

      const leaks: { description: string; chipsLost: number; frequency: number }[] = [];

      const epData = positionData["EP"];
      if (epData.hands >= 3 && (epData.vpip / epData.hands) > 0.4 && epData.chipsLost > 500) {
        leaks.push({
          description: `You lost ${epData.chipsLost.toLocaleString()} chips calling from EP with marginal hands`,
          chipsLost: epData.chipsLost,
          frequency: epData.vpip,
        });
      }

      const sbData = positionData["SB"];
      if (sbData.hands >= 3 && (sbData.vpip / sbData.hands) > 0.5 && sbData.chipsLost > 300) {
        leaks.push({
          description: `Overplaying from SB: ${sbData.chipsLost.toLocaleString()} chips lost with ${Math.round((sbData.vpip / sbData.hands) * 100)}% VPIP`,
          chipsLost: sbData.chipsLost,
          frequency: sbData.vpip,
        });
      }

      const totalHands = recentHandPlayers.length;
      const totalVpip = Object.values(positionData).reduce((s, d) => s + d.vpip, 0);
      if (totalHands >= 10 && (totalVpip / totalHands) > 0.45) {
        const totalLost = Object.values(positionData).reduce((s, d) => s + d.chipsLost, 0);
        leaks.push({
          description: `Playing too many hands overall (${Math.round((totalVpip / totalHands) * 100)}% VPIP). Tighten your range.`,
          chipsLost: totalLost,
          frequency: totalVpip,
        });
      }

      const sortedByNet = Object.entries(handResults).sort((a, b) => b[1].netChips - a[1].netChips);
      const topWinningHands = sortedByNet.filter(([, v]) => v.netChips > 0).slice(0, 5).map(([k]) => k);
      const topLosingHands = sortedByNet.filter(([, v]) => v.netChips < 0).reverse().slice(0, 5).map(([k]) => k);

      const recommendations: string[] = [];
      const overallVpipPct = totalHands > 0 ? Math.round((totalVpip / totalHands) * 100) : 0;

      if (epData.hands >= 3 && (epData.vpip / epData.hands) > 0.3) {
        recommendations.push("Tighten EP range to top 12% of hands");
      }
      if (overallVpipPct > 35) {
        recommendations.push("Reduce overall VPIP to 22-28% range");
      }
      if (overallVpipPct < 15 && totalHands >= 20) {
        recommendations.push("Open up your range, especially from BTN and CO");
      }

      const bbData = positionData["BB"];
      if (bbData.hands >= 3 && bbData.chipsLost > bbData.chipsWon * 2) {
        recommendations.push("Increase 3-bet frequency from BB to defend more effectively");
      }

      const btnData = positionData["BTN"];
      if (btnData.hands >= 3 && (btnData.vpip / btnData.hands) < 0.3) {
        recommendations.push("Play more hands from BTN - this is your most profitable position");
      }

      if (topLosingHands.length > 0) {
        recommendations.push(`Consider removing ${topLosingHands.slice(0, 2).join(", ")} from your opening range`);
      }

      if (recommendations.length === 0) {
        recommendations.push("Keep playing - you need more data for specific recommendations");
      }

      res.json({
        sessionId: require("crypto").randomUUID(),
        handsAnalyzed: recentHandPlayers.length,
        netResult: totalNet,
        positionBreakdown,
        leaks,
        topWinningHands,
        topLosingHands,
        recommendations,
      });
    } catch (err) { next(err); }
  });

  // ─── Anti-Cheat Admin Endpoints ─────────────────────────────────────────
  app.get("/api/admin/anti-cheat/live", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      const { antiCheatEngine } = await import("./anti-cheat");
      const riskFlags = antiCheatEngine.getActiveRiskFlags(10);
      const pendingAlerts = await storage.getCollusionAlerts("pending");

      res.json({
        activeRiskFlags: riskFlags,
        pendingAlerts: pendingAlerts.slice(0, 50),
        totalPendingAlerts: pendingAlerts.length,
      });
    } catch (err) { next(err); }
  });

  app.post("/api/admin/anti-cheat/freeze/:userId", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const targetUser = await storage.getUser(req.params.userId);
      if (!targetUser) return res.status(404).json({ message: "User not found" });

      await storage.updateUser(req.params.userId, { role: "frozen" as any });

      res.json({ ok: true, message: `Account ${targetUser.username} has been frozen` });
    } catch (err) { next(err); }
  });

  // ─── Support Ticket Routes ─────────────────────────────────────────────
  app.post("/api/support/tickets", requireAuth, async (req, res, next) => {
    try {
      const { subject, message, category, priority } = req.body;
      if (!subject || !message) return res.status(400).json({ message: "Subject and message are required" });

      const validCategories = ["account", "payment", "game", "technical", "other"];
      const validPriorities = ["low", "medium", "high", "urgent"];
      const cat = validCategories.includes(category) ? category : "other";
      const pri = validPriorities.includes(priority) ? priority : "medium";

      if (!hasDatabase()) {
        return res.status(503).json({ message: "Database required for ticket system" });
      }

      const db = getDb();
      const { supportTickets, ticketMessages } = await import("@shared/schema");

      const ticketId = require("crypto").randomUUID();
      const now = new Date();

      await db.insert(supportTickets).values({
        id: ticketId,
        userId: req.user!.id,
        subject: subject.trim().slice(0, 200),
        status: "open",
        priority: pri,
        category: cat,
        createdAt: now,
        updatedAt: now,
      });

      const msgId = require("crypto").randomUUID();
      await db.insert(ticketMessages).values({
        id: msgId,
        ticketId,
        userId: req.user!.id,
        message: message.trim().slice(0, 5000),
        isStaff: false,
        createdAt: now,
      });

      res.status(201).json({
        id: ticketId,
        subject: subject.trim(),
        status: "open",
        priority: pri,
        category: cat,
        createdAt: now.toISOString(),
      });
    } catch (err) { next(err); }
  });

  app.get("/api/support/tickets", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const { supportTickets } = await import("@shared/schema");

      const tickets = await db
        .select()
        .from(supportTickets)
        .where(sql`${supportTickets.userId} = ${req.user!.id}`)
        .orderBy(sql`${supportTickets.createdAt} desc`)
        .limit(50);

      res.json(tickets);
    } catch (err) { next(err); }
  });

  app.get("/api/support/tickets/:id", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.status(404).json({ message: "Not found" });
      const db = getDb();
      const { supportTickets, ticketMessages } = await import("@shared/schema");

      const [ticket] = await db
        .select()
        .from(supportTickets)
        .where(sql`${supportTickets.id} = ${req.params.id}`)
        .limit(1);

      if (!ticket) return res.status(404).json({ message: "Ticket not found" });

      if (ticket.userId !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await db
        .select()
        .from(ticketMessages)
        .where(sql`${ticketMessages.ticketId} = ${req.params.id}`)
        .orderBy(sql`${ticketMessages.createdAt} asc`);

      res.json({ ...ticket, messages });
    } catch (err) { next(err); }
  });

  app.post("/api/support/tickets/:id/messages", requireAuth, async (req, res, next) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ message: "Message required" });

      if (!hasDatabase()) return res.status(503).json({ message: "Database required" });
      const db = getDb();
      const { supportTickets, ticketMessages } = await import("@shared/schema");

      const [ticket] = await db
        .select()
        .from(supportTickets)
        .where(sql`${supportTickets.id} = ${req.params.id}`)
        .limit(1);

      if (!ticket) return res.status(404).json({ message: "Ticket not found" });

      if (ticket.userId !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const isStaff = req.user!.role === "admin";
      const msgId = require("crypto").randomUUID();
      const now = new Date();

      await db.insert(ticketMessages).values({
        id: msgId,
        ticketId: req.params.id,
        userId: req.user!.id,
        message: message.trim().slice(0, 5000),
        isStaff,
        createdAt: now,
      });

      await db.update(supportTickets)
        .set({ updatedAt: now })
        .where(sql`${supportTickets.id} = ${req.params.id}`);

      res.status(201).json({
        id: msgId,
        ticketId: req.params.id,
        userId: req.user!.id,
        message: message.trim(),
        isStaff,
        createdAt: now.toISOString(),
      });
    } catch (err) { next(err); }
  });

  app.post("/api/admin/support/tickets/:id/status", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { status } = req.body;
      const validStatuses = ["open", "in-progress", "resolved", "closed"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(", ")}` });
      }

      if (!hasDatabase()) return res.status(503).json({ message: "Database required" });
      const db = getDb();
      const { supportTickets } = await import("@shared/schema");

      const now = new Date();
      const updateData: any = { status, updatedAt: now };
      if (status === "resolved") updateData.resolvedAt = now;

      await db.update(supportTickets)
        .set(updateData)
        .where(sql`${supportTickets.id} = ${req.params.id}`);

      const [updated] = await db
        .select()
        .from(supportTickets)
        .where(sql`${supportTickets.id} = ${req.params.id}`)
        .limit(1);

      if (!updated) return res.status(404).json({ message: "Ticket not found" });
      res.json(updated);
    } catch (err) { next(err); }
  });

  app.get("/api/admin/support/tickets", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const { supportTickets } = await import("@shared/schema");

      const status = req.query.status as string | undefined;
      const priority = req.query.priority as string | undefined;

      let tickets;
      if (status) {
        tickets = await db.select().from(supportTickets).where(sql`${supportTickets.status} = ${status}`).orderBy(sql`${supportTickets.createdAt} desc`).limit(100);
      } else {
        tickets = await db.select().from(supportTickets).orderBy(sql`${supportTickets.createdAt} desc`).limit(100);
      }

      const filtered = priority ? tickets.filter(t => t.priority === priority) : tickets;
      res.json(filtered);
    } catch (err) { next(err); }
  });

  // ─── Create HTTP Server + WebSocket ──────────────────────────────────────
  const httpServer = createServer(app);
  setupWebSocket(httpServer, sessionMiddleware);

  return httpServer;
}

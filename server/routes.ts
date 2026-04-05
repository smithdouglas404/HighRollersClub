import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { createHash, randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import multer from "multer";
import nodemailer from "nodemailer";
import { storage } from "./storage";
import { registerAuthRoutes, requireAuth } from "./auth";
import { insertTableSchema, insertClubSchema, createAllianceSchema, updateAllianceSchema, createLeagueSeasonSchema, updateLeagueSeasonSchema, leagueStandingsSchema, createTournamentSchema, users, gameHands, handPlayers, playerStats, tables, adminAuditLogs, transactions, payments, musicTracks, sponsorshipPayouts, announcements } from "@shared/schema";
import { sql } from "drizzle-orm";
import { setupWebSocket, sendGameStateToTable, getClients, sendToUser, broadcastToTable } from "./websocket";
import { getBlindPreset } from "./game/blind-presets";
import { tableManager } from "./game/table-manager";
import { analyzeHand } from "./game/hand-analyzer";
import { geofenceMiddleware } from "./middleware/geofence";
import { setAnthropicApiKey, getAnthropicApiKey, hasAIEnabled } from "./game/ai-bot-engine";
import { hasDatabase, getDb } from "./db";
import { MTTManager, activeMTTs } from "./game/mtt-manager";
import { getTournamentSchedule, setTournamentSchedule, type ScheduledTournament } from "./scheduler";
import { fastFoldManager, type FastFoldPoolConfig } from "./game/fast-fold-manager";
import { blockchainConfig } from "./blockchain/config";

// ─── File Upload Setup (KYC documents) ────────────────────────────────────
const KYC_UPLOAD_DIR = path.join(process.cwd(), "uploads", "kyc");
fs.mkdirSync(KYC_UPLOAD_DIR, { recursive: true });

const kycUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, KYC_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Only JPG, PNG, WebP, and PDF files are allowed"));
  },
});

// ─── Email Helper ──────────────────────────────────────────────────────────
function getMailTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

async function sendKycEmail(to: string, subject: string, html: string) {
  const transport = getMailTransport();
  if (!transport) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] KYC email to ${to}: ${subject}`);
    }
    return;
  }
  const from = process.env.SMTP_FROM || "noreply@highrollers.club";
  await transport.sendMail({ from, to, subject, html }).catch((err: any) => {
    console.error("KYC email send error:", err.message);
  });
}

// ─── Admin Audit Logger ────────────────────────────────────────────────────
async function logAdminAction(
  adminId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details: Record<string, any> | null,
  ipAddress?: string
) {
  try {
    if (!hasDatabase()) return;
    const db = getDb();
    await db.insert(adminAuditLogs).values({
      adminId,
      action,
      targetType,
      targetId,
      details,
      ipAddress: ipAddress || null,
    });
  } catch (err: any) {
    console.error("Audit log error:", err.message);
  }
}

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
// Persisted via platformSettings table if database available
let globalSystemLocked = false;
let globalLockReason = "";

// Load lock status from database on startup
(async () => {
  try {
    if (hasDatabase()) {
      const db = getDb();
      const { platformSettings: ps } = await import("@shared/schema");
      const [lockSetting] = await db.select().from(ps).where(sql`${ps.key} = 'maintenance.enabled'`).limit(1);
      const [reasonSetting] = await db.select().from(ps).where(sql`${ps.key} = 'maintenance.reason'`).limit(1);
      if (lockSetting?.value === true) globalSystemLocked = true;
      if (reasonSetting?.value) globalLockReason = String(reasonSetting.value);
    }
  } catch {}
})();

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

  // ─── Practice Mode Shuffle (server-side, no auth needed) ───────────────
  app.post("/api/practice/shuffle", (_req, res) => {
    const { randomBytes, createHash } = require("crypto");
    const suits = ["hearts", "diamonds", "clubs", "spades"];
    const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
    const deck: Array<{ suit: string; rank: string }> = [];
    for (const suit of suits) for (const rank of ranks) deck.push({ suit, rank });

    // Server-side Fisher-Yates with rejection sampling
    const seed = randomBytes(32);
    for (let i = deck.length - 1; i > 0; i--) {
      const range = i + 1;
      const max = Math.floor(0x100000000 / range) * range;
      let rand: number;
      let attempt = 0;
      do {
        const hmac = require("crypto").createHmac("sha256", seed);
        hmac.update(`practice-${i}-${attempt}`);
        rand = hmac.digest().readUInt32BE(0);
        attempt++;
      } while (rand >= max);
      const j = rand % range;
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Generate a practice hash (not blockchain — just SHA-256 for transparency)
    const deckString = deck.map(c => `${c.rank}${c.suit[0]}`).join(",");
    const practiceHash = createHash("sha256").update(deckString).digest("hex");

    res.json({ deck, hash: practiceHash });
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
        return res.status(200).json({ available: false, message: "Video chat is not currently available. Contact the platform administrator to enable this feature." });
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

  // In-memory lock to prevent daily bonus race condition
  const dailyClaimLocks = new Set<string>();

  app.post("/api/wallet/claim-daily", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;

      // Prevent concurrent claims with in-memory lock
      if (dailyClaimLocks.has(userId)) {
        return res.status(429).json({ message: "Claim already in progress" });
      }
      dailyClaimLocks.add(userId);

      try {
        const user = await storage.getUser(userId);
        if (!user) { dailyClaimLocks.delete(userId); return res.status(404).json({ message: "User not found" }); }

        const now = new Date();
        if (user.lastDailyClaim) {
          const hoursSince = (now.getTime() - user.lastDailyClaim.getTime()) / (1000 * 60 * 60);
          if (hoursSince < 24) {
            dailyClaimLocks.delete(userId);
            return res.status(429).json({
              message: "Daily bonus already claimed",
              nextClaimAt: new Date(user.lastDailyClaim.getTime() + 24 * 60 * 60 * 1000),
            });
          }
        }

        // Set lastDailyClaim immediately to prevent race conditions
        await storage.updateUser(userId, { lastDailyClaim: now });

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

      const totalBal = await storage.getUserTotalBalance(userId);
      res.json({ balance: totalBal, bonus, nextClaimAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) });
      } finally {
        dailyClaimLocks.delete(userId);
      }
    } catch (err) {
      dailyClaimLocks.delete(req.user!.id);
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
  // ─── Secure Hand History Routes ──────────────────────────────────────────
  // ALL hand endpoints require authentication. Sensitive fields are stripped.

  app.get("/api/hands/:id", requireAuth, async (req, res, next) => {
    try {
      const hand = await storage.getGameHand(req.params.id);
      if (!hand) return res.status(404).json({ message: "Hand not found" });

      // Strip sensitive fields — never expose raw deck order, seeds, or full summary
      // Only admins or participants can see verification data
      const isAdmin = req.user!.role === "admin";
      const handPlayers = await storage.getHandPlayers(req.params.id);
      const isParticipant = handPlayers.some((p: any) => p.userId === req.user!.id);

      const safe: Record<string, any> = {
        id: hand.id,
        tableId: hand.tableId,
        handNumber: hand.handNumber,
        dealerSeat: hand.dealerSeat,
        communityCards: hand.communityCards,
        potTotal: hand.potTotal,
        totalRake: hand.totalRake,
        winnerIds: hand.winnerIds,
        commitmentHash: hand.commitmentHash, // hash is safe — it's the public commitment
        onChainCommitTx: hand.onChainCommitTx,
        onChainRevealTx: hand.onChainRevealTx,
        createdAt: hand.createdAt,
      };

      // Only participants and admins can see verification proof data (post-hand)
      if (isAdmin || isParticipant) {
        safe.serverSeed = hand.serverSeed;
        safe.deckOrder = hand.deckOrder;
        safe.playerSeeds = hand.playerSeeds;
        safe.vrfRequestId = hand.vrfRequestId;
        safe.vrfRandomWord = hand.vrfRandomWord;
      }

      // Never expose raw summary to non-admins (contains all hole cards)
      if (isAdmin) {
        safe.summary = hand.summary;
      }

      res.json(safe);
    } catch (err) {
      next(err);
    }
  });

  // Hand verification — only for participants and admins
  app.get("/api/hands/:id/verify", requireAuth, async (req, res, next) => {
    try {
      const hand = await storage.getGameHand(req.params.id);
      if (!hand) return res.status(404).json({ message: "Hand not found" });
      if (!hand.serverSeed || !hand.commitmentHash || !hand.deckOrder) {
        return res.status(404).json({ message: "No proof data for this hand" });
      }

      // Only participants or admins can verify
      const isAdmin = req.user!.role === "admin";
      const handPlayers = await storage.getHandPlayers(req.params.id);
      const isParticipant = handPlayers.some((p: any) => p.userId === req.user!.id);
      if (!isAdmin && !isParticipant) {
        return res.status(403).json({ message: "Only hand participants can verify" });
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

  // Table hands list
  app.get("/api/tables/:id/hands", requireAuth, async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const hands = await storage.getGameHands(req.params.id, limit);
      // Strip sensitive fields from list view
      const safe = hands.map((h: any) => ({
        id: h.id, tableId: h.tableId, handNumber: h.handNumber,
        potTotal: h.potTotal, totalRake: h.totalRake, winnerIds: h.winnerIds,
        communityCards: h.communityCards, commitmentHash: h.commitmentHash,
        createdAt: h.createdAt,
      }));
      res.json(safe);
    } catch (err) {
      next(err);
    }
  });

  // Hand players — strip hole cards for non-showdown non-self players
  app.get("/api/hands/:id/players", requireAuth, async (req, res, next) => {
    try {
      const players = await storage.getHandPlayers(req.params.id);
      const safePlayers = players.map((p: any) => {
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

  // Hand actions — require authentication
  app.get("/api/hands/:id/actions", requireAuth, async (req, res, next) => {
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
      if (!user) return res.status(400).json({ message: "User not found" });

      // KYC required for all tournaments
      if (user.kycStatus !== "verified") {
        return res.status(403).json({ message: "KYC verification required for tournaments. Visit /kyc to verify your identity." });
      }

      if (user.chipBalance < tourney.buyIn) {
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

      // Persist to database
      if (hasDatabase()) {
        try {
          const db = getDb();
          const { platformSettings: ps } = await import("@shared/schema");
          await db.insert(ps).values({ key: "maintenance.enabled", value: globalSystemLocked, updatedBy: req.user!.id })
            .onConflictDoUpdate({ target: ps.key, set: { value: globalSystemLocked, updatedBy: req.user!.id, updatedAt: new Date() } });
          await db.insert(ps).values({ key: "maintenance.reason", value: globalLockReason, updatedBy: req.user!.id })
            .onConflictDoUpdate({ target: ps.key, set: { value: globalLockReason, updatedBy: req.user!.id, updatedAt: new Date() } });
        } catch {}
      }

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

  // ─── Admin: User Management ──────────────────────────────────────────────

  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json({ results: [], total: 0 });
      const db = getDb();
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const search = req.query.search as string | undefined;
      const roleFilter = req.query.role as string | undefined;
      const tierFilter = req.query.tier as string | undefined;

      const conds: ReturnType<typeof sql>[] = [];
      if (search) conds.push(sql`(${users.username} ILIKE ${"%" + search + "%"} OR ${users.displayName} ILIKE ${"%" + search + "%"} OR ${users.email} ILIKE ${"%" + search + "%"} OR ${users.id} ILIKE ${"%" + search + "%"})`);
      if (roleFilter) conds.push(sql`${users.role} = ${roleFilter}`);
      if (tierFilter) conds.push(sql`${users.tier} = ${tierFilter}`);

      const where = conds.length > 0 ? conds.reduce((a, b) => sql`${a} AND ${b}`) : sql`1=1`;

      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(users).where(where);
      const total = Number(countRow.count);

      const rows = await db.select({
        id: users.id, username: users.username, displayName: users.displayName,
        email: users.email, role: users.role, tier: users.tier,
        chipBalance: users.chipBalance, kycStatus: users.kycStatus,
        provider: users.provider, createdAt: users.createdAt,
        selfExcludedUntil: users.selfExcludedUntil,
      }).from(users).where(where)
        .orderBy(sql`${users.createdAt} DESC`)
        .limit(limit).offset(offset);

      res.json({ results: rows, total });
    } catch (err) { next(err); }
  });

  app.get("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, twoFactorSecret, recoveryCodes, ...safe } = user as any;
      res.json(safe);
    } catch (err) { next(err); }
  });

  app.patch("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { role, tier, chipBalance, displayName, kycStatus, selfExcludedUntil } = req.body;
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const updates: Record<string, any> = {};
      if (role !== undefined) updates.role = role;
      if (tier !== undefined) updates.tier = tier;
      if (chipBalance !== undefined) updates.chipBalance = parseInt(chipBalance);
      if (displayName !== undefined) updates.displayName = displayName;
      if (kycStatus !== undefined) updates.kycStatus = kycStatus;
      if (selfExcludedUntil !== undefined) updates.selfExcludedUntil = selfExcludedUntil ? new Date(selfExcludedUntil) : null;

      if (Object.keys(updates).length === 0) return res.status(400).json({ message: "No fields to update" });

      const updated = await storage.updateUser(req.params.id, updates);
      await logAdminAction(req.user!.id, "user_edit", "user", req.params.id,
        { changes: updates, username: user.username }, req.ip || req.socket.remoteAddress);
      res.json(updated);
    } catch (err) { next(err); }
  });

  app.post("/api/admin/users/:id/ban", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.role === "admin") return res.status(400).json({ message: "Cannot ban an admin" });
      const { reason } = req.body;
      // Set self-exclusion far in the future as a ban
      await storage.updateUser(req.params.id, { selfExcludedUntil: new Date("2099-12-31") });
      await logAdminAction(req.user!.id, "user_ban", "user", req.params.id,
        { username: user.username, reason }, req.ip || req.socket.remoteAddress);
      await storage.createNotification(req.params.id, "account_action", "Account Suspended",
        reason || "Your account has been suspended by an administrator.", {});
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  app.post("/api/admin/users/:id/unban", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      await storage.updateUser(req.params.id, { selfExcludedUntil: null });
      await logAdminAction(req.user!.id, "user_unban", "user", req.params.id,
        { username: user.username }, req.ip || req.socket.remoteAddress);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // ─── Admin: Club Management ────────────────────────────────────────────────

  app.get("/api/admin/clubs", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const allClubs = await storage.getClubs();
      const search = req.query.search as string | undefined;
      let filtered = allClubs;
      if (search) {
        const s = search.toLowerCase();
        filtered = allClubs.filter(c => c.name.toLowerCase().includes(s) || c.id.toLowerCase().includes(s));
      }
      // Enrich with member counts
      const enriched = await Promise.all(filtered.map(async (club) => {
        const members = await storage.getClubMembers(club.id);
        return { ...club, memberCount: members.length };
      }));
      res.json(enriched);
    } catch (err) { next(err); }
  });

  app.get("/api/admin/clubs/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      const members = await storage.getClubMembers(club.id);
      const owner = await storage.getUser(club.ownerId);
      res.json({ ...club, members, ownerName: owner?.username || "unknown" });
    } catch (err) { next(err); }
  });

  app.delete("/api/admin/clubs/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });
      await storage.deleteClub(req.params.id);
      await logAdminAction(req.user!.id, "club_delete", "club", req.params.id,
        { clubName: club.name }, req.ip || req.socket.remoteAddress);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // ─── Admin: Table Management ───────────────────────────────────────────────

  app.get("/api/admin/tables", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const allTables = await storage.getTables();
      const search = req.query.search as string | undefined;
      let filtered = allTables;
      if (search) {
        const s = search.toLowerCase();
        filtered = allTables.filter(t => (t.name || "").toLowerCase().includes(s) || t.id.toLowerCase().includes(s));
      }
      // Enrich with active player count from table manager
      const enriched = filtered.map(t => {
        const instance = tableManager.getTable(t.id);
        const activePlayers = instance ? instance.engine.state.players.filter((p: any) => p.status !== "sitting-out").length : 0;
        return { ...t, activePlayers, hasEngine: !!instance };
      });
      res.json(enriched);
    } catch (err) { next(err); }
  });

  app.post("/api/admin/tables/:id/close", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) return res.status(404).json({ message: "Table not found" });
      // Close the table — update status in storage
      await storage.updateTable(req.params.id, { status: "closed" });
      await logAdminAction(req.user!.id, "table_close", "table", req.params.id,
        { tableName: table.name }, req.ip || req.socket.remoteAddress);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // ─── Admin: Environment Keys ─────────────────────────────────────────────

  const ENV_KEY_DEFINITIONS = [
    // Blockchain
    { key: "POLYGON_ENABLED", category: "Blockchain", description: "Enable Polygon blockchain integration", sensitive: false },
    { key: "POLYGON_RPC_URL", category: "Blockchain", description: "Polygon RPC endpoint URL", sensitive: false },
    { key: "POLYGON_CHAIN_ID", category: "Blockchain", description: "Polygon chain ID (80002=Amoy, 137=Mainnet)", sensitive: false },
    { key: "POLYGON_WALLET_KEY", category: "Blockchain", description: "Hot wallet private key for transactions", sensitive: true },
    { key: "HAND_VERIFIER_ADDRESS", category: "Blockchain", description: "PokerHandVerifier contract address", sensitive: false },
    { key: "VRF_CONSUMER_ADDRESS", category: "Blockchain", description: "PokerVRFConsumer contract address", sensitive: false },
    { key: "VRF_SUBSCRIPTION_ID", category: "Blockchain", description: "Chainlink VRF subscription ID", sensitive: false },
    { key: "VRF_KEY_HASH", category: "Blockchain", description: "Chainlink VRF key hash", sensitive: false },
    { key: "VRF_CALLBACK_GAS_LIMIT", category: "Blockchain", description: "VRF callback gas limit", sensitive: false },
    { key: "POLYGON_USDC_ADDRESS", category: "Blockchain", description: "USDC token contract on Polygon", sensitive: false },
    { key: "POLYGON_DEPOSIT_ADDRESS", category: "Blockchain", description: "Deposit address for Polygon payments", sensitive: false },
    // Solana
    { key: "SOL_WALLET_KEY", category: "Solana", description: "SOL hot wallet private key (JSON array)", sensitive: true },
    { key: "SOL_RPC_URL", category: "Solana", description: "Solana RPC endpoint", sensitive: false },
    { key: "SOL_HOT_WALLET", category: "Solana", description: "SOL hot wallet public address", sensitive: false },
    // Payments
    { key: "STRIPE_API_KEY", category: "Payments", description: "Stripe secret API key", sensitive: true },
    { key: "STRIPE_WEBHOOK_SECRET", category: "Payments", description: "Stripe webhook signing secret", sensitive: true },
    { key: "NOWPAYMENTS_API_KEY", category: "Payments", description: "NOWPayments API key", sensitive: true },
    { key: "NOWPAYMENTS_WEBHOOK_SECRET", category: "Payments", description: "NOWPayments webhook secret", sensitive: true },
    { key: "NOWPAYMENTS_SANDBOX", category: "Payments", description: "Use NOWPayments sandbox mode", sensitive: false },
    { key: "DIRECT_WALLET_ENABLED", category: "Payments", description: "Enable direct wallet monitoring", sensitive: false },
    { key: "BTC_XPUB", category: "Payments", description: "BTC HD wallet extended public key", sensitive: true },
    { key: "ETH_HOT_WALLET", category: "Payments", description: "ETH/Polygon hot wallet address", sensitive: false },
    { key: "BLOCKCYPHER_TOKEN", category: "Payments", description: "BlockCypher API token (BTC)", sensitive: true },
    { key: "ALCHEMY_API_KEY", category: "Payments", description: "Alchemy API key (ETH/Polygon)", sensitive: true },
    { key: "HELIUS_API_KEY", category: "Payments", description: "Helius API key (Solana)", sensitive: true },
    // Email
    { key: "SMTP_HOST", category: "Email", description: "SMTP server hostname", sensitive: false },
    { key: "SMTP_PORT", category: "Email", description: "SMTP server port", sensitive: false },
    { key: "SMTP_SECURE", category: "Email", description: "Use TLS (true/false)", sensitive: false },
    { key: "SMTP_USER", category: "Email", description: "SMTP username", sensitive: false },
    { key: "SMTP_PASS", category: "Email", description: "SMTP password", sensitive: true },
    { key: "SMTP_FROM", category: "Email", description: "From address for emails", sensitive: false },
    // KYC
    { key: "KYC_PROVIDER", category: "KYC", description: "KYC provider (manual|onfido|sumsub)", sensitive: false },
    { key: "KYC_WEBHOOK_SECRET", category: "KYC", description: "KYC webhook signing secret", sensitive: true },
    { key: "ONFIDO_API_TOKEN", category: "KYC", description: "Onfido API token for identity verification", sensitive: true },
    { key: "ONFIDO_REGION", category: "KYC", description: "Onfido region (us|eu)", sensitive: false },
    { key: "ONFIDO_REFERRER", category: "KYC", description: "Onfido SDK referrer pattern (e.g., *://*/*)", sensitive: false },
    // AI & Services
    { key: "ANTHROPIC_API_KEY", category: "AI", description: "Anthropic API key for AI bots", sensitive: true },
    { key: "AI_BOT_MODEL", category: "AI", description: "AI bot model ID", sensitive: false },
    { key: "ELEVENLABS_API_KEY", category: "AI", description: "ElevenLabs TTS API key", sensitive: true },
    { key: "OPENAI_API_KEY", category: "AI", description: "OpenAI API key (commentary)", sensitive: true },
    // Firebase
    { key: "FIREBASE_PROJECT_ID", category: "Firebase", description: "Firebase project ID", sensitive: false },
    { key: "FIREBASE_SERVICE_ACCOUNT_KEY", category: "Firebase", description: "Firebase service account JSON", sensitive: true },
    // Video
    { key: "DAILY_API_KEY", category: "Video", description: "Daily.co API key for video calls", sensitive: true },
    // Infrastructure
    { key: "DATABASE_URL", category: "Infrastructure", description: "PostgreSQL connection string", sensitive: true },
    { key: "SESSION_SECRET", category: "Infrastructure", description: "Session encryption secret", sensitive: true },
    { key: "WEBHOOK_BASE_URL", category: "Infrastructure", description: "Base URL for webhook callbacks", sensitive: false },
    { key: "BLOCKED_COUNTRIES", category: "Infrastructure", description: "Comma-separated blocked country codes", sensitive: false },
    { key: "NODE_ENV", category: "Infrastructure", description: "Environment (development|production)", sensitive: false },
    { key: "PORT", category: "Infrastructure", description: "Server listen port", sensitive: false },
    { key: "REDIS_URL", category: "Infrastructure", description: "Redis connection URL for caching and pub/sub", sensitive: true },
  ];

  app.get("/api/admin/env-keys", requireAuth, requireAdmin, async (_req, res) => {
    const keys = ENV_KEY_DEFINITIONS.map(def => ({
      ...def,
      value: def.sensitive
        ? (process.env[def.key] ? "••••••••" : "")
        : (process.env[def.key] || ""),
      isSet: !!process.env[def.key],
    }));
    res.json(keys);
  });

  app.put("/api/admin/env-keys", requireAuth, requireAdmin, async (req, res) => {
    const { key, value } = req.body;
    if (!key || typeof key !== "string") return res.status(400).json({ message: "Key is required" });

    const def = ENV_KEY_DEFINITIONS.find(d => d.key === key);
    if (!def) return res.status(400).json({ message: "Unknown key" });

    // Update process.env at runtime
    if (value === "" || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }

    await logAdminAction(req.user!.id, "env_key_change", "system", key,
      { description: def.description, sensitive: def.sensitive },
      req.ip || req.socket.remoteAddress);

    res.json({ success: true, key, isSet: !!process.env[key] });
  });

  // ─── Music Tracks ──────────────────────────────────────────────────────────

  const MUSIC_UPLOAD_DIR = path.join(process.cwd(), "uploads", "music");
  fs.mkdirSync(MUSIC_UPLOAD_DIR, { recursive: true });

  const musicUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, MUSIC_UPLOAD_DIR),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || ".mp3";
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
    fileFilter: (_req, file, cb) => {
      const allowed = [".mp3", ".m4a", ".ogg", ".wav", ".aac", ".flac", ".webm"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) cb(null, true);
      else cb(new Error("Only audio files are allowed (MP3, M4A, OGG, WAV, AAC, FLAC)"));
    },
  });

  // List all available music — platform tracks + user's own tracks
  app.get("/api/music", requireAuth, async (req, res, next) => {
    try {
      // Static platform tracks from /client/public/music/
      const staticDir = path.join(process.cwd(), "client", "public", "music");
      const staticTracks: any[] = [];
      if (fs.existsSync(staticDir)) {
        const allowed = [".mp3", ".m4a", ".ogg", ".wav", ".aac", ".flac", ".webm"];
        for (const file of fs.readdirSync(staticDir)) {
          const ext = path.extname(file).toLowerCase();
          if (!allowed.includes(ext)) continue;
          const name = path.parse(file).name;
          const artist = name.includes("_KLICKAUD") ? "KLICKAUD" : name.includes("_") ? name.split("_").pop() : null;
          const title = name.replace(/_KLICKAUD$/, "").replace(/_/g, " ");
          staticTracks.push({
            id: `static-${file}`,
            title,
            artist,
            filename: file,
            url: `/music/${file}`,
            isAdmin: true,
            uploadedBy: "system",
            createdAt: new Date("2025-01-01"),
          });
        }
      }

      if (!hasDatabase()) return res.json(staticTracks);
      const db = getDb();
      const tracks = await db.select().from(musicTracks)
        .where(sql`${musicTracks.isAdmin} = true OR ${musicTracks.uploadedBy} = ${req.user!.id}`)
        .orderBy(sql`${musicTracks.isAdmin} DESC, ${musicTracks.createdAt} DESC`);

      const dbTracks = tracks.map(t => ({
        ...t,
        url: `/api/music/file/${t.filename}`,
      }));

      res.json([...staticTracks, ...dbTracks]);
    } catch (err) { next(err); }
  });

  // Serve music file
  app.get("/api/music/file/:filename", (req, res) => {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(MUSIC_UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });
    res.sendFile(filePath);
  });

  // User upload their own track
  app.post("/api/music/upload", requireAuth, musicUpload.single("file"), async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });
      const { title, artist } = req.body;

      if (!hasDatabase()) return res.status(500).json({ message: "Database required for music uploads" });
      const db = getDb();

      const [track] = await db.insert(musicTracks).values({
        title: title || path.parse(file.originalname).name,
        artist: artist || null,
        filename: file.filename,
        originalName: file.originalname,
        uploadedBy: req.user!.id,
        isAdmin: false,
      }).returning();

      res.json({ ...track, url: `/api/music/file/${track.filename}` });
    } catch (err) { next(err); }
  });

  // User delete their own track
  app.delete("/api/music/:id", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.status(500).json({ message: "Database required" });
      const db = getDb();
      const [track] = await db.select().from(musicTracks).where(sql`${musicTracks.id} = ${req.params.id}`).limit(1);
      if (!track) return res.status(404).json({ message: "Track not found" });

      // Users can only delete their own; admins can delete any
      if (track.uploadedBy !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ message: "You can only delete your own tracks" });
      }

      // Delete file from disk
      const filePath = path.join(MUSIC_UPLOAD_DIR, track.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await db.delete(musicTracks).where(sql`${musicTracks.id} = ${req.params.id}`);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // Admin: upload platform track
  app.post("/api/admin/music/upload", requireAuth, requireAdmin, musicUpload.single("file"), async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });
      const { title, artist } = req.body;

      if (!hasDatabase()) return res.status(500).json({ message: "Database required" });
      const db = getDb();

      const [track] = await db.insert(musicTracks).values({
        title: title || path.parse(file.originalname).name,
        artist: artist || null,
        filename: file.filename,
        originalName: file.originalname,
        uploadedBy: req.user!.id,
        isAdmin: true,
      }).returning();

      await logAdminAction(req.user!.id, "music_upload", "music", track.id,
        { title: track.title, artist: track.artist }, req.ip || req.socket.remoteAddress);

      res.json({ ...track, url: `/api/music/file/${track.filename}` });
    } catch (err) { next(err); }
  });

  // Admin: list all tracks (platform + all users)
  app.get("/api/admin/music", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const tracks = await db.select({
        id: musicTracks.id, title: musicTracks.title, artist: musicTracks.artist,
        filename: musicTracks.filename, originalName: musicTracks.originalName,
        isAdmin: musicTracks.isAdmin, uploadedBy: musicTracks.uploadedBy,
        createdAt: musicTracks.createdAt,
        username: users.username,
      }).from(musicTracks)
        .leftJoin(users, sql`${users.id} = ${musicTracks.uploadedBy}`)
        .orderBy(sql`${musicTracks.isAdmin} DESC, ${musicTracks.createdAt} DESC`);
      res.json(tracks.map(t => ({ ...t, url: `/api/music/file/${t.filename}` })));
    } catch (err) { next(err); }
  });

  // Admin: delete any track
  app.delete("/api/admin/music/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.status(500).json({ message: "Database required" });
      const db = getDb();
      const [track] = await db.select().from(musicTracks).where(sql`${musicTracks.id} = ${req.params.id}`).limit(1);
      if (!track) return res.status(404).json({ message: "Track not found" });

      const filePath = path.join(MUSIC_UPLOAD_DIR, track.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await db.delete(musicTracks).where(sql`${musicTracks.id} = ${req.params.id}`);
      await logAdminAction(req.user!.id, "music_delete", "music", track.id,
        { title: track.title }, req.ip || req.socket.remoteAddress);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // ─── Card Encryption Verification ───────────────────────────────────────

  const cardEncryption = await import("./game/card-encryption");

  // Player can verify their own session key commitment
  app.get("/api/encryption/verify", requireAuth, async (req, res) => {
    const result = cardEncryption.verifySessionCommitment(req.user!.id);
    if (!result.found) return res.json({ verified: false, message: "No active session commitment" });

    const explorerUrl = result.batch?.txHash
      ? `https://${blockchainConfig.chainId === 137 ? "" : "amoy."}polygonscan.com/tx/${result.batch.txHash}`
      : null;

    res.json({
      verified: true,
      commitment: result.commitment,
      anchored: !!result.batch,
      batch: result.batch ? {
        merkleRoot: result.batch.merkleRoot,
        txHash: result.batch.txHash,
        explorerUrl,
        anchoredAt: new Date(result.batch.anchoredAt).toISOString(),
      } : null,
      merkleProof: result.merkleProof || null,
    });
  });

  // Admin: encryption stats
  app.get("/api/admin/encryption/stats", requireAuth, requireAdmin, async (_req, res) => {
    res.json(cardEncryption.getEncryptionStats());
  });

  // Admin: force anchor pending commitments now
  app.post("/api/admin/encryption/anchor", requireAuth, requireAdmin, async (req, res) => {
    const result = await cardEncryption.forceAnchor();
    if (!result) return res.json({ message: "No pending commitments to anchor" });
    await logAdminAction(req.user!.id, "force_anchor", "system", null,
      { merkleRoot: result.merkleRoot, txHash: result.txHash, count: result.count },
      req.ip || req.socket.remoteAddress);
    res.json(result);
  });

  // ─── Blockchain Dashboard Data ──────────────────────────────────────────

  // Aggregated blockchain stats for dashboard
  app.get("/api/admin/blockchain/stats", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      if (!hasDatabase()) return res.json({ kycVerified: 0, kycOnChain: 0, handsTotal: 0, handsOnChain: 0, paymentsTx: 0, vrfHands: 0 });
      const db = getDb();
      const [kycStats] = await db.select({
        verified: sql<number>`count(*) filter (where ${users.kycStatus} = 'verified')`,
        onChain: sql<number>`count(*) filter (where ${users.kycBlockchainTxHash} is not null)`,
      }).from(users);
      const [handStats] = await db.select({
        total: sql<number>`count(*)`,
        onChain: sql<number>`count(*) filter (where ${gameHands.onChainCommitTx} is not null or ${gameHands.onChainRevealTx} is not null)`,
        vrf: sql<number>`count(*) filter (where ${gameHands.vrfRequestId} is not null)`,
      }).from(gameHands);
      const [payStats] = await db.select({
        withTx: sql<number>`count(*) filter (where ${payments.txHash} is not null)`,
      }).from(payments);

      res.json({
        kycVerified: Number(kycStats.verified),
        kycOnChain: Number(kycStats.onChain),
        handsTotal: Number(handStats.total),
        handsOnChain: Number(handStats.onChain),
        vrfHands: Number(handStats.vrf),
        paymentsTx: Number(payStats.withTx),
        encryption: cardEncryption.getEncryptionStats(),
        blockchainEnabled: blockchainConfig.enabled,
        chainId: blockchainConfig.chainId,
        rpcConfigured: !!blockchainConfig.rpcUrl,
        contractConfigured: !!blockchainConfig.handVerifierAddress,
      });
    } catch (err) { next(err); }
  });

  // KYC blockchain records — all verified users with on-chain hashes
  app.get("/api/admin/blockchain/kyc", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const search = req.query.search as string | undefined;
      const onChainOnly = req.query.onChainOnly === "true";

      const conds: ReturnType<typeof sql>[] = [sql`${users.kycStatus} = 'verified'`];
      if (onChainOnly) conds.push(sql`${users.kycBlockchainTxHash} is not null`);
      if (search) conds.push(sql`(${users.username} ILIKE ${"%" + search + "%"} OR ${users.memberId} ILIKE ${"%" + search + "%"} OR ${users.kycBlockchainTxHash} ILIKE ${"%" + search + "%"})`);

      const where = conds.reduce((a, b) => sql`${a} AND ${b}`);
      const rows = await db.select({
        id: users.id, username: users.username, displayName: users.displayName,
        memberId: users.memberId, kycStatus: users.kycStatus,
        kycVerifiedAt: users.kycVerifiedAt, kycBlockchainTxHash: users.kycBlockchainTxHash,
        tier: users.tier, createdAt: users.createdAt,
      }).from(users).where(where).orderBy(sql`${users.kycVerifiedAt} DESC`).limit(100);
      res.json(rows);
    } catch (err) { next(err); }
  });

  // Recent on-chain hand activity
  app.get("/api/admin/blockchain/hands", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const onChainOnly = req.query.onChainOnly !== "false"; // default true
      const search = req.query.search as string | undefined;

      const conds: ReturnType<typeof sql>[] = [];
      if (onChainOnly) conds.push(sql`(${gameHands.onChainCommitTx} is not null or ${gameHands.onChainRevealTx} is not null or ${gameHands.vrfRequestId} is not null)`);
      if (search) conds.push(sql`(${gameHands.commitmentHash} ILIKE ${"%" + search + "%"} OR ${gameHands.onChainCommitTx} ILIKE ${"%" + search + "%"} OR ${gameHands.onChainRevealTx} ILIKE ${"%" + search + "%"} OR ${gameHands.id} ILIKE ${"%" + search + "%"})`);

      const where = conds.length > 0 ? conds.reduce((a, b) => sql`${a} AND ${b}`) : sql`1=1`;

      const rows = await db.select({
        id: gameHands.id, tableId: gameHands.tableId, handNumber: gameHands.handNumber,
        potTotal: gameHands.potTotal, totalRake: gameHands.totalRake,
        commitmentHash: gameHands.commitmentHash, vrfRequestId: gameHands.vrfRequestId,
        onChainCommitTx: gameHands.onChainCommitTx, onChainRevealTx: gameHands.onChainRevealTx,
        createdAt: gameHands.createdAt, tableName: tables.name,
      }).from(gameHands)
        .leftJoin(tables, sql`${tables.id} = ${gameHands.tableId}`)
        .where(where)
        .orderBy(sql`${gameHands.createdAt} DESC`)
        .limit(limit);
      res.json(rows);
    } catch (err) { next(err); }
  });

  // ─── Bot Detection Analysis ────────────────────────────────────────────────

  app.get("/api/admin/bot-detection/:userId", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json({ error: "Database required" });
      const db = getDb();
      const { handActions: handActionsTable } = await import("@shared/schema");
      const { analyzePlayerTiming } = await import("./game/bot-detection");

      // Get last 200 actions for the player
      const actions = await db.select({
        actionType: handActionsTable.actionType,
        timeSpent: handActionsTable.timeSpent,
        street: handActionsTable.street,
      }).from(handActionsTable)
        .where(sql`${handActionsTable.playerId} = ${req.params.userId}`)
        .orderBy(sql`${handActionsTable.sequenceNum} DESC`)
        .limit(200);

      const timings = actions
        .filter(a => a.timeSpent !== null && a.timeSpent > 0)
        .map(a => ({
          actionType: a.actionType,
          timeSpentMs: a.timeSpent!,
          street: a.street,
        }));

      const result = analyzePlayerTiming(req.params.userId, timings);
      res.json(result);
    } catch (err) { next(err); }
  });

  // Scan all active players for bot patterns
  app.get("/api/admin/bot-detection/scan/all", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const { handActions: handActionsTable } = await import("@shared/schema");
      const { analyzePlayerTiming } = await import("./game/bot-detection");

      // Get distinct players with recent activity (last 24h)
      const recentPlayers = await db.select({
        playerId: handActionsTable.playerId,
      }).from(handActionsTable)
        .where(sql`${handActionsTable.timeSpent} is not null`)
        .groupBy(handActionsTable.playerId)
        .having(sql`count(*) >= 10`)
        .limit(50);

      const results = [];
      for (const { playerId } of recentPlayers) {
        if (!playerId || playerId.startsWith("bot-")) continue; // skip known bots

        const actions = await db.select({
          actionType: handActionsTable.actionType,
          timeSpent: handActionsTable.timeSpent,
          street: handActionsTable.street,
        }).from(handActionsTable)
          .where(sql`${handActionsTable.playerId} = ${playerId} AND ${handActionsTable.timeSpent} > 0`)
          .orderBy(sql`${handActionsTable.sequenceNum} DESC`)
          .limit(200);

        const timings = actions.filter(a => a.timeSpent !== null).map(a => ({
          actionType: a.actionType,
          timeSpentMs: a.timeSpent!,
          street: a.street,
        }));

        const result = analyzePlayerTiming(playerId, timings);
        if (result.riskScore > 0) results.push(result);
      }

      // Sort by risk score descending
      results.sort((a, b) => b.riskScore - a.riskScore);
      res.json(results);
    } catch (err) { next(err); }
  });

  // ─── IP Rules Management ────────────────────────────────────────────────

  const { ipRules: ipRulesTable, accountActions: accountActionsTable, botActionQueue: botActionQueueTable, platformSettings: platformSettingsTable, deviceFingerprints: deviceFingerprintsTable } = await import("@shared/schema");
  const securityEngine = await import("./middleware/security-engine");
  const adminBot = await import("./admin-bot");

  // Refresh IP rules cache on startup
  if (hasDatabase()) securityEngine.refreshIpRules(getDb(), ipRulesTable, sql);

  app.get("/api/admin/ip-rules", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const rules = await db.select().from(ipRulesTable).orderBy(sql`${ipRulesTable.createdAt} DESC`).limit(200);
      res.json(rules);
    } catch (err) { next(err); }
  });

  app.post("/api/admin/ip-rules", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.status(500).json({ message: "Database required" });
      const db = getDb();
      const { ip, type, reason, expiresAt } = req.body;
      if (!ip || !type || !["ban", "allow"].includes(type)) return res.status(400).json({ message: "ip and type (ban|allow) required" });

      const [rule] = await db.insert(ipRulesTable).values({
        ip, type, reason: reason || null, createdBy: req.user!.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }).returning();

      await securityEngine.refreshIpRules(db, ipRulesTable, sql);
      await logAdminAction(req.user!.id, `ip_${type}`, "ip", ip, { reason }, req.ip || req.socket.remoteAddress);
      res.json(rule);
    } catch (err) { next(err); }
  });

  app.delete("/api/admin/ip-rules/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.status(500).json({ message: "Database required" });
      const db = getDb();
      await db.delete(ipRulesTable).where(sql`${ipRulesTable.id} = ${req.params.id}`);
      await securityEngine.refreshIpRules(db, ipRulesTable, sql);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // IP Geo lookup (admin tool)
  app.get("/api/admin/ip-lookup/:ip", requireAuth, requireAdmin, async (req, res) => {
    const geo = await securityEngine.getIpGeoInfo(req.params.ip);
    const isTor = securityEngine.isTorExitNode(req.params.ip);
    const ipCheck = securityEngine.checkIpRules(req.params.ip);
    res.json({ geo, isTor, ipRules: ipCheck });
  });

  // ─── Platform Settings ────────────────────────────────────────────────────

  app.get("/api/admin/platform-settings", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      if (!hasDatabase()) return res.json(securityEngine.DEFAULT_PLATFORM_SETTINGS);
      const db = getDb();
      const settings = await db.select().from(platformSettingsTable);
      const result = { ...securityEngine.DEFAULT_PLATFORM_SETTINGS };
      for (const s of settings) (result as any)[s.key] = s.value;
      res.json(result);
    } catch (err) { next(err); }
  });

  app.put("/api/admin/platform-settings", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.status(500).json({ message: "Database required" });
      const db = getDb();
      const { key, value } = req.body;
      if (!key) return res.status(400).json({ message: "key required" });

      await db.insert(platformSettingsTable).values({ key, value, updatedBy: req.user!.id })
        .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value, updatedBy: req.user!.id, updatedAt: new Date() } });

      // Update cache
      securityEngine.updatePlatformSettingsCache([{ key, value }]);
      await logAdminAction(req.user!.id, "platform_setting", "system", key, { value }, req.ip || req.socket.remoteAddress);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // ─── Force Logout ─────────────────────────────────────────────────────────

  app.post("/api/admin/force-logout/:userId", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { reason } = req.body;
      const clients = getClients();
      const client = clients.get(req.params.userId);
      if (client) {
        (client as any).ws?.close(1008, reason || "Session terminated by admin");
      }
      // Log it
      if (hasDatabase()) {
        const db = getDb();
        await db.insert(accountActionsTable).values({
          userId: req.params.userId, action: "session_kill", severity: "warning",
          message: reason || "Session terminated by administrator", automated: false,
        });
      }
      await logAdminAction(req.user!.id, "force_logout", "user", req.params.userId, { reason }, req.ip || req.socket.remoteAddress);
      res.json({ success: true, wasConnected: !!client });
    } catch (err) { next(err); }
  });

  // ─── Device Fingerprints ──────────────────────────────────────────────────

  // Client submits fingerprint on connect
  app.post("/api/device-fingerprint", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json({ ok: true });
      const db = getDb();
      const { fingerprint, screenRes, userAgent } = req.body;
      if (!fingerprint) return res.status(400).json({ message: "fingerprint required" });

      const ip = req.ip || req.socket.remoteAddress || "";

      // Upsert fingerprint record
      const existing = await db.select().from(deviceFingerprintsTable)
        .where(sql`${deviceFingerprintsTable.userId} = ${req.user!.id} AND ${deviceFingerprintsTable.fingerprint} = ${fingerprint}`)
        .limit(1);

      if (existing.length > 0) {
        await db.update(deviceFingerprintsTable)
          .set({ lastSeen: new Date(), ipAddress: ip })
          .where(sql`${deviceFingerprintsTable.id} = ${existing[0].id}`);
      } else {
        await db.insert(deviceFingerprintsTable).values({
          userId: req.user!.id, fingerprint, userAgent: userAgent || null,
          screenRes: screenRes || null, ipAddress: ip,
        });
      }

      // Check for multi-account matches
      const allFps = await db.select({
        userId: deviceFingerprintsTable.userId,
        fingerprint: deviceFingerprintsTable.fingerprint,
        ipAddress: deviceFingerprintsTable.ipAddress,
      }).from(deviceFingerprintsTable)
        .where(sql`${deviceFingerprintsTable.userId} != ${req.user!.id}`)
        .limit(500);

      const matches = securityEngine.detectMultiAccounts(req.user!.id, fingerprint, ip, allFps as any[]);
      const sameDevice = matches.filter(m => m.matchType === "same_device");

      if (sameDevice.length > 0) {
        // Flag but don't block
        await db.insert(accountActionsTable).values({
          userId: req.user!.id, action: "multi_account_flag", severity: "warning",
          message: `Device shared with ${sameDevice.length} other account(s)`,
          automated: true, details: { matchedUsers: sameDevice.map(m => m.matchedUserId.slice(0, 8)) },
        });
      }

      res.json({ ok: true, matches: matches.length });
    } catch (err) { next(err); }
  });

  // Admin: view multi-account flags
  app.get("/api/admin/multi-accounts", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const flags = await db.select({
        fingerprint: deviceFingerprintsTable.fingerprint,
        count: sql<number>`count(distinct ${deviceFingerprintsTable.userId})`,
      }).from(deviceFingerprintsTable)
        .groupBy(deviceFingerprintsTable.fingerprint)
        .having(sql`count(distinct ${deviceFingerprintsTable.userId}) > 1`)
        .orderBy(sql`count(distinct ${deviceFingerprintsTable.userId}) DESC`)
        .limit(50);

      const results = [];
      for (const flag of flags) {
        const accounts = await db.select({
          userId: deviceFingerprintsTable.userId,
          ipAddress: deviceFingerprintsTable.ipAddress,
          lastSeen: deviceFingerprintsTable.lastSeen,
          username: users.username,
        }).from(deviceFingerprintsTable)
          .leftJoin(users, sql`${users.id} = ${deviceFingerprintsTable.userId}`)
          .where(sql`${deviceFingerprintsTable.fingerprint} = ${flag.fingerprint}`);
        results.push({ fingerprint: flag.fingerprint.slice(0, 16) + "...", accountCount: Number(flag.count), accounts });
      }
      res.json(results);
    } catch (err) { next(err); }
  });

  // ─── HITL Bot Action Queue ────────────────────────────────────────────────

  app.get("/api/admin/hitl/queue", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const statusFilter = req.query.status as string || "pending";
      const typeFilter = req.query.type as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      const conds: ReturnType<typeof sql>[] = [];
      if (statusFilter !== "all") conds.push(sql`${botActionQueueTable.status} = ${statusFilter}`);
      if (typeFilter) conds.push(sql`${botActionQueueTable.type} = ${typeFilter}`);
      const where = conds.length > 0 ? conds.reduce((a, b) => sql`${a} AND ${b}`) : sql`1=1`;

      const items = await db.select().from(botActionQueueTable).where(where)
        .orderBy(sql`${botActionQueueTable.createdAt} DESC`).limit(limit);
      res.json(items);
    } catch (err) { next(err); }
  });

  app.post("/api/admin/hitl/:id/review", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.status(500).json({ message: "Database required" });
      const db = getDb();
      const { status } = req.body; // actioned | dismissed
      if (!status || !["actioned", "dismissed", "reviewed"].includes(status)) return res.status(400).json({ message: "Invalid status" });

      await db.update(botActionQueueTable)
        .set({ status, reviewedBy: req.user!.id, reviewedAt: new Date() })
        .where(sql`${botActionQueueTable.id} = ${req.params.id}`);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  app.get("/api/admin/hitl/stats", requireAuth, requireAdmin, async (_req, res) => {
    const botStats = adminBot.getBotStats();
    if (!hasDatabase()) return res.json({ bot: botStats, queue: { pending: 0, autoActions: 0, recommendations: 0, insights: 0 } });
    const db = getDb();
    const [counts] = await db.select({
      pending: sql<number>`count(*) filter (where ${botActionQueueTable.status} = 'pending')`,
      autoActions: sql<number>`count(*) filter (where ${botActionQueueTable.type} = 'auto_action')`,
      recommendations: sql<number>`count(*) filter (where ${botActionQueueTable.type} = 'recommendation')`,
      insights: sql<number>`count(*) filter (where ${botActionQueueTable.type} = 'insight')`,
    }).from(botActionQueueTable);
    res.json({
      bot: botStats,
      queue: { pending: Number(counts.pending), autoActions: Number(counts.autoActions), recommendations: Number(counts.recommendations), insights: Number(counts.insights) },
    });
  });

  // ─── Player Account Actions (visible to player) ──────────────────────────

  app.get("/api/account/actions", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const actions = await db.select().from(accountActionsTable)
        .where(sql`${accountActionsTable.userId} = ${req.user!.id}`)
        .orderBy(sql`${accountActionsTable.createdAt} DESC`)
        .limit(limit);
      res.json(actions);
    } catch (err) { next(err); }
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

  app.post("/api/support/contact", async (req, res) => {
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

    // Persist to database if available — create a support ticket + first message
    if (hasDatabase()) {
      try {
        const db = getDb();
        const { supportTickets, ticketMessages } = await import("@shared/schema");
        // Contact form may not have a userId — use a placeholder system user
        const [ticket] = await db.insert(supportTickets).values({
          userId: "system", // system placeholder for unauthenticated contacts
          subject: `[Contact] ${entry.subject}`,
          category: "other",
          priority: "medium",
          status: "open",
        }).returning();
        if (ticket) {
          await db.insert(ticketMessages).values({
            ticketId: ticket.id,
            userId: "system",
            message: `From: ${entry.name} (${entry.email})\n\n${entry.message}`,
            isStaff: false,
          });
        }
      } catch {}
    }

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

  // ─── Onfido SDK Integration (Professional KYC) ──────────────────────────
  // Creates an Onfido applicant + SDK token for the client-side verification flow.
  // Onfido handles: ID capture, liveness detection, face matching, document authenticity.
  // We NEVER see or store the actual ID documents — they live on Onfido's infrastructure.

  app.post("/api/kyc/onfido/start", requireAuth, requireTier("gold"), async (req, res, next) => {
    try {
      const onfidoApiToken = process.env.ONFIDO_API_TOKEN;
      if (!onfidoApiToken) {
        // Fallback to manual KYC mode if Onfido not configured
        return res.json({ mode: "manual", message: "Use the manual KYC form" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.kycStatus === "verified") return res.status(400).json({ message: "Already verified" });
      if (user.kycStatus === "pending") return res.status(400).json({ message: "Verification already in progress" });

      const { fullName, dateOfBirth } = req.body;
      const onfidoBaseUrl = process.env.ONFIDO_REGION === "eu" ? "https://api.eu.onfido.com/v3.6" : "https://api.us.onfido.com/v3.6";

      // Step 1: Create applicant on Onfido
      const nameParts = (fullName || user.displayName || "User").split(" ");
      const applicantRes = await fetch(`${onfidoBaseUrl}/applicants`, {
        method: "POST",
        headers: { "Authorization": `Token token=${onfidoApiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: nameParts[0] || "User",
          last_name: nameParts.slice(1).join(" ") || "Unknown",
          email: user.email || undefined,
          dob: dateOfBirth || undefined,
        }),
      });
      if (!applicantRes.ok) {
        const err = await applicantRes.json();
        return res.status(500).json({ message: "Failed to create Onfido applicant", error: err });
      }
      const applicant = await applicantRes.json();

      // Step 2: Generate SDK token for client-side verification
      const tokenRes = await fetch(`${onfidoBaseUrl}/sdk_token`, {
        method: "POST",
        headers: { "Authorization": `Token token=${onfidoApiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          applicant_id: applicant.id,
          referrer: process.env.ONFIDO_REFERRER || "*://*/*",
        }),
      });
      if (!tokenRes.ok) {
        return res.status(500).json({ message: "Failed to generate SDK token" });
      }
      const tokenData = await tokenRes.json();

      // Step 3: Store applicant ID on the user for webhook matching
      await storage.updateUser(user.id, {
        kycStatus: "pending",
        kycData: {
          ...(user.kycData as any || {}),
          fullName: fullName || user.displayName,
          dateOfBirth,
          providerApplicantId: applicant.id,
          provider: "onfido",
          submittedAt: new Date().toISOString(),
        },
      });

      res.json({
        mode: "onfido",
        sdkToken: tokenData.token,
        applicantId: applicant.id,
      });
    } catch (err) { next(err); }
  });

  // Onfido check creation — called after client-side SDK completes
  app.post("/api/kyc/onfido/check", requireAuth, async (req, res, next) => {
    try {
      const onfidoApiToken = process.env.ONFIDO_API_TOKEN;
      if (!onfidoApiToken) return res.status(400).json({ message: "Onfido not configured" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const kycData = user.kycData as any;
      if (!kycData?.providerApplicantId) return res.status(400).json({ message: "No Onfido applicant found" });

      const onfidoBaseUrl = process.env.ONFIDO_REGION === "eu" ? "https://api.eu.onfido.com/v3.6" : "https://api.us.onfido.com/v3.6";

      // Create a check (triggers Onfido's AI verification)
      const checkRes = await fetch(`${onfidoBaseUrl}/checks`, {
        method: "POST",
        headers: { "Authorization": `Token token=${onfidoApiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          applicant_id: kycData.providerApplicantId,
          report_names: ["document", "facial_similarity_photo"],
        }),
      });
      if (!checkRes.ok) {
        const err = await checkRes.json();
        return res.status(500).json({ message: "Failed to create check", error: err });
      }
      const check = await checkRes.json();

      // Update KYC data with check ID
      await storage.updateUser(user.id, {
        kycData: { ...kycData, checkId: check.id, checkStatus: "in_progress" },
      });

      // Result will arrive via webhook (POST /api/webhooks/kyc-verification)
      res.json({ checkId: check.id, status: "processing", message: "Verification in progress. You'll be notified when complete." });
    } catch (err) { next(err); }
  });

  // Manual KYC submit (fallback when Onfido is not configured)
  app.post("/api/kyc/submit", requireAuth, requireTier("gold"), kycUpload.fields([
    { name: "idDocument", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
  ]), async (req, res, next) => {
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

      // Extract uploaded file paths
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const idDocumentPath = files?.idDocument?.[0]?.filename || null;
      const selfiePath = files?.selfie?.[0]?.filename || null;

      const kycData = {
        fullName, dateOfBirth, country, idType,
        submittedAt: new Date().toISOString(),
        idDocumentPath,
        selfiePath,
      };
      const updated = await storage.updateUser(user.id, {
        kycStatus: "pending",
        kycData,
        kycRejectionReason: null,
      });

      // Send confirmation email
      if (user.email) {
        sendKycEmail(user.email, "KYC Application Received - HighRollers Club",
          `<h2>KYC Application Received</h2>
           <p>Hi ${fullName},</p>
           <p>We've received your identity verification application. Our team will review your documents and get back to you within 24-48 hours.</p>
           <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
           <p><strong>ID Type:</strong> ${idType}</p>
           <p>You'll receive an email when your verification status is updated.</p>
           <br/><p style="color:#888;">— HighRollers Club Team</p>`
        );
      }

      res.json(updated);
    } catch (err) { next(err); }
  });

  // Serve KYC document files to admins only
  app.get("/api/admin/kyc/document/:filename", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const filename = path.basename(req.params.filename); // prevent path traversal
      const filePath = path.join(KYC_UPLOAD_DIR, filename);
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });
      res.sendFile(filePath);
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

      // Audit log
      await logAdminAction(req.user!.id, "kyc_approve", "user", user.id,
        { username: user.username, kycData: user.kycData },
        req.ip || req.socket.remoteAddress
      );

      // Email notification
      if (user.email) {
        sendKycEmail(user.email, "KYC Verified - HighRollers Club",
          `<h2>Identity Verified!</h2>
           <p>Congratulations! Your identity has been successfully verified.</p>
           <p>You now have access to all verified member features, including on-chain identity recording and higher withdrawal limits.</p>
           <br/><p style="color:#888;">— HighRollers Club Team</p>`
        );
      }

      // In-app notification
      await storage.createNotification(user.id, "kyc_status", "KYC Approved",
        "Your identity verification has been approved!", { status: "verified" });

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
      const rejectReason = reason || "Application rejected";
      const updated = await storage.updateUser(user.id, {
        kycStatus: "rejected",
        kycRejectionReason: rejectReason,
      });

      // Audit log
      await logAdminAction(req.user!.id, "kyc_reject", "user", user.id,
        { username: user.username, reason: rejectReason },
        req.ip || req.socket.remoteAddress
      );

      // Email notification
      if (user.email) {
        sendKycEmail(user.email, "KYC Update - HighRollers Club",
          `<h2>Identity Verification Update</h2>
           <p>Unfortunately, your identity verification application was not approved.</p>
           <p><strong>Reason:</strong> ${rejectReason}</p>
           <p>You may resubmit your application with corrected documents at any time.</p>
           <br/><p style="color:#888;">— HighRollers Club Team</p>`
        );
      }

      // In-app notification
      await storage.createNotification(user.id, "kyc_status", "KYC Update",
        `Your verification was not approved: ${rejectReason}`, { status: "rejected", reason: rejectReason });

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

      let txHash: string;
      let onChain = false;

      if (blockchainConfig.enabled && blockchainConfig.handVerifierAddress && blockchainConfig.walletPrivateKey) {
        // Real on-chain recording via Polygon
        try {
          const { ethers } = await import("ethers");
          const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
          const signer = new ethers.Wallet(blockchainConfig.walletPrivateKey, provider);

          // Create a commitment hash of the KYC verification
          const kycHash = ethers.keccak256(ethers.toUtf8Bytes(
            JSON.stringify({ userId: user.id, memberId: user.memberId, kycData: user.kycData, verifiedAt: user.kycVerifiedAt })
          ));

          // Send a simple transaction with the KYC hash as data
          const tx = await signer.sendTransaction({
            to: blockchainConfig.handVerifierAddress,
            data: kycHash,
            value: 0,
          });
          const receipt = await tx.wait();
          txHash = receipt?.hash || tx.hash;
          onChain = true;
        } catch (chainErr: any) {
          console.warn("On-chain KYC recording failed, falling back to hash:", chainErr.message);
          // Fallback to local hash if chain call fails
          txHash = "0x" + createHash("sha256")
            .update(user.id + JSON.stringify(user.kycData) + Date.now().toString())
            .digest("hex");
        }
      } else {
        // Local hash when blockchain is not configured
        txHash = "0x" + createHash("sha256")
          .update(user.id + JSON.stringify(user.kycData) + Date.now().toString())
          .digest("hex");
      }

      await storage.updateUser(user.id, { kycBlockchainTxHash: txHash });
      res.json({ txHash, onChain, message: onChain ? "KYC recorded on Polygon" : "KYC hash recorded locally (blockchain not configured)" });
    } catch (err) { next(err); }
  });

  // ─── Ledger Routes ──────────────────────────────────────────────────────────

  const { tableSessions, tableLedgerEntries } = await import("@shared/schema");
  const { calculateSettlements, summarizeSessions } = await import("./game/ledger");

  // Player: my sessions at a specific table
  app.get("/api/tables/:id/my-ledger", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const sessions = await db.select().from(tableSessions)
        .where(sql`${tableSessions.tableId} = ${req.params.id} AND ${tableSessions.userId} = ${req.user!.id}`)
        .orderBy(sql`${tableSessions.startedAt} DESC`).limit(50);
      res.json(sessions);
    } catch (err) { next(err); }
  });

  // Player: all my sessions across all tables
  app.get("/api/ledger/my-history", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const sessions = await db.select({
        id: tableSessions.id, tableId: tableSessions.tableId,
        buyInTotal: tableSessions.buyInTotal, cashOutTotal: tableSessions.cashOutTotal,
        netResult: tableSessions.netResult, handsPlayed: tableSessions.handsPlayed,
        startedAt: tableSessions.startedAt, endedAt: tableSessions.endedAt,
        settled: tableSessions.settled, tableName: tables.name,
      }).from(tableSessions)
        .leftJoin(tables, sql`${tables.id} = ${tableSessions.tableId}`)
        .where(sql`${tableSessions.userId} = ${req.user!.id} AND ${tableSessions.endedAt} IS NOT NULL`)
        .orderBy(sql`${tableSessions.startedAt} DESC`).limit(100);
      res.json(sessions);
    } catch (err) { next(err); }
  });

  // Club owner/table creator: full table ledger
  app.get("/api/tables/:id/ledger", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json({ sessions: [], summary: null });
      const db = getDb();
      // Verify user is table creator or admin
      const table = await storage.getTable(req.params.id);
      if (!table) return res.status(404).json({ message: "Table not found" });
      const isOwner = String(table.createdById) === String(req.user!.id);
      const isAdmin = req.user!.role === "admin";
      // Club owners can also view
      let isClubOwner = false;
      if (table.clubId) {
        const club = await storage.getClub(table.clubId);
        if (club && String(club.ownerId) === String(req.user!.id)) isClubOwner = true;
      }
      if (!isOwner && !isAdmin && !isClubOwner) return res.status(403).json({ message: "Only table creator or club owner can view the ledger" });

      const sessions = await db.select().from(tableSessions)
        .where(sql`${tableSessions.tableId} = ${req.params.id} AND ${tableSessions.endedAt} IS NOT NULL`)
        .orderBy(sql`${tableSessions.startedAt} DESC`).limit(200);

      const summary = summarizeSessions(sessions as any[]);
      res.json({ sessions, summary });
    } catch (err) { next(err); }
  });

  // Settlement calculation for a table
  app.get("/api/tables/:id/ledger/settlement", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json({ settlements: [] });
      const db = getDb();
      const sessions = await db.select().from(tableSessions)
        .where(sql`${tableSessions.tableId} = ${req.params.id} AND ${tableSessions.endedAt} IS NOT NULL AND ${tableSessions.settled} = false`)
        .orderBy(sql`${tableSessions.startedAt} DESC`);
      const summary = summarizeSessions(sessions as any[]);
      res.json(summary);
    } catch (err) { next(err); }
  });

  // Mark sessions as settled
  app.post("/api/tables/:id/ledger/settle", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.status(500).json({ message: "Database required" });
      const db = getDb();
      const table = await storage.getTable(req.params.id);
      if (!table) return res.status(404).json({ message: "Table not found" });

      // Only table creator, club owner, or admin can settle
      const isOwner = String(table.createdById) === String(req.user!.id);
      const isAdmin = req.user!.role === "admin";
      if (!isOwner && !isAdmin) return res.status(403).json({ message: "Only table creator or admin can settle" });

      // Get unsettled sessions and create a ledger entry
      const sessions = await db.select().from(tableSessions)
        .where(sql`${tableSessions.tableId} = ${req.params.id} AND ${tableSessions.endedAt} IS NOT NULL AND ${tableSessions.settled} = false`);
      if (sessions.length === 0) return res.json({ message: "No unsettled sessions" });

      const summary = summarizeSessions(sessions as any[]);

      // Create settlement hash — immutable proof of the payout
      const settlementData = JSON.stringify({
        tableId: req.params.id,
        clubId: table.clubId,
        settledBy: req.user!.id,
        settledAt: new Date().toISOString(),
        results: summary.results,
        settlements: summary.settlements,
        totalRake: summary.totalRake,
        totalPot: summary.totalPot,
        playerCount: summary.playerCount,
      });
      const settlementHash = createHash("sha256").update(settlementData).digest("hex");

      // Anchor settlement hash to Polygon blockchain
      let settlementTxHash: string | null = null;
      if (blockchainConfig.enabled && blockchainConfig.walletPrivateKey && blockchainConfig.rpcUrl) {
        try {
          const { ethers } = await import("ethers");
          const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
          const signer = new ethers.Wallet(blockchainConfig.walletPrivateKey, provider);
          // Self-send transaction with settlement hash as calldata
          const tx = await signer.sendTransaction({
            to: signer.address,
            value: 0,
            data: "0x" + settlementHash,
          });
          const receipt = await tx.wait();
          settlementTxHash = receipt?.hash || tx.hash;
          console.log(`[Ledger] Settlement anchored to Polygon: ${settlementTxHash}`);
        } catch (chainErr: any) {
          console.warn(`[Ledger] Blockchain anchor failed: ${chainErr.message}`);
        }
      }

      // Create ledger entry with blockchain proof
      const [ledgerEntry] = await db.insert(tableLedgerEntries).values({
        tableId: req.params.id,
        clubId: table.clubId || null,
        sessionDate: new Date(),
        entries: summary.results,
        settlements: summary.settlements,
        totalRake: summary.totalRake,
        totalPot: summary.totalPot,
        playerCount: summary.playerCount,
        handsPlayed: summary.handsPlayed,
        settledBy: req.user!.id,
        settledAt: new Date(),
        notes: req.body.notes || null,
        settlementHash,
        settlementTxHash,
      }).returning();

      // Mark all sessions as settled
      await db.update(tableSessions)
        .set({ settled: true })
        .where(sql`${tableSessions.tableId} = ${req.params.id} AND ${tableSessions.endedAt} IS NOT NULL AND ${tableSessions.settled} = false`);

      // Log the settlement action
      await logAdminAction(req.user!.id, "ledger_settle", "table", req.params.id,
        { settlementHash, settlementTxHash, playerCount: summary.playerCount, totalPot: summary.totalPot },
        req.ip || req.socket.remoteAddress);

      res.json({
        settled: sessions.length,
        summary,
        settlementHash,
        settlementTxHash,
        explorerUrl: settlementTxHash ? `https://amoy.polygonscan.com/tx/${settlementTxHash}` : null,
      });
    } catch (err) { next(err); }
  });

  // Verify a settlement on-chain
  app.get("/api/ledger/:id/verify", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.status(500).json({ message: "Database required" });
      const db = getDb();
      const [entry] = await db.select().from(tableLedgerEntries).where(sql`${tableLedgerEntries.id} = ${req.params.id}`).limit(1);
      if (!entry) return res.status(404).json({ message: "Ledger entry not found" });

      // Reconstruct the hash from stored data to verify integrity
      const reconstructedData = JSON.stringify({
        tableId: entry.tableId,
        clubId: entry.clubId,
        settledBy: entry.settledBy,
        settledAt: entry.settledAt?.toISOString(),
        results: entry.entries,
        settlements: entry.settlements,
        totalRake: entry.totalRake,
        totalPot: entry.totalPot,
        playerCount: entry.playerCount,
      });
      const reconstructedHash = createHash("sha256").update(reconstructedData).digest("hex");
      const hashMatches = reconstructedHash === (entry as any).settlementHash;

      res.json({
        ledgerEntry: {
          id: entry.id,
          tableId: entry.tableId,
          sessionDate: entry.sessionDate,
          playerCount: entry.playerCount,
          totalPot: entry.totalPot,
          totalRake: entry.totalRake,
          settledAt: entry.settledAt,
          entries: entry.entries,
          settlements: entry.settlements,
        },
        verification: {
          settlementHash: (entry as any).settlementHash,
          settlementTxHash: (entry as any).settlementTxHash,
          hashIntegrity: hashMatches ? "VALID" : "TAMPERED",
          explorerUrl: (entry as any).settlementTxHash ? `https://amoy.polygonscan.com/tx/${(entry as any).settlementTxHash}` : null,
          onChain: !!(entry as any).settlementTxHash,
        },
      });
    } catch (err) { next(err); }
  });

  // Club-wide ledger
  app.get("/api/clubs/:id/ledger", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const entries = await db.select({
        id: tableLedgerEntries.id, tableId: tableLedgerEntries.tableId,
        sessionDate: tableLedgerEntries.sessionDate, entries: tableLedgerEntries.entries,
        settlements: tableLedgerEntries.settlements, totalRake: tableLedgerEntries.totalRake,
        totalPot: tableLedgerEntries.totalPot, playerCount: tableLedgerEntries.playerCount,
        settledAt: tableLedgerEntries.settledAt, notes: tableLedgerEntries.notes,
        tableName: tables.name,
      }).from(tableLedgerEntries)
        .leftJoin(tables, sql`${tables.id} = ${tableLedgerEntries.tableId}`)
        .where(sql`${tableLedgerEntries.clubId} = ${req.params.id}`)
        .orderBy(sql`${tableLedgerEntries.sessionDate} DESC`).limit(100);
      res.json(entries);
    } catch (err) { next(err); }
  });

  // Admin: platform-wide ledger overview
  app.get("/api/admin/ledger/overview", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      if (!hasDatabase()) return res.json({});
      const db = getDb();
      const [stats] = await db.select({
        totalSessions: sql<number>`count(*)`,
        totalBuyIns: sql<number>`coalesce(sum(${tableSessions.buyInTotal}), 0)`,
        totalCashOuts: sql<number>`coalesce(sum(${tableSessions.cashOutTotal}), 0)`,
        totalRake: sql<number>`coalesce(sum(${tableSessions.buyInTotal}) - sum(${tableSessions.cashOutTotal}), 0)`,
        unsettled: sql<number>`count(*) filter (where ${tableSessions.settled} = false AND ${tableSessions.endedAt} IS NOT NULL)`,
      }).from(tableSessions);
      const [ledgerStats] = await db.select({
        totalLedgerEntries: sql<number>`count(*)`,
        totalSettled: sql<number>`count(*) filter (where ${tableLedgerEntries.settledAt} IS NOT NULL)`,
      }).from(tableLedgerEntries);
      res.json({
        sessions: { total: Number(stats.totalSessions), unsettled: Number(stats.unsettled) },
        financial: { totalBuyIns: Number(stats.totalBuyIns), totalCashOuts: Number(stats.totalCashOuts), totalRake: Number(stats.totalRake) },
        ledger: { entries: Number(ledgerStats.totalLedgerEntries), settled: Number(ledgerStats.totalSettled) },
      });
    } catch (err) { next(err); }
  });

  // Admin: all settlements with blockchain proof data
  app.get("/api/admin/blockchain/settlements", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const search = req.query.search as string | undefined;
      const onChainOnly = req.query.onChainOnly === "true";

      const conds: ReturnType<typeof sql>[] = [];
      if (onChainOnly) conds.push(sql`${tableLedgerEntries.settlementTxHash} IS NOT NULL`);
      if (search) conds.push(sql`(${tableLedgerEntries.settlementHash} ILIKE ${"%" + search + "%"} OR ${tableLedgerEntries.settlementTxHash} ILIKE ${"%" + search + "%"} OR ${tableLedgerEntries.id} ILIKE ${"%" + search + "%"})`);

      const where = conds.length > 0 ? conds.reduce((a, b) => sql`${a} AND ${b}`) : sql`1=1`;

      const entries = await db.select({
        id: tableLedgerEntries.id,
        tableId: tableLedgerEntries.tableId,
        clubId: tableLedgerEntries.clubId,
        sessionDate: tableLedgerEntries.sessionDate,
        entries: tableLedgerEntries.entries,
        settlements: tableLedgerEntries.settlements,
        totalRake: tableLedgerEntries.totalRake,
        totalPot: tableLedgerEntries.totalPot,
        playerCount: tableLedgerEntries.playerCount,
        handsPlayed: tableLedgerEntries.handsPlayed,
        settledBy: tableLedgerEntries.settledBy,
        settledAt: tableLedgerEntries.settledAt,
        notes: tableLedgerEntries.notes,
        settlementHash: tableLedgerEntries.settlementHash,
        settlementTxHash: tableLedgerEntries.settlementTxHash,
        createdAt: tableLedgerEntries.createdAt,
        tableName: tables.name,
      }).from(tableLedgerEntries)
        .leftJoin(tables, sql`${tables.id} = ${tableLedgerEntries.tableId}`)
        .where(where)
        .orderBy(sql`${tableLedgerEntries.createdAt} DESC`)
        .limit(100);

      res.json(entries);
    } catch (err) { next(err); }
  });

  // ─── Sponsorship Payout Routes ──────────────────────────────────────────────

  // List all payouts with optional search/filter
  app.get("/api/admin/sponsorship/payouts", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const { search, status, clubId } = req.query as { search?: string; status?: string; clubId?: string };

      const conditions: string[] = [];
      if (status) conditions.push(`${sponsorshipPayouts.status.name} = '${status}'`);
      if (clubId) conditions.push(`${sponsorshipPayouts.clubId.name} = '${clubId}'`);

      let where = sql`1=1`;
      if (status && clubId) {
        where = sql`${sponsorshipPayouts.status} = ${status} AND ${sponsorshipPayouts.clubId} = ${clubId}`;
      } else if (status) {
        where = sql`${sponsorshipPayouts.status} = ${status}`;
      } else if (clubId) {
        where = sql`${sponsorshipPayouts.clubId} = ${clubId}`;
      }

      if (search) {
        const searchWhere = sql`(${sponsorshipPayouts.transactionId} ILIKE ${'%' + search + '%'} OR ${sponsorshipPayouts.recipientWallet} ILIKE ${'%' + search + '%'} OR ${sponsorshipPayouts.notes} ILIKE ${'%' + search + '%'})`;
        where = status || clubId ? sql`${where} AND ${searchWhere}` : searchWhere;
      }

      const payouts = await db.select().from(sponsorshipPayouts)
        .where(where)
        .orderBy(sql`${sponsorshipPayouts.createdAt} DESC`)
        .limit(200);

      res.json(payouts);
    } catch (err) { next(err); }
  });

  // Create a new payout
  app.post("/api/admin/sponsorship/payouts", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.status(503).json({ message: "Database not available" });
      const db = getDb();
      const { clubId, recipientUserId, recipientWallet, amount, currency, scheduledDate, notes } = req.body;

      if (!recipientWallet || !amount) {
        return res.status(400).json({ message: "recipientWallet and amount are required" });
      }

      // Auto-generate TX-XXXXXXXX transaction ID (collision-resistant)
      const txNum = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
      const transactionId = `TX-${txNum}`;

      const [payout] = await db.insert(sponsorshipPayouts).values({
        transactionId,
        clubId: clubId || null,
        recipientUserId: recipientUserId || null,
        recipientWallet,
        amount: Number(amount),
        currency: currency || "USDT",
        status: "pending",
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        notes: notes || null,
        createdBy: req.user!.id,
      }).returning();

      res.status(201).json(payout);
    } catch (err) { next(err); }
  });

  // Update payout status
  app.patch("/api/admin/sponsorship/payouts/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.status(503).json({ message: "Database not available" });
      const db = getDb();
      const { id } = req.params;
      const { status, txHash, notes, processedAt } = req.body;

      const updates: Record<string, unknown> = {};
      if (status) updates.status = status;
      if (txHash !== undefined) updates.txHash = txHash;
      if (notes !== undefined) updates.notes = notes;
      if (processedAt) updates.processedAt = new Date(processedAt);
      if (status === "completed" && !processedAt) updates.processedAt = new Date();

      const [updated] = await db.update(sponsorshipPayouts)
        .set(updates)
        .where(sql`${sponsorshipPayouts.id} = ${id}`)
        .returning();

      if (!updated) return res.status(404).json({ message: "Payout not found" });
      res.json(updated);
    } catch (err) { next(err); }
  });

  // Delete a payout
  app.delete("/api/admin/sponsorship/payouts/:id", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.status(503).json({ message: "Database not available" });
      const db = getDb();
      const { id } = req.params;

      const [deleted] = await db.delete(sponsorshipPayouts)
        .where(sql`${sponsorshipPayouts.id} = ${id}`)
        .returning();

      if (!deleted) return res.status(404).json({ message: "Payout not found" });
      res.json({ message: "Payout deleted", id });
    } catch (err) { next(err); }
  });

  // ─── Announcement Routes ──────────────────────────────────────────────────

  // Get active announcements for the current user (filtered by audience)
  app.get("/api/announcements/active", requireAuth, async (req: any, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const rows = await db
        .select()
        .from(announcements)
        .where(sql`${announcements.active} = true AND (${announcements.expiresAt} IS NULL OR ${announcements.expiresAt} > NOW())`)
        .orderBy(sql`${announcements.createdAt} DESC`);
      res.json(rows);
    } catch (err) { next(err); }
  });

  // Admin: create announcement
  app.post("/api/admin/announcements/create", requireAuth, requireAdmin, async (req: any, res, next) => {
    try {
      if (!hasDatabase()) return res.status(503).json({ message: "Database unavailable" });
      const db = getDb();
      const { title, message, targetAudience, deliveryStyle, expiresAt, clubId } = req.body;
      if (!title || !message) return res.status(400).json({ message: "title and message are required" });
      const [row] = await db.insert(announcements).values({
        title,
        message,
        targetAudience: targetAudience || "all",
        deliveryStyle: deliveryStyle || "notification",
        clubId: clubId || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: req.user!.id,
      }).returning();
      await logAdminAction(req.user!.id, "announcement_create", "announcement", row.id, { title, targetAudience, deliveryStyle }, req.ip);
      res.json(row);
    } catch (err) { next(err); }
  });

  // Admin: delete announcement
  app.delete("/api/admin/announcements/:id", requireAuth, requireAdmin, async (req: any, res, next) => {
    try {
      if (!hasDatabase()) return res.status(503).json({ message: "Database unavailable" });
      const db = getDb();
      const { id } = req.params;
      const [deleted] = await db.delete(announcements).where(sql`${announcements.id} = ${id}`).returning();
      if (!deleted) return res.status(404).json({ message: "Announcement not found" });
      await logAdminAction(req.user!.id, "announcement_delete", "announcement", id, null, req.ip);
      res.json({ message: "Announcement deleted", id });
    } catch (err) { next(err); }
  });

  // Admin: broadcast announcement to all connected WebSocket clients
  app.post("/api/admin/announcements/:id/broadcast", requireAuth, requireAdmin, async (req: any, res, next) => {
    try {
      if (!hasDatabase()) return res.status(503).json({ message: "Database unavailable" });
      const db = getDb();
      const { id } = req.params;
      const [announcement] = await db.select().from(announcements).where(sql`${announcements.id} = ${id}`);
      if (!announcement) return res.status(404).json({ message: "Announcement not found" });

      const clients = getClients();
      const wsMessage = {
        type: "announcement" as const,
        announcement: {
          id: announcement.id,
          title: announcement.title,
          message: announcement.message,
          deliveryStyle: announcement.deliveryStyle,
        },
      };

      // Broadcast to all connected clients via their individual connections
      const sentUserIds = new Set<string>();
      for (const client of clients.values()) {
        if (client.userId && !sentUserIds.has(client.userId)) {
          sentUserIds.add(client.userId);
          sendToUser(client.userId, wsMessage as any);
        }
      }

      await logAdminAction(req.user!.id, "announcement_broadcast", "announcement", id, { recipientCount: sentUserIds.size }, req.ip);
      res.json({ message: "Broadcast sent", recipientCount: sentUserIds.size });
    } catch (err) { next(err); }
  });

  // ─── Chart Data Routes ─────────────────────────────────────────────────────

  // Daily revenue trend (last 30 days)
  app.get("/api/admin/charts/revenue-trend", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const rows = await db.execute(sql`
        SELECT date_trunc('day', created_at)::date as day,
          coalesce(sum(case when type = 'rake' then abs(amount) else 0 end), 0) as rake,
          coalesce(sum(case when type = 'deposit' then abs(amount) else 0 end), 0) as deposits,
          coalesce(sum(case when type = 'cashout' then amount else 0 end), 0) as cashouts,
          coalesce(sum(case when type = 'buyin' then abs(amount) else 0 end), 0) as buyins
        FROM ${transactions}
        WHERE created_at > now() - interval '30 days'
        GROUP BY date_trunc('day', created_at)::date
        ORDER BY day
      `);
      res.json(rows);
    } catch (err) { next(err); }
  });

  // Revenue by source (pie chart)
  app.get("/api/admin/charts/revenue-sources", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const rows = await db.execute(sql`
        SELECT type, coalesce(sum(abs(amount)), 0) as total
        FROM ${transactions}
        WHERE type IN ('rake', 'deposit', 'purchase', 'buyin')
        GROUP BY type ORDER BY total DESC
      `);
      res.json(rows);
    } catch (err) { next(err); }
  });

  // Club analytics — member activity over time
  app.get("/api/clubs/:id/charts/activity", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const rows = await db.execute(sql`
        SELECT date_trunc('day', created_at)::date as day,
          count(distinct user_id) as active_players,
          count(*) as total_actions
        FROM ${transactions}
        WHERE table_id IN (SELECT id FROM ${tables} WHERE club_id = ${req.params.id})
          AND created_at > now() - interval '30 days'
        GROUP BY date_trunc('day', created_at)::date
        ORDER BY day
      `);
      res.json(rows);
    } catch (err) { next(err); }
  });

  // ─── Transaction Explorer Routes ────────────────────────────────────────────

  // Helper: build SQL conditions using drizzle sql template
  function buildSqlConditions(conditions: ReturnType<typeof sql>[]) {
    if (conditions.length === 0) return sql`1=1`;
    return conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`);
  }

  // Unified search across transactions
  app.get("/api/explorer/transactions", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json({ results: [], total: 0 });
      const db = getDb();
      const userId = req.user!.id;
      const isAdmin = req.user!.role === "admin";
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const typeFilter = req.query.type as string | undefined;
      const search = req.query.search as string | undefined;
      const dateFrom = req.query.from as string | undefined;
      const dateTo = req.query.to as string | undefined;
      const walletFilter = req.query.wallet as string | undefined;

      const effectiveUserId = isAdmin && req.query.all === "true" ? null : userId;
      const conds: ReturnType<typeof sql>[] = [];
      if (effectiveUserId) conds.push(sql`${transactions.userId} = ${effectiveUserId}`);
      if (typeFilter && typeFilter !== "all") conds.push(sql`${transactions.type} = ${typeFilter}`);
      if (walletFilter && walletFilter !== "all") conds.push(sql`${transactions.walletType} = ${walletFilter}`);
      if (dateFrom) conds.push(sql`${transactions.createdAt} >= ${dateFrom}::timestamp`);
      if (dateTo) conds.push(sql`${transactions.createdAt} <= ${dateTo + "T23:59:59Z"}::timestamp`);
      if (search) conds.push(sql`(${transactions.id} ILIKE ${"%" + search + "%"} OR ${transactions.description} ILIKE ${"%" + search + "%"})`);

      const where = buildSqlConditions(conds);

      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(transactions).where(where);
      const total = Number(countRow.count);

      const rows = await db.select({
        id: transactions.id, user_id: transactions.userId, type: transactions.type,
        amount: transactions.amount, balance_before: transactions.balanceBefore,
        balance_after: transactions.balanceAfter, description: transactions.description,
        wallet_type: transactions.walletType, payment_id: transactions.paymentId,
        metadata: transactions.metadata, created_at: transactions.createdAt,
        username: users.username, display_name: users.displayName,
      }).from(transactions)
        .leftJoin(users, sql`${users.id} = ${transactions.userId}`)
        .where(where)
        .orderBy(sql`${transactions.createdAt} DESC`)
        .limit(limit).offset(offset);

      res.json({ results: rows, total });
    } catch (err) { next(err); }
  });

  // Payments explorer
  app.get("/api/explorer/payments", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json({ results: [], total: 0 });
      const db = getDb();
      const userId = req.user!.id;
      const isAdmin = req.user!.role === "admin";
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const direction = req.query.direction as string | undefined;
      const statusFilter = req.query.status as string | undefined;
      const currency = req.query.currency as string | undefined;
      const search = req.query.search as string | undefined;

      const effectiveUserId = isAdmin && req.query.all === "true" ? null : userId;
      const conds: ReturnType<typeof sql>[] = [];
      if (effectiveUserId) conds.push(sql`${payments.userId} = ${effectiveUserId}`);
      if (direction) conds.push(sql`${payments.direction} = ${direction}`);
      if (statusFilter) conds.push(sql`${payments.status} = ${statusFilter}`);
      if (currency) conds.push(sql`${payments.currency} = ${currency}`);
      if (search) conds.push(sql`(${payments.id} ILIKE ${"%" + search + "%"} OR ${payments.txHash} ILIKE ${"%" + search + "%"})`);

      const where = buildSqlConditions(conds);

      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(payments).where(where);
      const total = Number(countRow.count);

      const rows = await db.select({
        id: payments.id, user_id: payments.userId, direction: payments.direction,
        status: payments.status, amount_fiat: payments.amountFiat,
        amount_crypto: payments.amountCrypto, currency: payments.currency,
        chip_amount: payments.chipAmount, gateway_provider: payments.gatewayProvider,
        deposit_address: payments.depositAddress, tx_hash: payments.txHash,
        confirmations: payments.confirmations, required_confirmations: payments.requiredConfirmations,
        withdrawal_address: payments.withdrawalAddress, created_at: payments.createdAt,
        username: users.username, display_name: users.displayName,
      }).from(payments)
        .leftJoin(users, sql`${users.id} = ${payments.userId}`)
        .where(where)
        .orderBy(sql`${payments.createdAt} DESC`)
        .limit(limit).offset(offset);

      res.json({ results: rows, total });
    } catch (err) { next(err); }
  });

  // Game hands explorer
  app.get("/api/explorer/hands", requireAuth, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json({ results: [], total: 0 });
      const db = getDb();
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const tableIdFilter = req.query.tableId as string | undefined;
      const search = req.query.search as string | undefined;
      const onChainOnly = req.query.onChainOnly === "true";

      const conds: ReturnType<typeof sql>[] = [];
      if (tableIdFilter) conds.push(sql`${gameHands.tableId} = ${tableIdFilter}`);
      if (search) conds.push(sql`(${gameHands.id} ILIKE ${"%" + search + "%"} OR ${gameHands.commitmentHash} ILIKE ${"%" + search + "%"})`);
      if (onChainOnly) conds.push(sql`(${gameHands.onChainCommitTx} IS NOT NULL OR ${gameHands.onChainRevealTx} IS NOT NULL)`);

      const where = buildSqlConditions(conds);

      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(gameHands).where(where);
      const total = Number(countRow.count);

      const rows = await db.select({
        id: gameHands.id, table_id: gameHands.tableId, hand_number: gameHands.handNumber,
        pot_total: gameHands.potTotal, total_rake: gameHands.totalRake,
        commitment_hash: gameHands.commitmentHash, vrf_request_id: gameHands.vrfRequestId,
        vrf_random_word: gameHands.vrfRandomWord,
        on_chain_commit_tx: gameHands.onChainCommitTx, on_chain_reveal_tx: gameHands.onChainRevealTx,
        winner_ids: gameHands.winnerIds, created_at: gameHands.createdAt,
        table_name: tables.name,
      }).from(gameHands)
        .leftJoin(tables, sql`${tables.id} = ${gameHands.tableId}`)
        .where(where)
        .orderBy(sql`${gameHands.createdAt} DESC`)
        .limit(limit).offset(offset);

      res.json({ results: rows, total });
    } catch (err) { next(err); }
  });

  // Blockchain verification endpoint — verify a hand on-chain
  app.get("/api/explorer/verify/:tableId/:handNumber", async (req, res, next) => {
    try {
      const { tableId, handNumber } = req.params;
      if (!hasDatabase()) return res.json({ verified: false, message: "No database" });
      const db = getDb();

      // Get local record
      const [hand] = await db.select().from(gameHands)
        .where(sql`${gameHands.tableId} = ${tableId} AND ${gameHands.handNumber} = ${parseInt(handNumber)}`)
        .limit(1);

      if (!hand) return res.status(404).json({ verified: false, message: "Hand not found" });

      // Check on-chain if blockchain is enabled
      let onChainResult = null;
      if (blockchainConfig.enabled && blockchainConfig.handVerifierAddress) {
        try {
          const { ethers } = await import("ethers");
          const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
          const abi = [
            "function verifyHand(string tableId, uint256 handNumber) external view returns (bool committed, bool revealed, bytes32 commitHash, uint256 timestamp)",
          ];
          const contract = new ethers.Contract(blockchainConfig.handVerifierAddress, abi, provider);
          const result = await contract.verifyHand(tableId, parseInt(handNumber));
          onChainResult = {
            committed: result[0],
            revealed: result[1],
            commitHash: result[2],
            timestamp: Number(result[3]),
            explorerUrl: `https://amoy.polygonscan.com/address/${blockchainConfig.handVerifierAddress}`,
          };
        } catch (chainErr: any) {
          onChainResult = { error: chainErr.message };
        }
      }

      res.json({
        hand: {
          id: hand.id,
          tableId: hand.tableId,
          handNumber: hand.handNumber,
          commitmentHash: hand.commitmentHash,
          onChainCommitTx: hand.onChainCommitTx,
          onChainRevealTx: hand.onChainRevealTx,
          vrfRequestId: hand.vrfRequestId,
          createdAt: hand.createdAt,
        },
        onChain: onChainResult,
        explorerLinks: {
          commitTx: hand.onChainCommitTx ? `https://amoy.polygonscan.com/tx/${hand.onChainCommitTx}` : null,
          revealTx: hand.onChainRevealTx ? `https://amoy.polygonscan.com/tx/${hand.onChainRevealTx}` : null,
        },
      });
    } catch (err) { next(err); }
  });

  // ─── Admin Audit Log Routes ────────────────────────────────────────────────

  app.get("/api/admin/audit-log", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== "admin") return res.status(403).json({ message: "Admin only" });
      if (!hasDatabase()) return res.json([]);
      const db = getDb();
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;
      const actionFilter = req.query.action as string | undefined;

      const logs = actionFilter
        ? await db.select().from(adminAuditLogs).where(sql`${adminAuditLogs.action} = ${actionFilter}`).orderBy(sql`${adminAuditLogs.createdAt} DESC`).limit(limit).offset(offset)
        : await db.select().from(adminAuditLogs).orderBy(sql`${adminAuditLogs.createdAt} DESC`).limit(limit).offset(offset);
      res.json(logs);
    } catch (err) { next(err); }
  });

  app.get("/api/admin/audit-log/stats", requireAuth, async (req, res, next) => {
    try {
      if (req.user!.role !== "admin") return res.status(403).json({ message: "Admin only" });
      if (!hasDatabase()) return res.json({ total: 0, byAction: {} });
      const db = getDb();
      const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(adminAuditLogs);
      const actionCounts = await db.select({
        action: adminAuditLogs.action,
        count: sql<number>`count(*)`,
      }).from(adminAuditLogs).groupBy(adminAuditLogs.action);
      const byAction: Record<string, number> = {};
      for (const row of actionCounts) byAction[row.action] = Number(row.count);
      res.json({ total: Number(countResult.count), byAction });
    } catch (err) { next(err); }
  });

  // ─── Third-Party KYC Verification Webhook ─────────────────────────────────
  // Supports Onfido / Sumsub webhook callbacks
  // Provider configured via KYC_PROVIDER env var (onfido | sumsub | manual)

  app.post("/api/webhooks/kyc-verification", async (req, res, next) => {
    try {
      const provider = process.env.KYC_PROVIDER || "manual";
      const webhookSecret = process.env.KYC_WEBHOOK_SECRET;

      // Verify webhook signature based on provider
      if (provider === "onfido") {
        const sig = req.headers["x-sha2-signature"] as string;
        if (webhookSecret && sig) {
          const expected = createHash("sha256").update(JSON.stringify(req.body) + webhookSecret).digest("hex");
          if (sig !== expected) return res.status(401).json({ message: "Invalid signature" });
        }

        const { payload } = req.body;
        if (!payload?.resource_type || payload.resource_type !== "check") {
          return res.json({ received: true });
        }

        const applicantId = payload.object?.applicant_id;
        const result = payload.object?.result; // "clear" | "consider"
        if (!applicantId) return res.json({ received: true });

        // Look up user by kycData.providerApplicantId
        const allPending = await storage.getAllUsersByKycStatus("pending");
        const user = allPending.find(u => (u.kycData as any)?.providerApplicantId === applicantId);
        if (!user) return res.json({ received: true, matched: false });

        if (result === "clear") {
          await storage.updateUser(user.id, { kycStatus: "verified", kycVerifiedAt: new Date() });
          if (user.email) {
            sendKycEmail(user.email, "KYC Verified - HighRollers Club",
              `<h2>Identity Verified!</h2><p>Your identity has been automatically verified. You now have full access.</p>`);
          }
          await storage.createNotification(user.id, "kyc_status", "KYC Approved", "Your identity has been verified!", { status: "verified" });
          await logAdminAction("system:onfido", "kyc_auto_approve", "user", user.id, { applicantId, result });
        } else {
          await storage.updateUser(user.id, { kycStatus: "rejected", kycRejectionReason: `Auto-review: ${result}` });
          if (user.email) {
            sendKycEmail(user.email, "KYC Update - HighRollers Club",
              `<h2>Verification Update</h2><p>Your application requires manual review. We'll notify you when complete.</p>`);
          }
          await storage.createNotification(user.id, "kyc_status", "KYC Review", "Your documents need additional review.", { status: "review" });
          await logAdminAction("system:onfido", "kyc_auto_reject", "user", user.id, { applicantId, result });
        }
        return res.json({ received: true, processed: true });

      } else if (provider === "sumsub") {
        const sig = req.headers["x-payload-digest"] as string;
        if (webhookSecret && sig) {
          const hmac = createHash("sha256").update(JSON.stringify(req.body) + webhookSecret).digest("hex");
          if (sig !== hmac) return res.status(401).json({ message: "Invalid signature" });
        }

        const { applicantId, reviewResult, type: eventType } = req.body;
        if (eventType !== "applicantReviewed" || !applicantId) return res.json({ received: true });

        const allPending = await storage.getAllUsersByKycStatus("pending");
        const user = allPending.find(u => (u.kycData as any)?.providerApplicantId === applicantId);
        if (!user) return res.json({ received: true, matched: false });

        const approved = reviewResult?.reviewAnswer === "GREEN";
        if (approved) {
          await storage.updateUser(user.id, { kycStatus: "verified", kycVerifiedAt: new Date() });
          if (user.email) {
            sendKycEmail(user.email, "KYC Verified - HighRollers Club",
              `<h2>Identity Verified!</h2><p>Your identity has been verified successfully.</p>`);
          }
          await storage.createNotification(user.id, "kyc_status", "KYC Approved", "Your identity has been verified!", { status: "verified" });
          await logAdminAction("system:sumsub", "kyc_auto_approve", "user", user.id, { applicantId, reviewResult });
        } else {
          const rejectReason = reviewResult?.rejectLabels?.join(", ") || "Verification failed";
          await storage.updateUser(user.id, { kycStatus: "rejected", kycRejectionReason: rejectReason });
          if (user.email) {
            sendKycEmail(user.email, "KYC Update - HighRollers Club",
              `<h2>Verification Update</h2><p>Your application was not approved: ${rejectReason}</p>`);
          }
          await storage.createNotification(user.id, "kyc_status", "KYC Update", `Verification not approved: ${rejectReason}`, { status: "rejected" });
          await logAdminAction("system:sumsub", "kyc_auto_reject", "user", user.id, { applicantId, reviewResult });
        }
        return res.json({ received: true, processed: true });
      }

      // Manual provider — no webhook processing
      res.json({ received: true, provider });
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
        if (client && client.tableIds.size > 0) { for (const tid of client.tableIds) { tableManager.leaveTable(tid, userId).catch(() => {}); } client.tableIds.clear(); }
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

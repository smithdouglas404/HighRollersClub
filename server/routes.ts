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
import { registerGameRoutes } from "./routes/game-routes";
import { registerClubRoutes } from "./routes/club-routes";
import { registerTournamentRoutes } from "./routes/tournament-routes";
import { registerWalletRoutes } from "./routes/wallet-routes";
import { registerMarketplaceRoutes } from "./routes/marketplace-routes";
import { registerPlayerRoutes } from "./routes/player-routes";
import { registerAdminPlatformRoutes } from "./routes/admin-platform-routes";
import { registerKycRoutes } from "./routes/kyc-routes";
import { registerPlatformRoutes } from "./routes/platform-routes";

// ─── ILIKE Wildcard Escape Helper ─────────────────────────────────────────
/** Escape special characters in user input before using in ILIKE patterns */
function escapeIlike(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

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
// Always reads admin ID from req.user.id to prevent spoofing.
// For system/webhook callers that have no request, use logSystemAction instead.
async function logAdminAction(
  req: import("express").Request,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details: Record<string, any> | null,
) {
  try {
    if (!hasDatabase()) return;
    const adminId = req.user?.id;
    if (!adminId) return;
    const db = getDb();
    await db.insert(adminAuditLogs).values({
      adminId,
      action,
      targetType,
      targetId,
      details,
      ipAddress: req.ip || req.socket?.remoteAddress || null,
    });
  } catch (err: any) {
    console.error("Audit log error:", err.message);
  }
}

// For automated system actions (webhooks, cron) where there is no authenticated request
async function logSystemAction(
  systemId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details: Record<string, any> | null,
) {
  try {
    if (!hasDatabase()) return;
    const db = getDb();
    await db.insert(adminAuditLogs).values({
      adminId: systemId,
      action,
      targetType,
      targetId,
      details,
      ipAddress: null,
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
    id: "free", name: "Free", monthlyPrice: 0, annualPrice: 0,
    benefits: [
      "Practice mode",
      "Join public cash games (with table limits)",
      "Basic statistics (hands played, win rate)",
      "Basic avatar creation",
      "Daily bonus: 1,000 chips",
      "Military rank earned & displayed",
      "Join clubs (cannot create)",
    ],
  },
  {
    id: "bronze", name: "Bronze", monthlyPrice: 499, annualPrice: 4999,
    benefits: [
      "Basic membership",
      "Avatar selection & ownership",
      "Daily challenges & missions",
      "Coaching access",
      "Everything in Free",
    ],
  },
  {
    id: "silver", name: "Silver", monthlyPrice: 999, annualPrice: 9999,
    benefits: [
      "Buy on marketplace (avatars, cosmetics, NFTs)",
      "Sell on marketplace (KYC required)",
      "Multi-table play",
      "Replay sharing",
      "Enhanced stats dashboard",
      "2x daily bonus (2,000 chips)",
      "Custom table themes",
      "Reduced platform fee (0.25% vs 0.5%)",
      "Everything in Bronze",
    ],
  },
  {
    id: "gold", name: "Gold", monthlyPrice: 1999, annualPrice: 19999,
    benefits: [
      "Full stats dashboard",
      "Advanced API access",
      "Priority support",
      "Rakeback eligible",
      "KYC required to purchase",
      "Everything in Silver",
    ],
  },
  {
    id: "platinum", name: "Platinum", monthlyPrice: 4999, annualPrice: 49999,
    benefits: [
      "Create & manage clubs",
      "Host tournaments with admin fees & rake",
      "Create private games with configurable rake",
      "Alliance system access",
      "Credit tournaments from club treasury",
      "Club rake reports & analytics",
      "Club marketplace storefront (sell club-branded NFTs)",
      "Reduced marketplace fee (2.0% vs 2.9%)",
      "Priority table seating",
      "Everything in Gold",
    ],
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

  // ─── Extracted Route Modules ────────────────────────────────────────────
  const sharedHelpers = { hasDatabase, getDb, sql };
  await registerWalletRoutes(app, requireAuth, sharedHelpers);
  await registerPlayerRoutes(app, requireAuth, sharedHelpers);
  // Marketplace routes registered after requireAdmin is defined (below)

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

  // ─── Table Routes + Video + Lottery SNG + Fast-Fold ── (moved to routes/game-routes.ts)

  // ─── Club Routes (User Clubs, Club CRUD, Rankings, Feed, Challenges, Tournaments, Leaderboard, Quick Stats, Rake Report) ── (moved to routes/club-routes.ts)

  // ─── Profile Routes ── (moved to routes/player-routes.ts)

  // ─── Wallet / Session / Transfer / Payment / Withdrawal Routes ── (moved to routes/wallet-routes.ts)

  // ─── Hand Routes / Secure Hand History ── (moved to routes/game-routes.ts)

  // ─── Player Stats / Military Rank / Stats Breakdown / Head-to-Head / Play Style Coach ── (moved to routes/player-routes.ts)

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

  // ─── Leaderboard / Missions ── (moved to routes/player-routes.ts)

  // ─── Hand Analysis Routes ── (moved to routes/game-routes.ts)

  // ─── Shop / Wishlist Routes ── (moved to routes/marketplace-routes.ts)

  // ─── Tournament Routes + Alliance & League ── (moved to routes/tournament-routes.ts)

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

  // Register marketplace routes (needs requireAdmin + requireTier + tierRank)
  await registerMarketplaceRoutes(app, requireAuth, { requireTier, tierRank, requireAdmin });

  // Register extracted route modules
  await registerGameRoutes(app, requireAuth, requireAdmin, { logAdminAction });
  await registerClubRoutes(app, requireAuth, requireAdmin, { hasDatabase, getDb, sql });
  await registerTournamentRoutes(app, requireAuth, requireAdmin);
  await registerAdminPlatformRoutes(app, requireAuth, requireAdmin, {
    logAdminAction,
    globalSystemLocked,
    globalLockReason,
    setGlobalLock: (locked: boolean, reason: string) => { globalSystemLocked = locked; globalLockReason = reason; },
  });
  await registerKycRoutes(app, requireAuth, requireAdmin, {
    requireTier,
    logAdminAction,
    sendKycEmail,
  });
  await registerPlatformRoutes(app, requireAuth, requireAdmin, {
    requireTier,
    logAdminAction,
    sendKycEmail,
    TIER_DEFINITIONS,
    TIER_ORDER,
    tierRank,
    socialLinks,
  });

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
      if (search) { const s = escapeIlike(search); conds.push(sql`(${users.username} ILIKE ${"%" + s + "%"} OR ${users.displayName} ILIKE ${"%" + s + "%"} OR ${users.email} ILIKE ${"%" + s + "%"} OR ${users.id} ILIKE ${"%" + s + "%"})`); }
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
      await logAdminAction(req, "user_edit", "user", req.params.id,
        { changes: updates, username: user.username });
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
      await logAdminAction(req, "user_ban", "user", req.params.id,
        { username: user.username, reason });
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
      await logAdminAction(req, "user_unban", "user", req.params.id,
        { username: user.username });
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
      await logAdminAction(req, "club_delete", "club", req.params.id,
        { clubName: club.name });
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
      await logAdminAction(req, "table_close", "table", req.params.id,
        { tableName: table.name });
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

    await logAdminAction(req, "env_key_change", "system", key,
      { description: def.description, sensitive: def.sensitive });

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

      await logAdminAction(req, "music_upload", "music", track.id,
        { title: track.title, artist: track.artist });

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
      await logAdminAction(req, "music_delete", "music", track.id,
        { title: track.title });
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // ─── Card Encryption Verification ── (moved to routes/game-routes.ts)

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
      if (search) { const s = escapeIlike(search); conds.push(sql`(${users.username} ILIKE ${"%" + s + "%"} OR ${users.memberId} ILIKE ${"%" + s + "%"} OR ${users.kycBlockchainTxHash} ILIKE ${"%" + s + "%"})`); }

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
      if (search) { const s = escapeIlike(search); conds.push(sql`(${gameHands.commitmentHash} ILIKE ${"%" + s + "%"} OR ${gameHands.onChainCommitTx} ILIKE ${"%" + s + "%"} OR ${gameHands.onChainRevealTx} ILIKE ${"%" + s + "%"} OR ${gameHands.id} ILIKE ${"%" + s + "%"})`); }

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
      await logAdminAction(req, `ip_${type}`, "ip", ip, { reason });
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
      await logAdminAction(req, "platform_setting", "system", key, { value });
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
      await logAdminAction(req, "force_logout", "user", req.params.userId, { reason });
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

  // ─── Player Account Actions ── (moved to routes/player-routes.ts)

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

  // ─── Player Notes ── (moved to routes/player-routes.ts)

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

  // ─── Premium Subscription ── (moved to routes/wallet-routes.ts)

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

  // ─── Club Wars ── (moved to routes/club-routes.ts)

  // ─── Avatar Marketplace / NFT Marketplace / Staking ── (moved to routes/marketplace-routes.ts)

  // ─── Coaching - Live Analysis ── (moved to routes/game-routes.ts)

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
      const { tier, plan } = req.body; // plan: "monthly" | "annual"
      if (!tier || !TIER_ORDER.includes(tier)) {
        return res.status(400).json({ message: "Invalid tier" });
      }
      if (tier === "free") {
        return res.status(400).json({ message: "Cannot upgrade to free tier" });
      }
      if (!plan || !["monthly", "annual"].includes(plan)) {
        return res.status(400).json({ message: "Plan must be 'monthly' or 'annual'" });
      }
      const tierDef = TIER_DEFINITIONS.find(t => t.id === tier);
      if (!tierDef) return res.status(400).json({ message: "Unknown tier" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (tierRank(user.tier) >= tierRank(tier) && user.tierExpiresAt && new Date(user.tierExpiresAt) > new Date()) {
        return res.status(400).json({ message: "You already have this tier or higher" });
      }

      // KYC requirement for Gold and Platinum
      if (tierRank(tier) >= tierRank("gold") && user.kycStatus !== "verified") {
        return res.status(403).json({
          message: "KYC verification required for Gold and Platinum tiers",
          requiresKyc: true,
        });
      }

      // Calculate price in cents — paid via payment gateway (crypto or card)
      const priceInCents = plan === "annual" ? tierDef.annualPrice : tierDef.monthlyPrice;
      const durationDays = plan === "annual" ? 365 : 30;

      // Create a payment via the payment service
      const { getPaymentService } = await import("./payments/payment-service");
      const paymentService = getPaymentService();

      // Initiate a tier subscription payment (chipAmount=0, subscription only)
      const gateway = req.body.gateway || "stripe";
      const currency = req.body.currency || "USD";
      const depositResult = await paymentService.initiateDeposit(
        user.id,
        priceInCents,
        currency,
        gateway,
        [{ walletType: "main", amount: priceInCents }], // allocation must match
      );

      // Store tier intent in payment metadata so webhook can activate the tier
      if (depositResult && depositResult.paymentId) {
        await storage.updatePayment(depositResult.paymentId, {
          gatewayData: JSON.stringify({
            tierIntent: { tier, plan, durationDays },
          }) as any,
        });
      }

      res.json({
        message: "Payment initiated for tier upgrade",
        paymentId: depositResult.paymentId,
        payAddress: depositResult.payAddress,
        payAmount: depositResult.payAmount,
        tier,
        plan,
        priceFormatted: `$${(priceInCents / 100).toFixed(2)}`,
        duration: plan === "annual" ? "1 year" : "30 days",
      });
    } catch (err) { next(err); }
  });

  // Direct tier activation (for admin or after payment confirmation)
  app.post("/api/tiers/activate", requireAuth, async (req, res, next) => {
    try {
      const { tier, plan, userId } = req.body;
      const targetUserId = userId || req.user!.id;

      // Only admins can activate for other users
      if (userId && userId !== req.user!.id) {
        const admin = await storage.getUser(req.user!.id);
        if (!admin || admin.role !== "admin") {
          return res.status(403).json({ message: "Admin only" });
        }
      }

      const tierDef = TIER_DEFINITIONS.find(t => t.id === tier);
      if (!tierDef) return res.status(400).json({ message: "Unknown tier" });

      const durationDays = plan === "annual" ? 365 : 30;
      const user = await storage.getUser(targetUserId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Set or extend tier
      const now = Date.now();
      const currentExpiry = user.tierExpiresAt ? new Date(user.tierExpiresAt).getTime() : 0;
      const baseTime = currentExpiry > now && tierRank(user.tier) >= tierRank(tier) ? currentExpiry : now;
      const expiresAt = new Date(baseTime + durationDays * 24 * 60 * 60 * 1000);

      const updated = await storage.updateUser(targetUserId, { tier, tierExpiresAt: expiresAt });
      res.json({ message: `${tier} tier activated until ${expiresAt.toISOString()}`, user: updated });
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

  app.post("/api/kyc/onfido/start", requireAuth, requireTier("silver"), async (req, res, next) => {
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
  app.post("/api/kyc/submit", requireAuth, requireTier("silver"), kycUpload.fields([
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
      await logAdminAction(req, "kyc_approve", "user", user.id,
        { username: user.username, kycData: user.kycData }
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
      await logAdminAction(req, "kyc_reject", "user", user.id,
        { username: user.username, reason: rejectReason }
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
      await logAdminAction(req, "ledger_settle", "table", req.params.id,
        { settlementHash, settlementTxHash, playerCount: summary.playerCount, totalPot: summary.totalPot });

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
      if (search) { const s = escapeIlike(search); conds.push(sql`(${tableLedgerEntries.settlementHash} ILIKE ${"%" + s + "%"} OR ${tableLedgerEntries.settlementTxHash} ILIKE ${"%" + s + "%"} OR ${tableLedgerEntries.id} ILIKE ${"%" + s + "%"})`); }

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
        const se = escapeIlike(search);
        const searchWhere = sql`(${sponsorshipPayouts.transactionId} ILIKE ${'%' + se + '%'} OR ${sponsorshipPayouts.recipientWallet} ILIKE ${'%' + se + '%'} OR ${sponsorshipPayouts.notes} ILIKE ${'%' + se + '%'})`;
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
      await logAdminAction(req, "announcement_create", "announcement", row.id, { title, targetAudience, deliveryStyle });
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
      await logAdminAction(req, "announcement_delete", "announcement", id, null);
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

      await logAdminAction(req, "announcement_broadcast", "announcement", id, { recipientCount: sentUserIds.size });
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
      if (search) { const s = escapeIlike(search); conds.push(sql`(${transactions.id} ILIKE ${"%" + s + "%"} OR ${transactions.description} ILIKE ${"%" + s + "%"})`); }

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
      if (search) { const s = escapeIlike(search); conds.push(sql`(${payments.id} ILIKE ${"%" + s + "%"} OR ${payments.txHash} ILIKE ${"%" + s + "%"})`); }

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
      if (search) { const s = escapeIlike(search); conds.push(sql`(${gameHands.id} ILIKE ${"%" + s + "%"} OR ${gameHands.commitmentHash} ILIKE ${"%" + s + "%"})`); }
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
        } else if (process.env.NODE_ENV === "production") {
          // In production, reject unsigned webhooks
          if (!webhookSecret) console.error("[kyc-webhook] REJECTING: no KYC_WEBHOOK_SECRET configured in production");
          else if (!sig) console.error("[kyc-webhook] REJECTING: missing x-sha2-signature header");
          return res.status(401).json({ message: "Webhook signature verification required in production" });
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
          await logSystemAction("system:onfido", "kyc_auto_approve", "user", user.id, { applicantId, result });
        } else {
          await storage.updateUser(user.id, { kycStatus: "rejected", kycRejectionReason: `Auto-review: ${result}` });
          if (user.email) {
            sendKycEmail(user.email, "KYC Update - HighRollers Club",
              `<h2>Verification Update</h2><p>Your application requires manual review. We'll notify you when complete.</p>`);
          }
          await storage.createNotification(user.id, "kyc_status", "KYC Review", "Your documents need additional review.", { status: "review" });
          await logSystemAction("system:onfido", "kyc_auto_reject", "user", user.id, { applicantId, result });
        }
        return res.json({ received: true, processed: true });

      } else if (provider === "sumsub") {
        const sig = req.headers["x-payload-digest"] as string;
        if (webhookSecret && sig) {
          const hmac = createHash("sha256").update(JSON.stringify(req.body) + webhookSecret).digest("hex");
          if (sig !== hmac) return res.status(401).json({ message: "Invalid signature" });
        } else if (process.env.NODE_ENV === "production") {
          if (!webhookSecret) console.error("[kyc-webhook] REJECTING: no KYC_WEBHOOK_SECRET configured in production");
          else if (!sig) console.error("[kyc-webhook] REJECTING: missing x-payload-digest header");
          return res.status(401).json({ message: "Webhook signature verification required in production" });
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
          await logSystemAction("system:sumsub", "kyc_auto_approve", "user", user.id, { applicantId, reviewResult });
        } else {
          const rejectReason = reviewResult?.rejectLabels?.join(", ") || "Verification failed";
          await storage.updateUser(user.id, { kycStatus: "rejected", kycRejectionReason: rejectReason });
          if (user.email) {
            sendKycEmail(user.email, "KYC Update - HighRollers Club",
              `<h2>Verification Update</h2><p>Your application was not approved: ${rejectReason}</p>`);
          }
          await storage.createNotification(user.id, "kyc_status", "KYC Update", `Verification not approved: ${rejectReason}`, { status: "rejected" });
          await logSystemAction("system:sumsub", "kyc_auto_reject", "user", user.id, { applicantId, reviewResult });
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

import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { randomUUID, createHash } from "crypto";
import path from "path";
import fs from "fs";
import multer from "multer";
import { storage } from "../storage";
import { users, gameHands, tables, adminAuditLogs, transactions, payments, musicTracks, announcements } from "@shared/schema";
import { sql } from "drizzle-orm";
import { tableManager } from "../game/table-manager";
import { getClients, sendToUser } from "../websocket";
import { getTournamentSchedule, setTournamentSchedule, type ScheduledTournament } from "../scheduler";
import { blockchainConfig } from "../blockchain/config";
import { hasDatabase, getDb } from "../db";
import type { RouteContext } from "./types";

// ─── Music Upload Setup ──────────────────────────────────────────────────
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

// ─── Environment Key Definitions ───────────────────────────────────────
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

export async function registerAdminPlatformRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler,
  ctx: {
    logAdminAction: (adminId: string, action: string, targetType: string | null, targetId: string | null, details: Record<string, any> | null, ipAddress?: string) => Promise<void>;
    globalSystemLocked: boolean;
    globalLockReason: string;
    setGlobalLock: (locked: boolean, reason: string) => void;
  },
) {
  const { logAdminAction } = ctx;

  // ─── Admin: Rake & Revenue Reports ─────────────────────────────────────

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
      res.json({ locked: ctx.globalSystemLocked, reason: ctx.globalLockReason });
    } catch (err) {
      next(err);
    }
  });

  // Toggle global lock
  app.post("/api/admin/system-lock", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { locked, reason } = req.body;
      ctx.setGlobalLock(!!locked, reason || (locked ? "Manual admin lock" : ""));
      console.warn(`[ADMIN] System lock ${locked ? "ENGAGED" : "RELEASED"}: ${ctx.globalLockReason}`);

      // Persist to database
      if (hasDatabase()) {
        try {
          const db = getDb();
          const { platformSettings: ps } = await import("@shared/schema");
          await db.insert(ps).values({ key: "maintenance.enabled", value: ctx.globalSystemLocked, updatedBy: req.user!.id })
            .onConflictDoUpdate({ target: ps.key, set: { value: ctx.globalSystemLocked, updatedBy: req.user!.id, updatedAt: new Date() } });
          await db.insert(ps).values({ key: "maintenance.reason", value: ctx.globalLockReason, updatedBy: req.user!.id })
            .onConflictDoUpdate({ target: ps.key, set: { value: ctx.globalLockReason, updatedBy: req.user!.id, updatedAt: new Date() } });
        } catch {}
      }

      res.json({ locked: ctx.globalSystemLocked, reason: ctx.globalLockReason });
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
      const { getPaymentService } = await import("../payments/payment-service");
      const svc = getPaymentService();
      await svc.approveWithdrawal(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/admin/withdrawals/:id/reject", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const { getPaymentService } = await import("../payments/payment-service");
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

  // ─── Bot Detection Analysis ────────────────────────────────────────────────

  app.get("/api/admin/bot-detection/:userId", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      if (!hasDatabase()) return res.json({ error: "Database required" });
      const db = getDb();
      const { handActions: handActionsTable } = await import("@shared/schema");
      const { analyzePlayerTiming } = await import("../game/bot-detection");

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
      const { analyzePlayerTiming } = await import("../game/bot-detection");

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
  const securityEngine = await import("../middleware/security-engine");
  const adminBot = await import("../admin-bot");

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

  // ─── Anti-Cheat Admin Endpoints ─────────────────────────────────────────
  app.get("/api/admin/anti-cheat/live", requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      const { antiCheatEngine } = await import("../anti-cheat");
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
}

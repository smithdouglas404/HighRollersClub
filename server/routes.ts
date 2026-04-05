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
  app.get("/api/health", async (_req, res) => {
    let dbOk = false;
    if (hasDatabase()) {
      try { await getDb().execute(sql`SELECT 1`); dbOk = true; } catch { dbOk = false; }
    }
    const ok = hasDatabase() ? dbOk : true;
    res.status(ok ? 200 : 503).json({
      ok,
      storage: hasDatabase() ? "database" : "memory",
      database: dbOk,
      redis: !!process.env.REDIS_URL,
      warning: dbOk ? null : hasDatabase() ? "Database connection failed" : "In-memory storage — data lost on restart",
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
  // Legacy-compatible logAdminAction wrapper (accepts adminId string instead of req)
  const logAdminActionLegacy = async (
    adminId: string,
    action: string,
    targetType: string | null,
    targetId: string | null,
    details: Record<string, any> | null,
    ipAddress?: string,
  ) => {
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
  };

  await registerAdminPlatformRoutes(app, requireAuth, requireAdmin, {
    logAdminAction: logAdminActionLegacy,
    globalSystemLocked,
    globalLockReason,
    setGlobalLock: (locked: boolean, reason: string) => { globalSystemLocked = locked; globalLockReason = reason; },
  });
  await registerKycRoutes(app, requireAuth, requireAdmin, {
    requireTier,
    logAdminAction: logAdminActionLegacy,
    sendKycEmail,
  });
  await registerPlatformRoutes(app, requireAuth, requireAdmin, {
    requireTier,
    logAdminAction: logAdminActionLegacy,
    sendKycEmail,
    TIER_DEFINITIONS,
    TIER_ORDER,
    tierRank,
    socialLinks,
  });

  // ─── Admin: Rake & Revenue Reports ── (moved to routes/admin-platform-routes.ts)

  // ─── Admin: Rakeback Processing ── (moved to routes/admin-platform-routes.ts)

  // ─── Admin: Kill Switch ── (moved to routes/admin-platform-routes.ts)

  // ─── Admin: Payments & Withdrawals ── (moved to routes/admin-platform-routes.ts)

  // ─── Admin Stats ── (moved to routes/admin-platform-routes.ts)

  // ─── Admin: User Management ── (moved to routes/admin-platform-routes.ts)

  // ─── Admin: Club Management ── (moved to routes/admin-platform-routes.ts)

  // ─── Admin: Table Management ── (moved to routes/admin-platform-routes.ts)

  // ─── Admin: Environment Keys ── (moved to routes/admin-platform-routes.ts)

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
  const cardEncryption = await import("./game/card-encryption");
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

  // ─── Bot Detection Analysis ── (moved to routes/admin-platform-routes.ts)

  // ─── IP Rules Management ── (moved to routes/admin-platform-routes.ts)

  // ─── Platform Settings ── (moved to routes/admin-platform-routes.ts)

  // ─── Force Logout ── (moved to routes/admin-platform-routes.ts)

  // ─── Device Fingerprints ── (moved to routes/admin-platform-routes.ts)

  // ─── HITL Bot Action Queue ── (moved to routes/admin-platform-routes.ts)

  // ─── Player Account Actions ── (moved to routes/player-routes.ts)

  // ─── Admin Collusion Alerts ── (moved to routes/admin-platform-routes.ts)

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

  // ─── Admin Announcements (in-memory) ── (moved to routes/admin-platform-routes.ts)

  // ─── Global Stats ── (moved to routes/platform-routes.ts)

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

  // ─── Analytics Endpoints ── (moved to routes/platform-routes.ts)

  // ─── Social Link Settings ── (moved to routes/platform-routes.ts)

  // ─── Support Contact ── (moved to routes/platform-routes.ts)

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

  // ─── Admin: Tournament Schedule ── (moved to routes/admin-platform-routes.ts)

  // ─── Tier System Routes ── (moved to routes/platform-routes.ts)

  // ─── KYC Routes ── (moved to routes/kyc-routes.ts)

  // ─── Onfido SDK Integration (Professional KYC) ── (moved to routes/kyc-routes.ts)

  // ─── Blockchain Member ID Routes ── (moved to routes/kyc-routes.ts)

  // ─── Ledger Routes ── (moved to routes/platform-routes.ts)

  // ─── Sponsorship Payout Routes ── (moved to routes/platform-routes.ts)

  // ─── Announcement Routes ── (moved to routes/platform-routes.ts)

  // ─── Chart Data Routes ── (moved to routes/platform-routes.ts)

  // ─── Transaction Explorer Routes ── (moved to routes/platform-routes.ts)

  // ─── Admin Audit Log Routes ── (moved to routes/admin-platform-routes.ts)

  // ─── Third-Party KYC Verification Webhook ── (moved to routes/kyc-routes.ts)

  // ─── Responsible Gambling ── (moved to routes/platform-routes.ts)

  // ─── AI Premium Session Report ── (moved to routes/platform-routes.ts)

  // ─── Anti-Cheat Admin Endpoints ── (moved to routes/admin-platform-routes.ts)

  // ─── Support Ticket Routes ── (moved to routes/platform-routes.ts)

  // ─── Create HTTP Server + WebSocket ──────────────────────────────────────
  const httpServer = createServer(app);
  setupWebSocket(httpServer, sessionMiddleware);

  return httpServer;
}

import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { createHash, randomUUID } from "crypto";
import path from "path";
import { storage } from "../storage";
import { users, gameHands, handPlayers, tables, transactions, payments, sponsorshipPayouts, announcements } from "@shared/schema";
import { sql } from "drizzle-orm";
import { getClients, sendToUser } from "../websocket";
import { blockchainConfig } from "../blockchain/config";
import { hasDatabase, getDb } from "../db";
import { tableManager } from "../game/table-manager";

export async function registerPlatformRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler,
  ctx: {
    requireTier: (minTier: string) => RequestHandler;
    logAdminAction: (adminId: string, action: string, targetType: string | null, targetId: string | null, details: Record<string, any> | null, ipAddress?: string) => Promise<void>;
    sendKycEmail: (to: string, subject: string, html: string) => Promise<void>;
    TIER_DEFINITIONS: any[];
    TIER_ORDER: readonly string[];
    tierRank: (tier: string) => number;
    socialLinks: { twitter: string; discord: string; telegram: string };
  },
) {
  const { requireTier, logAdminAction, sendKycEmail, TIER_DEFINITIONS, TIER_ORDER, tierRank, socialLinks } = ctx;

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
      const { getPaymentService } = await import("../payments/payment-service");
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
        const clubAnnouncements = await storage.getClubAnnouncements(clubId);
        for (const a of clubAnnouncements) {
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

  // ─── Ledger Routes ──────────────────────────────────────────────────────────

  const { tableSessions, tableLedgerEntries } = await import("@shared/schema");
  const { calculateSettlements, summarizeSessions } = await import("../game/ledger");

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
}

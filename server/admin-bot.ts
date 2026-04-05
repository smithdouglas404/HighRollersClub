/**
 * AI Admin Bot — Autonomous HITL Monitoring Agent
 *
 * Runs a periodic scan loop (every 5 minutes) that:
 * 1. AUTO-ACTIONS: Immediately handles clear violations (Tor, banned IPs, bot scores >80)
 * 2. RECOMMENDATIONS: Queues ambiguous cases for admin review (VPN from allowed country, moderate bot scores)
 * 3. INSIGHTS: Generates daily digests of platform health trends
 *
 * All actions are logged to botActionQueue table and visible on the admin HITL dashboard.
 * The bot NEVER makes irreversible decisions on ambiguous cases — those go to the admin.
 */

import { hasDatabase, getDb } from "./db";
import { storage } from "./storage";
import { botActionQueue, accountActions, ipRules, deviceFingerprints, users } from "@shared/schema";
import { sql } from "drizzle-orm";
import { getIpGeoInfo, isTorExitNode, checkIpRules, detectMultiAccounts, getPlatformSetting } from "./middleware/security-engine";
import { analyzePlayerTiming } from "./game/bot-detection";
import { getClients, sendToUser } from "./websocket";

const SCAN_INTERVAL = 5 * 60 * 1000; // 5 minutes
const BOT_SUSPEND_THRESHOLD = 80;

// ─── Bot State ──────────────────────────────────────────────────────────────

let isRunning = false;
let lastScanAt = 0;
let scanCount = 0;
let totalAutoActions = 0;
let totalRecommendations = 0;
let totalInsights = 0;

export function getBotStats() {
  return {
    isRunning,
    lastScanAt: lastScanAt ? new Date(lastScanAt).toISOString() : null,
    scanCount,
    totalAutoActions,
    totalRecommendations,
    totalInsights,
    nextScanIn: isRunning ? Math.max(0, SCAN_INTERVAL - (Date.now() - lastScanAt)) : null,
  };
}

// ─── Queue Helpers ──────────────────────────────────────────────────────────

async function queueAction(
  type: "auto_action" | "recommendation" | "insight",
  category: string,
  severity: string,
  title: string,
  description: string,
  targetUserId?: string,
  targetType?: string,
  targetId?: string,
  actionTaken?: string,
  details?: any
) {
  if (!hasDatabase()) return;
  const db = getDb();
  await db.insert(botActionQueue).values({
    type, category, severity, title, description,
    targetUserId: targetUserId || null,
    targetType: targetType || null,
    targetId: targetId || null,
    actionTaken: actionTaken || null,
    status: type === "auto_action" ? "actioned" : "pending",
    details: details || null,
  });

  if (type === "auto_action") totalAutoActions++;
  else if (type === "recommendation") totalRecommendations++;
  else totalInsights++;
}

async function logAccountAction(userId: string, action: string, severity: string, message: string, details?: any) {
  if (!hasDatabase()) return;
  const db = getDb();
  await db.insert(accountActions).values({
    userId, action, severity, message, automated: true, details: details || null,
  });
  // Send real-time notification to user
  try {
    sendToUser(userId, { type: "account_action", action, severity, message } as any);
  } catch {}
}

// ─── Scan: Active Session Security ──────────────────────────────────────────

async function scanActiveSessions() {
  const clients = getClients();
  if (!clients || clients.size === 0) return;

  for (const [userId, client] of clients) {
    const ip = (client as any).ip || "";
    if (!ip) continue;

    // Check IP rules
    const ipCheck = checkIpRules(ip);
    if (!ipCheck.allowed) {
      // AUTO-ACTION: Banned IP — force disconnect
      try {
        (client as any).ws?.close(1008, "IP banned");
        await logAccountAction(userId, "session_kill", "critical", `Session terminated: ${ipCheck.rule}`, { ip });
        await queueAction("auto_action", "ip_ban", "critical",
          `Banned IP force-disconnected: ${ip}`,
          `User ${userId} connected from banned IP ${ip}. Session killed automatically.`,
          userId, "user", userId, "session_kill", { ip, rule: ipCheck.rule });
      } catch {}
      continue;
    }

    // Check Tor
    if (isTorExitNode(ip)) {
      // AUTO-ACTION: Tor detected — force disconnect
      try {
        (client as any).ws?.close(1008, "Tor not allowed");
        await logAccountAction(userId, "session_kill", "critical", "Session terminated: Tor exit node detected", { ip });
        await queueAction("auto_action", "vpn", "critical",
          `Tor exit node detected: ${ip}`,
          `User ${userId} connected from Tor exit node. Session killed automatically.`,
          userId, "user", userId, "session_kill", { ip });
      } catch {}
      continue;
    }

    // Check VPN/Proxy
    const geo = await getIpGeoInfo(ip);
    if (geo && (geo.isVpn || geo.isProxy) && getPlatformSetting("geofence.block_vpn", true)) {
      // RECOMMENDATION: VPN from allowed country — don't auto-kick, flag for admin
      await queueAction("recommendation", "vpn", "high",
        `VPN/Proxy detected: ${userId.slice(0, 8)}`,
        `User connected from ${geo.isp} (${geo.country}/${geo.region}). VPN/Proxy: ${geo.isVpn ? "VPN" : "Proxy"}. Consider reviewing.`,
        userId, "user", userId, undefined, { ip, geo });
    }
  }
}

// ─── Scan: Bot Detection ────────────────────────────────────────────────────

async function scanForBots() {
  if (!hasDatabase()) return;
  const db = getDb();

  try {
    const { handActions } = await import("@shared/schema");

    // Get players with recent activity
    const recentPlayers = await db.select({ playerId: handActions.playerId })
      .from(handActions)
      .where(sql`${handActions.timeSpent} is not null AND ${handActions.timeSpent} > 0`)
      .groupBy(handActions.playerId)
      .having(sql`count(*) >= 20`)
      .limit(30);

    for (const { playerId } of recentPlayers) {
      if (!playerId || playerId.startsWith("bot-")) continue;

      const actions = await db.select({
        actionType: handActions.actionType,
        timeSpent: handActions.timeSpent,
        street: handActions.street,
      }).from(handActions)
        .where(sql`${handActions.playerId} = ${playerId} AND ${handActions.timeSpent} > 0`)
        .orderBy(sql`${handActions.sequenceNum} DESC`)
        .limit(200);

      const timings = actions.filter(a => a.timeSpent !== null).map(a => ({
        actionType: a.actionType,
        timeSpentMs: a.timeSpent!,
        street: a.street,
      }));

      const result = analyzePlayerTiming(playerId, timings);

      if (result.riskScore >= BOT_SUSPEND_THRESHOLD) {
        // AUTO-ACTION: High confidence bot — suspend
        await storage.updateUser(playerId, { selfExcludedUntil: new Date("2099-12-31") });
        await logAccountAction(playerId, "ban", "critical",
          `Account suspended: automated bot detection (risk score ${result.riskScore}/100)`,
          { riskScore: result.riskScore, signals: result.signals.map(s => s.type) });
        await queueAction("auto_action", "bot", "critical",
          `Bot auto-suspended: risk ${result.riskScore}`,
          `Player ${playerId.slice(0, 8)} scored ${result.riskScore}/100. Signals: ${result.signals.map(s => s.type).join(", ")}`,
          playerId, "user", playerId, "account_suspended", { result });
      } else if (result.riskScore >= 40) {
        // RECOMMENDATION: Moderate risk — flag for review
        await queueAction("recommendation", "bot", result.riskScore >= 60 ? "high" : "medium",
          `Possible bot: risk ${result.riskScore}`,
          `Player ${playerId.slice(0, 8)} shows bot-like patterns. Avg ${result.avgTimeMs}ms, StdDev ${result.stdDevMs}ms. Review recommended.`,
          playerId, "user", playerId, undefined, { result });
      }
    }
  } catch {}
}

// ─── Scan: Multi-Account Detection ──────────────────────────────────────────

async function scanMultiAccounts() {
  if (!hasDatabase()) return;
  const db = getDb();

  try {
    // Find device fingerprints that appear on multiple accounts
    const dupes = await db.select({
      fingerprint: deviceFingerprints.fingerprint,
      count: sql<number>`count(distinct ${deviceFingerprints.userId})`,
    }).from(deviceFingerprints)
      .groupBy(deviceFingerprints.fingerprint)
      .having(sql`count(distinct ${deviceFingerprints.userId}) > 1`)
      .limit(20);

    for (const dupe of dupes) {
      const accounts = await db.select({
        userId: deviceFingerprints.userId,
        ipAddress: deviceFingerprints.ipAddress,
        lastSeen: deviceFingerprints.lastSeen,
      }).from(deviceFingerprints)
        .where(sql`${deviceFingerprints.fingerprint} = ${dupe.fingerprint}`)
        .orderBy(sql`${deviceFingerprints.lastSeen} DESC`);

      const userIds = [...new Set(accounts.map(a => a.userId))];
      if (userIds.length < 2) continue;

      // RECOMMENDATION: Multiple accounts on same device
      await queueAction("recommendation", "multi_account", "high",
        `Multi-account detected: ${userIds.length} accounts on same device`,
        `Device fingerprint ${dupe.fingerprint.slice(0, 16)}... is linked to ${userIds.length} accounts: ${userIds.map(u => u.slice(0, 8)).join(", ")}`,
        userIds[0], "user", dupe.fingerprint, undefined,
        { accounts: userIds, fingerprint: dupe.fingerprint.slice(0, 32) });
    }
  } catch {}
}

// ─── Scan: Daily Insights ───────────────────────────────────────────────────

async function generateInsights() {
  if (!hasDatabase()) return;
  const db = getDb();

  try {
    // Active users in last 24h
    const [activeCount] = await db.select({
      count: sql<number>`count(distinct user_id)`,
    }).from(accountActions)
      .where(sql`${accountActions.createdAt} > now() - interval '24 hours'`);

    // Pending bot queue items
    const [pendingCount] = await db.select({
      count: sql<number>`count(*)`,
    }).from(botActionQueue)
      .where(sql`${botActionQueue.status} = 'pending'`);

    const pending = Number(pendingCount.count);
    if (pending > 10) {
      await queueAction("insight", "suspicious", "medium",
        `${pending} pending review items`,
        `You have ${pending} unreviewed items in the HITL queue. Consider reviewing flagged users and recommendations.`);
    }

    // IP ban activity
    const [banCount] = await db.select({
      count: sql<number>`count(*)`,
    }).from(botActionQueue)
      .where(sql`${botActionQueue.category} IN ('ip_ban', 'vpn', 'bot') AND ${botActionQueue.createdAt} > now() - interval '24 hours'`);

    const bans = Number(banCount.count);
    if (bans > 0) {
      await queueAction("insight", "suspicious", bans > 5 ? "high" : "low",
        `${bans} security events in last 24h`,
        `${bans} security events detected (IP bans, VPN detections, bot flags). Platform security is ${bans > 10 ? "under elevated threat" : "normal"}.`);
    }
  } catch {}
}

// ─── Main Scan Loop ─────────────────────────────────────────────────────────

async function runScan() {
  if (!hasDatabase()) return;
  lastScanAt = Date.now();
  scanCount++;

  try {
    await scanActiveSessions();
    await scanForBots();
    await scanMultiAccounts();

    // Generate insights every 6th scan (~30 min)
    if (scanCount % 6 === 0) {
      await generateInsights();
    }
  } catch (err: any) {
    console.error("[AdminBot] Scan error:", err.message);
  }
}

// ─── Start/Stop ─────────────────────────────────────────────────────────────

let scanTimer: ReturnType<typeof setInterval> | null = null;

export function startAdminBot() {
  if (isRunning) return;
  isRunning = true;
  console.log("[AdminBot] Started — scanning every 5 minutes");

  // First scan after 30 seconds (let server finish starting)
  setTimeout(() => {
    runScan();
    scanTimer = setInterval(runScan, SCAN_INTERVAL);
  }, 30000);
}

export function stopAdminBot() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
  isRunning = false;
  console.log("[AdminBot] Stopped");
}

// Auto-start
startAdminBot();

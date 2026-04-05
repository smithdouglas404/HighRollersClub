/**
 * Background Jobs Worker — Standalone process for scheduled and on-demand jobs.
 *
 * Runs independently from the main server with only DATABASE_URL and REDIS_URL.
 * Handles: tournament scheduling, mission generation, admin bot scans,
 * rakeback processing, session cleanup, tier expiry, and Redis-triggered jobs.
 *
 * Start: npx tsx server/jobs-worker.ts
 */

import http from "http";
import { storage } from "./storage";
import { hasDatabase, getDb } from "./db";
import { getPubSub } from "./infra/ws-pubsub";
import { seedData } from "./seed";
import { seedBotTables } from "./seed-bot-tables";
import { users } from "@shared/schema";
import { sql } from "drizzle-orm";

// ─── Logging (standalone, no vite dependency) ──────────────────────────────

function log(message: string) {
  const ts = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${ts} [jobs-worker] ${message}`);
}

// ─── Metrics ───────────────────────────────────────────────────────────────

interface JobMetrics {
  jobsProcessed: number;
  lastRunTimes: Record<string, number>;
  errors: number;
}

const metrics: JobMetrics = {
  jobsProcessed: 0,
  lastRunTimes: {},
  errors: 0,
};

function recordRun(jobName: string) {
  metrics.jobsProcessed++;
  metrics.lastRunTimes[jobName] = Date.now();
}

function recordError(jobName: string, err: unknown) {
  metrics.errors++;
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[jobs-worker] ${jobName} error: ${msg}`);
}

// ─── Job: Tournament Scheduler ─────────────────────────────────────────────

let lastScheduledDate: string | null = null;

async function ensureTodaysTournaments(): Promise<void> {
  await storage.ensureSystemUser();

  const today = new Date().toISOString().slice(0, 10);
  if (lastScheduledDate === today) return;

  const allTournaments = await storage.getTournaments();
  const todayStart = new Date(today + "T00:00:00Z");
  const todayEnd = new Date(today + "T23:59:59Z");

  const todaysTournaments = allTournaments.filter((t) => {
    const created = new Date(t.createdAt);
    return created >= todayStart && created <= todayEnd && t.createdById === "system";
  });

  // Import blind presets dynamically to avoid pulling in game engine deps at top level
  const { getBlindPreset } = await import("./game/blind-presets");

  const DEFAULT_SCHEDULE = [
    { name: "Morning Freeroll",   hourUTC: 10, minuteUTC: 0, buyIn: 0,    startingChips: 1000,  maxPlayers: 50,  blindInterval: undefined as number | undefined },
    { name: "Afternoon Grind",    hourUTC: 14, minuteUTC: 0, buyIn: 500,  startingChips: 5000,  maxPlayers: 30,  blindInterval: undefined as number | undefined },
    { name: "Evening Main Event", hourUTC: 20, minuteUTC: 0, buyIn: 2000, startingChips: 10000, maxPlayers: 100, blindInterval: undefined as number | undefined },
    { name: "Late Night Turbo",   hourUTC: 23, minuteUTC: 0, buyIn: 1000, startingChips: 3000,  maxPlayers: 20,  blindInterval: 3 },
  ];

  if (todaysTournaments.length >= DEFAULT_SCHEDULE.length) {
    lastScheduledDate = today;
    log(`Today's ${todaysTournaments.length} tournaments already exist — skipping.`);
    return;
  }

  const existingNames = new Set(todaysTournaments.map((t) => t.name));

  for (const sched of DEFAULT_SCHEDULE) {
    const tourneyName = `${sched.name} — ${today}`;
    if (existingNames.has(tourneyName)) continue;

    const startAt = new Date(
      `${today}T${String(sched.hourUTC).padStart(2, "0")}:${String(sched.minuteUTC).padStart(2, "0")}:00Z`
    );

    const blindPreset = sched.blindInterval && sched.blindInterval <= 5 ? "turbo" : "mtt";
    const blindSchedule = getBlindPreset(blindPreset);
    const adjustedSchedule = sched.blindInterval
      ? blindSchedule.map((level: any) => ({ ...level, durationSeconds: sched.blindInterval! * 60 }))
      : blindSchedule;

    await storage.createTournament({
      name: tourneyName,
      buyIn: sched.buyIn,
      startingChips: sched.startingChips,
      blindSchedule: adjustedSchedule,
      maxPlayers: sched.maxPlayers,
      pokerVariant: "nlhe",
      status: "registering",
      prizePool: 0,
      createdById: "system",
      clubId: null,
      startAt,
      registrationFee: 0,
      lateRegistration: false,
      payoutStructureType: "top_15",
      guaranteedPrize: 0,
      adminFeePercent: 0,
      timeBankSeconds: 30,
    });

    log(`Created tournament: "${tourneyName}" starting at ${startAt.toISOString()}`);
  }

  lastScheduledDate = today;
  log(`Daily tournament schedule applied for ${today}.`);
}

// ─── Job: Mission Generation ───────────────────────────────────────────────

const MISSION_TEMPLATES = {
  daily: [
    { type: "hands_played", label: "Play 50 Hands", description: "Play 50 hands in any game format", target: 50, reward: 200 },
    { type: "pots_won", label: "Win 20 Pots", description: "Win 20 pots in any game", target: 20, reward: 500 },
    { type: "win_streak", label: "Win Streak 5", description: "Achieve a 5-hand winning streak", target: 5, reward: 750 },
    { type: "sng_win", label: "Win a Sit & Go", description: "Finish 1st in a Sit & Go tournament", target: 1, reward: 1000 },
    { type: "bomb_pot", label: "Play 5 Bomb Pots", description: "Play 5 bomb pot hands", target: 5, reward: 300 },
    { type: "heads_up_win", label: "Win Heads-Up Match", description: "Win a heads-up format game", target: 1, reward: 500 },
    { type: "consecutive_wins", label: "Win 3 in a Row", description: "Win 3 consecutive hands", target: 3, reward: 400 },
    { type: "bluff_wins", label: "Bluff Master", description: "Win 3 hands on a fold", target: 3, reward: 1000 },
    { type: "preflop_folds", label: "Patient Player", description: "Fold preflop 10 times", target: 10, reward: 300 },
    { type: "vpip", label: "Action Player", description: "Voluntarily enter 15 pots", target: 15, reward: 400 },
  ],
  weekly: [
    { type: "hands_played", label: "Marathon", description: "Play 100 hands this week", target: 100, reward: 3000 },
    { type: "pots_won", label: "Shark Week", description: "Win 30 pots this week", target: 30, reward: 5000 },
    { type: "plo_hands", label: "Omaha Explorer", description: "Play 20 PLO hands", target: 20, reward: 2000 },
    { type: "tournament_hands", label: "Tournament Grinder", description: "Play 50 tournament hands", target: 50, reward: 4000 },
    { type: "sng_win", label: "SNG Champion", description: "Win a Sit & Go", target: 1, reward: 3000 },
    { type: "big_pot_wins", label: "Whale Hunter", description: "Win 5 big pots", target: 5, reward: 5000 },
  ],
};

async function generateMissionsForAllUsers(): Promise<number> {
  if (!hasDatabase()) return 0;
  const db = getDb();

  // Get all users created or recently active (uses createdAt as proxy)
  const activeUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.createdAt} > now() - interval '30 days'`)
    .limit(1000);

  const shuffle = <T>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
  let count = 0;

  for (const { id: userId } of activeUsers) {
    try {
      // Check if user already has active missions for today
      const existingMissions = await storage.getUserMissions(userId);
      const today = new Date().toISOString().slice(0, 10);
      const hasTodayMissions = existingMissions.some((m) => {
        const created = new Date(m.periodStart).toISOString().slice(0, 10);
        return created === today;
      });
      if (hasTodayMissions) continue;

      const dailyPicks = shuffle(MISSION_TEMPLATES.daily).slice(0, 3 + Math.round(Math.random()));
      const weeklyPicks = shuffle(MISSION_TEMPLATES.weekly).slice(0, 3 + Math.round(Math.random()));
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

      for (const t of [...dailyPicks, ...weeklyPicks]) {
        const isWeekly = MISSION_TEMPLATES.weekly.includes(t);
        const mission = await storage.createMission({
          type: t.type,
          label: t.label,
          description: t.description,
          target: t.target,
          reward: t.reward,
          periodType: isWeekly ? "weekly" : "daily",
          isActive: true,
        });
        const statField = baselineFieldMap[t.type];
        const baseline =
          stats && statField && typeof (stats as any)[statField] === "number"
            ? ((stats as any)[statField] as number)
            : 0;
        await storage.createUserMission({
          userId,
          missionId: mission.id,
          progress: 0,
          completedAt: null,
          claimedAt: null,
          periodStart: new Date(),
          baselineValue: baseline,
        });
      }
      count++;
    } catch (err) {
      // Skip individual user failures
    }
  }

  return count;
}

// ─── Job: Rakeback Processing ──────────────────────────────────────────────

async function processRakeback(percent = 20, days = 7): Promise<{ processed: number; totalPaid: number }> {
  const rakebackPercent = Math.min(Math.max(percent, 1), 100);
  const lookbackDays = Math.min(Math.max(days, 1), 90);

  const rakeByPlayer = await storage.getRakeByPlayer(lookbackDays);
  let processed = 0;
  let totalPaid = 0;

  for (const entry of rakeByPlayer) {
    const rakebackAmount = Math.floor((entry.totalRake * rakebackPercent) / 100);
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
      description: `Rakeback payout (${rakebackPercent}% of ${entry.totalRake} rake over ${lookbackDays} days)`,
      walletType: "bonus",
      relatedTransactionId: null,
      paymentId: null,
      metadata: null,
    });

    processed++;
    totalPaid += rakebackAmount;
  }

  return { processed, totalPaid };
}

// ─── Job: Stale Session Cleanup ────────────────────────────────────────────

async function cleanupStaleSessions(): Promise<number> {
  if (!hasDatabase()) return 0;
  const db = getDb();

  // Delete sessions older than 24 hours from the sessions table
  try {
    const result = await db.execute(
      sql`DELETE FROM session WHERE expire < now() RETURNING sid`
    );
    const count = Array.isArray(result) ? result.length : 0;
    return count;
  } catch {
    // Session table may not exist if using memory store
    return 0;
  }
}

// ─── Job: Tier Expiry Check ────────────────────────────────────────────────

async function checkTierExpiry(): Promise<number> {
  if (!hasDatabase()) return 0;
  const db = getDb();

  // Find users whose tier has expired and is not already free
  const expiredUsers = await db
    .select({ id: users.id, tier: users.tier })
    .from(users)
    .where(
      sql`${users.tier} != 'free' AND ${users.tierExpiresAt} IS NOT NULL AND ${users.tierExpiresAt} < now()`
    )
    .limit(500);

  for (const user of expiredUsers) {
    await storage.updateUser(user.id, { tier: "free", tierExpiresAt: null });
    log(`Downgraded user ${user.id.slice(0, 8)} from ${user.tier} to free (expired).`);
  }

  return expiredUsers.length;
}

// ─── Job: Admin Bot Scan (simplified for worker — no WS access) ────────────

async function runAdminBotScan(): Promise<void> {
  if (!hasDatabase()) return;
  const db = getDb();

  try {
    const { handActions, botActionQueue } = await import("@shared/schema");
    const { analyzePlayerTiming } = await import("./game/bot-detection");

    // Bot detection scan
    const recentPlayers = await db
      .select({ playerId: handActions.playerId })
      .from(handActions)
      .where(sql`${handActions.timeSpent} is not null AND ${handActions.timeSpent} > 0`)
      .groupBy(handActions.playerId)
      .having(sql`count(*) >= 20`)
      .limit(30);

    for (const { playerId } of recentPlayers) {
      if (!playerId || playerId.startsWith("bot-")) continue;

      const actions = await db
        .select({
          actionType: handActions.actionType,
          timeSpent: handActions.timeSpent,
          street: handActions.street,
        })
        .from(handActions)
        .where(sql`${handActions.playerId} = ${playerId} AND ${handActions.timeSpent} > 0`)
        .orderBy(sql`${handActions.sequenceNum} DESC`)
        .limit(200);

      const timings = actions
        .filter((a) => a.timeSpent !== null)
        .map((a) => ({
          actionType: a.actionType,
          timeSpentMs: a.timeSpent!,
          street: a.street,
        }));

      const result = analyzePlayerTiming(playerId, timings);

      if (result.riskScore >= 80) {
        await storage.updateUser(playerId, { selfExcludedUntil: new Date("2099-12-31") });
        await db.insert(botActionQueue).values({
          type: "auto_action",
          category: "bot",
          severity: "critical",
          title: `Bot auto-suspended: risk ${result.riskScore}`,
          description: `Player ${playerId.slice(0, 8)} scored ${result.riskScore}/100. Signals: ${result.signals.map((s: any) => s.type).join(", ")}`,
          targetUserId: playerId,
          targetType: "user",
          targetId: playerId,
          actionTaken: "account_suspended",
          status: "actioned",
          details: { result },
        });
        log(`Bot auto-suspended: ${playerId.slice(0, 8)} (risk ${result.riskScore})`);
      } else if (result.riskScore >= 40) {
        await db.insert(botActionQueue).values({
          type: "recommendation",
          category: "bot",
          severity: result.riskScore >= 60 ? "high" : "medium",
          title: `Possible bot: risk ${result.riskScore}`,
          description: `Player ${playerId.slice(0, 8)} shows bot-like patterns. Avg ${result.avgTimeMs}ms, StdDev ${result.stdDevMs}ms.`,
          targetUserId: playerId,
          targetType: "user",
          targetId: playerId,
          actionTaken: null,
          status: "pending",
          details: { result },
        });
      }
    }

    // Generate insights every 6th scan (~30 min)
    const { accountActions } = await import("@shared/schema");

    const [pendingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(botActionQueue)
      .where(sql`${botActionQueue.status} = 'pending'`);

    const pending = Number(pendingCount.count);
    if (pending > 10) {
      await db.insert(botActionQueue).values({
        type: "insight",
        category: "suspicious",
        severity: "medium",
        title: `${pending} pending review items`,
        description: `You have ${pending} unreviewed items in the HITL queue. Consider reviewing.`,
        targetUserId: null,
        targetType: null,
        targetId: null,
        actionTaken: null,
        status: "pending",
        details: null,
      });
    }
  } catch (err) {
    // Schema tables may not exist yet
  }
}

// ─── Redis Job Listener ────────────────────────────────────────────────────

function setupRedisListener() {
  if (!process.env.REDIS_URL) {
    log("No REDIS_URL — Redis job listener disabled. Using scheduled jobs only.");
    return;
  }

  const pubsub = getPubSub();

  pubsub.subscribe("jobs:run", async (message: any) => {
    log(`Received on-demand job: ${JSON.stringify(message)}`);
    const startTime = Date.now();
    let result: any = null;

    try {
      switch (message.type) {
        case "process_rakeback": {
          const rb = await processRakeback(message.percent || 20, message.days || 7);
          result = rb;
          log(`Rakeback processed: ${rb.processed} users, ${rb.totalPaid} chips paid.`);
          break;
        }
        case "generate_missions": {
          const count = await generateMissionsForAllUsers();
          result = { usersProcessed: count };
          log(`Missions generated for ${count} users.`);
          break;
        }
        case "seed_bot_tables": {
          await seedBotTables();
          result = { seeded: true };
          log("Bot tables seeded.");
          break;
        }
        case "cleanup_sessions": {
          const cleaned = await cleanupStaleSessions();
          result = { sessionsRemoved: cleaned };
          log(`Cleaned ${cleaned} stale sessions.`);
          break;
        }
        default:
          log(`Unknown job type: ${message.type}`);
          result = { error: `Unknown job type: ${message.type}` };
      }
    } catch (err) {
      recordError(`redis:${message.type}`, err);
      result = { error: err instanceof Error ? err.message : String(err) };
    }

    // Publish completion event
    try {
      await pubsub.publish("jobs:complete", {
        type: message.type,
        result,
        durationMs: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      });
    } catch {
      // Redis publish failure is non-fatal
    }

    recordRun(`redis:${message.type}`);
  });

  log("Redis job listener active on channel 'jobs:run'.");
}

// ─── Scheduled Jobs ────────────────────────────────────────────────────────

const intervals: ReturnType<typeof setInterval>[] = [];

function scheduleJob(name: string, intervalMs: number, fn: () => Promise<void>) {
  const wrapped = async () => {
    try {
      await fn();
      recordRun(name);
    } catch (err) {
      recordError(name, err);
    }
  };

  // Run immediately, then on interval
  wrapped();
  intervals.push(setInterval(wrapped, intervalMs));
  log(`Scheduled "${name}" every ${Math.round(intervalMs / 1000)}s.`);
}

function scheduleMidnightJob(name: string, fn: () => Promise<void>) {
  // Calculate ms until next midnight UTC
  const now = new Date();
  const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  const msUntilMidnight = nextMidnight.getTime() - now.getTime();

  const wrapped = async () => {
    try {
      await fn();
      recordRun(name);
    } catch (err) {
      recordError(name, err);
    }
  };

  // Run at next midnight, then every 24 hours
  setTimeout(() => {
    wrapped();
    intervals.push(setInterval(wrapped, 24 * 60 * 60 * 1000));
  }, msUntilMidnight);

  log(`Scheduled "${name}" at midnight UTC (in ${Math.round(msUntilMidnight / 1000)}s), then daily.`);
}

function scheduleSundayMidnight(name: string, fn: () => Promise<void>) {
  // Calculate ms until next Sunday midnight UTC
  const now = new Date();
  const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7; // 0 = Sunday
  const nextSunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilSunday, 0, 0, 0));
  const msUntilSunday = nextSunday.getTime() - now.getTime();

  const wrapped = async () => {
    try {
      await fn();
      recordRun(name);
    } catch (err) {
      recordError(name, err);
    }
  };

  // Run at next Sunday midnight, then every 7 days
  setTimeout(() => {
    wrapped();
    intervals.push(setInterval(wrapped, 7 * 24 * 60 * 60 * 1000));
  }, msUntilSunday);

  log(`Scheduled "${name}" at Sunday midnight UTC (in ${Math.round(msUntilSunday / 60000)}min), then weekly.`);
}

// ─── Health Endpoint ───────────────────────────────────────────────────────

function startHealthServer() {
  const port = parseInt(process.env.JOBS_HEALTH_PORT || "3001", 10);

  const server = http.createServer((_req, res) => {
    if (_req.url === "/health" && _req.method === "GET") {
      const now = Date.now();
      const nextRuns: Record<string, string> = {};

      for (const [job, lastRun] of Object.entries(metrics.lastRunTimes)) {
        // Estimate next run based on known intervals
        const intervalMap: Record<string, number> = {
          tournaments: 60 * 60 * 1000,
          admin_bot_scan: 5 * 60 * 1000,
          session_cleanup: 60 * 60 * 1000,
          tier_expiry: 60 * 60 * 1000,
        };
        const interval = intervalMap[job];
        if (interval) {
          const nextRun = new Date(lastRun + interval);
          nextRuns[job] = nextRun.toISOString();
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          uptime: process.uptime(),
          jobsProcessed: metrics.jobsProcessed,
          errors: metrics.errors,
          lastRunTimes: Object.fromEntries(
            Object.entries(metrics.lastRunTimes).map(([k, v]) => [k, new Date(v).toISOString()])
          ),
          nextScheduledRuns: nextRuns,
        })
      );
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  server.listen(port, () => {
    log(`Health endpoint listening on :${port}/health`);
  });
}

// ─── Startup ───────────────────────────────────────────────────────────────

async function main() {
  log("Starting background jobs worker...");

  if (!hasDatabase()) {
    console.error("[jobs-worker] FATAL: DATABASE_URL is required.");
    process.exit(1);
  }

  // Run seeds on first boot (idempotent)
  log("Running startup seeds...");
  try {
    await seedData();
    log("Seed data complete.");
  } catch (err) {
    recordError("seed_data", err);
  }

  try {
    await seedBotTables();
    log("Bot tables seed complete.");
  } catch (err) {
    recordError("seed_bot_tables", err);
  }

  // Start scheduled jobs
  scheduleJob("tournaments", 60 * 60 * 1000, ensureTodaysTournaments);           // Every hour
  scheduleJob("admin_bot_scan", 5 * 60 * 1000, runAdminBotScan);                 // Every 5 min
  scheduleJob("session_cleanup", 60 * 60 * 1000, cleanupStaleSessions as any);   // Every hour
  scheduleJob("tier_expiry", 60 * 60 * 1000, async () => {                       // Every hour
    const count = await checkTierExpiry();
    if (count > 0) log(`Downgraded ${count} expired tiers.`);
  });

  scheduleMidnightJob("mission_generation", async () => {
    const count = await generateMissionsForAllUsers();
    log(`Midnight mission generation: ${count} users processed.`);
  });

  scheduleSundayMidnight("weekly_rakeback", async () => {
    const result = await processRakeback(20, 7);
    log(`Weekly rakeback: ${result.processed} users, ${result.totalPaid} chips.`);
  });

  // Redis job listener (for on-demand jobs from admin API)
  setupRedisListener();

  // Health endpoint
  startHealthServer();

  log("Jobs worker running. Press Ctrl+C to stop.");

  // Graceful shutdown
  const shutdown = () => {
    log("Shutting down...");
    for (const interval of intervals) clearInterval(interval);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[jobs-worker] Fatal startup error:", err);
  process.exit(1);
});

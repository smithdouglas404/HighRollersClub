import { storage } from "./storage";
import { MTTManager, activeMTTs } from "./game/mtt-manager";
import { log } from "./vite";
import { getBlindPreset } from "./game/blind-presets";

// ─── Tournament Schedule Definitions ─────────────────────────────────────────

export interface ScheduledTournament {
  name: string;
  hourUTC: number;
  minuteUTC: number;
  buyIn: number;
  startingChips: number;
  maxPlayers: number;
  blindInterval?: number; // override blind level duration in minutes
}

const DEFAULT_SCHEDULE: ScheduledTournament[] = [
  { name: "Morning Freeroll",    hourUTC: 10, minuteUTC: 0, buyIn: 0,    startingChips: 1000,  maxPlayers: 50 },
  { name: "Afternoon Grind",     hourUTC: 14, minuteUTC: 0, buyIn: 500,  startingChips: 5000,  maxPlayers: 30 },
  { name: "Evening Main Event",  hourUTC: 20, minuteUTC: 0, buyIn: 2000, startingChips: 10000, maxPlayers: 100 },
  { name: "Late Night Turbo",    hourUTC: 23, minuteUTC: 0, buyIn: 1000, startingChips: 3000,  maxPlayers: 20, blindInterval: 3 },
];

// In-memory tracking to avoid re-creating tournaments on the same day
let lastScheduledDate: string | null = null;

// Allow admin modifications at runtime
let currentSchedule: ScheduledTournament[] = [...DEFAULT_SCHEDULE];

// ─── Core Scheduling Logic ───────────────────────────────────────────────────

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * Ensure today's scheduled tournaments exist in the database.
 * Idempotent: skips if tournaments for today were already created.
 */
async function ensureTodaysTournaments(): Promise<void> {
  // Ensure system user exists before creating tournaments (FK constraint on created_by_id)
  await storage.ensureSystemUser();

  const today = todayDateString();

  if (lastScheduledDate === today) {
    return; // Already scheduled today
  }

  try {
    // Double-check by looking for tournaments created today with our naming pattern
    const allTournaments = await storage.getTournaments();
    const todayStart = new Date(today + "T00:00:00Z");
    const todayEnd = new Date(today + "T23:59:59Z");

    const todaysTournaments = allTournaments.filter((t) => {
      const created = new Date(t.createdAt);
      return created >= todayStart && created <= todayEnd && t.createdById === "system";
    });

    if (todaysTournaments.length >= currentSchedule.length) {
      // All tournaments already created for today
      lastScheduledDate = today;
      log(`[scheduler] Today's ${todaysTournaments.length} tournaments already exist — skipping.`);
      return;
    }

    // Create missing tournaments
    const existingNames = new Set(todaysTournaments.map((t) => t.name));

    for (const sched of currentSchedule) {
      const tourneyName = `${sched.name} — ${today}`;
      if (existingNames.has(tourneyName)) continue;

      const startAt = new Date(`${today}T${String(sched.hourUTC).padStart(2, "0")}:${String(sched.minuteUTC).padStart(2, "0")}:00Z`);

      // Build blind schedule: use turbo preset for short intervals, mtt for standard
      const blindPreset = sched.blindInterval && sched.blindInterval <= 5 ? "turbo" : "mtt";
      const blindSchedule = getBlindPreset(blindPreset);

      // Override durations if a custom interval was specified
      const adjustedSchedule = sched.blindInterval
        ? blindSchedule.map((level) => ({ ...level, durationSeconds: sched.blindInterval! * 60 }))
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

      log(`[scheduler] Created tournament: "${tourneyName}" starting at ${startAt.toISOString()}`);
    }

    lastScheduledDate = today;
    log(`[scheduler] Daily tournament schedule applied for ${today}.`);
  } catch (err) {
    console.error("[scheduler] Failed to create daily tournaments:", err);
  }
}

/**
 * Check if any scheduled tournaments should auto-start
 * (start time has passed and they're still in "registering" status).
 */
async function checkTournamentAutoStart(): Promise<void> {
  try {
    const allTournaments = await storage.getTournaments();
    const now = new Date();

    for (const tourney of allTournaments) {
      if (tourney.status !== "registering") continue;
      if (tourney.createdById !== "system") continue;
      if (!tourney.startAt) continue;

      const startTime = new Date(tourney.startAt);
      const regs = await storage.getTournamentRegistrations(tourney.id);

      // Auto-start if registration is full
      const shouldStartFull = regs.length >= tourney.maxPlayers;
      // Auto-start if start time has passed (with at least 2 players)
      const shouldStartTime = now >= startTime && regs.length >= 2;

      if (shouldStartFull || shouldStartTime) {
        log(`[scheduler] Auto-starting tournament "${tourney.name}" with ${regs.length} players.`);

        const mtt = new MTTManager(tourney.id, regs.map((r) => ({
          userId: r.userId,
          username: r.userId,
          displayName: r.userId,
        })), {
          prizePool: tourney.prizePool,
          startingChips: tourney.startingChips,
          buyInAmount: tourney.buyIn,
          blindSchedule: (tourney.blindSchedule as any) || undefined,
        });

        activeMTTs.set(tourney.id, mtt);

        try {
          await mtt.start();
          log(`[scheduler] Tournament "${tourney.name}" is now running.`);
        } catch (err) {
          console.error(`[scheduler] Failed to start tournament "${tourney.name}":`, err);
          activeMTTs.delete(tourney.id);
        }
      }

      // If start time passed but fewer than 2 registrants, cancel
      if (now >= startTime && regs.length < 2 && !shouldStartFull) {
        const tenMinutesAfter = new Date(startTime.getTime() + 10 * 60 * 1000);
        if (now >= tenMinutesAfter) {
          log(`[scheduler] Cancelling tournament "${tourney.name}" — insufficient registrations (${regs.length}).`);
          await storage.updateTournament(tourney.id, { status: "complete" });
        }
      }
    }
  } catch (err) {
    console.error("[scheduler] Failed to check tournament auto-start:", err);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize the daily tournament scheduler.
 * Runs immediately and then checks every hour.
 */
export function scheduleDailyTournaments(): void {
  // Run immediately on startup
  ensureTodaysTournaments().then(() => checkTournamentAutoStart()).catch(() => {});

  // Then check every hour (creates new day's tournaments at midnight, and auto-starts)
  schedulerInterval = setInterval(async () => {
    await ensureTodaysTournaments();
    await checkTournamentAutoStart();
  }, 60 * 60 * 1000); // 1 hour

  log("[scheduler] Daily tournament scheduler initialized (runs every hour).");
}

/**
 * Get the current tournament schedule (for admin API).
 */
export function getTournamentSchedule(): ScheduledTournament[] {
  return [...currentSchedule];
}

/**
 * Update the tournament schedule (for admin API).
 * Only affects future days — today's tournaments are already created.
 */
export function setTournamentSchedule(schedule: ScheduledTournament[]): void {
  currentSchedule = [...schedule];
  lastScheduledDate = null; // Force re-evaluation on next check
  log(`[scheduler] Tournament schedule updated (${schedule.length} entries).`);
}

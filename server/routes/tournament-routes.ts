import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { storage } from "../storage";
import { createTournamentSchema, createAllianceSchema, updateAllianceSchema, createLeagueSeasonSchema, updateLeagueSeasonSchema, leagueStandingsSchema } from "@shared/schema";
import { getBlindPreset } from "../game/blind-presets";
import { MTTManager, activeMTTs } from "../game/mtt-manager";

// ─── Tier System Constants (needed for tierRank) ──────────────────────
const TIER_ORDER = ["free", "bronze", "silver", "gold", "platinum"] as const;
type Tier = typeof TIER_ORDER[number];

function tierRank(tier: string): number {
  const idx = TIER_ORDER.indexOf(tier as Tier);
  return idx >= 0 ? idx : 0;
}

export async function registerTournamentRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler,
) {

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

      // Gate tournament hosting with rake/fees: require Platinum tier (club owners only)
      if ((adminFeePercent ?? 0) > 0) {
        const tourUser = await storage.getUser(req.user!.id);
        if (!tourUser || tierRank(tourUser.tier) < tierRank("platinum")) {
          return res.status(403).json({ message: "Platinum tier required to host tournaments with admin fees" });
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

  // ─── Tier tournament buy-in limits (cents; 0 = special: free=freerolls-only, gold/plat=unlimited) ───
  const TIER_TOURNAMENT_BUYIN_MAX: Record<string, number> = {
    free: 0, bronze: 2500, silver: 20000, gold: 0, platinum: 0,
  };

  app.post("/api/tournaments/:id/register", requireAuth, async (req, res, next) => {
    try {
      const tourney = await storage.getTournament(req.params.id);
      if (!tourney) return res.status(404).json({ message: "Tournament not found" });
      if (tourney.status !== "registering") {
        return res.status(400).json({ message: "Registration closed" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(400).json({ message: "User not found" });

      // ─── Tier-based tournament buy-in limit enforcement ───────────────
      const tier = user.tier || "free";
      const maxBuyIn = TIER_TOURNAMENT_BUYIN_MAX[tier] ?? 0;
      if (tier === "free" && tourney.buyIn > 0) {
        return res.status(403).json({ message: "Free tier can only join freeroll tournaments (buy-in = 0). Upgrade to Bronze or higher." });
      }
      if (tier !== "free" && maxBuyIn > 0 && tourney.buyIn > maxBuyIn) {
        return res.status(403).json({
          message: `Your ${tier} tier allows tournament buy-ins up to $${(maxBuyIn / 100).toFixed(2)}. This tournament requires $${(tourney.buyIn / 100).toFixed(2)}. Upgrade your tier.`,
        });
      }

      // KYC required for all paid tournaments
      if (tourney.buyIn > 0 && user.kycStatus !== "verified") {
        return res.status(403).json({ message: "KYC verification required for paid tournaments. Visit /kyc to verify your identity." });
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
}

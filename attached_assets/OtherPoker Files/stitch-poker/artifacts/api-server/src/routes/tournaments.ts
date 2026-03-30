import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  ListTournamentsResponse,
  CreateTournamentBody,
  GetTournamentParams,
  GetTournamentResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tournaments", async (_req, res) => {
  const tournaments = await db.select().from(tournamentsTable);
  const mapped = tournaments.map((t) => ({
    ...t,
    description: t.description ?? undefined,
    prizePool: t.prizePool ?? undefined,
    blindStructure: t.blindStructure ?? undefined,
    startingChips: t.startingChips ?? undefined,
    levels: t.levels ?? undefined,
    gameType: t.gameType as "texas_holdem" | "omaha" | "short_deck" | "plo5",
    status: t.status as "registration" | "in_progress" | "completed" | "cancelled",
    startTime: t.startTime?.toISOString(),
    createdAt: t.createdAt.toISOString(),
  }));
  res.json(ListTournamentsResponse.parse(mapped));
});

router.post("/tournaments", async (req, res) => {
  const body = CreateTournamentBody.parse(req.body);
  const [tournament] = await db
    .insert(tournamentsTable)
    .values({
      name: body.name,
      description: body.description,
      gameType: body.gameType,
      buyIn: body.buyIn,
      maxPlayers: body.maxPlayers,
      startTime: body.startTime ? new Date(body.startTime) : null,
      blindStructure: body.blindStructure,
      startingChips: body.startingChips,
    })
    .returning();

  res.status(201).json(
    GetTournamentResponse.parse({
      ...tournament,
      description: tournament.description ?? undefined,
      prizePool: tournament.prizePool ?? undefined,
      blindStructure: tournament.blindStructure ?? undefined,
      startingChips: tournament.startingChips ?? undefined,
      levels: tournament.levels ?? undefined,
      gameType: tournament.gameType as "texas_holdem" | "omaha" | "short_deck" | "plo5",
      status: tournament.status as "registration" | "in_progress" | "completed" | "cancelled",
      startTime: tournament.startTime?.toISOString(),
    })
  );
});

router.get("/tournaments/:tournamentId", async (req, res) => {
  const { tournamentId } = GetTournamentParams.parse({
    tournamentId: req.params.tournamentId,
  });
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));

  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  res.json(
    GetTournamentResponse.parse({
      ...tournament,
      description: tournament.description ?? undefined,
      prizePool: tournament.prizePool ?? undefined,
      blindStructure: tournament.blindStructure ?? undefined,
      startingChips: tournament.startingChips ?? undefined,
      levels: tournament.levels ?? undefined,
      gameType: tournament.gameType as "texas_holdem" | "omaha" | "short_deck" | "plo5",
      status: tournament.status as "registration" | "in_progress" | "completed" | "cancelled",
      startTime: tournament.startTime?.toISOString(),
    })
  );
});

export default router;

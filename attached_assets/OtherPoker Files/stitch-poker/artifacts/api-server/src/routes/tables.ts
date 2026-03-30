import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { pokerTablesTable } from "@workspace/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import {
  ListTablesResponse,
  CreateTableBody,
  GetTableParams,
  GetTableResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tables", async (req, res) => {
  const { gameType, status } = req.query;
  const conditions = [];
  if (gameType && typeof gameType === "string") {
    conditions.push(eq(pokerTablesTable.gameType, gameType));
  }
  if (status && typeof status === "string") {
    conditions.push(eq(pokerTablesTable.status, status));
  }
  const tables = await db
    .select()
    .from(pokerTablesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  const mapped = tables.map((t) => ({
    ...t,
    clubId: t.clubId ?? undefined,
    minBuyIn: t.minBuyIn ?? undefined,
    maxBuyIn: t.maxBuyIn ?? undefined,
    gameType: t.gameType as "texas_holdem" | "omaha" | "short_deck" | "plo5",
    status: t.status as "waiting" | "in_progress" | "paused",
  }));
  res.json(ListTablesResponse.parse(mapped));
});

router.post("/tables", async (req, res) => {
  const body = CreateTableBody.parse(req.body);
  const stakes = `${body.smallBlind}/${body.bigBlind}`;
  const [table] = await db
    .insert(pokerTablesTable)
    .values({
      name: body.name,
      gameType: body.gameType,
      smallBlind: body.smallBlind,
      bigBlind: body.bigBlind,
      minBuyIn: body.minBuyIn,
      maxBuyIn: body.maxBuyIn,
      maxPlayers: body.maxPlayers,
      isPrivate: body.isPrivate,
      clubId: body.clubId,
      stakes,
    })
    .returning();

  res.status(201).json(
    GetTableResponse.parse({
      ...table,
      clubId: table.clubId ?? undefined,
      minBuyIn: table.minBuyIn ?? undefined,
      maxBuyIn: table.maxBuyIn ?? undefined,
      gameType: table.gameType as "texas_holdem" | "omaha" | "short_deck" | "plo5",
      status: table.status as "waiting" | "in_progress" | "paused",
    })
  );
});

router.get("/tables/:tableId", async (req, res) => {
  const { tableId } = GetTableParams.parse({ tableId: req.params.tableId });
  const [table] = await db
    .select()
    .from(pokerTablesTable)
    .where(eq(pokerTablesTable.id, tableId));

  if (!table) {
    res.status(404).json({ error: "Table not found" });
    return;
  }

  res.json(
    GetTableResponse.parse({
      ...table,
      clubId: table.clubId ?? undefined,
      minBuyIn: table.minBuyIn ?? undefined,
      maxBuyIn: table.maxBuyIn ?? undefined,
      gameType: table.gameType as "texas_holdem" | "omaha" | "short_deck" | "plo5",
      status: table.status as "waiting" | "in_progress" | "paused",
    })
  );
});

export default router;

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clubsTable, clubMembersTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  ListClubsResponse,
  CreateClubBody,
  GetClubParams,
  GetClubResponse,
  GetClubMembersParams,
  GetClubMembersResponse,
} from "@workspace/api-zod";
import { requireAuth, getSessionUserId } from "../lib/auth";

const router: IRouter = Router();

router.get("/clubs", async (_req, res) => {
  const clubs = await db
    .select({
      id: clubsTable.id,
      name: clubsTable.name,
      description: clubsTable.description,
      ownerUsername: usersTable.username,
      memberCount: clubsTable.memberCount,
      maxMembers: clubsTable.maxMembers,
      isPrivate: clubsTable.isPrivate,
      chipBuyIn: clubsTable.chipBuyIn,
      imageUrl: clubsTable.imageUrl,
      createdAt: clubsTable.createdAt,
    })
    .from(clubsTable)
    .leftJoin(usersTable, eq(clubsTable.ownerId, usersTable.id));

  const mapped = clubs.map((c) => ({
    ...c,
    description: c.description ?? undefined,
    ownerUsername: c.ownerUsername ?? "unknown",
    chipBuyIn: c.chipBuyIn ?? undefined,
    imageUrl: c.imageUrl ?? undefined,
    createdAt: c.createdAt?.toISOString(),
  }));

  res.json(ListClubsResponse.parse(mapped));
});

router.post("/clubs", requireAuth, async (req, res) => {
  const body = CreateClubBody.parse(req.body);
  const userId = getSessionUserId(req)!;

  const [owner] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId));

  const [club] = await db
    .insert(clubsTable)
    .values({
      name: body.name,
      description: body.description,
      maxMembers: body.maxMembers,
      isPrivate: body.isPrivate,
      chipBuyIn: body.chipBuyIn,
      ownerId: userId,
    })
    .returning();

  await db.insert(clubMembersTable).values({
    clubId: club.id,
    userId,
    role: "owner",
  });

  const result = GetClubResponse.parse({
    id: club.id,
    name: club.name,
    description: club.description ?? undefined,
    ownerUsername: owner?.username ?? "unknown",
    memberCount: club.memberCount,
    maxMembers: club.maxMembers,
    isPrivate: club.isPrivate,
    chipBuyIn: club.chipBuyIn ?? undefined,
    imageUrl: club.imageUrl ?? undefined,
    createdAt: club.createdAt.toISOString(),
  });

  res.status(201).json(result);
});

router.get("/clubs/:clubId", async (req, res) => {
  const { clubId } = GetClubParams.parse({ clubId: req.params.clubId });
  const [club] = await db
    .select({
      id: clubsTable.id,
      name: clubsTable.name,
      description: clubsTable.description,
      ownerUsername: usersTable.username,
      memberCount: clubsTable.memberCount,
      maxMembers: clubsTable.maxMembers,
      isPrivate: clubsTable.isPrivate,
      chipBuyIn: clubsTable.chipBuyIn,
      imageUrl: clubsTable.imageUrl,
      createdAt: clubsTable.createdAt,
    })
    .from(clubsTable)
    .leftJoin(usersTable, eq(clubsTable.ownerId, usersTable.id))
    .where(eq(clubsTable.id, clubId));

  if (!club) {
    res.status(404).json({ error: "Club not found" });
    return;
  }

  res.json(
    GetClubResponse.parse({
      ...club,
      description: club.description ?? undefined,
      ownerUsername: club.ownerUsername ?? "unknown",
      chipBuyIn: club.chipBuyIn ?? undefined,
      imageUrl: club.imageUrl ?? undefined,
      createdAt: club.createdAt?.toISOString(),
    })
  );
});

router.get("/clubs/:clubId/members", async (req, res) => {
  const { clubId } = GetClubMembersParams.parse({ clubId: req.params.clubId });
  const members = await db
    .select({
      username: usersTable.username,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      role: clubMembersTable.role,
      joinedAt: clubMembersTable.joinedAt,
    })
    .from(clubMembersTable)
    .leftJoin(usersTable, eq(clubMembersTable.userId, usersTable.id))
    .where(eq(clubMembersTable.clubId, clubId));

  const mapped = members.map((m) => ({
    ...m,
    username: m.username ?? "unknown",
    displayName: m.displayName ?? "Unknown",
    avatarUrl: m.avatarUrl ?? undefined,
    role: m.role as "owner" | "admin" | "member",
    joinedAt: m.joinedAt?.toISOString(),
  }));

  res.json(GetClubMembersResponse.parse(mapped));
});

export default router;

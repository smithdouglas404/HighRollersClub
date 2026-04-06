import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, getSessionUserId } from "../lib/auth";
import { getBalance } from "../lib/wallet";

const router: IRouter = Router();

router.get("/users/me", requireAuth, async (req, res) => {
  const userId = getSessionUserId(req)!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const balance = await getBalance(userId);

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    chips: balance,
    level: user.level,
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;

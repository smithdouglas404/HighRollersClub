import { Router, type IRouter } from "express";
import { GetCurrentUserResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users/me", (_req, res) => {
  const data = GetCurrentUserResponse.parse({
    id: 1,
    username: "player_one",
    displayName: "Player One",
    avatarUrl: "",
    chips: 25000,
    level: 12,
    gamesPlayed: 247,
    gamesWon: 89,
    createdAt: new Date().toISOString(),
  });
  res.json(data);
});

export default router;

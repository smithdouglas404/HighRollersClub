import { Router, type IRouter } from "express";
import { requireAuth, getSessionUserId } from "../lib/auth";
import {
  getGameState,
  joinTable,
  leaveTable,
  startHand,
  performAction,
  type PlayerAction,
} from "../lib/game-engine";
import { broadcastGameState, broadcastToTable } from "../lib/websocket";

const router: IRouter = Router();

router.get("/tables/:tableId/game", requireAuth, async (req, res) => {
  const tableId = Number(req.params.tableId);
  if (isNaN(tableId)) {
    res.status(400).json({ error: "Invalid table ID" });
    return;
  }
  const userId = getSessionUserId(req)!;
  const state = await getGameState(tableId, userId);
  res.json(state);
});

router.post("/tables/:tableId/join", requireAuth, async (req, res) => {
  const tableId = Number(req.params.tableId);
  const userId = getSessionUserId(req)!;
  const { seatIndex, buyIn } = req.body;

  if (typeof seatIndex !== "number" || typeof buyIn !== "number") {
    res.status(400).json({ error: "seatIndex and buyIn are required" });
    return;
  }

  try {
    const player = await joinTable(tableId, userId, seatIndex, buyIn);
    res.json(player);
    broadcastGameState(tableId);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/tables/:tableId/leave", requireAuth, async (req, res) => {
  const tableId = Number(req.params.tableId);
  const userId = getSessionUserId(req)!;

  try {
    await leaveTable(tableId, userId);
    res.json({ success: true });
    broadcastGameState(tableId);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/tables/:tableId/start", requireAuth, async (req, res) => {
  const tableId = Number(req.params.tableId);
  const userId = getSessionUserId(req)!;

  try {
    const state = await getGameState(tableId, userId);
    const isSeated = state.players.some((p: any) => p.userId === userId);
    if (!isSeated) {
      res.status(403).json({ error: "You must be seated at this table to start a hand" });
      return;
    }
    const result = await startHand(tableId);
    res.json(result);
    broadcastGameState(tableId);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/tables/:tableId/action", requireAuth, async (req, res) => {
  const tableId = Number(req.params.tableId);
  const userId = getSessionUserId(req)!;
  const { action, amount } = req.body;

  const validActions: PlayerAction[] = ["fold", "check", "call", "raise", "all_in"];
  if (!validActions.includes(action)) {
    res.status(400).json({ error: "Invalid action" });
    return;
  }

  try {
    const state = await performAction(tableId, userId, action, amount);
    res.json(state);
    broadcastGameState(tableId);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

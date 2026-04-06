import { Router, type IRouter } from "express";
import { requireAuth, getSessionUserId } from "../lib/auth";
import { getBalance, getTransactionHistory } from "../lib/wallet";

const router: IRouter = Router();

router.get("/wallet/balance", requireAuth, async (req, res) => {
  const userId = getSessionUserId(req)!;
  const balance = await getBalance(userId);
  res.json({ balance });
});

router.get("/wallet/transactions", requireAuth, async (req, res) => {
  const userId = getSessionUserId(req)!;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const transactions = await getTransactionHistory(userId, limit);
  res.json(transactions);
});

export default router;

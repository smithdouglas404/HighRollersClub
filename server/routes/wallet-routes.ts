import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { storage } from "../storage";
import { sql as defaultSql } from "drizzle-orm";

export interface WalletHelpers {
  hasDatabase: () => boolean;
  getDb: () => any;
  sql: typeof defaultSql;
}

export async function registerWalletRoutes(
  app: Express,
  requireAuth: RequestHandler,
  helpers: WalletHelpers,
) {
  const { hasDatabase, getDb, sql } = helpers;

  // ─── Wallet Routes ───────────────────────────────────────────────────────
  app.get("/api/wallet/balance", requireAuth, async (req, res, next) => {
    try {
      const userWallets = await storage.getUserWallets(req.user!.id);
      const balances: Record<string, number> = {};
      let total = 0;
      for (const w of userWallets) {
        balances[w.walletType] = w.balance;
        total += w.balance;
      }
      // Backward compat: also return flat balance
      res.json({ balance: total, balances, wallets: userWallets });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/wallet/balances", requireAuth, async (req, res, next) => {
    try {
      await storage.ensureWallets(req.user!.id);
      const userWallets = await storage.getUserWallets(req.user!.id);
      const balances: Record<string, number> = { main: 0, cash_game: 0, sng: 0, tournament: 0, bonus: 0 };
      let total = 0;
      for (const w of userWallets) {
        balances[w.walletType] = w.balance;
        total += w.balance;
      }
      res.json({ balances, total, wallets: userWallets });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/wallet/daily-status", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Determine bonus amount (2x with Elite Pass)
      const inv = await storage.getUserInventory(user.id);
      const items = await storage.getShopItems();
      const elitePass = items.find(i => i.category === "premium" && i.rarity === "legendary");
      const hasElitePass = elitePass ? inv.some(i => i.itemId === elitePass.id) : false;
      const bonusAmount = hasElitePass ? 2000 : 1000;

      if (user.lastDailyClaim) {
        const nextClaimAt = new Date(user.lastDailyClaim.getTime() + 24 * 60 * 60 * 1000);
        if (nextClaimAt.getTime() > Date.now()) {
          return res.json({ canClaim: false, nextClaimAt, bonusAmount });
        }
      }
      res.json({ canClaim: true, nextClaimAt: null, bonusAmount });
    } catch (err) {
      next(err);
    }
  });

  // In-memory lock to prevent daily bonus race condition
  const dailyClaimLocks = new Set<string>();

  app.post("/api/wallet/claim-daily", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;

      // Prevent concurrent claims with in-memory lock
      if (dailyClaimLocks.has(userId)) {
        return res.status(429).json({ message: "Claim already in progress" });
      }
      dailyClaimLocks.add(userId);

      try {
        const user = await storage.getUser(userId);
        if (!user) { dailyClaimLocks.delete(userId); return res.status(404).json({ message: "User not found" }); }

        const now = new Date();
        if (user.lastDailyClaim) {
          const hoursSince = (now.getTime() - user.lastDailyClaim.getTime()) / (1000 * 60 * 60);
          if (hoursSince < 24) {
            dailyClaimLocks.delete(userId);
            return res.status(429).json({
              message: "Daily bonus already claimed",
              nextClaimAt: new Date(user.lastDailyClaim.getTime() + 24 * 60 * 60 * 1000),
            });
          }
        }

        // Set lastDailyClaim immediately to prevent race conditions
        await storage.updateUser(userId, { lastDailyClaim: now });

      // Check if user has Elite Pass for 2x bonus
      const userInventory = await storage.getUserInventory(user.id);
      const allShopItems = await storage.getShopItems();
      const elitePass = allShopItems.find(i => i.category === "premium" && i.rarity === "legendary");
      const hasElitePass = elitePass ? userInventory.some(inv => inv.itemId === elitePass.id) : false;
      const bonus = hasElitePass ? 2000 : 1000;

      // Credit bonus wallet (ensure wallets exist first)
      await storage.ensureWallets(user.id);
      const { success, newBalance } = await storage.atomicAddToWallet(user.id, "bonus", bonus);
      if (!success) return res.status(500).json({ message: "Failed to credit bonus" });

      // Also update legacy chipBalance for backward compat
      await storage.atomicAddChips(user.id, bonus);

      await storage.createTransaction({
        userId: user.id,
        type: "bonus",
        amount: bonus,
        balanceBefore: newBalance - bonus,
        balanceAfter: newBalance,
        tableId: null,
        description: "Daily login bonus",
        walletType: "bonus",
        relatedTransactionId: null,
        paymentId: null,
        metadata: null,
      });

      const totalBal = await storage.getUserTotalBalance(userId);
      res.json({ balance: totalBal, bonus, nextClaimAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) });
      } finally {
        dailyClaimLocks.delete(userId);
      }
    } catch (err) {
      dailyClaimLocks.delete(req.user!.id);
      next(err);
    }
  });

  app.get("/api/wallet/transactions", requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const txs = await storage.getTransactions(req.user!.id, limit, offset);

      // Add human-readable display types for the frontend
      const displayTypeMap: Record<string, string> = {
        buyin: "Table Buy-in",
        cashout: "Table Exit",
        deposit: "Funds Added",
        withdraw: "Added Chips to Table",
        bonus: "Bonus",
        rake: "Rake Collected",
        prize: "Tournament Prize",
      };

      const formatted = txs.map(tx => ({
        ...tx,
        displayType: displayTypeMap[tx.type] || "Adjustment",
        status: "Completed",
      }));

      res.json(formatted);
    } catch (err) {
      next(err);
    }
  });

  // Session profit/loss summaries — grouped by table
  app.get("/api/wallet/sessions", requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 50);
      const sessions = await storage.getSessionSummaries(req.user!.id, limit);
      res.json(sessions);
    } catch (err) {
      next(err);
    }
  });

  // ─── Session History (stack-over-time) ─────────────────────────────────────
  app.get("/api/sessions/history", requireAuth, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);

      if (!hasDatabase()) {
        return res.json([]);
      }

      const db = getDb();

      // Fetch all hands for this user, joined with game_hands and tables
      const rows = await db.execute(sql`
        SELECT
          gh.id AS hand_id,
          gh.table_id,
          gh.hand_number,
          gh.created_at,
          t.name AS table_name,
          hp.start_stack,
          hp.end_stack,
          hp.net_result
        FROM hand_players hp
        INNER JOIN game_hands gh ON gh.id = hp.hand_id
        INNER JOIN tables t ON t.id = gh.table_id
        WHERE hp.user_id = ${userId}
        ORDER BY gh.created_at ASC
      `);

      const allHands = (rows as any).rows ?? rows;
      if (!allHands || allHands.length === 0) {
        return res.json([]);
      }

      // Group hands into sessions: same table, gap <= 30 min
      const SESSION_GAP_MS = 30 * 60 * 1000;
      interface HandRow {
        hand_id: string;
        table_id: string;
        hand_number: number;
        created_at: string | Date;
        table_name: string;
        start_stack: number;
        end_stack: number;
        net_result: number;
      }

      interface Session {
        tableId: string;
        tableName: string;
        hands: HandRow[];
      }

      const sessions: Session[] = [];
      let current: Session | null = null;
      let lastTime = 0;

      for (const row of allHands as HandRow[]) {
        const t = new Date(row.created_at).getTime();
        const sameTable = current && row.table_id === current.tableId;
        const withinGap = current && (t - lastTime) <= SESSION_GAP_MS;

        if (sameTable && withinGap) {
          current!.hands.push(row);
        } else {
          current = {
            tableId: row.table_id,
            tableName: row.table_name,
            hands: [row],
          };
          sessions.push(current);
        }
        lastTime = t;
      }

      // Build response: newest sessions first, limited
      const result = sessions
        .slice(-limit)
        .reverse()
        .map((s) => {
          const firstHand = s.hands[0];
          const lastHand = s.hands[s.hands.length - 1];
          const startingStack = Number(firstHand.start_stack);
          const endingStack = Number(lastHand.end_stack);
          return {
            sessionId: `${s.tableId}-${new Date(firstHand.created_at).getTime()}`,
            tableName: s.tableName,
            startTime: new Date(firstHand.created_at).toISOString(),
            endTime: new Date(lastHand.created_at).toISOString(),
            handsPlayed: s.hands.length,
            startingStack,
            endingStack,
            netResult: endingStack - startingStack,
            stackHistory: s.hands.map(h => ({
              handNumber: Number(h.hand_number),
              chips: Number(h.end_stack),
            })),
          };
        });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // ─── Wallet Transfer ─────────────────────────────────────────────────────
  app.post("/api/wallet/transfer", requireAuth, async (req, res, next) => {
    try {
      const { from, to, amount } = req.body;
      if (!from || !to || !amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid transfer: from, to, and amount > 0 required" });
      }
      const validTypes = ["main", "cash_game", "sng", "tournament", "bonus"];
      if (!validTypes.includes(from) || !validTypes.includes(to)) {
        return res.status(400).json({ message: "Invalid wallet type" });
      }
      if (from === to) return res.status(400).json({ message: "Cannot transfer to the same wallet" });
      if (from === "bonus") return res.status(400).json({ message: "Cannot transfer from bonus wallet" });

      await storage.ensureWallets(req.user!.id);
      const { success, fromBalance, toBalance } = await storage.atomicTransferBetweenWallets(
        req.user!.id, from, to, amount
      );
      if (!success) return res.status(400).json({ message: "Insufficient funds or wallet locked" });

      // Log both sides of the transfer
      const txId1 = require("crypto").randomUUID();
      const txId2 = require("crypto").randomUUID();
      await storage.createTransaction({
        userId: req.user!.id, type: "transfer", amount: -amount,
        balanceBefore: fromBalance + amount, balanceAfter: fromBalance,
        tableId: null, description: `Transfer to ${to} wallet`,
        walletType: from, relatedTransactionId: txId2, paymentId: null, metadata: null,
      });
      await storage.createTransaction({
        userId: req.user!.id, type: "transfer", amount: amount,
        balanceBefore: toBalance - amount, balanceAfter: toBalance,
        tableId: null, description: `Transfer from ${from} wallet`,
        walletType: to, relatedTransactionId: txId1, paymentId: null, metadata: null,
      });

      const allWallets = await storage.getUserWallets(req.user!.id);
      const balances: Record<string, number> = {};
      for (const w of allWallets) balances[w.walletType] = w.balance;

      res.json({ success: true, balances });
    } catch (err) {
      next(err);
    }
  });

  // ─── Payment / Deposit Routes ─────────────────────────────────────────────
  app.get("/api/payments/currencies", async (_req, res, next) => {
    try {
      const currencies = await storage.getSupportedCurrencies();
      res.json(currencies);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/payments/gateways", async (_req, res, next) => {
    try {
      const { getPaymentService } = await import("../payments/payment-service");
      const svc = getPaymentService();
      res.json(svc.getAvailableGateways());
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/payments/deposit", requireAuth, async (req, res, next) => {
    try {
      const { amount, currency, gateway, allocation } = req.body;
      if (!amount || !currency || !gateway || !allocation || !Array.isArray(allocation)) {
        return res.status(400).json({ message: "amount, currency, gateway, and allocation[] required" });
      }
      if (amount < 100) return res.status(400).json({ message: "Minimum deposit is $1.00 (100 cents)" });

      const allocSum = allocation.reduce((s: number, a: any) => s + (a.amount || 0), 0);
      if (allocSum !== amount) {
        return res.status(400).json({ message: `Allocation sum (${allocSum}) must equal deposit amount (${amount})` });
      }

      const { getPaymentService } = await import("../payments/payment-service");
      const svc = getPaymentService();
      const result = await svc.initiateDeposit(req.user!.id, amount, currency, gateway, allocation);
      res.json(result);
    } catch (err: any) {
      if (err.message?.includes("not configured")) {
        return res.status(400).json({ message: err.message });
      }
      next(err);
    }
  });

  app.get("/api/payments/:id", requireAuth, async (req, res, next) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment || payment.userId !== req.user!.id) {
        return res.status(404).json({ message: "Payment not found" });
      }
      res.json(payment);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/payments", requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
      const userPayments = await storage.getUserPayments(req.user!.id, limit, offset);
      res.json(userPayments);
    } catch (err) {
      next(err);
    }
  });

  // ─── Payment Webhooks (no auth — verified by signature) ───────────────────
  app.post("/api/payments/webhook/:provider", async (req, res, next) => {
    try {
      const provider = req.params.provider;
      const { getPaymentService } = await import("../payments/payment-service");
      const svc = getPaymentService();
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === "string") headers[k.toLowerCase()] = v;
      }
      // For Stripe, pass raw body (Buffer) for signature verification
      const webhookBody = provider === "stripe" && (req as any).rawBody
        ? (req as any).rawBody
        : req.body;
      const result = await svc.processWebhook(provider, webhookBody, headers);
      res.json({ ok: true, ...result });
    } catch (err: any) {
      console.error(`[Webhook] Error processing ${req.params.provider} webhook:`, err.message);
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Withdrawal Routes ────────────────────────────────────────────────────
  app.post("/api/wallet/withdraw", requireAuth, async (req, res, next) => {
    try {
      const { amount, currency, address } = req.body;
      if (!amount || !currency || !address) {
        return res.status(400).json({ message: "amount, currency, and address required" });
      }
      if (amount <= 0) return res.status(400).json({ message: "Amount must be positive" });

      const { getPaymentService } = await import("../payments/payment-service");
      const svc = getPaymentService();
      const result = await svc.initiateWithdrawal(req.user!.id, amount, currency, address);
      res.json(result);
    } catch (err: any) {
      if (err.message?.includes("Insufficient") || err.message?.includes("Invalid")) {
        return res.status(400).json({ message: err.message });
      }
      next(err);
    }
  });

  app.get("/api/wallet/withdrawals", requireAuth, async (req, res, next) => {
    try {
      const requests = await storage.getUserWithdrawalRequests(req.user!.id);
      res.json(requests);
    } catch (err) {
      next(err);
    }
  });

  // ─── Premium Subscription ─────────────────────────────────────────────────
  const PREMIUM_COST_CHIPS = 5000;
  const PREMIUM_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  app.get("/api/subscribe/status", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const now = Date.now();
      const isPremium = !!user.premiumUntil && new Date(user.premiumUntil).getTime() > now;
      res.json({
        isPremium,
        expiresAt: isPremium ? user.premiumUntil : null,
      });
    } catch (err) { next(err); }
  });

  app.post("/api/subscribe/premium", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Deduct from main wallet
      await storage.ensureWallets(user.id);
      const wallets = await storage.getUserWallets(user.id);
      const mainWallet = wallets.find(w => w.walletType === "main");
      if (!mainWallet || mainWallet.balance < PREMIUM_COST_CHIPS) {
        return res.status(400).json({
          message: `Insufficient chips. You need ${PREMIUM_COST_CHIPS.toLocaleString()} chips in your main wallet.`,
          required: PREMIUM_COST_CHIPS,
          available: mainWallet?.balance ?? 0,
        });
      }

      // Deduct chips
      const result = await storage.atomicAddToWallet(user.id, "main", -PREMIUM_COST_CHIPS);
      if (!result.success) {
        return res.status(400).json({ message: "Failed to deduct chips. Try again." });
      }

      // Set or extend premium
      const now = Date.now();
      const currentExpiry = user.premiumUntil ? new Date(user.premiumUntil).getTime() : 0;
      const baseTime = currentExpiry > now ? currentExpiry : now;
      const newExpiry = new Date(baseTime + PREMIUM_DURATION_MS);

      await storage.updateUser(user.id, { premiumUntil: newExpiry });

      res.json({
        message: "Premium activated!",
        isPremium: true,
        expiresAt: newExpiry,
        chipsDeducted: PREMIUM_COST_CHIPS,
        newBalance: result.newBalance,
      });
    } catch (err) { next(err); }
  });
}

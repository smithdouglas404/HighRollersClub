// ─── Payment Worker ─────────────────────────────────────────────────────────
// Standalone process for payment processing, blockchain monitoring, and
// webhook handling. Runs independently from the main API server.
//
// Required env vars: REDIS_URL, DATABASE_URL
// Optional: NOWPAYMENTS_API_KEY, STRIPE_API_KEY, DIRECT_WALLET_ENABLED,
//           POLYGON_ENABLED, NFT_MARKETPLACE_ADDRESS, etc.
//
// Start: npx tsx server/payment-worker.ts

import express from "express";
import Redis from "ioredis";
import { getPaymentService, type PaymentService } from "./payments/payment-service";
import { getNFTService, type NFTService } from "./nft/nft-service";
import { ContractClient } from "./blockchain/contract-client";
import { VRFClient } from "./blockchain/vrf-client";
import { storage } from "./storage";

// ─── Types ──────────────────────────────────────────────────────────────────

interface JobMessage {
  type: string;
  payload: Record<string, any>;
  id?: string;
  timestamp?: number;
}

interface DepositConfirmationJob {
  type: "deposit_confirmation";
  payload: {
    paymentId: string;
    gatewayProvider: string;
    gatewayPaymentId: string;
  };
}

interface WithdrawalApprovalJob {
  type: "withdrawal_approval";
  payload: {
    requestId: string;
    adminUserId: string;
  };
}

interface NFTMintJob {
  type: "nft_mint";
  payload: {
    userId: string;
    toAddress: string;
    metadataURI: string;
  };
}

interface HandCommitJob {
  type: "hand_commit";
  payload: {
    tableId: string;
    handNumber: number;
    commitmentHash: string;
    vrfRequestId?: string;
  };
}

interface HandRevealJob {
  type: "hand_reveal";
  payload: {
    tableId: string;
    handNumber: number;
    serverSeed: string;
    playerSeeds: string[];
    deckOrder: string;
  };
}

interface VRFRequestJob {
  type: "vrf_request";
  payload: {
    tableId: string;
    handNumber: number;
  };
}

type PaymentJob =
  | DepositConfirmationJob
  | WithdrawalApprovalJob
  | NFTMintJob
  | HandCommitJob
  | HandRevealJob
  | VRFRequestJob;

// ─── Globals ────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PAYMENT_WORKER_PORT || "5050", 10);
const POLL_INTERVAL_MS = parseInt(process.env.BLOCKCHAIN_POLL_INTERVAL || "30000", 10);
const REDIS_CHANNEL_PROCESS = "payments:process";
const REDIS_CHANNEL_COMPLETE = "payments:complete";

let redisSub: Redis | null = null;
let redisPub: Redis | null = null;
let paymentService: PaymentService;
let nftService: NFTService;
let contractClient: ContractClient;
let vrfClient: VRFClient;

let isShuttingDown = false;
let pendingJobs = 0;
let blockchainPollTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Redis Helpers ──────────────────────────────────────────────────────────

function initRedis(): { sub: Redis; pub: Redis } {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn("[PaymentWorker] REDIS_URL not set — job queue disabled, webhooks only");
    return { sub: null as any, pub: null as any };
  }
  const sub = new Redis(url);
  const pub = new Redis(url);

  sub.on("error", (err) => console.error("[PaymentWorker] Redis sub error:", err.message));
  pub.on("error", (err) => console.error("[PaymentWorker] Redis pub error:", err.message));

  return { sub, pub };
}

async function publishComplete(type: string, data: Record<string, any>): Promise<void> {
  if (!redisPub) return;
  try {
    await redisPub.publish(
      REDIS_CHANNEL_COMPLETE,
      JSON.stringify({ type, data, timestamp: Date.now() }),
    );
  } catch (err: any) {
    console.error("[PaymentWorker] Failed to publish completion:", err.message);
  }
}

// ─── Job Processing ─────────────────────────────────────────────────────────

async function processJob(job: JobMessage): Promise<void> {
  if (isShuttingDown) return;
  pendingJobs++;

  try {
    console.log(`[PaymentWorker] Processing job: ${job.type} (id=${job.id || "none"})`);

    switch (job.type) {
      case "deposit_confirmation":
        await handleDepositConfirmation(job.payload as DepositConfirmationJob["payload"]);
        break;
      case "withdrawal_approval":
        await handleWithdrawalApproval(job.payload as WithdrawalApprovalJob["payload"]);
        break;
      case "nft_mint":
        await handleNFTMint(job.payload as NFTMintJob["payload"]);
        break;
      case "hand_commit":
        await handleHandCommit(job.payload as HandCommitJob["payload"]);
        break;
      case "hand_reveal":
        await handleHandReveal(job.payload as HandRevealJob["payload"]);
        break;
      case "vrf_request":
        await handleVRFRequest(job.payload as VRFRequestJob["payload"]);
        break;
      default:
        console.warn(`[PaymentWorker] Unknown job type: ${job.type}`);
    }
  } catch (err: any) {
    console.error(`[PaymentWorker] Job failed (${job.type}):`, err.message);
    await publishComplete(`${job.type}:error`, {
      jobId: job.id,
      error: err.message,
    });
  } finally {
    pendingJobs--;
  }
}

// ── Deposit Confirmation Handler ────────────────────────────────────────────

async function handleDepositConfirmation(
  payload: DepositConfirmationJob["payload"],
): Promise<void> {
  const gateway = paymentService.getGateway(payload.gatewayProvider);
  if (!gateway) {
    throw new Error(`Gateway '${payload.gatewayProvider}' not available`);
  }

  const status = await gateway.getPaymentStatus(payload.gatewayPaymentId);
  console.log(
    `[PaymentWorker] Deposit ${payload.paymentId}: status=${status.status}, confirmations=${status.confirmations}`,
  );

  // Update payment record
  await storage.updatePayment(payload.paymentId, {
    status: status.status === "finished" ? "confirmed" : status.status,
    txHash: status.txHash || undefined,
    confirmations: status.confirmations,
  });

  // If confirmed, the main payment service creditDeposit logic runs via webhook
  // Publish status update for the API server
  await publishComplete("deposit_status", {
    paymentId: payload.paymentId,
    status: status.status,
    confirmations: status.confirmations,
    txHash: status.txHash,
  });
}

// ── Withdrawal Approval Handler ─────────────────────────────────────────────

async function handleWithdrawalApproval(
  payload: WithdrawalApprovalJob["payload"],
): Promise<void> {
  await paymentService.approveWithdrawal(payload.requestId, payload.adminUserId);

  await publishComplete("withdrawal_completed", {
    requestId: payload.requestId,
    adminUserId: payload.adminUserId,
  });
}

// ── NFT Mint Handler ────────────────────────────────────────────────────────

async function handleNFTMint(payload: NFTMintJob["payload"]): Promise<void> {
  if (!nftService.isAvailable()) {
    throw new Error("NFT service not available");
  }

  const result = await nftService.mintAvatar(payload.toAddress, payload.metadataURI);
  if (!result) {
    throw new Error("NFT minting returned null");
  }

  await publishComplete("nft_minted", {
    userId: payload.userId,
    tokenId: result.tokenId,
    txHash: result.txHash,
    toAddress: payload.toAddress,
    metadataURI: payload.metadataURI,
  });
}

// ── Hand Commit Handler ─────────────────────────────────────────────────────

async function handleHandCommit(payload: HandCommitJob["payload"]): Promise<void> {
  const result = await contractClient.commitHand(
    payload.tableId,
    payload.handNumber,
    payload.commitmentHash,
    payload.vrfRequestId,
  );

  await publishComplete("hand_committed", {
    tableId: payload.tableId,
    handNumber: payload.handNumber,
    txHash: result?.txHash || null,
  });
}

// ── Hand Reveal Handler ─────────────────────────────────────────────────────

async function handleHandReveal(payload: HandRevealJob["payload"]): Promise<void> {
  const result = await contractClient.revealHand(
    payload.tableId,
    payload.handNumber,
    payload.serverSeed,
    payload.playerSeeds,
    payload.deckOrder,
  );

  await publishComplete("hand_revealed", {
    tableId: payload.tableId,
    handNumber: payload.handNumber,
    txHash: result?.txHash || null,
  });
}

// ── VRF Request Handler ─────────────────────────────────────────────────────

async function handleVRFRequest(payload: VRFRequestJob["payload"]): Promise<void> {
  const result = await vrfClient.requestRandomness(payload.tableId, payload.handNumber);
  if (!result) {
    throw new Error("VRF request returned null — blockchain not configured");
  }

  // Publish the requestId immediately so the game server knows
  await publishComplete("vrf_requested", {
    tableId: payload.tableId,
    handNumber: payload.handNumber,
    requestId: result.requestId,
  });

  // Wait for fulfillment in the background
  const randomWord = await result.randomWordPromise;
  await publishComplete("vrf_fulfilled", {
    tableId: payload.tableId,
    handNumber: payload.handNumber,
    requestId: result.requestId,
    randomWord,
  });
}

// ─── Blockchain Monitoring Loop ─────────────────────────────────────────────

async function pollBlockchainConfirmations(): Promise<void> {
  if (isShuttingDown) return;

  try {
    // Poll pending deposits for confirmation updates
    const pendingPayments = await storage.getPendingPayments();
    if (pendingPayments.length > 0) {
      for (const payment of pendingPayments) {
        if (isShuttingDown) break;
        if (!payment.gatewayPaymentId || !payment.gatewayProvider) continue;

        try {
          const gateway = paymentService.getGateway(payment.gatewayProvider);
          if (!gateway) continue;

          const status = await gateway.getPaymentStatus(payment.gatewayPaymentId);

          // Only update if status changed
          if (status.status !== payment.status || status.confirmations !== payment.confirmations) {
            console.log(
              `[PaymentWorker] Poll update: payment=${payment.id} status=${payment.status}->${status.status} confs=${status.confirmations}`,
            );

            const newStatus = status.status === "finished" ? "confirmed" : status.status;
            await storage.updatePayment(payment.id, {
              status: newStatus,
              txHash: status.txHash || payment.txHash,
              confirmations: status.confirmations,
              confirmedAt: newStatus === "confirmed" ? new Date() : undefined,
            });

            await publishComplete("deposit_status", {
              paymentId: payment.id,
              userId: payment.userId,
              status: newStatus,
              confirmations: status.confirmations,
              txHash: status.txHash,
            });
          }
        } catch (err: any) {
          // Silently skip individual polling failures
          console.warn(`[PaymentWorker] Poll error for payment ${payment.id}:`, err.message);
        }
      }
    }

    // Poll pending VRF requests
    await pollVRFRequests();
  } catch (err: any) {
    console.error("[PaymentWorker] Blockchain poll error:", err.message);
  }

  // Schedule next poll
  if (!isShuttingDown) {
    blockchainPollTimer = setTimeout(pollBlockchainConfirmations, POLL_INTERVAL_MS);
  }
}

async function pollVRFRequests(): Promise<void> {
  // VRF polling is handled inline by VRFClient.requestRandomness() promises
  // This is a placeholder for any additional VRF monitoring if needed
}

// ─── Express Webhook Server ─────────────────────────────────────────────────

function createWebhookServer(): express.Application {
  const app = express();

  // Stripe needs raw body for signature verification
  app.use("/api/payments/webhook/stripe", express.raw({ type: "application/json" }));
  // All other routes use JSON parsing
  app.use(express.json());

  // ── Health Check ────────────────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({
      status: isShuttingDown ? "draining" : "healthy",
      uptime: process.uptime(),
      pendingJobs,
      redis: redisSub ? "connected" : "disconnected",
      gateways: paymentService.getAvailableGateways().map((g) => g.name),
      timestamp: new Date().toISOString(),
    });
  });

  // ── Webhook Handler ─────────────────────────────────────────────────
  app.post("/api/payments/webhook/:provider", async (req, res) => {
    const { provider } = req.params;
    console.log(`[PaymentWorker] Webhook received from ${provider}`);

    try {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === "string") headers[key] = value;
      }

      const body = provider === "stripe" && Buffer.isBuffer(req.body)
        ? req.body.toString("utf8")
        : req.body;

      const result = await paymentService.processWebhook(provider, body, headers);

      // Notify the API server via Redis
      await publishComplete("webhook_processed", {
        provider,
        paymentId: result.paymentId,
        status: result.status,
      });

      res.json({ ok: true, paymentId: result.paymentId, status: result.status });
    } catch (err: any) {
      console.error(`[PaymentWorker] Webhook error (${provider}):`, err.message);
      res.status(400).json({ error: err.message });
    }
  });

  // ── Initiate Deposit ────────────────────────────────────────────────
  app.post("/api/payments/deposit", async (req, res) => {
    try {
      const { userId, amountCents, currency, gatewayName, allocation } = req.body;

      if (!userId || !amountCents || !currency || !gatewayName) {
        res.status(400).json({ error: "Missing required fields: userId, amountCents, currency, gatewayName" });
        return;
      }

      const result = await paymentService.initiateDeposit(
        userId,
        amountCents,
        currency,
        gatewayName,
        allocation || [{ walletType: "main", amount: amountCents }],
      );

      await publishComplete("deposit_initiated", {
        userId,
        paymentId: result.paymentId,
        gatewayProvider: result.gatewayProvider,
      });

      res.json(result);
    } catch (err: any) {
      console.error("[PaymentWorker] Deposit error:", err.message);
      res.status(400).json({ error: err.message });
    }
  });

  // ── Initiate Withdrawal ─────────────────────────────────────────────
  app.post("/api/wallet/withdraw", async (req, res) => {
    try {
      const { userId, chipAmount, currency, address } = req.body;

      if (!userId || !chipAmount || !currency || !address) {
        res.status(400).json({ error: "Missing required fields: userId, chipAmount, currency, address" });
        return;
      }

      const result = await paymentService.initiateWithdrawal(userId, chipAmount, currency, address);

      await publishComplete("withdrawal_initiated", {
        userId,
        requestId: result.requestId,
        status: result.status,
      });

      res.json(result);
    } catch (err: any) {
      console.error("[PaymentWorker] Withdrawal error:", err.message);
      res.status(400).json({ error: err.message });
    }
  });

  return app;
}

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[PaymentWorker] ${signal} received — starting graceful shutdown...`);

  // Stop accepting new blockchain poll cycles
  if (blockchainPollTimer) {
    clearTimeout(blockchainPollTimer);
    blockchainPollTimer = null;
  }

  // Unsubscribe from Redis job channel
  if (redisSub) {
    try {
      await redisSub.unsubscribe(REDIS_CHANNEL_PROCESS);
    } catch { /* ignore */ }
  }

  // Wait for in-flight jobs to complete (max 30 seconds)
  const drainStart = Date.now();
  const DRAIN_TIMEOUT_MS = 30_000;
  while (pendingJobs > 0 && Date.now() - drainStart < DRAIN_TIMEOUT_MS) {
    console.log(`[PaymentWorker] Draining... ${pendingJobs} pending jobs`);
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (pendingJobs > 0) {
    console.warn(`[PaymentWorker] Force shutdown with ${pendingJobs} pending jobs`);
  }

  // Close Redis connections
  if (redisSub) {
    try { redisSub.disconnect(); } catch { /* ignore */ }
  }
  if (redisPub) {
    try { redisPub.disconnect(); } catch { /* ignore */ }
  }

  console.log("[PaymentWorker] Shutdown complete.");
  process.exit(0);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("===========================================");
  console.log("  Payment Worker starting...");
  console.log("===========================================");

  // Initialize services
  paymentService = getPaymentService();
  nftService = getNFTService();
  contractClient = new ContractClient();
  vrfClient = new VRFClient();

  const gateways = paymentService.getAvailableGateways();
  console.log(`[PaymentWorker] Gateways registered: ${gateways.map((g) => g.name).join(", ") || "(none)"}`);
  console.log(`[PaymentWorker] NFT service: ${nftService.isAvailable() ? "available" : "not configured"}`);

  // Initialize Redis
  const redis = initRedis();
  redisSub = redis.sub;
  redisPub = redis.pub;

  // Subscribe to job queue
  if (redisSub) {
    await redisSub.subscribe(REDIS_CHANNEL_PROCESS);
    console.log(`[PaymentWorker] Subscribed to Redis channel: ${REDIS_CHANNEL_PROCESS}`);

    redisSub.on("message", (_channel: string, raw: string) => {
      try {
        const job = JSON.parse(raw) as JobMessage;
        // Fire and forget — job processing is async
        processJob(job).catch((err) => {
          console.error("[PaymentWorker] Unhandled job error:", err.message);
        });
      } catch (err: any) {
        console.error("[PaymentWorker] Failed to parse job message:", err.message);
      }
    });
  }

  // Start blockchain monitoring loop
  console.log(`[PaymentWorker] Blockchain poll interval: ${POLL_INTERVAL_MS}ms`);
  blockchainPollTimer = setTimeout(pollBlockchainConfirmations, POLL_INTERVAL_MS);

  // Start webhook HTTP server
  const app = createWebhookServer();
  const server = app.listen(PORT, () => {
    console.log(`[PaymentWorker] HTTP server listening on port ${PORT}`);
    console.log(`[PaymentWorker] Webhook URL: POST http://0.0.0.0:${PORT}/api/payments/webhook/:provider`);
    console.log(`[PaymentWorker] Deposit URL:  POST http://0.0.0.0:${PORT}/api/payments/deposit`);
    console.log(`[PaymentWorker] Withdraw URL: POST http://0.0.0.0:${PORT}/api/wallet/withdraw`);
    console.log(`[PaymentWorker] Health URL:   GET  http://0.0.0.0:${PORT}/health`);
    console.log("[PaymentWorker] Ready.");
  });

  // Graceful shutdown hooks
  process.on("SIGTERM", () => {
    server.close();
    shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    server.close();
    shutdown("SIGINT");
  });
}

main().catch((err) => {
  console.error("[PaymentWorker] Fatal error:", err);
  process.exit(1);
});

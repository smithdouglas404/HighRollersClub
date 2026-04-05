import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { createHash } from "crypto";
import path from "path";
import fs from "fs";
import multer from "multer";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { sql as defaultSql } from "drizzle-orm";
import type { AdminHelpers } from "./admin-routes";
import { tierRank } from "../tier-config";

// ─── File Upload Setup (KYC documents) ────────────────────────────────────
const KYC_UPLOAD_DIR = path.join(process.cwd(), "uploads", "kyc");
fs.mkdirSync(KYC_UPLOAD_DIR, { recursive: true });

const kycUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, KYC_UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Only JPG, PNG, WebP, and PDF files are allowed"));
  },
});

function requireTier(minTier: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    const user = await storage.getUser(req.user.id);
    if (!user) return res.status(401).json({ message: "User not found" });
    // Check tier expiry — if expired, revert to free
    if (user.tier !== "free" && user.tierExpiresAt && new Date(user.tierExpiresAt) < new Date()) {
      await storage.updateUser(user.id, { tier: "free", tierExpiresAt: null });
      user.tier = "free";
    }
    if (tierRank(user.tier) < tierRank(minTier)) {
      return res.status(403).json({ message: `Requires ${minTier} tier or higher` });
    }
    next();
  };
}

export async function registerSecurityRoutes(
  app: Express,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler,
  helpers: AdminHelpers,
) {
  const { logAdminAction, sendKycEmail, blockchainConfig, getDb, hasDatabase, sql } = helpers;

  // ─── KYC Routes ──────────────────────────────────────────────────────────

  app.get("/api/kyc/status", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        kycStatus: user.kycStatus,
        kycData: user.kycData,
        kycVerifiedAt: user.kycVerifiedAt,
        kycRejectionReason: user.kycRejectionReason,
        kycBlockchainTxHash: user.kycBlockchainTxHash,
      });
    } catch (err) { next(err); }
  });

  // ─── Onfido SDK Integration (Professional KYC) ──────────────────────────
  // Creates an Onfido applicant + SDK token for the client-side verification flow.
  // Onfido handles: ID capture, liveness detection, face matching, document authenticity.
  // We NEVER see or store the actual ID documents — they live on Onfido's infrastructure.

  app.post("/api/kyc/onfido/start", requireAuth, requireTier("gold"), async (req, res, next) => {
    try {
      const onfidoApiToken = process.env.ONFIDO_API_TOKEN;
      if (!onfidoApiToken) {
        // Fallback to manual KYC mode if Onfido not configured
        return res.json({ mode: "manual", message: "Use the manual KYC form" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.kycStatus === "verified") return res.status(400).json({ message: "Already verified" });
      if (user.kycStatus === "pending") return res.status(400).json({ message: "Verification already in progress" });

      const { fullName, dateOfBirth } = req.body;
      const onfidoBaseUrl = process.env.ONFIDO_REGION === "eu" ? "https://api.eu.onfido.com/v3.6" : "https://api.us.onfido.com/v3.6";

      // Step 1: Create applicant on Onfido
      const nameParts = (fullName || user.displayName || "User").split(" ");
      const applicantRes = await fetch(`${onfidoBaseUrl}/applicants`, {
        method: "POST",
        headers: { "Authorization": `Token token=${onfidoApiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: nameParts[0] || "User",
          last_name: nameParts.slice(1).join(" ") || "Unknown",
          email: user.email || undefined,
          dob: dateOfBirth || undefined,
        }),
      });
      if (!applicantRes.ok) {
        const err = await applicantRes.json();
        return res.status(500).json({ message: "Failed to create Onfido applicant", error: err });
      }
      const applicant = await applicantRes.json();

      // Step 2: Generate SDK token for client-side verification
      const tokenRes = await fetch(`${onfidoBaseUrl}/sdk_token`, {
        method: "POST",
        headers: { "Authorization": `Token token=${onfidoApiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          applicant_id: applicant.id,
          referrer: process.env.ONFIDO_REFERRER || "*://*/*",
        }),
      });
      if (!tokenRes.ok) {
        return res.status(500).json({ message: "Failed to generate SDK token" });
      }
      const tokenData = await tokenRes.json();

      // Step 3: Store applicant ID on the user for webhook matching
      await storage.updateUser(user.id, {
        kycStatus: "pending",
        kycData: {
          ...(user.kycData as any || {}),
          fullName: fullName || user.displayName,
          dateOfBirth,
          providerApplicantId: applicant.id,
          provider: "onfido",
          submittedAt: new Date().toISOString(),
        },
      });

      res.json({
        mode: "onfido",
        sdkToken: tokenData.token,
        applicantId: applicant.id,
      });
    } catch (err) { next(err); }
  });

  // Onfido check creation — called after client-side SDK completes
  app.post("/api/kyc/onfido/check", requireAuth, async (req, res, next) => {
    try {
      const onfidoApiToken = process.env.ONFIDO_API_TOKEN;
      if (!onfidoApiToken) return res.status(400).json({ message: "Onfido not configured" });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const kycData = user.kycData as any;
      if (!kycData?.providerApplicantId) return res.status(400).json({ message: "No Onfido applicant found" });

      const onfidoBaseUrl = process.env.ONFIDO_REGION === "eu" ? "https://api.eu.onfido.com/v3.6" : "https://api.us.onfido.com/v3.6";

      // Create a check (triggers Onfido's AI verification)
      const checkRes = await fetch(`${onfidoBaseUrl}/checks`, {
        method: "POST",
        headers: { "Authorization": `Token token=${onfidoApiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          applicant_id: kycData.providerApplicantId,
          report_names: ["document", "facial_similarity_photo"],
        }),
      });
      if (!checkRes.ok) {
        const err = await checkRes.json();
        return res.status(500).json({ message: "Failed to create check", error: err });
      }
      const check = await checkRes.json();

      // Update KYC data with check ID
      await storage.updateUser(user.id, {
        kycData: { ...kycData, checkId: check.id, checkStatus: "in_progress" },
      });

      // Result will arrive via webhook (POST /api/webhooks/kyc-verification)
      res.json({ checkId: check.id, status: "processing", message: "Verification in progress. You'll be notified when complete." });
    } catch (err) { next(err); }
  });

  // Manual KYC submit (fallback when Onfido is not configured)
  app.post("/api/kyc/submit", requireAuth, requireTier("gold"), kycUpload.fields([
    { name: "idDocument", maxCount: 1 },
    { name: "selfie", maxCount: 1 },
  ]), async (req, res, next) => {
    try {
      const { fullName, dateOfBirth, country, idType } = req.body;
      if (!fullName || !dateOfBirth || !country || !idType) {
        return res.status(400).json({ message: "All fields required: fullName, dateOfBirth, country, idType" });
      }

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.kycStatus === "pending") {
        return res.status(400).json({ message: "KYC application already pending" });
      }
      if (user.kycStatus === "verified") {
        return res.status(400).json({ message: "KYC already verified" });
      }

      // Extract uploaded file paths
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const idDocumentPath = files?.idDocument?.[0]?.filename || null;
      const selfiePath = files?.selfie?.[0]?.filename || null;

      const kycData = {
        fullName, dateOfBirth, country, idType,
        submittedAt: new Date().toISOString(),
        idDocumentPath,
        selfiePath,
      };
      const updated = await storage.updateUser(user.id, {
        kycStatus: "pending",
        kycData,
        kycRejectionReason: null,
      });

      // Send confirmation email
      if (user.email) {
        sendKycEmail(user.email, "KYC Application Received - HighRollers Club",
          `<h2>KYC Application Received</h2>
           <p>Hi ${fullName},</p>
           <p>We've received your identity verification application. Our team will review your documents and get back to you within 24-48 hours.</p>
           <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
           <p><strong>ID Type:</strong> ${idType}</p>
           <p>You'll receive an email when your verification status is updated.</p>
           <br/><p style="color:#888;">— HighRollers Club Team</p>`
        );
      }

      res.json(updated);
    } catch (err) { next(err); }
  });

  // Record KYC on blockchain
  app.post("/api/kyc/record-on-chain", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.kycStatus !== "verified") {
        return res.status(400).json({ message: "KYC must be verified first" });
      }
      if (user.kycBlockchainTxHash) {
        return res.status(400).json({ message: "Already recorded on-chain", txHash: user.kycBlockchainTxHash });
      }

      let txHash: string;
      let onChain = false;

      if (blockchainConfig.enabled && blockchainConfig.handVerifierAddress && blockchainConfig.walletPrivateKey) {
        // Real on-chain recording via Polygon
        try {
          const { ethers } = await import("ethers");
          const provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
          const signer = new ethers.Wallet(blockchainConfig.walletPrivateKey, provider);

          // Create a commitment hash of the KYC verification
          const kycHash = ethers.keccak256(ethers.toUtf8Bytes(
            JSON.stringify({ userId: user.id, memberId: user.memberId, kycData: user.kycData, verifiedAt: user.kycVerifiedAt })
          ));

          // Send a simple transaction with the KYC hash as data
          const tx = await signer.sendTransaction({
            to: blockchainConfig.handVerifierAddress,
            data: kycHash,
            value: 0,
          });
          const receipt = await tx.wait();
          txHash = receipt?.hash || tx.hash;
          onChain = true;
        } catch (chainErr: any) {
          console.warn("On-chain KYC recording failed, falling back to hash:", chainErr.message);
          // Fallback to local hash if chain call fails
          txHash = "0x" + createHash("sha256")
            .update(user.id + JSON.stringify(user.kycData) + Date.now().toString())
            .digest("hex");
        }
      } else {
        // Local hash when blockchain is not configured
        txHash = "0x" + createHash("sha256")
          .update(user.id + JSON.stringify(user.kycData) + Date.now().toString())
          .digest("hex");
      }

      await storage.updateUser(user.id, { kycBlockchainTxHash: txHash });
      res.json({ txHash, onChain, message: onChain ? "KYC recorded on Polygon" : "KYC hash recorded locally (blockchain not configured)" });
    } catch (err) { next(err); }
  });

  // ─── Responsible Gambling ─────────────────────────────────────────────────

  app.get("/api/responsible-gambling/settings", requireAuth, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        selfExcludedUntil: user.selfExcludedUntil,
        depositLimitDaily: user.depositLimitDaily ?? 0,
        depositLimitWeekly: user.depositLimitWeekly ?? 0,
        depositLimitMonthly: user.depositLimitMonthly ?? 0,
        sessionTimeLimitMinutes: user.sessionTimeLimitMinutes ?? 0,
        lossLimitDaily: user.lossLimitDaily ?? 0,
        coolOffUntil: user.coolOffUntil,
      });
    } catch (err) { next(err); }
  });

  app.put("/api/responsible-gambling/settings", requireAuth, async (req, res, next) => {
    try {
      const { depositLimitDaily, depositLimitWeekly, depositLimitMonthly, sessionTimeLimitMinutes, lossLimitDaily } = req.body;
      const updates: Record<string, any> = {};
      if (depositLimitDaily !== undefined) updates.depositLimitDaily = Math.max(0, Math.floor(Number(depositLimitDaily)));
      if (depositLimitWeekly !== undefined) updates.depositLimitWeekly = Math.max(0, Math.floor(Number(depositLimitWeekly)));
      if (depositLimitMonthly !== undefined) updates.depositLimitMonthly = Math.max(0, Math.floor(Number(depositLimitMonthly)));
      if (sessionTimeLimitMinutes !== undefined) updates.sessionTimeLimitMinutes = Math.max(0, Math.floor(Number(sessionTimeLimitMinutes)));
      if (lossLimitDaily !== undefined) updates.lossLimitDaily = Math.max(0, Math.floor(Number(lossLimitDaily)));
      if (Object.keys(updates).length === 0) return res.status(400).json({ message: "No valid settings provided" });
      const updated = await storage.updateUser(req.user!.id, updates);
      res.json({
        selfExcludedUntil: updated?.selfExcludedUntil ?? null,
        depositLimitDaily: updated?.depositLimitDaily ?? 0,
        depositLimitWeekly: updated?.depositLimitWeekly ?? 0,
        depositLimitMonthly: updated?.depositLimitMonthly ?? 0,
        sessionTimeLimitMinutes: updated?.sessionTimeLimitMinutes ?? 0,
        lossLimitDaily: updated?.lossLimitDaily ?? 0,
        coolOffUntil: updated?.coolOffUntil ?? null,
      });
    } catch (err) { next(err); }
  });

  app.post("/api/responsible-gambling/self-exclude", requireAuth, async (req, res, next) => {
    try {
      const { days } = req.body;
      if (!days || days < 1) return res.status(400).json({ message: "days must be >= 1" });
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.selfExcludedUntil) {
        const remainingMs = new Date(user.selfExcludedUntil).getTime() - Date.now();
        if (remainingMs > 24 * 60 * 60 * 1000) {
          return res.status(400).json({ message: "Cannot modify self-exclusion. Current exclusion cannot be reversed early.", selfExcludedUntil: user.selfExcludedUntil });
        }
      }
      const daysToAdd = days === 0 ? 3650 : Math.floor(Number(days));
      const excludeUntil = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);
      await storage.updateUser(req.user!.id, { selfExcludedUntil: excludeUntil });
      res.json({ selfExcludedUntil: excludeUntil, message: `Self-excluded until ${excludeUntil.toISOString()}` });
    } catch (err) { next(err); }
  });

  app.post("/api/responsible-gambling/cool-off", requireAuth, async (req, res, next) => {
    try {
      const coolOffUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await storage.updateUser(req.user!.id, { coolOffUntil });
      res.json({ coolOffUntil, message: "Cool-off period activated for 24 hours" });
    } catch (err) { next(err); }
  });

  // ─── Third-Party KYC Verification Webhook ─────────────────────────────────
  // Supports Onfido / Sumsub webhook callbacks
  // Provider configured via KYC_PROVIDER env var (onfido | sumsub | manual)

  app.post("/api/webhooks/kyc-verification", async (req, res, next) => {
    try {
      const provider = process.env.KYC_PROVIDER || "manual";
      const webhookSecret = process.env.KYC_WEBHOOK_SECRET;

      // Verify webhook signature based on provider
      if (provider === "onfido") {
        const sig = req.headers["x-sha2-signature"] as string;
        if (webhookSecret && sig) {
          const expected = createHash("sha256").update(JSON.stringify(req.body) + webhookSecret).digest("hex");
          if (sig !== expected) return res.status(401).json({ message: "Invalid signature" });
        }

        const { payload } = req.body;
        if (!payload?.resource_type || payload.resource_type !== "check") {
          return res.json({ received: true });
        }

        const applicantId = payload.object?.applicant_id;
        const result = payload.object?.result; // "clear" | "consider"
        if (!applicantId) return res.json({ received: true });

        // Look up user by kycData.providerApplicantId
        const allPending = await storage.getAllUsersByKycStatus("pending");
        const user = allPending.find(u => (u.kycData as any)?.providerApplicantId === applicantId);
        if (!user) return res.json({ received: true, matched: false });

        if (result === "clear") {
          await storage.updateUser(user.id, { kycStatus: "verified", kycVerifiedAt: new Date() });
          if (user.email) {
            sendKycEmail(user.email, "KYC Verified - HighRollers Club",
              `<h2>Identity Verified!</h2><p>Your identity has been automatically verified. You now have full access.</p>`);
          }
          await storage.createNotification(user.id, "kyc_status", "KYC Approved", "Your identity has been verified!", { status: "verified" });
          await logAdminAction("system:onfido", "kyc_auto_approve", "user", user.id, { applicantId, result });
        } else {
          await storage.updateUser(user.id, { kycStatus: "rejected", kycRejectionReason: `Auto-review: ${result}` });
          if (user.email) {
            sendKycEmail(user.email, "KYC Update - HighRollers Club",
              `<h2>Verification Update</h2><p>Your application requires manual review. We'll notify you when complete.</p>`);
          }
          await storage.createNotification(user.id, "kyc_status", "KYC Review", "Your documents need additional review.", { status: "review" });
          await logAdminAction("system:onfido", "kyc_auto_reject", "user", user.id, { applicantId, result });
        }
        return res.json({ received: true, processed: true });

      } else if (provider === "sumsub") {
        const sig = req.headers["x-payload-digest"] as string;
        if (webhookSecret && sig) {
          const hmac = createHash("sha256").update(JSON.stringify(req.body) + webhookSecret).digest("hex");
          if (sig !== hmac) return res.status(401).json({ message: "Invalid signature" });
        }

        const { applicantId, reviewResult, type: eventType } = req.body;
        if (eventType !== "applicantReviewed" || !applicantId) return res.json({ received: true });

        const allPending = await storage.getAllUsersByKycStatus("pending");
        const user = allPending.find(u => (u.kycData as any)?.providerApplicantId === applicantId);
        if (!user) return res.json({ received: true, matched: false });

        const approved = reviewResult?.reviewAnswer === "GREEN";
        if (approved) {
          await storage.updateUser(user.id, { kycStatus: "verified", kycVerifiedAt: new Date() });
          if (user.email) {
            sendKycEmail(user.email, "KYC Verified - HighRollers Club",
              `<h2>Identity Verified!</h2><p>Your identity has been verified successfully.</p>`);
          }
          await storage.createNotification(user.id, "kyc_status", "KYC Approved", "Your identity has been verified!", { status: "verified" });
          await logAdminAction("system:sumsub", "kyc_auto_approve", "user", user.id, { applicantId, reviewResult });
        } else {
          const rejectReason = reviewResult?.rejectLabels?.join(", ") || "Verification failed";
          await storage.updateUser(user.id, { kycStatus: "rejected", kycRejectionReason: rejectReason });
          if (user.email) {
            sendKycEmail(user.email, "KYC Update - HighRollers Club",
              `<h2>Verification Update</h2><p>Your application was not approved: ${rejectReason}</p>`);
          }
          await storage.createNotification(user.id, "kyc_status", "KYC Update", `Verification not approved: ${rejectReason}`, { status: "rejected" });
          await logAdminAction("system:sumsub", "kyc_auto_reject", "user", user.id, { applicantId, reviewResult });
        }
        return res.json({ received: true, processed: true });
      }

      // Manual provider — no webhook processing
      res.json({ received: true, provider });
    } catch (err) { next(err); }
  });
}

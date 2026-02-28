// ─── Payment Service ────────────────────────────────────────────────────────
// High-level orchestrator for deposits, withdrawals, and wallet crediting.
// Abstracts over multiple payment gateways.

import type { IPaymentGateway } from "./gateway-interface";
import type { WalletType, Payment } from "@shared/schema";
import { storage } from "../storage";

export interface AllocationEntry {
  walletType: WalletType;
  amount: number; // chip amount
}

export interface DepositResult {
  paymentId: string;
  payAddress: string;
  payAmount: string;
  currency: string;
  expiresAt: Date;
  gatewayProvider: string;
}

export interface WithdrawalResult {
  requestId: string;
  status: string;
}

export class PaymentService {
  private gateways: Map<string, IPaymentGateway> = new Map();
  private webhookBaseUrl: string;

  constructor(webhookBaseUrl: string) {
    this.webhookBaseUrl = webhookBaseUrl;
  }

  registerGateway(gateway: IPaymentGateway) {
    this.gateways.set(gateway.name, gateway);
  }

  getGateway(name: string): IPaymentGateway | undefined {
    return this.gateways.get(name);
  }

  getAvailableGateways(): { name: string; currencies: string[] }[] {
    return Array.from(this.gateways.values()).map(g => ({
      name: g.name,
      currencies: g.getSupportedCurrencies(),
    }));
  }

  // ── Deposit Flow ─────────────────────────────────────────────────────

  async initiateDeposit(
    userId: string,
    amountCents: number,
    currency: string,
    gatewayName: string,
    allocation: AllocationEntry[],
  ): Promise<DepositResult> {
    const gateway = this.gateways.get(gatewayName);
    if (!gateway) throw new Error(`Payment gateway '${gatewayName}' not configured`);

    // Validate allocation sums
    const chipAmount = amountCents; // 1 cent = 1 chip (configurable)
    const allocSum = allocation.reduce((s, a) => s + a.amount, 0);
    if (allocSum !== chipAmount) {
      throw new Error(`Allocation sum (${allocSum}) does not match chip amount (${chipAmount})`);
    }

    // Ensure user has all wallets
    await storage.ensureWallets(userId);

    // Get exchange rate
    const rate = await gateway.getExchangeRate(currency);

    // Create payment record
    const payment = await storage.createPayment({
      userId,
      direction: "deposit",
      status: "pending",
      amountFiat: amountCents,
      amountCrypto: null,
      currency,
      exchangeRate: String(rate.usdPerCoin),
      chipAmount,
      allocation: allocation as any,
      gatewayProvider: gatewayName,
      gatewayPaymentId: null,
      gatewayData: null,
      depositAddress: null,
      txHash: null,
      confirmations: 0,
      requiredConfirmations: currency === "SOL" ? 1 : currency === "BTC" ? 3 : 12,
      withdrawalAddress: null,
      confirmedAt: null,
      creditedAt: null,
      expiresAt: null,
    });

    // Create payment with gateway
    const callbackUrl = `${this.webhookBaseUrl}/api/payments/webhook/${gatewayName}`;
    const gatewayResult = await gateway.createPayment({
      amount: amountCents,
      currency,
      orderId: payment.id,
      description: `Poker deposit - ${allocation.map(a => `${a.amount} to ${a.walletType}`).join(", ")}`,
      callbackUrl,
    });

    // Update payment with gateway details
    await storage.updatePayment(payment.id, {
      gatewayPaymentId: gatewayResult.gatewayPaymentId,
      depositAddress: gatewayResult.payAddress,
      amountCrypto: gatewayResult.payAmount,
      expiresAt: gatewayResult.expiresAt,
      gatewayData: gatewayResult.rawResponse as any,
    });

    return {
      paymentId: payment.id,
      payAddress: gatewayResult.payAddress,
      payAmount: gatewayResult.payAmount,
      currency,
      expiresAt: gatewayResult.expiresAt,
      gatewayProvider: gatewayName,
    };
  }

  // ── Webhook Processing ────────────────────────────────────────────────

  async processWebhook(
    gatewayName: string,
    body: any,
    headers: Record<string, string>,
  ): Promise<{ paymentId: string; status: string }> {
    const gateway = this.gateways.get(gatewayName);
    if (!gateway) throw new Error(`Unknown gateway: ${gatewayName}`);

    const webhookData = await gateway.handleWebhook(body, headers);
    const payment = await storage.getPaymentByGatewayId(gatewayName, webhookData.gatewayPaymentId);
    if (!payment) throw new Error(`Payment not found for gateway ID: ${webhookData.gatewayPaymentId}`);

    // Don't reprocess already-credited payments
    if (payment.status === "credited") {
      return { paymentId: payment.id, status: "credited" };
    }

    // Map gateway status to our status
    let newStatus = payment.status;
    if (webhookData.status === "confirming" || webhookData.status === "partially_paid") {
      newStatus = "confirming";
    } else if (webhookData.status === "confirmed" || webhookData.status === "sending") {
      newStatus = "confirmed";
    } else if (webhookData.status === "finished") {
      newStatus = "confirmed";
    } else if (webhookData.status === "failed" || webhookData.status === "refunded") {
      newStatus = "failed";
    } else if (webhookData.status === "expired") {
      newStatus = "expired";
    }

    // Update payment record
    await storage.updatePayment(payment.id, {
      status: newStatus,
      txHash: webhookData.txHash || payment.txHash,
      confirmations: webhookData.confirmations ?? payment.confirmations,
    });

    // If confirmed/finished, credit the wallets
    if ((newStatus === "confirmed" || webhookData.status === "finished") && payment.status !== "confirmed" && payment.status !== "credited") {
      await this.creditDeposit(payment);
    }

    return { paymentId: payment.id, status: newStatus };
  }

  // ── Credit Deposit to Wallets ─────────────────────────────────────────

  private async creditDeposit(payment: Payment) {
    const allocation = (payment.allocation as AllocationEntry[] | null) || [];

    // If no allocation specified, credit everything to main wallet
    if (allocation.length === 0) {
      const { success, newBalance } = await storage.atomicAddToWallet(payment.userId, "main", payment.chipAmount);
      if (success) {
        await storage.createTransaction({
          userId: payment.userId,
          type: "deposit",
          amount: payment.chipAmount,
          balanceBefore: newBalance - payment.chipAmount,
          balanceAfter: newBalance,
          tableId: null,
          description: `Deposit via ${payment.gatewayProvider} (${payment.currency})`,
          walletType: "main",
          relatedTransactionId: null,
          paymentId: payment.id,
          metadata: { currency: payment.currency, txHash: payment.txHash } as any,
        });
      }
    } else {
      // Credit each wallet per allocation
      for (const entry of allocation) {
        if (entry.amount <= 0) continue;
        const { success, newBalance } = await storage.atomicAddToWallet(payment.userId, entry.walletType, entry.amount);
        if (success) {
          await storage.createTransaction({
            userId: payment.userId,
            type: "deposit",
            amount: entry.amount,
            balanceBefore: newBalance - entry.amount,
            balanceAfter: newBalance,
            tableId: null,
            description: `Deposit to ${entry.walletType} via ${payment.gatewayProvider} (${payment.currency})`,
            walletType: entry.walletType,
            relatedTransactionId: null,
            paymentId: payment.id,
            metadata: { currency: payment.currency, txHash: payment.txHash, allocation: entry } as any,
          });
        }
      }
    }

    // Mark payment as credited
    await storage.updatePayment(payment.id, {
      status: "credited",
      creditedAt: new Date(),
    });
  }

  // ── Withdrawal Flow ──────────────────────────────────────────────────

  async initiateWithdrawal(
    userId: string,
    chipAmount: number,
    currency: string,
    address: string,
  ): Promise<WithdrawalResult> {
    // Validate address with any available gateway
    for (const gateway of this.gateways.values()) {
      if (gateway.getSupportedCurrencies().includes(currency.toUpperCase())) {
        if (!gateway.validateAddress(currency, address)) {
          throw new Error(`Invalid ${currency} address`);
        }
        break;
      }
    }

    // Hold funds from main wallet
    const { success } = await storage.atomicDeductFromWallet(userId, "main", chipAmount);
    if (!success) throw new Error("Insufficient funds in main wallet");

    // Get exchange rate for fiat amount
    let amountFiat = chipAmount; // 1 chip = 1 cent by default
    for (const gateway of this.gateways.values()) {
      try {
        const rate = await gateway.getExchangeRate(currency);
        amountFiat = Math.round(chipAmount); // chips are already in cents
        break;
      } catch { /* try next gateway */ }
    }

    // Record the hold transaction
    const totalBal = await storage.getUserTotalBalance(userId);
    await storage.createTransaction({
      userId,
      type: "withdraw",
      amount: -chipAmount,
      balanceBefore: totalBal + chipAmount,
      balanceAfter: totalBal,
      tableId: null,
      description: `Withdrawal hold: ${chipAmount} chips → ${currency} to ${address.slice(0, 8)}...`,
      walletType: "main",
      relatedTransactionId: null,
      paymentId: null,
      metadata: { currency, address } as any,
    });

    // Create withdrawal request (pending admin approval)
    const request = await storage.createWithdrawalRequest({
      userId,
      paymentId: null,
      amount: chipAmount,
      amountFiat,
      currency,
      withdrawalAddress: address,
      status: "pending",
      reviewedBy: null,
      reviewNote: null,
      processedAt: null,
    });

    return {
      requestId: request.id,
      status: "pending",
    };
  }

  // ── Admin: Process Withdrawal ────────────────────────────────────────

  async approveWithdrawal(requestId: string, adminUserId: string): Promise<void> {
    const request = await storage.getWithdrawalRequests();
    const req = request.find(r => r.id === requestId);
    if (!req) throw new Error("Withdrawal request not found");
    if (req.status !== "pending") throw new Error(`Request is ${req.status}, not pending`);

    await storage.updateWithdrawalRequest(requestId, {
      status: "processing",
      reviewedBy: adminUserId,
    });

    // Find a gateway that supports this currency and process
    for (const gateway of this.gateways.values()) {
      if (gateway.getSupportedCurrencies().includes(req.currency.toUpperCase())) {
        try {
          const rate = await gateway.getExchangeRate(req.currency);
          const cryptoAmount = (req.amount / 100 / rate.usdPerCoin).toFixed(8);

          const result = await gateway.createWithdrawal({
            amount: cryptoAmount,
            currency: req.currency,
            address: req.withdrawalAddress,
            orderId: req.id,
          });

          // Create payment record for the withdrawal
          const payment = await storage.createPayment({
            userId: req.userId,
            direction: "withdrawal",
            status: "processing",
            amountFiat: req.amountFiat || req.amount,
            amountCrypto: cryptoAmount,
            currency: req.currency,
            exchangeRate: String(rate.usdPerCoin),
            chipAmount: req.amount,
            allocation: null,
            gatewayProvider: gateway.name,
            gatewayPaymentId: result.gatewayWithdrawalId,
            gatewayData: result.rawResponse as any,
            depositAddress: null,
            txHash: null,
            confirmations: 0,
            requiredConfirmations: 1,
            withdrawalAddress: req.withdrawalAddress,
            confirmedAt: null,
            creditedAt: null,
            expiresAt: null,
          });

          await storage.updateWithdrawalRequest(requestId, {
            status: "completed",
            paymentId: payment.id,
            processedAt: new Date(),
          });

          return;
        } catch (err) {
          console.error(`[PaymentService] Withdrawal failed via ${gateway.name}:`, err);
          // Try next gateway
        }
      }
    }

    throw new Error("No gateway could process this withdrawal");
  }

  async rejectWithdrawal(requestId: string, adminUserId: string, note?: string): Promise<void> {
    const requests = await storage.getWithdrawalRequests();
    const req = requests.find(r => r.id === requestId);
    if (!req) throw new Error("Withdrawal request not found");
    if (req.status !== "pending") throw new Error(`Request is ${req.status}, not pending`);

    // Refund chips to main wallet
    await storage.atomicAddToWallet(req.userId, "main", req.amount);

    const totalBal = await storage.getUserTotalBalance(req.userId);
    await storage.createTransaction({
      userId: req.userId,
      type: "refund",
      amount: req.amount,
      balanceBefore: totalBal - req.amount,
      balanceAfter: totalBal,
      tableId: null,
      description: `Withdrawal rejected — funds returned to main wallet`,
      walletType: "main",
      relatedTransactionId: null,
      paymentId: null,
      metadata: { withdrawalRequestId: requestId, reason: note } as any,
    });

    await storage.updateWithdrawalRequest(requestId, {
      status: "cancelled",
      reviewedBy: adminUserId,
      reviewNote: note || "Rejected by admin",
    });
  }

  // ── Exchange Rates ───────────────────────────────────────────────────

  async getExchangeRates(currencies: string[]): Promise<Record<string, { usdPerCoin: number }>> {
    const rates: Record<string, { usdPerCoin: number }> = {};
    for (const currency of currencies) {
      for (const gateway of this.gateways.values()) {
        try {
          const rate = await gateway.getExchangeRate(currency);
          rates[currency] = { usdPerCoin: rate.usdPerCoin };
          break;
        } catch { /* try next */ }
      }
    }
    return rates;
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

let paymentServiceInstance: PaymentService | null = null;

export function getPaymentService(): PaymentService {
  if (!paymentServiceInstance) {
    const baseUrl = process.env.WEBHOOK_BASE_URL
      || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : null)
      || "http://localhost:5000";
    paymentServiceInstance = new PaymentService(baseUrl);

    // Register configured gateways
    if (process.env.NOWPAYMENTS_API_KEY) {
      const { NOWPaymentsGateway } = require("./nowpayments-gateway");
      paymentServiceInstance.registerGateway(new NOWPaymentsGateway({
        apiKey: process.env.NOWPAYMENTS_API_KEY,
        webhookSecret: process.env.NOWPAYMENTS_WEBHOOK_SECRET,
        sandbox: process.env.NOWPAYMENTS_SANDBOX === "true",
      }));
    }

    if (process.env.COINPAYMENTS_API_KEY) {
      const { CoinPaymentsGateway } = require("./coinpayments-gateway");
      paymentServiceInstance.registerGateway(new CoinPaymentsGateway({
        apiKey: process.env.COINPAYMENTS_API_KEY,
        apiSecret: process.env.COINPAYMENTS_API_SECRET,
        webhookSecret: process.env.COINPAYMENTS_IPN_SECRET,
      }));
    }

    if (process.env.DIRECT_WALLET_ENABLED === "true") {
      const { DirectWalletGateway } = require("./direct-wallet-gateway");
      paymentServiceInstance.registerGateway(new DirectWalletGateway({
        apiKey: "direct",
        btcXpub: process.env.BTC_XPUB,
        ethAddress: process.env.ETH_HOT_WALLET,
        solAddress: process.env.SOL_HOT_WALLET,
        blockcypherToken: process.env.BLOCKCYPHER_TOKEN,
        alchemyApiKey: process.env.ALCHEMY_API_KEY,
        heliusApiKey: process.env.HELIUS_API_KEY,
        webhookSecret: process.env.DIRECT_WALLET_WEBHOOK_SECRET,
      }));
    }
  }
  return paymentServiceInstance;
}

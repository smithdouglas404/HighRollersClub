// ─── NOWPayments Gateway ────────────────────────────────────────────────────
// Integration with NOWPayments API (https://nowpayments.io)
// Supports 200+ cryptocurrencies, simple REST API, IPN webhooks

import crypto from "crypto";
import type {
  IPaymentGateway,
  PaymentGatewayConfig,
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  CreateWithdrawalRequest,
  CreateWithdrawalResponse,
  ExchangeRateResponse,
} from "./gateway-interface";

const NOWPAYMENTS_API = "https://api.nowpayments.io/v1";
const NOWPAYMENTS_SANDBOX_API = "https://api-sandbox.nowpayments.io/v1";

export class NOWPaymentsGateway implements IPaymentGateway {
  readonly name = "nowpayments" as const;
  private config: PaymentGatewayConfig;
  private baseUrl: string;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
    this.baseUrl = config.sandbox ? NOWPAYMENTS_SANDBOX_API : (config.baseUrl || NOWPAYMENTS_API);
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "x-api-key": this.config.apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`NOWPayments API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const data = await this.request("POST", "/payment", {
      price_amount: req.amount / 100, // convert cents to dollars
      price_currency: "usd",
      pay_currency: req.currency.toLowerCase(),
      order_id: req.orderId,
      order_description: req.description || "Poker deposit",
      ipn_callback_url: req.callbackUrl,
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
    });

    return {
      gatewayPaymentId: String(data.payment_id),
      payAddress: data.pay_address,
      payAmount: String(data.pay_amount),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // NOWPayments doesn't expire, but we set 24h
      status: data.payment_status,
      rawResponse: data,
    };
  }

  async getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatusResponse> {
    const data = await this.request("GET", `/payment/${gatewayPaymentId}`);

    const statusMap: Record<string, PaymentStatusResponse["status"]> = {
      waiting: "waiting",
      confirming: "confirming",
      confirmed: "confirmed",
      sending: "confirmed",
      partially_paid: "confirming",
      finished: "finished",
      failed: "failed",
      refunded: "failed",
      expired: "expired",
    };

    return {
      gatewayPaymentId: String(data.payment_id),
      status: statusMap[data.payment_status] || "waiting",
      actuallyPaid: String(data.actually_paid || "0"),
      confirmations: 0, // NOWPayments doesn't expose confirmation count
      txHash: data.payin_hash,
      rawResponse: data,
    };
  }

  handleWebhook(body: any, headers: Record<string, string>): Promise<{
    gatewayPaymentId: string;
    status: string;
    txHash?: string;
    confirmations?: number;
    actuallyPaid?: string;
  }> {
    // Verify HMAC signature
    if (this.config.webhookSecret) {
      const signature = headers["x-nowpayments-sig"];
      if (!signature) throw new Error("Missing webhook signature");

      // Sort body keys and create HMAC
      const sortedBody = JSON.stringify(this.sortObject(body));
      const hmac = crypto
        .createHmac("sha512", this.config.webhookSecret)
        .update(sortedBody)
        .digest("hex");

      if (hmac !== signature) throw new Error("Invalid webhook signature");
    }

    return Promise.resolve({
      gatewayPaymentId: String(body.payment_id),
      status: body.payment_status,
      txHash: body.payin_hash,
      actuallyPaid: String(body.actually_paid || "0"),
    });
  }

  async createWithdrawal(req: CreateWithdrawalRequest): Promise<CreateWithdrawalResponse> {
    // NOWPayments payout API
    const data = await this.request("POST", "/payout", {
      withdrawals: [{
        address: req.address,
        currency: req.currency.toLowerCase(),
        amount: parseFloat(req.amount),
        extra_id: req.orderId,
      }],
    });

    return {
      gatewayWithdrawalId: String(data.id || data.withdrawals?.[0]?.id),
      status: data.status || "processing",
      rawResponse: data,
    };
  }

  async getExchangeRate(currency: string): Promise<ExchangeRateResponse> {
    const data = await this.request("GET", `/estimate?amount=1&currency_from=usd&currency_to=${currency.toLowerCase()}`);
    const cryptoPerUsd = parseFloat(data.estimated_amount);
    return {
      rate: cryptoPerUsd,
      usdPerCoin: cryptoPerUsd > 0 ? 1 / cryptoPerUsd : 0,
      timestamp: Date.now(),
    };
  }

  getSupportedCurrencies(): string[] {
    return ["BTC", "ETH", "USDT", "SOL", "LTC", "DOGE", "XRP", "ADA", "MATIC", "BNB", "AVAX", "DOT", "LINK", "TRX", "SHIB"];
  }

  validateAddress(currency: string, address: string): boolean {
    if (!address || address.length < 10) return false;
    // Basic format validation per currency
    switch (currency.toUpperCase()) {
      case "BTC": return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address);
      case "ETH":
      case "USDT":
      case "MATIC":
      case "BNB": return /^0x[a-fA-F0-9]{40}$/.test(address);
      case "SOL": return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      case "XRP": return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
      case "TRX": return /^T[a-zA-Z0-9]{33}$/.test(address);
      default: return address.length >= 10;
    }
  }

  private sortObject(obj: any): any {
    if (typeof obj !== "object" || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortObject(item));
    return Object.keys(obj).sort().reduce((sorted: any, key) => {
      sorted[key] = this.sortObject(obj[key]);
      return sorted;
    }, {});
  }
}

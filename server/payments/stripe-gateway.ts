// ─── Stripe Payment Gateway ─────────────────────────────────────────────────
// Integration with Stripe API (https://stripe.com)
// Supports credit/debit card and bank payments via Stripe Checkout Sessions
// Uses raw fetch() calls — no external stripe npm package needed

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

const STRIPE_API = "https://api.stripe.com/v1";

export class StripeGateway implements IPaymentGateway {
  readonly name = "stripe" as const;
  private apiKey: string;
  private webhookSecret: string;

  constructor(config: PaymentGatewayConfig) {
    this.apiKey = config.apiKey;
    this.webhookSecret = config.webhookSecret || "";
  }

  /**
   * Make an authenticated request to the Stripe API.
   * Stripe uses application/x-www-form-urlencoded for POST bodies.
   */
  private async request(method: string, path: string, params?: Record<string, string>): Promise<any> {
    const url = `${STRIPE_API}${path}`;
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${this.apiKey}`,
    };

    let body: string | undefined;
    if (params && method !== "GET") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = this.encodeFormData(params);
    }

    // For GET requests with params, append to URL
    let finalUrl = url;
    if (params && method === "GET") {
      const qs = new URLSearchParams(params).toString();
      finalUrl = `${url}?${qs}`;
    }

    const res = await fetch(finalUrl, {
      method,
      headers,
      body,
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Stripe API error ${res.status}: ${text}`);
    }

    if (!res.ok) {
      const msg = data?.error?.message || text;
      throw new Error(`Stripe API error ${res.status}: ${msg}`);
    }

    return data;
  }

  /**
   * Encode nested objects into Stripe's form encoding format.
   * e.g., { "line_items[0][price_data][currency]": "usd" }
   */
  private encodeFormData(params: Record<string, string>): string {
    return Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
  }

  // ── Deposit Flow ─────────────────────────────────────────────────────

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    // Stripe Checkout Sessions expect amount in smallest currency unit (cents for USD)
    const amountCents = req.amount; // already in cents

    // Build Stripe Checkout Session params (form-encoded with bracket notation)
    const params: Record<string, string> = {
      "mode": "payment",
      "payment_method_types[0]": "card",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(amountCents),
      "line_items[0][price_data][product_data][name]": "Poker Chip Deposit",
      "line_items[0][price_data][product_data][description]": req.description || `Deposit of $${(amountCents / 100).toFixed(2)}`,
      "line_items[0][quantity]": "1",
      "client_reference_id": req.orderId,
      "metadata[order_id]": req.orderId,
    };

    // Success/cancel URLs — Stripe requires these for Checkout
    if (req.successUrl) {
      params["success_url"] = req.successUrl;
    } else {
      // Default: redirect back to wallet page with success indicator
      const baseUrl = process.env.WEBHOOK_BASE_URL
        || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : null)
        || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
        || (process.env.NODE_ENV === "production" ? (() => { throw new Error("FATAL: WEBHOOK_BASE_URL required for Stripe redirects in production"); })() : "http://localhost:5000");
      params["success_url"] = `${baseUrl}/wallet?deposit=success`;
      params["cancel_url"] = `${baseUrl}/wallet?deposit=cancelled`;
    }

    if (req.cancelUrl) {
      params["cancel_url"] = req.cancelUrl;
    } else if (!params["cancel_url"]) {
      const baseUrl = process.env.WEBHOOK_BASE_URL
        || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : null)
        || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
        || (process.env.NODE_ENV === "production" ? (() => { throw new Error("FATAL: WEBHOOK_BASE_URL required for Stripe redirects in production"); })() : "http://localhost:5000");
      params["cancel_url"] = `${baseUrl}/wallet?deposit=cancelled`;
    }

    const session = await this.request("POST", "/checkout/sessions", params);

    return {
      gatewayPaymentId: session.id,
      payAddress: session.url, // The Checkout Session URL — user opens this to pay
      payAmount: (amountCents / 100).toFixed(2), // display as dollars
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // Stripe sessions expire in ~24h, but we show 30min
      status: session.payment_status || "unpaid",
      rawResponse: session,
    };
  }

  async getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatusResponse> {
    const session = await this.request("GET", `/checkout/sessions/${gatewayPaymentId}`);

    const statusMap: Record<string, PaymentStatusResponse["status"]> = {
      paid: "confirmed",
      complete: "confirmed",
      unpaid: "waiting",
      no_payment_required: "confirmed",
      expired: "expired",
    };

    // Check both payment_status and status fields
    const paymentStatus = session.payment_status || "unpaid";
    const sessionStatus = session.status || "open";

    let mappedStatus: PaymentStatusResponse["status"] = "waiting";
    if (statusMap[paymentStatus]) {
      mappedStatus = statusMap[paymentStatus];
    } else if (sessionStatus === "expired") {
      mappedStatus = "expired";
    } else if (sessionStatus === "complete") {
      mappedStatus = "confirmed";
    }

    return {
      gatewayPaymentId: session.id,
      status: mappedStatus,
      actuallyPaid: paymentStatus === "paid" ? (session.amount_total / 100).toFixed(2) : "0",
      confirmations: mappedStatus === "confirmed" ? 1 : 0,
      txHash: session.payment_intent || undefined,
      rawResponse: session,
    };
  }

  // ── Webhook Processing ────────────────────────────────────────────────

  async handleWebhook(body: any, headers: Record<string, string>): Promise<{
    gatewayPaymentId: string;
    status: string;
    txHash?: string;
    confirmations?: number;
    actuallyPaid?: string;
  }> {
    // Verify Stripe webhook signature
    if (this.webhookSecret) {
      const signature = headers["stripe-signature"];
      if (!signature) throw new Error("Missing stripe-signature header");

      this.verifyWebhookSignature(body, signature);
    }

    // Parse the event — body may be raw string or parsed object
    const event = typeof body === "string" ? JSON.parse(body) : body;

    const eventType = event.type;
    const eventData = event.data?.object;

    if (!eventData) {
      throw new Error("Invalid Stripe webhook event: missing data.object");
    }

    // Map Stripe event types to our status
    let status: string;
    let gatewayPaymentId: string;
    let txHash: string | undefined;
    let actuallyPaid: string | undefined;

    switch (eventType) {
      case "checkout.session.completed": {
        status = "confirmed";
        gatewayPaymentId = eventData.id; // Checkout Session ID
        txHash = eventData.payment_intent;
        const amountTotal = eventData.amount_total;
        actuallyPaid = amountTotal ? (amountTotal / 100).toFixed(2) : undefined;
        break;
      }
      case "checkout.session.expired": {
        status = "expired";
        gatewayPaymentId = eventData.id;
        break;
      }
      case "payment_intent.succeeded": {
        status = "confirmed";
        // For payment_intent events, we need to find the checkout session
        // The metadata should contain our order_id
        gatewayPaymentId = eventData.metadata?.checkout_session_id || eventData.id;
        txHash = eventData.id;
        actuallyPaid = eventData.amount_received
          ? (eventData.amount_received / 100).toFixed(2)
          : undefined;
        break;
      }
      case "payment_intent.payment_failed": {
        status = "failed";
        gatewayPaymentId = eventData.metadata?.checkout_session_id || eventData.id;
        txHash = eventData.id;
        break;
      }
      default: {
        // For unhandled event types, return waiting status
        status = "waiting";
        gatewayPaymentId = eventData.id || "unknown";
      }
    }

    return {
      gatewayPaymentId,
      status,
      txHash,
      confirmations: status === "confirmed" ? 1 : 0,
      actuallyPaid,
    };
  }

  /**
   * Verify Stripe webhook signature using HMAC-SHA256.
   * stripe-signature header format: t=timestamp,v1=signature[,v1=signature...]
   */
  private verifyWebhookSignature(rawBody: any, signatureHeader: string): void {
    const elements = signatureHeader.split(",");
    const sigMap: Record<string, string[]> = {};
    let timestamp = "";

    for (const element of elements) {
      const [key, value] = element.split("=", 2);
      if (key === "t") {
        timestamp = value;
      } else {
        if (!sigMap[key]) sigMap[key] = [];
        sigMap[key].push(value);
      }
    }

    if (!timestamp) throw new Error("Missing timestamp in stripe-signature");
    const v1Signatures = sigMap["v1"];
    if (!v1Signatures || v1Signatures.length === 0) {
      throw new Error("Missing v1 signature in stripe-signature");
    }

    // Compute expected signature
    const payload = typeof rawBody === "string" ? rawBody :
      (rawBody instanceof Buffer ? rawBody.toString("utf8") : JSON.stringify(rawBody));
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(signedPayload)
      .digest("hex");

    // Constant-time comparison with any of the v1 signatures
    const isValid = v1Signatures.some(sig => {
      try {
        return crypto.timingSafeEqual(
          Buffer.from(expectedSignature, "hex"),
          Buffer.from(sig, "hex"),
        );
      } catch {
        return false;
      }
    });

    if (!isValid) {
      throw new Error("Invalid Stripe webhook signature");
    }

    // Check timestamp tolerance (5 minutes)
    const timestampAge = Math.abs(Date.now() / 1000 - parseInt(timestamp));
    if (timestampAge > 300) {
      throw new Error("Stripe webhook timestamp too old");
    }
  }

  // ── Withdrawal Flow ──────────────────────────────────────────────────

  async createWithdrawal(req: CreateWithdrawalRequest): Promise<CreateWithdrawalResponse> {
    // Fiat withdrawals via Stripe would use Stripe Connect payouts in production.
    // For now, return a pending status — admin reviews and processes manually.
    return {
      gatewayWithdrawalId: `stripe_wd_${req.orderId}`,
      status: "pending_review",
      rawResponse: {
        message: "Fiat withdrawals require manual review. Funds will be sent to your registered payment method.",
        orderId: req.orderId,
        amount: req.amount,
        currency: req.currency,
        email: req.address, // For Stripe, "address" is the user's email
      },
    };
  }

  // ── Exchange Rates ───────────────────────────────────────────────────

  async getExchangeRate(_currency: string): Promise<ExchangeRateResponse> {
    // USD is 1:1 — 1 USD cent = 1 chip
    return {
      rate: 1,
      usdPerCoin: 1,
      timestamp: Date.now(),
    };
  }

  // ── Utilities ────────────────────────────────────────────────────────

  getSupportedCurrencies(): string[] {
    return ["USD"];
  }

  validateAddress(_currency: string, address: string): boolean {
    // For Stripe, "address" is the user's email for withdrawal purposes
    if (!address || address.length < 5) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
  }
}

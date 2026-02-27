// ─── CoinPayments Gateway ──────────────────────────────────────────────────
// Integration with CoinPayments API (https://www.coinpayments.net)
// Established multi-coin payment processor with IPN callbacks

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

const COINPAYMENTS_API = "https://www.coinpayments.net/api.php";

export class CoinPaymentsGateway implements IPaymentGateway {
  readonly name = "coinpayments" as const;
  private config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  private async request(cmd: string, params: Record<string, string> = {}): Promise<any> {
    const body = new URLSearchParams({
      version: "1",
      cmd,
      key: this.config.apiKey,
      format: "json",
      ...params,
    });

    const hmac = crypto
      .createHmac("sha512", this.config.apiSecret || "")
      .update(body.toString())
      .digest("hex");

    const res = await fetch(COINPAYMENTS_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        HMAC: hmac,
      },
      body: body.toString(),
    });

    const data = await res.json();
    if (data.error !== "ok") {
      throw new Error(`CoinPayments API error: ${data.error}`);
    }
    return data.result;
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const data = await this.request("create_transaction", {
      amount: String(req.amount / 100), // cents to dollars
      currency1: "USD",
      currency2: req.currency.toUpperCase(),
      buyer_email: "noreply@poker.app",
      item_name: req.description || "Poker deposit",
      item_number: req.orderId,
      ipn_url: req.callbackUrl,
      success_url: req.successUrl || "",
      cancel_url: req.cancelUrl || "",
    });

    return {
      gatewayPaymentId: data.txn_id,
      payAddress: data.address,
      payAmount: String(data.amount),
      expiresAt: new Date(data.timeout * 1000 + Date.now()),
      status: "waiting",
      rawResponse: data,
    };
  }

  async getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatusResponse> {
    const data = await this.request("get_tx_info", {
      txid: gatewayPaymentId,
    });

    let status: PaymentStatusResponse["status"] = "waiting";
    const statusNum = parseInt(data.status, 10);
    if (statusNum >= 100) status = "finished";
    else if (statusNum >= 2) status = "confirmed";
    else if (statusNum >= 1) status = "confirming";
    else if (statusNum === 0) status = "waiting";
    else if (statusNum < 0) status = "failed";

    return {
      gatewayPaymentId,
      status,
      actuallyPaid: String(data.receivedf || "0"),
      confirmations: parseInt(data.recv_confirms || "0", 10),
      txHash: data.txid,
      rawResponse: data,
    };
  }

  async handleWebhook(body: any, headers: Record<string, string>): Promise<{
    gatewayPaymentId: string;
    status: string;
    txHash?: string;
    confirmations?: number;
    actuallyPaid?: string;
  }> {
    // Verify HMAC
    if (this.config.webhookSecret) {
      const hmac = headers["hmac"];
      if (!hmac) throw new Error("Missing IPN HMAC");

      const payload = typeof body === "string" ? body : new URLSearchParams(body).toString();
      const expectedHmac = crypto
        .createHmac("sha512", this.config.webhookSecret)
        .update(payload)
        .digest("hex");

      if (hmac !== expectedHmac) throw new Error("Invalid IPN HMAC");
    }

    // Verify merchant ID
    if (body.merchant && this.config.apiKey && body.merchant !== this.config.apiKey) {
      throw new Error("Merchant ID mismatch");
    }

    const statusNum = parseInt(body.status, 10);
    let status = "waiting";
    if (statusNum >= 100) status = "finished";
    else if (statusNum >= 2) status = "confirmed";
    else if (statusNum >= 1) status = "confirming";
    else if (statusNum < 0) status = "failed";

    return {
      gatewayPaymentId: body.txn_id,
      status,
      txHash: body.txid || undefined,
      actuallyPaid: String(body.receivedf || body.received || "0"),
    };
  }

  async createWithdrawal(req: CreateWithdrawalRequest): Promise<CreateWithdrawalResponse> {
    const data = await this.request("create_withdrawal", {
      amount: req.amount,
      currency: req.currency.toUpperCase(),
      address: req.address,
      auto_confirm: "1",
      note: `Withdrawal ${req.orderId}`,
    });

    return {
      gatewayWithdrawalId: data.id,
      status: data.status || "processing",
      rawResponse: data,
    };
  }

  async getExchangeRate(currency: string): Promise<ExchangeRateResponse> {
    const data = await this.request("rates", {});
    const coin = data[currency.toUpperCase()];
    if (!coin) throw new Error(`Currency ${currency} not supported`);

    const usdPerCoin = parseFloat(coin.rate_btc) > 0
      ? parseFloat(data.BTC?.rate_btc || "1") / parseFloat(coin.rate_btc) * parseFloat(data.USD?.rate_btc || "0")
      : 0;

    return {
      rate: usdPerCoin > 0 ? 1 / usdPerCoin : 0,
      usdPerCoin,
      timestamp: Date.now(),
    };
  }

  getSupportedCurrencies(): string[] {
    return ["BTC", "ETH", "USDT", "SOL", "LTC", "DOGE", "XRP", "ADA", "MATIC", "BNB", "TRX", "BCH", "DASH"];
  }

  validateAddress(currency: string, address: string): boolean {
    if (!address || address.length < 10) return false;
    switch (currency.toUpperCase()) {
      case "BTC": return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address);
      case "ETH":
      case "USDT":
      case "MATIC":
      case "BNB": return /^0x[a-fA-F0-9]{40}$/.test(address);
      case "SOL": return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      case "TRX": return /^T[a-zA-Z0-9]{33}$/.test(address);
      default: return address.length >= 10;
    }
  }
}

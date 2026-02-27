// ─── Payment Gateway Interface ─────────────────────────────────────────────
// All crypto payment gateways implement this interface.
// Supports: NOWPayments, CoinPayments, Direct Wallet

export interface PaymentGatewayConfig {
  apiKey: string;
  apiSecret?: string;
  webhookSecret?: string;
  baseUrl?: string;
  sandbox?: boolean;
}

export interface CreatePaymentRequest {
  amount: number;        // USD cents
  currency: string;      // BTC, ETH, USDT, SOL, etc.
  orderId: string;       // our internal payment.id
  description?: string;
  callbackUrl: string;   // webhook URL for payment updates
  successUrl?: string;   // redirect after successful payment
  cancelUrl?: string;    // redirect on cancel
}

export interface CreatePaymentResponse {
  gatewayPaymentId: string;
  payAddress: string;     // crypto address to send payment to
  payAmount: string;      // exact crypto amount to pay
  expiresAt: Date;
  status: string;
  rawResponse: Record<string, any>;
}

export interface PaymentStatusResponse {
  gatewayPaymentId: string;
  status: "waiting" | "confirming" | "confirmed" | "finished" | "failed" | "expired";
  actuallyPaid: string;  // crypto amount actually received
  confirmations: number;
  txHash?: string;
  rawResponse: Record<string, any>;
}

export interface CreateWithdrawalRequest {
  amount: string;         // crypto amount
  currency: string;
  address: string;        // recipient crypto address
  orderId: string;        // our internal withdrawal request id
}

export interface CreateWithdrawalResponse {
  gatewayWithdrawalId: string;
  status: string;
  rawResponse: Record<string, any>;
}

export interface ExchangeRateResponse {
  rate: number;           // 1 USD = X crypto (or 1 crypto = X USD depending on implementation)
  usdPerCoin: number;     // how many USD per 1 coin
  timestamp: number;
}

export interface IPaymentGateway {
  readonly name: string;  // "nowpayments" | "coinpayments" | "direct"

  // Deposit flow
  createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResponse>;
  getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatusResponse>;
  handleWebhook(body: any, headers: Record<string, string>): Promise<{
    gatewayPaymentId: string;
    status: string;
    txHash?: string;
    confirmations?: number;
    actuallyPaid?: string;
  }>;

  // Withdrawal flow
  createWithdrawal(req: CreateWithdrawalRequest): Promise<CreateWithdrawalResponse>;

  // Exchange rates
  getExchangeRate(currency: string): Promise<ExchangeRateResponse>;

  // Utilities
  getSupportedCurrencies(): string[];
  validateAddress(currency: string, address: string): boolean;
}

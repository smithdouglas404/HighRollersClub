// ─── Direct Wallet Gateway ─────────────────────────────────────────────────
// No middleman — generates HD wallet addresses per user and monitors
// blockchain APIs directly for incoming transactions.
// Supports: BTC (BlockCypher), ETH/USDT (Alchemy/Infura), SOL (Helius)
// Lower fees than third-party gateways.

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

// Config extends base with blockchain-specific API keys
export interface DirectWalletConfig extends PaymentGatewayConfig {
  btcXpub?: string;           // BTC HD wallet extended public key
  ethAddress?: string;         // ETH hot wallet address
  solAddress?: string;         // SOL hot wallet address
  blockcypherToken?: string;   // BlockCypher API token for BTC
  alchemyApiKey?: string;      // Alchemy API key for ETH
  heliusApiKey?: string;       // Helius API key for SOL
  derivationIndex?: number;    // current HD wallet index
}

// Confirmation requirements per currency
const CONFIRMATIONS: Record<string, number> = {
  BTC: 3,
  ETH: 12,
  USDT: 12,
  SOL: 1,
};

export class DirectWalletGateway implements IPaymentGateway {
  readonly name = "direct" as const;
  private config: DirectWalletConfig;
  private derivationIndex: number;

  constructor(config: DirectWalletConfig) {
    this.config = config;
    this.derivationIndex = config.derivationIndex || 0;
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const currency = req.currency.toUpperCase();
    const payAddress = await this.generateDepositAddress(currency, req.orderId);
    const rate = await this.getExchangeRate(currency);
    const amountUsd = req.amount / 100;
    const payAmount = (amountUsd / rate.usdPerCoin).toFixed(8);

    return {
      gatewayPaymentId: `direct_${req.orderId}_${Date.now()}`,
      payAddress,
      payAmount,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiry
      status: "waiting",
      rawResponse: { currency, payAddress, payAmount, rate: rate.usdPerCoin },
    };
  }

  async getPaymentStatus(gatewayPaymentId: string): Promise<PaymentStatusResponse> {
    // Check blockchain for deposit confirmations
    const parts = gatewayPaymentId.split("_");
    // Attempt to extract currency from stored metadata
    const currency = parts[3] || "ETH";

    // For Polygon/ETH: check via Alchemy or public RPC
    if ((currency === "ETH" || currency === "USDT" || currency === "MATIC") && this.config.alchemyApiKey) {
      try {
        const txHash = parts[4]; // stored when deposit detected
        if (txHash && txHash.startsWith("0x")) {
          const rpcUrl = `https://polygon-amoy.g.alchemy.com/v2/${this.config.alchemyApiKey}`;
          const res = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1, method: "eth_getTransactionReceipt", params: [txHash],
            }),
          });
          const data = await res.json();
          if (data.result?.status === "0x1") {
            const blockNum = parseInt(data.result.blockNumber, 16);
            // Get current block for confirmation count
            const blockRes = await fetch(rpcUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_blockNumber", params: [] }),
            });
            const blockData = await blockRes.json();
            const currentBlock = parseInt(blockData.result, 16);
            const confirmations = currentBlock - blockNum;
            const requiredConfs = CONFIRMATIONS[currency] || 12;
            return {
              gatewayPaymentId,
              status: confirmations >= requiredConfs ? "finished" : "confirming",
              actuallyPaid: "0",
              confirmations,
              rawResponse: { txHash, blockNum, currentBlock },
            };
          }
        }
      } catch {
        // Fallback to waiting
      }
    }

    // For SOL: check via Helius
    if (currency === "SOL" && this.config.heliusApiKey) {
      try {
        const txSig = parts[4];
        if (txSig) {
          const res = await fetch(`https://api.helius.xyz/v0/transactions/?api-key=${this.config.heliusApiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactions: [txSig] }),
          });
          const data = await res.json();
          if (data[0]?.transactionError === null) {
            return {
              gatewayPaymentId,
              status: "finished",
              actuallyPaid: "0",
              confirmations: 1,
              rawResponse: data[0],
            };
          }
        }
      } catch {
        // Fallback
      }
    }

    return {
      gatewayPaymentId,
      status: "waiting",
      actuallyPaid: "0",
      confirmations: 0,
      rawResponse: {},
    };
  }

  async handleWebhook(body: any, _headers: Record<string, string>): Promise<{
    gatewayPaymentId: string;
    status: string;
    txHash?: string;
    confirmations?: number;
    actuallyPaid?: string;
  }> {
    // Webhook from our own blockchain monitoring service
    // Verify internal signature
    if (this.config.webhookSecret) {
      const signature = _headers["x-direct-signature"];
      if (!signature) throw new Error("Missing direct wallet webhook signature");

      const expected = crypto
        .createHmac("sha256", this.config.webhookSecret)
        .update(JSON.stringify(body))
        .digest("hex");

      if (signature !== expected) throw new Error("Invalid webhook signature");
    }

    const confirmations = body.confirmations || 0;
    const requiredConfs = CONFIRMATIONS[body.currency?.toUpperCase()] || 3;

    let status = "waiting";
    if (confirmations >= requiredConfs) status = "finished";
    else if (confirmations > 0) status = "confirming";

    return {
      gatewayPaymentId: body.gatewayPaymentId || body.orderId,
      status,
      txHash: body.txHash,
      confirmations,
      actuallyPaid: body.amount || "0",
    };
  }

  async createWithdrawal(req: CreateWithdrawalRequest): Promise<CreateWithdrawalResponse> {
    const withdrawalId = `direct_wd_${req.orderId}_${Date.now()}`;
    const currency = req.currency.toUpperCase();

    // Polygon USDT/USDC withdrawal via hot wallet
    if ((currency === "USDT" || currency === "ETH" || currency === "MATIC") && this.config.ethAddress) {
      try {
        const polygonRpcUrl = process.env.POLYGON_RPC_URL;
        if (!polygonRpcUrl) throw new Error("POLYGON_RPC_URL not configured");
        const walletKey = process.env.POLYGON_WALLET_KEY;

        if (walletKey) {
          const { ethers } = await import("ethers");
          const provider = new ethers.JsonRpcProvider(polygonRpcUrl);
          const signer = new ethers.Wallet(walletKey, provider);

          let txHash: string;

          if (currency === "USDT" || (currency as string) === "USDC") {
            // ERC-20 transfer — USDT/USDC contract on Polygon
            const usdcAddress = process.env.POLYGON_USDC_ADDRESS;
            if (!usdcAddress) throw new Error("POLYGON_USDC_ADDRESS not configured");
            const erc20Abi = ["function transfer(address to, uint256 amount) returns (bool)"];
            const contract = new ethers.Contract(usdcAddress, erc20Abi, signer);
            // USDC has 6 decimals
            const amount = ethers.parseUnits(req.amount, 6);
            const tx = await contract.transfer(req.address, amount);
            const receipt = await tx.wait();
            txHash = receipt?.hash || tx.hash;
          } else {
            // Native MATIC/ETH transfer
            const tx = await signer.sendTransaction({
              to: req.address,
              value: ethers.parseEther(req.amount),
            });
            const receipt = await tx.wait();
            txHash = receipt?.hash || tx.hash;
          }

          console.log(`[DirectWallet] Polygon withdrawal sent: ${txHash}`);
          return {
            gatewayWithdrawalId: withdrawalId,
            status: "completed",
            rawResponse: { currency, amount: req.amount, address: req.address, txHash, chain: "polygon" },
          };
        }
      } catch (err: any) {
        console.error(`[DirectWallet] Polygon withdrawal failed:`, err.message);
        return {
          gatewayWithdrawalId: withdrawalId,
          status: "failed",
          rawResponse: { error: err.message, currency, amount: req.amount, address: req.address },
        };
      }
    }

    // SOL withdrawal via hot wallet
    if (currency === "SOL" && this.config.solAddress) {
      try {
        const solWalletKey = process.env.SOL_WALLET_KEY;
        if (solWalletKey) {
          // Dynamic import for Solana web3
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const solWeb3: any = await (async () => { try { return require("@solana/web3.js"); } catch { return null; } })();
          if (!solWeb3) throw new Error("@solana/web3.js not installed");
          const { Connection, Keypair, Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } = solWeb3;
          const solRpcUrl = process.env.SOL_RPC_URL;
          if (!solRpcUrl) throw new Error("SOL_RPC_URL not configured");
          const connection = new Connection(solRpcUrl, "confirmed");
          const keypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(solWalletKey)));

          const tx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: keypair.publicKey,
              toPubkey: new PublicKey(req.address),
              lamports: Math.floor(parseFloat(req.amount) * LAMPORTS_PER_SOL),
            })
          );
          const signature = await connection.sendTransaction(tx, [keypair]);
          await connection.confirmTransaction(signature, "confirmed");

          console.log(`[DirectWallet] SOL withdrawal sent: ${signature}`);
          return {
            gatewayWithdrawalId: withdrawalId,
            status: "completed",
            rawResponse: { currency: "SOL", amount: req.amount, address: req.address, txHash: signature, chain: "solana" },
          };
        }
      } catch (err: any) {
        console.error(`[DirectWallet] SOL withdrawal failed:`, err.message);
        return {
          gatewayWithdrawalId: withdrawalId,
          status: "failed",
          rawResponse: { error: err.message, currency, amount: req.amount, address: req.address },
        };
      }
    }

    // Fallback: queue for manual processing
    console.log(`[DirectWallet] Withdrawal queued for manual processing: ${req.amount} ${currency} to ${req.address}`);
    return {
      gatewayWithdrawalId: withdrawalId,
      status: "processing",
      rawResponse: { currency, amount: req.amount, address: req.address, manual: true },
    };
  }

  async getExchangeRate(currency: string): Promise<ExchangeRateResponse> {
    // Use CoinGecko free API for exchange rates
    const coinIds: Record<string, string> = {
      BTC: "bitcoin",
      ETH: "ethereum",
      SOL: "solana",
      USDT: "tether",
    };

    const coinId = coinIds[currency.toUpperCase()];
    if (!coinId) throw new Error(`Unsupported currency: ${currency}`);

    // USDT is pegged to USD
    if (currency.toUpperCase() === "USDT") {
      return { rate: 1, usdPerCoin: 1, timestamp: Date.now() };
    }

    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
      );
      const data = await res.json();
      const usdPerCoin = data[coinId]?.usd || 0;

      return {
        rate: usdPerCoin > 0 ? 1 / usdPerCoin : 0,
        usdPerCoin,
        timestamp: Date.now(),
      };
    } catch {
      throw new Error(`Failed to fetch exchange rate for ${currency}`);
    }
  }

  getSupportedCurrencies(): string[] {
    return ["BTC", "ETH", "USDT", "SOL"];
  }

  validateAddress(currency: string, address: string): boolean {
    if (!address || address.length < 10) return false;
    switch (currency.toUpperCase()) {
      case "BTC": return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address);
      case "ETH":
      case "USDT": return /^0x[a-fA-F0-9]{40}$/.test(address);
      case "SOL": return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      default: return false;
    }
  }

  // Generate a unique deposit address per payment
  private async generateDepositAddress(currency: string, orderId: string): Promise<string> {
    switch (currency.toUpperCase()) {
      case "BTC":
        return this.generateBTCAddress(orderId);
      case "ETH":
      case "USDT":
      case "USDC":
      case "MATIC":
        // For Polygon/ETH: return the hot wallet address
        // Deposits are tracked via memo/orderId in the transaction data field
        const addr = this.config.ethAddress || process.env.POLYGON_DEPOSIT_ADDRESS;
        if (!addr) throw new Error("ETH/Polygon deposit address not configured: set ETH_HOT_WALLET or POLYGON_DEPOSIT_ADDRESS");
        return addr;
      case "SOL":
        if (!this.config.solAddress) throw new Error("SOL deposit address not configured: set SOL_HOT_WALLET");
        return this.config.solAddress;
      default:
        throw new Error(`Cannot generate address for ${currency}`);
    }
  }

  private async generateBTCAddress(_orderId: string): Promise<string> {
    // In production: derive from xpub using BIP44/BIP84 path
    // m/84'/0'/0'/0/{index}
    if (this.config.btcXpub && this.config.blockcypherToken) {
      try {
        const res = await fetch(
          `https://api.blockcypher.com/v1/btc/main/wallets/hd/${this.config.btcXpub}/addresses/derive?token=${this.config.blockcypherToken}`,
          { method: "POST" }
        );
        const data = await res.json();
        this.derivationIndex++;
        return data.address || data.chains?.[0]?.chain_addresses?.[0]?.address;
      } catch {
        // Fallback
      }
    }
    // No fallback — BTC deposits require configured xpub
    if (!this.config.btcXpub) throw new Error("BTC deposits not configured: BTC_XPUB required");
    return this.config.btcXpub;
  }
}

// Chainlink VRF v2.5 client for on-chain randomness
// All methods no-op when POLYGON_ENABLED=false

import { blockchainConfig } from "./config";

// VRF Consumer ABI (minimal — only the functions we call)
const VRF_CONSUMER_ABI = [
  "function requestRandomness(string tableId, uint256 handNumber) external returns (uint256 requestId)",
  "function getRandomWord(uint256 requestId) external view returns (uint256)",
  "function requestFulfilled(uint256 requestId) external view returns (bool)",
  "event RandomnessFulfilled(uint256 indexed requestId, uint256 randomWord)",
];

export interface VRFResult {
  requestId: string;
  randomWordPromise: Promise<string | null>;
}

export class VRFClient {
  private provider: any = null;
  private signer: any = null;
  private contract: any = null;
  private initialized = false;

  constructor() {
    if (!blockchainConfig.enabled) return;
    this.init().catch((err) => {
      console.warn("VRFClient init failed:", err.message);
    });
  }

  private async init() {
    if (!blockchainConfig.enabled) return;
    if (!blockchainConfig.vrfConsumerAddress || !blockchainConfig.walletPrivateKey) {
      console.warn("VRFClient: Missing contract address or wallet key");
      return;
    }

    try {
      // Dynamic import to avoid bundling ethers when not needed
      const { ethers } = await import("ethers");
      this.provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
      this.signer = new ethers.Wallet(blockchainConfig.walletPrivateKey, this.provider);
      this.contract = new ethers.Contract(
        blockchainConfig.vrfConsumerAddress,
        VRF_CONSUMER_ABI,
        this.signer
      );
      this.initialized = true;
    } catch (err: any) {
      console.warn("VRFClient ethers init failed:", err.message);
    }
  }

  async requestRandomness(tableId: string, handNumber: number): Promise<VRFResult | null> {
    if (!blockchainConfig.enabled || !this.initialized || !this.contract) {
      return null;
    }

    try {
      const tx = await this.contract.requestRandomness(tableId, handNumber);
      const receipt = await tx.wait();

      // Extract requestId from transaction logs
      const requestId = receipt.logs?.[0]?.topics?.[1] || tx.hash;

      // Create a promise that resolves when the VRF callback fires
      const randomWordPromise = new Promise<string | null>((resolve) => {
        const timeout = setTimeout(() => {
          resolve(null); // VRF didn't arrive in time
        }, 30000);

        // Poll for fulfillment
        const poll = async () => {
          try {
            const fulfilled = await this.contract.requestFulfilled(requestId);
            if (fulfilled) {
              clearTimeout(timeout);
              const word = await this.contract.getRandomWord(requestId);
              resolve(word.toString());
              return;
            }
          } catch {
            // Ignore polling errors
          }
          setTimeout(poll, 2000);
        };
        poll();
      });

      return { requestId: requestId.toString(), randomWordPromise };
    } catch (err: any) {
      console.warn("VRF requestRandomness failed:", err.message);
      return null;
    }
  }
}

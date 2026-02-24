// PokerHandVerifier contract client — on-chain proof anchoring
// All methods no-op when POLYGON_ENABLED=false

import { blockchainConfig } from "./config";

const HAND_VERIFIER_ABI = [
  "function commitHand(string tableId, uint256 handNumber, bytes32 commitmentHash, uint256 vrfRequestId) external",
  "function revealHand(string tableId, uint256 handNumber, string serverSeed, string[] playerSeeds, string deckOrder) external",
  "function verifyHand(string tableId, uint256 handNumber) external view returns (bool committed, bool revealed, bytes32 commitHash, uint256 timestamp)",
  "function getHandData(string tableId, uint256 handNumber) external view returns (string serverSeed, string[] playerSeeds, string deckOrder, bytes32 commitHash, uint256 vrfRequestId, uint256 commitTimestamp, uint256 revealTimestamp)",
  "event HandCommitted(string indexed tableId, uint256 indexed handNumber, bytes32 commitmentHash)",
  "event HandRevealed(string indexed tableId, uint256 indexed handNumber)",
];

export interface CommitResult {
  txHash: string;
}

export interface RevealResult {
  txHash: string;
}

export class ContractClient {
  private provider: any = null;
  private signer: any = null;
  private contract: any = null;
  private initialized = false;

  constructor() {
    if (!blockchainConfig.enabled) return;
    this.init().catch((err) => {
      console.warn("ContractClient init failed:", err.message);
    });
  }

  private async init() {
    if (!blockchainConfig.enabled) return;
    if (!blockchainConfig.handVerifierAddress || !blockchainConfig.walletPrivateKey) {
      console.warn("ContractClient: Missing contract address or wallet key");
      return;
    }

    try {
      const { ethers } = await import("ethers");
      this.provider = new ethers.JsonRpcProvider(blockchainConfig.rpcUrl);
      this.signer = new ethers.Wallet(blockchainConfig.walletPrivateKey, this.provider);
      this.contract = new ethers.Contract(
        blockchainConfig.handVerifierAddress,
        HAND_VERIFIER_ABI,
        this.signer
      );
      this.initialized = true;
    } catch (err: any) {
      console.warn("ContractClient ethers init failed:", err.message);
    }
  }

  async commitHand(
    tableId: string,
    handNumber: number,
    commitmentHash: string,
    vrfRequestId?: string
  ): Promise<CommitResult | null> {
    if (!blockchainConfig.enabled || !this.initialized || !this.contract) {
      return null;
    }

    try {
      const commitHash = "0x" + commitmentHash.padStart(64, "0");
      const vrfId = vrfRequestId ? BigInt(vrfRequestId) : BigInt(0);
      const tx = await this.contract.commitHand(tableId, handNumber, commitHash, vrfId);
      const receipt = await tx.wait();
      return { txHash: receipt.hash };
    } catch (err: any) {
      console.warn("commitHand failed:", err.message);
      return null;
    }
  }

  async revealHand(
    tableId: string,
    handNumber: number,
    serverSeed: string,
    playerSeeds: string[],
    deckOrder: string
  ): Promise<RevealResult | null> {
    if (!blockchainConfig.enabled || !this.initialized || !this.contract) {
      return null;
    }

    try {
      const tx = await this.contract.revealHand(tableId, handNumber, serverSeed, playerSeeds, deckOrder);
      const receipt = await tx.wait();
      return { txHash: receipt.hash };
    } catch (err: any) {
      console.warn("revealHand failed:", err.message);
      return null;
    }
  }

  async verifyHand(
    tableId: string,
    handNumber: number
  ): Promise<{ committed: boolean; revealed: boolean; commitHash: string; timestamp: number } | null> {
    if (!blockchainConfig.enabled || !this.initialized || !this.contract) {
      return null;
    }

    try {
      const result = await this.contract.verifyHand(tableId, handNumber);
      return {
        committed: result[0],
        revealed: result[1],
        commitHash: result[2],
        timestamp: Number(result[3]),
      };
    } catch (err: any) {
      console.warn("verifyHand failed:", err.message);
      return null;
    }
  }
}

// NFT Marketplace Service — ERC-721 avatar minting, listing, and purchasing
// Interacts with PokerNFTMarketplace contract on Polygon

import { storage } from "../storage";

const NFT_MARKETPLACE_ABI = [
  "function mintAvatar(address to, string uri) external returns (uint256)",
  "function listForSale(uint256 tokenId, uint256 price) external",
  "function buyNFT(uint256 tokenId, uint256 feeBps) external payable",
  "function cancelListing(uint256 tokenId) external",
  "function listings(uint256 tokenId) external view returns (address seller, uint256 price, bool active)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function defaultFeeBps() external view returns (uint256)",
  "event AvatarMinted(uint256 indexed tokenId, address indexed to, string tokenURI)",
  "event Listed(uint256 indexed tokenId, address indexed seller, uint256 price)",
  "event Sold(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price, uint256 fee)",
];

export interface NFTMintResult {
  tokenId: string;
  txHash: string;
}

export interface NFTListing {
  tokenId: string;
  seller: string;
  price: string;
  active: boolean;
  tokenURI?: string;
}

export class NFTService {
  private provider: any = null;
  private signer: any = null;
  private contract: any = null;
  private initialized = false;

  constructor() {
    const contractAddress = process.env.NFT_MARKETPLACE_ADDRESS;
    const rpcUrl = process.env.POLYGON_RPC_URL;
    const walletKey = process.env.POLYGON_WALLET_KEY;

    if (!contractAddress || !rpcUrl || !walletKey) {
      console.warn("NFTService: Missing NFT_MARKETPLACE_ADDRESS, POLYGON_RPC_URL, or POLYGON_WALLET_KEY");
      return;
    }

    this.init(rpcUrl, walletKey, contractAddress).catch(err => {
      console.warn("NFTService init failed:", err.message);
    });
  }

  private async init(rpcUrl: string, walletKey: string, contractAddress: string) {
    const { ethers } = await import("ethers");
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(walletKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, NFT_MARKETPLACE_ABI, this.signer);
    this.initialized = true;
  }

  isAvailable(): boolean {
    return this.initialized;
  }

  async mintAvatar(toAddress: string, metadataURI: string): Promise<NFTMintResult | null> {
    if (!this.initialized || !this.contract) return null;

    try {
      const tx = await this.contract.mintAvatar(toAddress, metadataURI);
      const receipt = await tx.wait();

      // Extract tokenId from event
      const event = receipt.logs.find((l: any) => {
        try {
          return this.contract.interface.parseLog(l)?.name === "AvatarMinted";
        } catch { return false; }
      });

      let tokenId = "0";
      if (event) {
        const parsed = this.contract.interface.parseLog(event);
        tokenId = parsed?.args?.tokenId?.toString() || "0";
      }

      return { tokenId, txHash: receipt.hash };
    } catch (err: any) {
      console.warn("NFT mint failed:", err.message);
      return null;
    }
  }

  async getListing(tokenId: string): Promise<NFTListing | null> {
    if (!this.initialized || !this.contract) return null;

    try {
      const [seller, price, active] = await this.contract.listings(BigInt(tokenId));
      const tokenURI = await this.contract.tokenURI(BigInt(tokenId));
      return {
        tokenId,
        seller,
        price: price.toString(),
        active,
        tokenURI,
      };
    } catch (err: any) {
      console.warn("NFT getListing failed:", err.message);
      return null;
    }
  }
}

// Singleton
let nftServiceInstance: NFTService | null = null;

export function getNFTService(): NFTService {
  if (!nftServiceInstance) {
    nftServiceInstance = new NFTService();
  }
  return nftServiceInstance;
}

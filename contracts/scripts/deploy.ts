import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy PokerHandVerifier
  const PokerHandVerifier = await ethers.getContractFactory("PokerHandVerifier");
  const verifier = await PokerHandVerifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("PokerHandVerifier deployed to:", verifierAddress);

  // Deploy PokerVRFConsumer (requires Chainlink VRF coordinator address)
  // Polygon Mainnet VRF Coordinator v2.5
  const VRF_COORDINATOR = process.env.VRF_COORDINATOR;
  if (!VRF_COORDINATOR) throw new Error("VRF_COORDINATOR required");
  const SUBSCRIPTION_ID = process.env.VRF_SUBSCRIPTION_ID;
  if (!SUBSCRIPTION_ID) throw new Error("VRF_SUBSCRIPTION_ID required");
  const KEY_HASH = process.env.VRF_KEY_HASH;
  if (!KEY_HASH) throw new Error("VRF_KEY_HASH required");
  const CALLBACK_GAS_LIMIT = parseInt(process.env.VRF_CALLBACK_GAS_LIMIT || "100000");

  const PokerVRFConsumer = await ethers.getContractFactory("PokerVRFConsumer");
  const vrfConsumer = await PokerVRFConsumer.deploy(
    VRF_COORDINATOR,
    BigInt(SUBSCRIPTION_ID),
    KEY_HASH,
    CALLBACK_GAS_LIMIT
  );
  await vrfConsumer.waitForDeployment();
  const vrfAddress = await vrfConsumer.getAddress();
  console.log("PokerVRFConsumer deployed to:", vrfAddress);

  // Deploy PokerNFTMarketplace (ERC-721 avatar marketplace)
  const PokerNFTMarketplace = await ethers.getContractFactory("PokerNFTMarketplace");
  const nftMarketplace = await PokerNFTMarketplace.deploy();
  await nftMarketplace.waitForDeployment();
  const nftAddress = await nftMarketplace.getAddress();
  console.log("PokerNFTMarketplace deployed to:", nftAddress);

  console.log("\n--- Environment Variables ---");
  console.log(`HAND_VERIFIER_ADDRESS=${verifierAddress}`);
  console.log(`VRF_CONSUMER_ADDRESS=${vrfAddress}`);
  console.log(`NFT_MARKETPLACE_ADDRESS=${nftAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

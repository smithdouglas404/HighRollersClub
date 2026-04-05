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
  const VRF_COORDINATOR = process.env.VRF_COORDINATOR || "0xec0Ed46f36576541C75739E915ADbCb3DE24bD77";
  const SUBSCRIPTION_ID = process.env.VRF_SUBSCRIPTION_ID || "0";
  // Polygon Mainnet 200 gwei key hash
  const KEY_HASH = process.env.VRF_KEY_HASH || "0x719ed7d7664abc3001c18aac8130a2265e1e70b7e036ae20f3ca8b92b3154d86";
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

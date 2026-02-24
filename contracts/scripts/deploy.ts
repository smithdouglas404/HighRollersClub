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
  // Amoy VRF Coordinator: 0x343300b5d84999c6348c38C5b2eAD10C7eFf2458
  const VRF_COORDINATOR = process.env.VRF_COORDINATOR || "0x343300b5d84999c6348c38C5b2eAD10C7eFf2458";
  const SUBSCRIPTION_ID = process.env.VRF_SUBSCRIPTION_ID || "0";
  const KEY_HASH = process.env.VRF_KEY_HASH || "0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899";
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

  console.log("\n--- Environment Variables ---");
  console.log(`HAND_VERIFIER_ADDRESS=${verifierAddress}`);
  console.log(`VRF_CONSUMER_ADDRESS=${vrfAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// Blockchain configuration — all operations no-op when disabled

export const blockchainConfig = {
  enabled: process.env.POLYGON_ENABLED === "true",
  rpcUrl: process.env.POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology",
  chainId: parseInt(process.env.POLYGON_CHAIN_ID || "80002"), // Amoy testnet
  vrfConsumerAddress: process.env.VRF_CONSUMER_ADDRESS || "",
  handVerifierAddress: process.env.HAND_VERIFIER_ADDRESS || "",
  walletPrivateKey: process.env.POLYGON_WALLET_KEY || "",
  vrfSubscriptionId: process.env.VRF_SUBSCRIPTION_ID || "",
  vrfKeyHash: process.env.VRF_KEY_HASH || "0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899",
  vrfCallbackGasLimit: parseInt(process.env.VRF_CALLBACK_GAS_LIMIT || "100000"),
};

// Blockchain configuration — all operations no-op when disabled
// IMPORTANT: No testnet fallbacks. All values MUST be set explicitly via env vars.

function requireEnv(key: string, fallback?: string): string {
  const val = process.env[key];
  if (val) return val;
  if (fallback !== undefined) return fallback;
  return ""; // Empty = not configured, will cause no-op in clients
}

export const blockchainConfig = {
  enabled: process.env.POLYGON_ENABLED === "true",
  rpcUrl: requireEnv("POLYGON_RPC_URL"), // Must be set — no testnet fallback
  chainId: parseInt(process.env.POLYGON_CHAIN_ID || "0"), // 0 = not configured
  vrfConsumerAddress: requireEnv("VRF_CONSUMER_ADDRESS"),
  handVerifierAddress: requireEnv("HAND_VERIFIER_ADDRESS"),
  walletPrivateKey: requireEnv("POLYGON_WALLET_KEY"),
  vrfSubscriptionId: requireEnv("VRF_SUBSCRIPTION_ID"),
  vrfKeyHash: requireEnv("VRF_KEY_HASH"),
  vrfCallbackGasLimit: parseInt(process.env.VRF_CALLBACK_GAS_LIMIT || "100000"),
};

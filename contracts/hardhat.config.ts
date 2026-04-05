import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;
if (!POLYGON_RPC_URL) throw new Error("POLYGON_RPC_URL required");
const AMOY_RPC_URL = process.env.AMOY_RPC_URL;
if (!AMOY_RPC_URL) throw new Error("AMOY_RPC_URL required");
const DEPLOYER_KEY = process.env.POLYGON_WALLET_KEY;
if (!DEPLOYER_KEY) throw new Error("POLYGON_WALLET_KEY required");

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    amoy: {
      url: AMOY_RPC_URL,
      accounts: [DEPLOYER_KEY],
      chainId: 80002,
    },
    polygon: {
      url: POLYGON_RPC_URL,
      accounts: [DEPLOYER_KEY],
      chainId: 137,
    },
  },
};

export default config;

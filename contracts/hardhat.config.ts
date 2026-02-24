import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "https://rpc-amoy.polygon.technology";
const POLYGON_MAINNET_RPC = process.env.POLYGON_MAINNET_RPC || "https://polygon-rpc.com";
const DEPLOYER_KEY = process.env.POLYGON_WALLET_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    amoy: {
      url: POLYGON_RPC_URL,
      accounts: [DEPLOYER_KEY],
      chainId: 80002,
    },
    polygon: {
      url: POLYGON_MAINNET_RPC,
      accounts: [DEPLOYER_KEY],
      chainId: 137,
    },
  },
};

export default config;

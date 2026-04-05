import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "https://polygon-mainnet.g.alchemy.com/v2/oYq5cymBhdX5N-HCNydIx";
const DEPLOYER_KEY = process.env.POLYGON_WALLET_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

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
      url: "https://polygon-amoy.g.alchemy.com/v2/oYq5cymBhdX5N-HCNydIx",
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

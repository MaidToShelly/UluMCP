const NETWORKS = {
  "algorand-mainnet": {
    algodUrl:
      process.env.ALGORAND_MAINNET_ALGOD_URL ||
      "https://mainnet-api.algonode.cloud",
    algodToken: process.env.ALGORAND_MAINNET_ALGOD_TOKEN || "",
    algodPort: process.env.ALGORAND_MAINNET_ALGOD_PORT || "",
    indexerUrl:
      process.env.ALGORAND_MAINNET_INDEXER_URL ||
      "https://mainnet-idx.algonode.cloud",
    indexerToken: process.env.ALGORAND_MAINNET_INDEXER_TOKEN || "",
    indexerPort: process.env.ALGORAND_MAINNET_INDEXER_PORT || "",
  },
  "algorand-testnet": {
    algodUrl:
      process.env.ALGORAND_TESTNET_ALGOD_URL ||
      "https://testnet-api.algonode.cloud",
    algodToken: process.env.ALGORAND_TESTNET_ALGOD_TOKEN || "",
    algodPort: process.env.ALGORAND_TESTNET_ALGOD_PORT || "",
    indexerUrl:
      process.env.ALGORAND_TESTNET_INDEXER_URL ||
      "https://testnet-idx.algonode.cloud",
    indexerToken: process.env.ALGORAND_TESTNET_INDEXER_TOKEN || "",
    indexerPort: process.env.ALGORAND_TESTNET_INDEXER_PORT || "",
  },
  "voi-mainnet": {
    algodUrl:
      process.env.VOI_MAINNET_ALGOD_URL ||
      "https://mainnet-api.voi.nodely.io",
    algodToken: process.env.VOI_MAINNET_ALGOD_TOKEN || "",
    algodPort: process.env.VOI_MAINNET_ALGOD_PORT || "",
    indexerUrl:
      process.env.VOI_MAINNET_INDEXER_URL ||
      "https://mainnet-idx.voi.nodely.io",
    indexerToken: process.env.VOI_MAINNET_INDEXER_TOKEN || "",
    indexerPort: process.env.VOI_MAINNET_INDEXER_PORT || "",
    mimirUrl:
      process.env.VOI_MAINNET_MIMIR_URL ||
      "https://voi-mainnet-mimirapi.nftnavigator.xyz",
  },
  "voi-testnet": {
    algodUrl:
      process.env.VOI_TESTNET_ALGOD_URL ||
      "https://testnet-api.voi.nodely.io",
    algodToken: process.env.VOI_TESTNET_ALGOD_TOKEN || "",
    algodPort: process.env.VOI_TESTNET_ALGOD_PORT || "",
    indexerUrl:
      process.env.VOI_TESTNET_INDEXER_URL ||
      "https://testnet-idx.voi.nodely.io",
    indexerToken: process.env.VOI_TESTNET_INDEXER_TOKEN || "",
    indexerPort: process.env.VOI_TESTNET_INDEXER_PORT || "",
    mimirUrl:
      process.env.VOI_TESTNET_MIMIR_URL || "",
  },
};

export function getNetworkConfig(network) {
  const config = NETWORKS[network];
  if (!config) {
    const supported = Object.keys(NETWORKS).join(", ");
    throw new Error(
      `Unknown network: "${network}". Supported networks: ${supported}`
    );
  }
  return config;
}

export const SUPPORTED_NETWORKS = Object.keys(NETWORKS);

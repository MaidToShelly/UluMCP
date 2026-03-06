const NETWORKS = {
  "algorand-mainnet": {
    algodUrl:
      process.env.ALGORAND_MAINNET_ALGOD_URL ||
      "https://mainnet-api.4160.nodely.dev",
    algodToken: process.env.ALGORAND_MAINNET_ALGOD_TOKEN || "",
    algodPort: process.env.ALGORAND_MAINNET_ALGOD_PORT || "",
    indexerUrl:
      process.env.ALGORAND_MAINNET_INDEXER_URL ||
      "https://mainnet-idx.4160.nodely.dev",
    indexerToken: process.env.ALGORAND_MAINNET_INDEXER_TOKEN || "",
    indexerPort: process.env.ALGORAND_MAINNET_INDEXER_PORT || "",
  },
  "voi-mainnet": {
    algodUrl:
      process.env.VOI_MAINNET_ALGOD_URL ||
      "https://mainnet-api.voi.nodely.dev",
    algodToken: process.env.VOI_MAINNET_ALGOD_TOKEN || "",
    algodPort: process.env.VOI_MAINNET_ALGOD_PORT || "",
    indexerUrl:
      process.env.VOI_MAINNET_INDEXER_URL ||
      "https://mainnet-idx.voi.nodely.dev",
    indexerToken: process.env.VOI_MAINNET_INDEXER_TOKEN || "",
    indexerPort: process.env.VOI_MAINNET_INDEXER_PORT || "",
    mimirUrl:
      process.env.VOI_MAINNET_MIMIR_URL ||
      "https://voi-mainnet-mimirapi.nftnavigator.xyz",
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

import algosdk from "algosdk";
import { getNetworkConfig } from "../config/networks.js";

export function getAlgodClient(network) {
  const config = getNetworkConfig(network);
  return new algosdk.Algodv2(
    config.algodToken,
    config.algodUrl,
    config.algodPort
  );
}

export function getIndexerClient(network) {
  const config = getNetworkConfig(network);
  return new algosdk.Indexer(
    config.indexerToken,
    config.indexerUrl,
    config.indexerPort
  );
}

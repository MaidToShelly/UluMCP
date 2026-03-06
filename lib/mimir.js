import { getNetworkConfig } from "../config/networks.js";

export function getMimirUrl(network) {
  const config = getNetworkConfig(network);
  return config.mimirUrl || null;
}

async function mimirFetch(baseUrl, path, params = {}) {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mimir API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTokens(mimirUrl, { contractId, limit, next } = {}) {
  return mimirFetch(mimirUrl, "/arc200/tokens", {
    contractId,
    limit,
    "next-token": next,
  });
}

export async function fetchBalances(
  mimirUrl,
  { contractId, accountId, limit, next } = {}
) {
  return mimirFetch(mimirUrl, "/arc200/balances", {
    contractId,
    accountId,
    limit,
    "next-token": next,
  });
}

export async function fetchTransfers(
  mimirUrl,
  { contractId, user, limit, next } = {}
) {
  return mimirFetch(mimirUrl, "/arc200/transfers", {
    contractId,
    user,
    limit,
    "next-token": next,
  });
}

export async function fetchApprovals(
  mimirUrl,
  { contractId, limit, next } = {}
) {
  return mimirFetch(mimirUrl, "/arc200/approvals", {
    contractId,
    limit,
    "next-token": next,
  });
}

// --- ARC72 NFT endpoints ---

export async function fetchNftTokens(
  mimirUrl,
  { contractId, tokenId, owner, limit, next } = {}
) {
  return mimirFetch(mimirUrl, "/nft-indexer/v1/tokens", {
    contractId,
    tokenId,
    owner,
    limit,
    "next-token": next,
  });
}

export async function fetchCollections(
  mimirUrl,
  { contractId, limit, next } = {}
) {
  return mimirFetch(mimirUrl, "/nft-indexer/v1/collections", {
    contractId,
    limit,
    "next-token": next,
  });
}

export async function fetchNftTransfers(
  mimirUrl,
  { contractId, limit, next } = {}
) {
  return mimirFetch(mimirUrl, "/nft-indexer/v1/transfers", {
    contractId,
    limit,
    "next-token": next,
  });
}

// --- Marketplace endpoints ---

export async function fetchListings(
  mimirUrl,
  { collectionId, limit, next } = {}
) {
  return mimirFetch(mimirUrl, "/nft-indexer/v1/mp/listings", {
    collectionId,
    limit,
    "next-token": next,
  });
}

export async function fetchSales(
  mimirUrl,
  { collectionId, limit, next } = {}
) {
  return mimirFetch(mimirUrl, "/nft-indexer/v1/mp/sales", {
    collectionId,
    limit,
    "next-token": next,
  });
}

export async function fetchDeletes(
  mimirUrl,
  { collectionId, limit, next } = {}
) {
  return mimirFetch(mimirUrl, "/nft-indexer/v1/mp/deletes", {
    collectionId,
    limit,
    "next-token": next,
  });
}

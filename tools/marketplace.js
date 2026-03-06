import { z } from "zod";
import { SUPPORTED_NETWORKS } from "../config/networks.js";
import {
  getMimirUrl,
  fetchListings,
  fetchSales,
  fetchDeletes,
} from "../lib/mimir.js";

function success(data) {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function failure(error) {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: String(error) }) }],
    isError: true,
  };
}

function requireMimir(network) {
  const url = getMimirUrl(network);
  if (!url) {
    throw new Error(
      `Marketplace queries require Mimir API, not available for ${network}`
    );
  }
  return url;
}

function normalizeListing(l) {
  return {
    mpListingId: l.mpListingId,
    collectionId: l.collectionId,
    tokenId: l.tokenId,
    seller: l.seller,
    price: l.price,
    currency: l.currency,
    royalty: l.royalty,
    createRound: l.createRound,
    createTimestamp: l.createTimestamp,
    endTimestamp: l.endTimestamp,
    mpContractId: l.mpContractId,
    transactionId: l.transactionId,
    tokenName: l.token?.metadata
      ? safeJsonField(l.token.metadata, "name")
      : null,
    tokenImage: l.token?.metadata
      ? safeJsonField(l.token.metadata, "image")
      : null,
    collectionName: l.collection?.name || null,
  };
}

function normalizeSale(s) {
  return {
    mpListingId: s.mpListingId,
    collectionId: s.collectionId,
    tokenId: s.tokenId,
    seller: s.seller,
    buyer: s.buyer,
    price: s.price,
    currency: s.currency,
    round: s.round,
    timestamp: s.timestamp,
    mpContractId: s.mpContractId,
    transactionId: s.transactionId,
    tokenName: s.token?.metadata
      ? safeJsonField(s.token.metadata, "name")
      : null,
    tokenImage: s.token?.metadata
      ? safeJsonField(s.token.metadata, "image")
      : null,
  };
}

function normalizeDelete(d) {
  return {
    mpListingId: d.mpListingId,
    collectionId: d.collectionId,
    tokenId: d.tokenId,
    owner: d.owner,
    round: d.round,
    timestamp: d.timestamp,
    mpContractId: d.mpContractId,
    transactionId: d.transactionId,
  };
}

function safeJsonField(raw, field) {
  try {
    return JSON.parse(raw)[field] || null;
  } catch {
    return null;
  }
}

const networkSchema = z
  .string()
  .describe(`Network identifier (${SUPPORTED_NETWORKS.join(", ")})`);

export function registerMarketplaceTools(server) {
  server.tool(
    "mp_listings",
    "Fetches active NFT marketplace listings. Optionally filter by collection. Voi mainnet only.",
    {
      network: networkSchema,
      collectionId: z
        .number()
        .optional()
        .describe("Filter by NFT collection contract ID"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of listings to return (default 20)"),
      next: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous response"),
    },
    async ({ network, collectionId, limit, next }) => {
      try {
        const mimirUrl = requireMimir(network);
        const data = await fetchListings(mimirUrl, {
          collectionId,
          limit: limit || 20,
          next,
        });
        return success({
          listings: (data.listings || []).map(normalizeListing),
          totalCount: data["total-count"],
          nextCursor: data["next-token"],
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "mp_sales",
    "Fetches NFT marketplace sales history. Optionally filter by collection. Voi mainnet only.",
    {
      network: networkSchema,
      collectionId: z
        .number()
        .optional()
        .describe("Filter by NFT collection contract ID"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of sales to return (default 20)"),
      next: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous response"),
    },
    async ({ network, collectionId, limit, next }) => {
      try {
        const mimirUrl = requireMimir(network);
        const data = await fetchSales(mimirUrl, {
          collectionId,
          limit: limit || 20,
          next,
        });
        return success({
          sales: (data.sales || []).map(normalizeSale),
          totalCount: data["total-count"],
          nextCursor: data["next-token"],
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "mp_deletes",
    "Fetches cancelled/deleted NFT marketplace listings. Optionally filter by collection. Voi mainnet only.",
    {
      network: networkSchema,
      collectionId: z
        .number()
        .optional()
        .describe("Filter by NFT collection contract ID"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of results to return (default 20)"),
      next: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous response"),
    },
    async ({ network, collectionId, limit, next }) => {
      try {
        const mimirUrl = requireMimir(network);
        const data = await fetchDeletes(mimirUrl, {
          collectionId,
          limit: limit || 20,
          next,
        });
        return success({
          deletes: (data.deletes || []).map(normalizeDelete),
          totalCount: data["total-count"],
          nextCursor: data["next-token"],
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );
}

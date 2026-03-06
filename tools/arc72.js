import { z } from "zod";
import { SUPPORTED_NETWORKS } from "../config/networks.js";
import {
  getMimirUrl,
  fetchNftTokens,
  fetchCollections,
  fetchNftTransfers,
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
      `ARC72 queries require Mimir API, not available for ${network}`
    );
  }
  return url;
}

function safeParseMetadata(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function normalizeToken(t) {
  const meta = safeParseMetadata(t.metadata);
  return {
    contractId: t.contractId,
    tokenId: t.tokenId,
    owner: t.owner,
    approved: t.approved,
    isBurned: t.isBurned,
    mintRound: t["mint-round"],
    collectionName: t.collectionName,
    metadataURI: t.metadataURI,
    name: meta?.name || null,
    description: meta?.description || null,
    image: meta?.image || null,
    properties: meta?.properties || null,
    verified: t.verified,
  };
}

function normalizeCollection(c) {
  return {
    contractId: c.contractId,
    name: c.name,
    creator: c.creator,
    totalSupply: c.totalSupply,
    burnedSupply: c.burnedSupply,
    uniqueOwners: c.uniqueOwners,
    verified: c.verified,
    imageUrl: c.imageUrl,
    mintRound: c.mintRound,
  };
}

const networkSchema = z
  .string()
  .describe(`Network identifier (${SUPPORTED_NETWORKS.join(", ")})`);

export function registerArc72Tools(server) {
  server.tool(
    "arc72_tokens",
    "Lists or searches ARC72 NFTs. Filter by collection, owner, or specific token. Voi mainnet only.",
    {
      network: networkSchema,
      contractId: z
        .number()
        .optional()
        .describe("Filter by NFT collection contract ID"),
      tokenId: z.string().optional().describe("Specific token ID within a collection"),
      owner: z.string().optional().describe("Filter by current owner address"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of tokens to return (default 20)"),
      next: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous response"),
    },
    async ({ network, contractId, tokenId, owner, limit, next }) => {
      try {
        const mimirUrl = requireMimir(network);
        const data = await fetchNftTokens(mimirUrl, {
          contractId,
          tokenId,
          owner,
          limit: limit || 20,
          next,
        });
        return success({
          tokens: (data.tokens || []).map(normalizeToken),
          totalCount: data["total-count"],
          nextCursor: data["next-token"],
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "arc72_collections",
    "Lists ARC72 NFT collections. Optionally filter by contract ID. Voi mainnet only.",
    {
      network: networkSchema,
      contractId: z
        .number()
        .optional()
        .describe("Filter by collection contract ID"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of collections to return (default 20)"),
      next: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous response"),
    },
    async ({ network, contractId, limit, next }) => {
      try {
        const mimirUrl = requireMimir(network);
        const data = await fetchCollections(mimirUrl, {
          contractId,
          limit: limit || 20,
          next,
        });
        return success({
          collections: (data.collections || []).map(normalizeCollection),
          totalCount: data["total-count"],
          nextCursor: data["next-token"],
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "arc72_transfers",
    "Fetches ARC72 NFT transfer history. Optionally filter by collection. Voi mainnet only.",
    {
      network: networkSchema,
      contractId: z
        .number()
        .optional()
        .describe("Filter by collection contract ID"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of transfers to return (default 20)"),
      next: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous response"),
    },
    async ({ network, contractId, limit, next }) => {
      try {
        const mimirUrl = requireMimir(network);
        const data = await fetchNftTransfers(mimirUrl, {
          contractId,
          limit: limit || 20,
          next,
        });
        const transfers = (data.transfers || []).map((t) => ({
          contractId: t.contractId,
          tokenId: t.tokenId,
          from: t.fromAddr,
          to: t.toAddr,
          round: t.round,
          timestamp: t.timestamp,
          transactionId: t.transactionId,
        }));
        return success({
          transfers,
          totalCount: data["total-count"],
          nextCursor: data["next-token"],
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );
}

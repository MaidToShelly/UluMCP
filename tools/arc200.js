import { z } from "zod";
import { arc200 } from "ulujs";
import { getAlgodClient, getIndexerClient } from "../lib/clients.js";
import { SUPPORTED_NETWORKS } from "../config/networks.js";
import {
  getMimirUrl,
  fetchTokens,
  fetchBalances,
  fetchTransfers,
  fetchApprovals,
} from "../lib/mimir.js";

function makeContract(network, contractId) {
  const algod = getAlgodClient(network);
  const indexer = getIndexerClient(network);
  return new arc200(contractId, algod, indexer);
}

function stringify(obj) {
  return JSON.stringify(obj, (_, v) =>
    typeof v === "bigint" ? v.toString() : v
  );
}

function success(data) {
  return { content: [{ type: "text", text: stringify(data) }] };
}

function failure(error) {
  return {
    content: [{ type: "text", text: stringify({ error: String(error) }) }],
    isError: true,
  };
}

const networkSchema = z
  .string()
  .describe(`Network identifier (${SUPPORTED_NETWORKS.join(", ")})`);
const contractIdSchema = z.number().describe("ARC200 token application ID");

export function registerArc200Tools(server) {
  server.tool(
    "arc200_list_tokens",
    "Lists ARC200 tokens available on the network. Voi mainnet only.",
    {
      network: networkSchema,
      contractId: z
        .number()
        .optional()
        .describe("Filter by specific contract ID to get one token's info"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of tokens to return (default 20)"),
      next: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous response"),
    },
    async ({ network, contractId, limit, next }) => {
      try {
        const mimirUrl = getMimirUrl(network);
        if (!mimirUrl) {
          return failure(
            `Token listing not available for ${network} (no Mimir API configured)`
          );
        }
        const data = await fetchTokens(mimirUrl, {
          contractId,
          limit: limit || 20,
          next,
        });
        const tokens = (data.tokens || []).map((t) => ({
          contractId: t.contractId,
          name: t.name,
          symbol: t.symbol,
          decimals: t.decimals,
          totalSupply: t.totalSupply,
          creator: t.creator,
          verified: t.verified,
          imageUrl: t.imageUrl,
          mintRound: t.mintRound,
        }));
        return success({
          tokens,
          totalCount: data["total-count"],
          nextCursor: data["next-token"],
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "arc200_balance_of",
    "Returns ARC200 token balance for an address. Uses Mimir API on voi-mainnet, falls back to on-chain query on other networks.",
    {
      network: networkSchema,
      contractId: contractIdSchema,
      address: z.string().describe("Algorand address to check balance for"),
    },
    async ({ network, contractId, address }) => {
      try {
        const mimirUrl = getMimirUrl(network);
        if (mimirUrl) {
          const data = await fetchBalances(mimirUrl, {
            contractId,
            accountId: address,
          });
          const entry = (data.balances || []).find(
            (b) => b.contractId === contractId
          );
          return success({
            contractId,
            address,
            balance: entry ? entry.balance : "0",
            name: entry?.name,
            symbol: entry?.symbol,
            decimals: entry?.decimals,
            verified: entry?.verified,
            source: "mimir",
          });
        }
        const contract = makeContract(network, contractId);
        const result = await contract.arc200_balanceOf(address);
        if (!result.success) {
          return failure(result.error || "Failed to fetch balance");
        }
        return success({
          contractId,
          address,
          balance: result.returnValue.toString(),
          source: "onchain",
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "arc200_allowance",
    "Returns the spending allowance granted by owner to spender for an ARC200 token.",
    {
      network: networkSchema,
      contractId: contractIdSchema,
      owner: z.string().describe("Token owner address"),
      spender: z.string().describe("Approved spender address"),
    },
    async ({ network, contractId, owner, spender }) => {
      try {
        const mimirUrl = getMimirUrl(network);
        if (mimirUrl) {
          const data = await fetchApprovals(mimirUrl, { contractId });
          const entry = (data.approvals || []).find(
            (a) => a.owner === owner && a.spender === spender
          );
          return success({
            contractId,
            owner,
            spender,
            allowance: entry ? entry.amount : "0",
            source: "mimir",
          });
        }
        const contract = makeContract(network, contractId);
        const result = await contract.arc200_allowance(owner, spender);
        if (!result.success) {
          return failure(result.error || "Failed to fetch allowance");
        }
        return success({
          contractId,
          owner,
          spender,
          allowance: result.returnValue.toString(),
          source: "onchain",
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "arc200_transfers",
    "Fetches ARC200 token transfer history. Uses Mimir API on voi-mainnet, falls back to on-chain event query on other networks.",
    {
      network: networkSchema,
      contractId: contractIdSchema,
      user: z
        .string()
        .optional()
        .describe("Filter transfers involving this address (sender or receiver)"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of transfers to return"),
      next: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous response"),
    },
    async ({ network, contractId, user, limit, next }) => {
      try {
        const mimirUrl = getMimirUrl(network);
        if (mimirUrl) {
          const data = await fetchTransfers(mimirUrl, {
            contractId,
            user,
            limit: limit || 20,
            next,
          });
          return success({
            contractId,
            transfers: data.transfers || [],
            nextCursor: data["next-token"],
            source: "mimir",
          });
        }
        const contract = makeContract(network, contractId);
        const query = {};
        const result = await contract.arc200_Transfer(query);
        return success({
          contractId,
          transfers: result,
          source: "onchain",
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "arc200_approvals",
    "Fetches ARC200 token approval history. Uses Mimir API on voi-mainnet, falls back to on-chain event query on other networks.",
    {
      network: networkSchema,
      contractId: contractIdSchema,
      limit: z
        .number()
        .optional()
        .describe("Maximum number of approvals to return"),
      next: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous response"),
    },
    async ({ network, contractId, limit, next }) => {
      try {
        const mimirUrl = getMimirUrl(network);
        if (mimirUrl) {
          const data = await fetchApprovals(mimirUrl, {
            contractId,
            limit: limit || 20,
            next,
          });
          return success({
            contractId,
            approvals: data.approvals || [],
            totalCount: data["total-count"],
            nextCursor: data["next-token"],
            source: "mimir",
          });
        }
        const contract = makeContract(network, contractId);
        const result = await contract.arc200_Approval({});
        return success({
          contractId,
          approvals: result,
          source: "onchain",
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );
}

import { z } from "zod";
import {
  resolveName,
  resolveAddress,
  resolveToken,
  searchNames,
} from "../lib/envoi.js";

function success(data) {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function failure(error) {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: String(error) }) }],
    isError: true,
  };
}

function normalizeResult(r) {
  return {
    name: r.name,
    address: r.address,
    metadata: r.metadata || {},
    ...(r.type && { type: r.type }),
  };
}

export function registerEnvoiTools(server) {
  server.tool(
    "envoi_resolve_name",
    "Resolves a VOI address to its enVoi name(s) and profile metadata (bio, avatar, social links). Voi mainnet only.",
    {
      address: z.string().describe("Algorand/VOI address to look up"),
    },
    async ({ address }) => {
      try {
        const data = await resolveName(address);
        return success({
          address,
          results: (data.results || []).map(normalizeResult),
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "envoi_resolve_address",
    "Resolves an enVoi name (e.g. 'shelly.voi') to its VOI address and profile metadata. Voi mainnet only.",
    {
      name: z.string().describe("enVoi name to resolve (e.g. 'shelly.voi')"),
    },
    async ({ name }) => {
      try {
        const data = await resolveAddress(name);
        return success({
          query: name,
          results: (data.results || []).map(normalizeResult),
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "envoi_resolve_token",
    "Resolves an enVoi token ID to its name, owner, and metadata. Voi mainnet only.",
    {
      tokenId: z.string().describe("enVoi token ID to look up"),
    },
    async ({ tokenId }) => {
      try {
        const data = await resolveToken(tokenId);
        return success({
          tokenId,
          results: (data.results || []).map(normalizeResult),
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "envoi_search",
    "Searches for enVoi names matching a pattern. Returns matching names with addresses and metadata. Voi mainnet only.",
    {
      pattern: z.string().describe("Search pattern for VOI names"),
    },
    async ({ pattern }) => {
      try {
        const data = await searchNames(pattern);
        return success({
          pattern,
          results: (data.results || []).map(normalizeResult),
          totalCount: (data.results || []).length,
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );
}

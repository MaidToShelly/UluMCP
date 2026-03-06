import { z } from "zod";
import * as humble from "../lib/humble.js";

function success(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data),
      },
    ],
  };
}

function failure(error) {
  return {
    content: [
      { type: "text", text: JSON.stringify({ error: String(error) }) },
    ],
    isError: true,
  };
}

export function registerHumbleApiTools(server) {
  server.tool(
    "humble_protocol_stats",
    "Returns HumbleSwap protocol-wide statistics including total pools, active pools, token count, TVL, 24h volume, and 24h fees on Voi.",
    {},
    async () => {
      try {
        return success(await humble.getProtocolStats());
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "humble_pools",
    "Lists all HumbleSwap liquidity pools on Voi with their token pairs and pool IDs.",
    {},
    async () => {
      try {
        return success(await humble.getPools());
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "humble_pool_details",
    "Returns detailed HumbleSwap pool information including reserves, fees, protocol balances, and LP token data for a specific pool on Voi.",
    {
      poolId: z
        .number()
        .describe("HumbleSwap pool application ID"),
    },
    async ({ poolId }) => {
      try {
        return success(await humble.getPoolDetails(poolId));
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "humble_pool_analytics",
    "Returns pool analytics including TVL and liquidity depth for a specific HumbleSwap pool on Voi.",
    {
      poolId: z
        .number()
        .describe("HumbleSwap pool application ID"),
    },
    async ({ poolId }) => {
      try {
        return success(await humble.getPoolAnalytics(poolId));
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "humble_tokens",
    "Lists all tokens tracked by HumbleSwap on Voi with name, symbol, decimals, and total supply.",
    {},
    async () => {
      try {
        return success(await humble.getTokens());
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "humble_token_metadata",
    "Returns enriched metadata for a token on HumbleSwap including name, symbol, decimals, total supply, and market cap.",
    {
      assetId: z
        .number()
        .describe("ARC-200 token contract ID"),
    },
    async ({ assetId }) => {
      try {
        return success(await humble.getTokenMetadata(assetId));
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "humble_token_price",
    "Returns current price data for a token across all HumbleSwap pools it trades in on Voi. Prices are quoted against each pool's paired token.",
    {
      tokenId: z
        .number()
        .describe("ARC-200 token contract ID"),
    },
    async ({ tokenId }) => {
      try {
        return success(await humble.getTokenPrice(tokenId));
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "humble_price_history",
    "Returns historical price data for a token on HumbleSwap. Useful for charting price trends over time.",
    {
      tokenId: z
        .number()
        .describe("ARC-200 token contract ID"),
    },
    async ({ tokenId }) => {
      try {
        return success(await humble.getPriceHistory(tokenId));
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "humble_router",
    "Finds all swap paths between two tokens on HumbleSwap including direct and multi-hop routes with estimated output amounts. Token IDs use ARC-200 contract IDs (e.g. 390001 for wVOI).",
    {
      tokenA: z
        .number()
        .describe("Input token contract ID"),
      tokenB: z
        .number()
        .describe("Output token contract ID"),
    },
    async ({ tokenA, tokenB }) => {
      try {
        return success(await humble.getRouter(tokenA, tokenB));
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "humble_arbitrage",
    "Detects arbitrage opportunities across HumbleSwap pools on Voi.",
    {},
    async () => {
      try {
        return success(await humble.getArbitrageOpportunities());
      } catch (err) {
        return failure(err.message);
      }
    }
  );
}

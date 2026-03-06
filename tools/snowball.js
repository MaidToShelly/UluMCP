import { z } from "zod";
import { getQuote, getPool, getPools, getTokens } from "../lib/snowball.js";

function success(data) {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function failure(error) {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: String(error) }) }],
    isError: true,
  };
}

export function registerSnowballTools(server) {
  server.tool(
    "snowball_quote",
    "Gets a swap quote from SnowballSwap aggregator with multi-pool routing across HumbleSwap and Nomadex. Returns output amount, price impact, and route details. Voi mainnet only.",
    {
      inputToken: z
        .string()
        .describe("Input token ID (use underlying token ID, e.g. '302190' for aUSDC, '0' for VOI)"),
      outputToken: z
        .string()
        .describe("Output token ID (use underlying token ID, e.g. '0' for VOI)"),
      amount: z
        .string()
        .describe("Amount of input token in base units (e.g. '1000000' for 1 aUSDC with 6 decimals)"),
      slippageTolerance: z
        .number()
        .optional()
        .describe("Slippage tolerance as decimal (e.g. 0.01 for 1%, default 0.01)"),
      poolId: z
        .number()
        .optional()
        .describe("Specific pool contract ID for single-pool mode. Omit for multi-pool routing."),
      dex: z
        .array(z.string())
        .optional()
        .describe('Filter pools by DEX (e.g. ["humbleswap", "nomadex"])'),
    },
    async ({ inputToken, outputToken, amount, slippageTolerance, poolId, dex }) => {
      try {
        const data = await getQuote({
          inputToken,
          outputToken,
          amount,
          slippageTolerance,
          poolId,
          dex,
        });

        const result = {
          inputToken,
          outputToken,
          inputAmount: data.quote.inputAmount,
          outputAmount: data.quote.outputAmount,
          minimumOutputAmount: data.quote.minimumOutputAmount,
          rate: data.quote.rate,
          priceImpact: data.quote.priceImpact,
          route: data.route,
        };

        if (data.simulationError) {
          result.simulationError = data.simulationError;
        }

        return success(result);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "snowball_pool",
    "Gets detailed information about a specific swap pool from SnowballSwap, including reserves, fees, and liquidity. Voi mainnet only.",
    {
      poolId: z.number().describe("Pool contract ID"),
    },
    async ({ poolId }) => {
      try {
        const data = await getPool(poolId);
        return success(data);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "snowball_pools",
    "Lists all swap pools configured in SnowballSwap aggregator, including HumbleSwap and Nomadex pools with token pairs and fees. Voi mainnet only.",
    {},
    async () => {
      try {
        const data = await getPools();
        const pools = (data.pools || []).map((p) => ({
          poolId: p.poolId,
          dex: p.dex,
          name: p.name,
          fee: p.fee,
        }));
        return success({ pools, totalCount: pools.length });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "snowball_tokens",
    "Lists all tokens supported by SnowballSwap aggregator with metadata (symbol, name, decimals, image). Voi mainnet only.",
    {},
    async () => {
      try {
        const data = await getTokens();
        const tokens = (data.tokens || []).filter((t) => !t.is_wrapped);
        return success({ tokens, totalCount: tokens.length });
      } catch (err) {
        return failure(err.message);
      }
    }
  );
}

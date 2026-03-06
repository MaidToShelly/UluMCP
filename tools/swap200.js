import { z } from "zod";
import { swap200 } from "ulujs";
import { getAlgodClient, getIndexerClient } from "../lib/clients.js";
import { SUPPORTED_NETWORKS } from "../config/networks.js";

function makePool(network, poolId) {
  const algod = getAlgodClient(network);
  const indexer = getIndexerClient(network);
  return new swap200(poolId, algod, indexer);
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

export function registerSwapTools(server) {
  server.tool(
    "humble_pool_state",
    "Returns the current state of a HumbleSwap liquidity pool including token IDs, reserves, and price.",
    {
      network: networkSchema,
      poolId: z.number().describe("HumbleSwap pool application ID"),
    },
    async ({ network, poolId }) => {
      try {
        const pool = makePool(network, poolId);
        const info = await pool.Info();
        if (!info.success) {
          return failure(info.error || "Failed to fetch pool state");
        }
        const { tokA, tokB, poolBals, lptBals, protoInfo } = info.returnValue;
        const reserveA = poolBals.A.toString();
        const reserveB = poolBals.B.toString();

        let price = null;
        const numA = Number(poolBals.A);
        const numB = Number(poolBals.B);
        if (numA > 0) {
          price = numB / numA;
        }

        return success({
          poolId,
          tokenA: tokA,
          tokenB: tokB,
          reserves: { A: reserveA, B: reserveB },
          price,
          lptBals: {
            lpHeld: lptBals.lpHeld.toString(),
            lpMinted: lptBals.lpMinted.toString(),
          },
          fees: {
            protocolFee: protoInfo.protoFee,
            lpFee: protoInfo.lpFee,
            totalFee: protoInfo.totFee,
          },
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "humble_quote",
    "Estimates the output amount for a HumbleSwap given an input token and amount. Uses the constant-product formula with pool fees.",
    {
      network: networkSchema,
      poolId: z.number().describe("HumbleSwap pool application ID"),
      tokenIn: z
        .number()
        .describe("Application ID of the token being swapped in"),
      amountIn: z
        .string()
        .describe("Amount of input token (as a string to support large values)"),
    },
    async ({ network, poolId, tokenIn, amountIn }) => {
      try {
        const pool = makePool(network, poolId);
        const info = await pool.Info();
        if (!info.success) {
          return failure(info.error || "Failed to fetch pool state");
        }
        const { tokA, tokB, poolBals, protoInfo } = info.returnValue;

        const amtIn = BigInt(amountIn);
        let reserveIn, reserveOut, tokenOut;

        if (Number(tokenIn) === Number(tokA)) {
          reserveIn = BigInt(poolBals.A);
          reserveOut = BigInt(poolBals.B);
          tokenOut = tokB;
        } else if (Number(tokenIn) === Number(tokB)) {
          reserveIn = BigInt(poolBals.B);
          reserveOut = BigInt(poolBals.A);
          tokenOut = tokA;
        } else {
          return failure(
            `Token ${tokenIn} is not part of pool ${poolId}. Pool tokens: ${tokA}, ${tokB}`
          );
        }

        const feeBps = BigInt(protoInfo.totFee || 0);
        const amtInAfterFee =
          (amtIn * (10000n - feeBps)) / 10000n;
        const amountOut =
          (reserveOut * amtInAfterFee) / (reserveIn + amtInAfterFee);

        return success({
          poolId,
          tokenIn,
          tokenOut,
          amountIn: amtIn.toString(),
          amountOut: amountOut.toString(),
          feeAppliedBps: Number(feeBps),
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );
}

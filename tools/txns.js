import { z } from "zod";
import algosdk from "algosdk";
import { CONTRACT, abi, arc200, swap200, arc72 } from "ulujs";
import { swap as swapUtil, Info as swapInfo } from "ulujs/utils/swap.js";
import { getAlgodClient, getIndexerClient } from "../lib/clients.js";
import { SUPPORTED_NETWORKS } from "../config/networks.js";

function makeArc200(network, contractId, sender) {
  const algod = getAlgodClient(network);
  const indexer = getIndexerClient(network);
  return new arc200(contractId, algod, indexer, {
    acc: { addr: sender },
  });
}

function makeSwap(network, poolId, sender) {
  const algod = getAlgodClient(network);
  const indexer = getIndexerClient(network);
  return new swap200(poolId, algod, indexer, {
    acc: { addr: sender },
  });
}

function makeArc72(network, contractId, sender) {
  const algod = getAlgodClient(network);
  const indexer = getIndexerClient(network);
  return new arc72(contractId, algod, indexer, {
    acc: { addr: sender },
  });
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

export function registerTxnTools(server) {
  server.tool(
    "arc200_transfer_txn",
    "Builds unsigned ARC-200 token transfer transactions. Returns base64-encoded transaction group (string[]) for wallet signing. Simulation must pass (sender needs sufficient balance).",
    {
      network: networkSchema,
      contractId: z.number().describe("ARC-200 token contract ID"),
      sender: z.string().describe("Sender wallet address"),
      to: z.string().describe("Recipient wallet address"),
      amount: z
        .string()
        .describe("Transfer amount in base units (as string for large values)"),
    },
    async ({ network, contractId, sender, to, amount }) => {
      try {
        const contract = makeArc200(network, contractId, sender);
        const result = await contract.arc200_transfer(to, BigInt(amount));
        if (!result.success) {
          return failure(
            result.error ||
              "Simulation failed — sender may have insufficient balance"
          );
        }
        return success({
          action: "arc200_transfer",
          contractId,
          sender,
          to,
          amount,
          txns: result.txns,
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "arc200_approve_txn",
    "Builds unsigned ARC-200 approval transactions to authorize a spender. Returns base64-encoded transaction group (string[]) for wallet signing.",
    {
      network: networkSchema,
      contractId: z.number().describe("ARC-200 token contract ID"),
      sender: z.string().describe("Token owner wallet address"),
      spender: z.string().describe("Address to authorize for spending"),
      amount: z
        .string()
        .describe("Allowance amount in base units (as string for large values)"),
    },
    async ({ network, contractId, sender, spender, amount }) => {
      try {
        const contract = makeArc200(network, contractId, sender);
        const result = await contract.arc200_approve(spender, BigInt(amount));
        if (!result.success) {
          return failure(result.error || "Failed to build approve transactions");
        }
        return success({
          action: "arc200_approve",
          contractId,
          sender,
          spender,
          amount,
          txns: result.txns,
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "humble_swap_txn",
    "Builds unsigned HumbleSwap pool swap transactions. Handles native VOI wrapping, approvals, and withdrawal automatically. Returns base64-encoded transaction group (string[]) for wallet signing. Use tokenIn=0 for native VOI on voi-mainnet.",
    {
      network: networkSchema,
      poolId: z.number().describe("HumbleSwap pool application ID"),
      sender: z.string().describe("Swapper wallet address"),
      tokenIn: z
        .number()
        .describe(
          "Contract ID of the token being swapped in (use 0 for native VOI on voi-mainnet)"
        ),
      tokenOut: z
        .number()
        .describe("Contract ID of the token being received"),
      amountIn: z
        .string()
        .describe(
          "Amount of input token in human-readable units (e.g. '1' for 1 VOI)"
        ),
      slippage: z
        .number()
        .optional()
        .describe("Slippage tolerance as decimal (default 0.01 = 1%)"),
    },
    async ({ network, poolId, sender, tokenIn, tokenOut, amountIn, slippage }) => {
      try {
        const algod = getAlgodClient(network);
        const indexer = getIndexerClient(network);
        const acc = { addr: sender, sk: new Uint8Array(0) };
        const ci = new CONTRACT(
          poolId,
          algod,
          indexer,
          abi.swap,
          acc,
          true,
          false
        );

        const infoR = await swapInfo(ci);
        if (!infoR.success) {
          return failure("Failed to fetch pool info");
        }
        const { tokA, tokB } = infoR.returnValue;

        const VOI_NATIVE_OVERRIDES = { "voi-mainnet": 390001 };
        const resolvedIn =
          tokenIn === 0 && VOI_NATIVE_OVERRIDES[network]
            ? VOI_NATIVE_OVERRIDES[network]
            : tokenIn;
        const resolvedOut =
          tokenOut === 0 && VOI_NATIVE_OVERRIDES[network]
            ? VOI_NATIVE_OVERRIDES[network]
            : tokenOut;

        const isAForB =
          resolvedIn === tokA && resolvedOut === tokB;
        const isBForA =
          resolvedIn === tokB && resolvedOut === tokA;
        if (!isAForB && !isBForA) {
          return failure(
            `Token pair (${tokenIn}, ${tokenOut}) does not match pool tokens (A=${tokA}, B=${tokB})`
          );
        }

        const A = {
          tokenId: String(tokenIn),
          contractId: resolvedIn,
          symbol: "tokenIn",
          decimals: 6,
          amount: amountIn,
        };
        const B = {
          tokenId: String(tokenOut),
          contractId: resolvedOut,
          symbol: "tokenOut",
          decimals: 6,
        };

        const result = await swapUtil(ci, sender, poolId, A, B, [], {
          debug: false,
          slippage: slippage ?? 0.01,
        });

        if (!result || !result.success) {
          return failure(
            result?.error ||
              "Swap simulation failed — sender may have insufficient balance"
          );
        }
        return success({
          action: "humble_swap",
          poolId,
          sender,
          tokenIn,
          tokenOut,
          amountIn,
          txns: result.txns,
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "arc200_transferFrom_txn",
    "Builds unsigned ARC-200 delegated transfer transactions (spend from an approved allowance). Returns base64-encoded transaction group (string[]) for wallet signing. Requires prior approval from the token owner.",
    {
      network: networkSchema,
      contractId: z.number().describe("ARC-200 token contract ID"),
      sender: z
        .string()
        .describe("Spender wallet address (must have approval from 'from')"),
      from: z.string().describe("Token owner address to transfer from"),
      to: z.string().describe("Recipient wallet address"),
      amount: z
        .string()
        .describe("Transfer amount in base units (as string for large values)"),
    },
    async ({ network, contractId, sender, from, to, amount }) => {
      try {
        const contract = makeArc200(network, contractId, sender);
        const result = await contract.arc200_transferFrom(
          from,
          to,
          BigInt(amount)
        );
        if (!result.success) {
          return failure(
            result.error ||
              "Simulation failed — spender may lack sufficient allowance or owner has insufficient balance"
          );
        }
        return success({
          action: "arc200_transferFrom",
          contractId,
          sender,
          from,
          to,
          amount,
          txns: result.txns,
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "arc72_transferFrom_txn",
    "Builds unsigned ARC-72 NFT transfer transactions. Returns base64-encoded transaction group (string[]) for wallet signing. Sender must be the owner or an approved operator.",
    {
      network: networkSchema,
      contractId: z.number().describe("ARC-72 NFT collection contract ID"),
      sender: z
        .string()
        .describe("Wallet address initiating the transfer (owner or approved)"),
      from: z.string().describe("Current NFT owner address"),
      to: z.string().describe("Recipient wallet address"),
      tokenId: z.string().describe("Token ID within the collection"),
    },
    async ({ network, contractId, sender, from, to, tokenId }) => {
      try {
        const nft = makeArc72(network, contractId, sender);
        const ci = nft.contractInstance;

        const algod = getAlgodClient(network);
        const appAddr = algosdk.getApplicationAddress(BigInt(contractId));
        const accInfo = await algod.accountInformation(appAddr).do();
        const available =
          BigInt(accInfo.amount) - BigInt(accInfo.minBalance);
        const boxCost = 28500;
        if (available < BigInt(boxCost)) {
          ci.setPaymentAmount(
            boxCost - Number(available > 0n ? available : 0n)
          );
        }

        const result = await ci.arc72_transferFrom(
          from,
          to,
          BigInt(tokenId)
        );
        if (!result.success) {
          return failure(
            result.error ||
              "Simulation failed — sender may not own or be approved for this token"
          );
        }
        return success({
          action: "arc72_transferFrom",
          contractId,
          sender,
          from,
          to,
          tokenId,
          txns: result.txns,
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "payment_txn",
    "Builds an unsigned native payment transaction (VOI or ALGO depending on network). Returns a base64-encoded transaction (string[]) for wallet signing.",
    {
      network: networkSchema,
      sender: z.string().describe("Sender wallet address"),
      receiver: z.string().describe("Recipient wallet address"),
      amount: z
        .string()
        .describe("Amount in microVOI/microALGO (1 VOI = 1,000,000 microVOI)"),
      note: z
        .string()
        .optional()
        .describe("Optional note to attach to the transaction"),
    },
    async ({ network, sender, receiver, amount, note }) => {
      try {
        const algod = getAlgodClient(network);
        const params = await algod.getTransactionParams().do();
        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          sender,
          receiver,
          amount: BigInt(amount),
          suggestedParams: params,
          ...(note
            ? { note: new Uint8Array(Buffer.from(note)) }
            : {}),
        });
        const encoded = algosdk.encodeUnsignedTransaction(txn);
        const b64 = Buffer.from(encoded).toString("base64");
        return success({
          action: "payment",
          network,
          sender,
          receiver,
          amount,
          note: note || null,
          txns: [b64],
        });
      } catch (err) {
        return failure(err.message);
      }
    }
  );
}

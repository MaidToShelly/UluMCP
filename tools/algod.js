import { z } from "zod";
import { getAlgodClient } from "../lib/clients.js";
import { SUPPORTED_NETWORKS } from "../config/networks.js";

const networkSchema = z
  .string()
  .describe(`Network identifier (${SUPPORTED_NETWORKS.join(", ")})`);

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

export function registerAlgodTools(server) {
  server.tool(
    "algod_send_raw_transactions",
    "Submit signed transactions to the network. Compatible with algorand-mcp send_raw_transaction. Accepts base64-encoded signed transactions and submits them via algod.",
    {
      signedTxns: z
        .array(z.string())
        .describe("Array of base64-encoded signed transactions"),
      network: networkSchema,
    },
    async ({ signedTxns, network }) => {
      try {
        const algod = getAlgodClient(network);
        const combined = Buffer.concat(
          signedTxns.map((b64) => Buffer.from(b64, "base64"))
        );
        const { txId } = await algod.sendRawTransaction(combined).do();
        return success({ txId });
      } catch (err) {
        return failure(err.message);
      }
    }
  );
}

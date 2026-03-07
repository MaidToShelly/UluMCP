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
    "algod_get_account_info",
    "Get current account balance, assets, and auth address from algod.",
    {
      address: z.string().describe("The account public key"),
      network: networkSchema,
    },
    async ({ address, network }) => {
      try {
        const algod = getAlgodClient(network);
        const info = await algod.accountInformation(address).do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "algod_get_account_application_info",
    "Get account-specific application information from algod.",
    {
      address: z.string().describe("The account public key"),
      appId: z.number().describe("The application ID"),
      network: networkSchema,
    },
    async ({ address, appId, network }) => {
      try {
        const algod = getAlgodClient(network);
        const info = await algod
          .accountApplicationInformation(address, appId)
          .do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "algod_get_account_asset_info",
    "Get account-specific asset information from algod.",
    {
      address: z.string().describe("The account public key"),
      assetId: z.number().describe("The asset ID"),
      network: networkSchema,
    },
    async ({ address, assetId, network }) => {
      try {
        const algod = getAlgodClient(network);
        const info = await algod
          .accountAssetInformation(address, assetId)
          .do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "algod_get_application_by_id",
    "Get application information (global state, programs).",
    {
      appId: z.number().describe("Application ID"),
      network: networkSchema,
    },
    async ({ appId, network }) => {
      try {
        const algod = getAlgodClient(network);
        const info = await algod.getApplicationByID(appId).do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "algod_get_application_box",
    "Get application box by name.",
    {
      appId: z.number().describe("Application ID"),
      boxName: z.string().describe("Box name (UTF-8 string)"),
      network: networkSchema,
    },
    async ({ appId, boxName, network }) => {
      try {
        const algod = getAlgodClient(network);
        const nameBytes = new TextEncoder().encode(boxName);
        const info = await algod
          .getApplicationBoxByName(appId, nameBytes)
          .do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "algod_get_application_boxes",
    "Get all application boxes.",
    {
      appId: z.number().describe("Application ID"),
      maxBoxes: z
        .number()
        .optional()
        .describe("Maximum number of boxes to return"),
      network: networkSchema,
    },
    async ({ appId, maxBoxes, network }) => {
      try {
        const algod = getAlgodClient(network);
        let req = algod.getApplicationBoxes(appId);
        if (maxBoxes != null) req = req.max(maxBoxes);
        const info = await req.do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "algod_get_asset_by_id",
    "Get current asset information from algod.",
    {
      assetId: z.number().describe("Asset ID"),
      network: networkSchema,
    },
    async ({ assetId, network }) => {
      try {
        const algod = getAlgodClient(network);
        const info = await algod.getAssetByID(assetId).do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "algod_get_transaction_params",
    "Get suggested transaction parameters (fee, first/last valid round, genesis info).",
    {
      network: networkSchema,
    },
    async ({ network }) => {
      try {
        const algod = getAlgodClient(network);
        const params = await algod.getTransactionParams().do();
        return success(params);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "algod_get_node_status",
    "Get current node status.",
    {
      network: networkSchema,
    },
    async ({ network }) => {
      try {
        const algod = getAlgodClient(network);
        const status = await algod.status().do();
        return success(status);
      } catch (err) {
        return failure(err.message);
      }
    }
  );
}

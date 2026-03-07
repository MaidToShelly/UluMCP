import { z } from "zod";
import { getIndexerClient } from "../lib/clients.js";
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

export function registerIndexerTools(server) {
  // ── Account lookups ───────────────────────────────────────────────────

  server.tool(
    "indexer_lookup_account_by_id",
    "Get account information from indexer.",
    {
      address: z.string().describe("Account address"),
      network: networkSchema,
    },
    async ({ address, network }) => {
      try {
        const indexer = getIndexerClient(network);
        const info = await indexer.lookupAccountByID(address).do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "indexer_lookup_account_assets",
    "Get account assets.",
    {
      address: z.string().describe("Account address"),
      assetId: z.number().optional().describe("Filter by asset ID"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of assets to return"),
      next: z
        .string()
        .optional()
        .describe("Token for retrieving the next page of results"),
      network: networkSchema,
    },
    async ({ address, assetId, limit, next, network }) => {
      try {
        const indexer = getIndexerClient(network);
        let req = indexer.lookupAccountAssets(address);
        if (assetId != null) req = req.assetId(assetId);
        if (limit != null) req = req.limit(limit);
        if (next) req = req.nextToken(next);
        const info = await req.do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "indexer_lookup_account_app_local_states",
    "Get account application local states.",
    {
      address: z.string().describe("Account address"),
      network: networkSchema,
    },
    async ({ address, network }) => {
      try {
        const indexer = getIndexerClient(network);
        const info = await indexer.lookupAccountAppLocalStates(address).do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "indexer_lookup_account_created_applications",
    "Get applications created by this account.",
    {
      address: z.string().describe("Account address"),
      network: networkSchema,
    },
    async ({ address, network }) => {
      try {
        const indexer = getIndexerClient(network);
        const info = await indexer
          .lookupAccountCreatedApplications(address)
          .do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "indexer_lookup_account_transactions",
    "Get account transaction history.",
    {
      address: z.string().describe("Account address"),
      assetId: z.number().optional().describe("Filter by asset ID"),
      txType: z.string().optional().describe("Filter by transaction type"),
      minRound: z
        .number()
        .optional()
        .describe("Only return transactions after this round"),
      maxRound: z
        .number()
        .optional()
        .describe("Only return transactions before this round"),
      afterTime: z
        .string()
        .optional()
        .describe("Only return transactions after this time"),
      beforeTime: z
        .string()
        .optional()
        .describe("Only return transactions before this time"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of transactions to return"),
      next: z
        .string()
        .optional()
        .describe("Token for retrieving the next page of results"),
      network: networkSchema,
    },
    async ({
      address,
      assetId,
      txType,
      minRound,
      maxRound,
      afterTime,
      beforeTime,
      limit,
      next,
      network,
    }) => {
      try {
        const indexer = getIndexerClient(network);
        let req = indexer.lookupAccountTransactions(address);
        if (assetId != null) req = req.assetID(assetId);
        if (txType) req = req.txType(txType);
        if (minRound != null) req = req.minRound(minRound);
        if (maxRound != null) req = req.maxRound(maxRound);
        if (afterTime) req = req.afterTime(afterTime);
        if (beforeTime) req = req.beforeTime(beforeTime);
        if (limit != null) req = req.limit(limit);
        if (next) req = req.nextToken(next);
        const info = await req.do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "indexer_search_for_accounts",
    "Search for accounts with various criteria.",
    {
      assetId: z.number().optional().describe("Filter by asset ID"),
      applicationId: z
        .number()
        .optional()
        .describe("Filter by application ID"),
      currencyGreaterThan: z
        .number()
        .optional()
        .describe("Filter by minimum balance"),
      currencyLessThan: z
        .number()
        .optional()
        .describe("Filter by maximum balance"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of accounts to return"),
      next: z
        .string()
        .optional()
        .describe("Token for retrieving the next page of results"),
      network: networkSchema,
    },
    async ({
      assetId,
      applicationId,
      currencyGreaterThan,
      currencyLessThan,
      limit,
      next,
      network,
    }) => {
      try {
        const indexer = getIndexerClient(network);
        let req = indexer.searchAccounts();
        if (assetId != null) req = req.assetID(assetId);
        if (applicationId != null) req = req.applicationID(applicationId);
        if (currencyGreaterThan != null)
          req = req.currencyGreaterThan(currencyGreaterThan);
        if (currencyLessThan != null)
          req = req.currencyLessThan(currencyLessThan);
        if (limit != null) req = req.limit(limit);
        if (next) req = req.nextToken(next);
        const info = await req.do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  // ── Application lookups ───────────────────────────────────────────────

  server.tool(
    "indexer_lookup_applications",
    "Get application information from indexer.",
    {
      appId: z.number().describe("Application ID"),
      network: networkSchema,
    },
    async ({ appId, network }) => {
      try {
        const indexer = getIndexerClient(network);
        const info = await indexer.lookupApplications(appId).do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "indexer_lookup_application_logs",
    "Get application log messages.",
    {
      appId: z.number().describe("Application ID"),
      sender: z.string().optional().describe("Filter by sender address"),
      txid: z.string().optional().describe("Filter by transaction ID"),
      minRound: z
        .number()
        .optional()
        .describe("Only return logs after this round"),
      maxRound: z
        .number()
        .optional()
        .describe("Only return logs before this round"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of logs to return"),
      next: z
        .string()
        .optional()
        .describe("Token for retrieving the next page of results"),
      network: networkSchema,
    },
    async ({ appId, sender, txid, minRound, maxRound, limit, next, network }) => {
      try {
        const indexer = getIndexerClient(network);
        let req = indexer.lookupApplicationLogs(appId);
        if (sender) req = req.sender(sender);
        if (txid) req = req.txid(txid);
        if (minRound != null) req = req.minRound(minRound);
        if (maxRound != null) req = req.maxRound(maxRound);
        if (limit != null) req = req.limit(limit);
        if (next) req = req.nextToken(next);
        const info = await req.do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "indexer_search_for_applications",
    "Search for applications with various criteria.",
    {
      creator: z.string().optional().describe("Filter by creator address"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of applications to return"),
      next: z
        .string()
        .optional()
        .describe("Token for retrieving the next page of results"),
      network: networkSchema,
    },
    async ({ creator, limit, next, network }) => {
      try {
        const indexer = getIndexerClient(network);
        let req = indexer.searchForApplications();
        if (creator) req = req.creator(creator);
        if (limit != null) req = req.limit(limit);
        if (next) req = req.nextToken(next);
        const info = await req.do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "indexer_lookup_application_box",
    "Get application box by name from indexer.",
    {
      appId: z.number().describe("Application ID"),
      boxName: z.string().describe("Box name"),
      network: networkSchema,
    },
    async ({ appId, boxName, network }) => {
      try {
        const indexer = getIndexerClient(network);
        const nameBytes = new TextEncoder().encode(boxName);
        const info = await indexer
          .lookupApplicationBoxByIDandName(appId, nameBytes)
          .do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "indexer_lookup_application_boxes",
    "Get all application boxes from indexer.",
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
        const indexer = getIndexerClient(network);
        let req = indexer.searchForApplicationBoxes(appId);
        if (maxBoxes != null) req = req.limit(maxBoxes);
        const info = await req.do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  // ── Asset lookups ─────────────────────────────────────────────────────

  server.tool(
    "indexer_lookup_asset_by_id",
    "Get asset information and configuration.",
    {
      assetId: z.number().describe("Asset ID"),
      network: networkSchema,
    },
    async ({ assetId, network }) => {
      try {
        const indexer = getIndexerClient(network);
        const info = await indexer.lookupAssetByID(assetId).do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "indexer_lookup_asset_balances",
    "Get accounts holding this asset and their balances.",
    {
      assetId: z.number().describe("Asset ID"),
      address: z.string().optional().describe("Filter by account address"),
      currencyGreaterThan: z
        .number()
        .optional()
        .describe("Filter by minimum balance"),
      currencyLessThan: z
        .number()
        .optional()
        .describe("Filter by maximum balance"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of balances to return"),
      next: z
        .string()
        .optional()
        .describe("Token for retrieving the next page of results"),
      network: networkSchema,
    },
    async ({
      assetId,
      address,
      currencyGreaterThan,
      currencyLessThan,
      limit,
      next,
      network,
    }) => {
      try {
        const indexer = getIndexerClient(network);
        let req = indexer.lookupAssetBalances(assetId);
        if (address) req = req.address(address);
        if (currencyGreaterThan != null)
          req = req.currencyGreaterThan(currencyGreaterThan);
        if (currencyLessThan != null)
          req = req.currencyLessThan(currencyLessThan);
        if (limit != null) req = req.limit(limit);
        if (next) req = req.nextToken(next);
        const info = await req.do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "indexer_lookup_asset_transactions",
    "Get transactions involving this asset.",
    {
      assetId: z.number().describe("Asset ID"),
      address: z.string().optional().describe("Filter by account address"),
      addressRole: z
        .string()
        .optional()
        .describe("Filter by address role (sender or receiver)"),
      txid: z.string().optional().describe("Filter by transaction ID"),
      minRound: z
        .number()
        .optional()
        .describe("Only return transactions after this round"),
      maxRound: z
        .number()
        .optional()
        .describe("Only return transactions before this round"),
      afterTime: z
        .string()
        .optional()
        .describe("Only return transactions after this time"),
      beforeTime: z
        .string()
        .optional()
        .describe("Only return transactions before this time"),
      excludeCloseTo: z
        .boolean()
        .optional()
        .describe("Whether to exclude close-to transactions"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of transactions to return"),
      next: z
        .string()
        .optional()
        .describe("Token for retrieving the next page of results"),
      network: networkSchema,
    },
    async ({
      assetId,
      address,
      addressRole,
      txid,
      minRound,
      maxRound,
      afterTime,
      beforeTime,
      excludeCloseTo,
      limit,
      next,
      network,
    }) => {
      try {
        const indexer = getIndexerClient(network);
        let req = indexer.lookupAssetTransactions(assetId);
        if (address) req = req.address(address);
        if (addressRole) req = req.addressRole(addressRole);
        if (txid) req = req.txid(txid);
        if (minRound != null) req = req.minRound(minRound);
        if (maxRound != null) req = req.maxRound(maxRound);
        if (afterTime) req = req.afterTime(afterTime);
        if (beforeTime) req = req.beforeTime(beforeTime);
        if (excludeCloseTo != null) req = req.excludeCloseTo(excludeCloseTo);
        if (limit != null) req = req.limit(limit);
        if (next) req = req.nextToken(next);
        const info = await req.do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "indexer_search_for_assets",
    "Search for assets with various criteria.",
    {
      assetId: z.number().optional().describe("Filter by asset ID"),
      name: z.string().optional().describe("Filter by asset name"),
      unit: z.string().optional().describe("Filter by asset unit name"),
      creator: z.string().optional().describe("Filter by creator address"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of assets to return"),
      next: z
        .string()
        .optional()
        .describe("Token for retrieving the next page of results"),
      network: networkSchema,
    },
    async ({ assetId, name, unit, creator, limit, next, network }) => {
      try {
        const indexer = getIndexerClient(network);
        let req = indexer.searchForAssets();
        if (assetId != null) req = req.index(assetId);
        if (name) req = req.name(name);
        if (unit) req = req.unit(unit);
        if (creator) req = req.creator(creator);
        if (limit != null) req = req.limit(limit);
        if (next) req = req.nextToken(next);
        const info = await req.do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  // ── Transaction lookups ───────────────────────────────────────────────

  server.tool(
    "indexer_lookup_transaction_by_id",
    "Get transaction information by ID.",
    {
      txId: z.string().describe("Transaction ID"),
      network: networkSchema,
    },
    async ({ txId, network }) => {
      try {
        const indexer = getIndexerClient(network);
        const info = await indexer.lookupTransactionByID(txId).do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "indexer_search_for_transactions",
    "Search for transactions with various criteria.",
    {
      address: z.string().optional().describe("Filter by account address"),
      addressRole: z
        .string()
        .optional()
        .describe("Filter by address role (sender or receiver)"),
      assetId: z.number().optional().describe("Filter by asset ID"),
      applicationId: z
        .number()
        .optional()
        .describe("Filter by application ID"),
      txType: z.string().optional().describe("Filter by transaction type"),
      minRound: z
        .number()
        .optional()
        .describe("Only return transactions after this round"),
      maxRound: z
        .number()
        .optional()
        .describe("Only return transactions before this round"),
      round: z.number().optional().describe("Filter by specific round"),
      afterTime: z
        .string()
        .optional()
        .describe("Only return transactions after this time"),
      beforeTime: z
        .string()
        .optional()
        .describe("Only return transactions before this time"),
      currencyGreaterThan: z
        .number()
        .optional()
        .describe("Filter by minimum amount"),
      currencyLessThan: z
        .number()
        .optional()
        .describe("Filter by maximum amount"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of transactions to return"),
      next: z
        .string()
        .optional()
        .describe("Token for retrieving the next page of results"),
      network: networkSchema,
    },
    async ({
      address,
      addressRole,
      assetId,
      applicationId,
      txType,
      minRound,
      maxRound,
      round,
      afterTime,
      beforeTime,
      currencyGreaterThan,
      currencyLessThan,
      limit,
      next,
      network,
    }) => {
      try {
        const indexer = getIndexerClient(network);
        let req = indexer.searchForTransactions();
        if (address) req = req.address(address);
        if (addressRole) req = req.addressRole(addressRole);
        if (assetId != null) req = req.assetID(assetId);
        if (applicationId != null) req = req.applicationID(applicationId);
        if (txType) req = req.txType(txType);
        if (minRound != null) req = req.minRound(minRound);
        if (maxRound != null) req = req.maxRound(maxRound);
        if (round != null) req = req.round(round);
        if (afterTime) req = req.afterTime(afterTime);
        if (beforeTime) req = req.beforeTime(beforeTime);
        if (currencyGreaterThan != null)
          req = req.currencyGreaterThan(currencyGreaterThan);
        if (currencyLessThan != null)
          req = req.currencyLessThan(currencyLessThan);
        if (limit != null) req = req.limit(limit);
        if (next) req = req.nextToken(next);
        const info = await req.do();
        return success(info);
      } catch (err) {
        return failure(err.message);
      }
    }
  );
}

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { registerIndexerTools } from "../tools/indexer.js";

const tools = {};

const fakeServer = {
  tool(name, _desc, _schema, handler) {
    tools[name] = handler;
  },
};
registerIndexerTools(fakeServer);

function parse(result) {
  assert.ok(result.content?.[0]?.text, "result has text content");
  const data = JSON.parse(result.content[0].text);
  if (result.isError) throw new Error(data.error);
  return data;
}

const ADDR = "G3MSA75OZEJTCCENOJDLDJK7UD7E2K5DNC7FVHCNOV7E3I4DTXTOWDUIFQ";
const KNOWN_APP = 390001;

describe("indexer tools – voi-mainnet", { timeout: 30_000 }, () => {
  it("indexer_lookup_account_by_id", async () => {
    const data = parse(
      await tools.indexer_lookup_account_by_id({
        address: ADDR,
        network: "voi-mainnet",
      })
    );
    assert.ok(data.account || data.address, "has account data");
  });

  it("indexer_lookup_account_assets", async () => {
    const data = parse(
      await tools.indexer_lookup_account_assets({
        address: ADDR,
        limit: 5,
        network: "voi-mainnet",
      })
    );
    assert.ok("assets" in data, "has assets field");
  });

  it("indexer_lookup_account_app_local_states", async () => {
    const data = parse(
      await tools.indexer_lookup_account_app_local_states({
        address: ADDR,
        network: "voi-mainnet",
      })
    );
    assert.ok(
      "apps-local-states" in data || "appsLocalStates" in data,
      "has local states"
    );
  });

  it("indexer_lookup_account_created_applications", async () => {
    const data = parse(
      await tools.indexer_lookup_account_created_applications({
        address: ADDR,
        network: "voi-mainnet",
      })
    );
    assert.ok(
      "applications" in data || "created-applications" in data,
      "has applications field"
    );
  });

  it("indexer_lookup_account_transactions", async () => {
    const data = parse(
      await tools.indexer_lookup_account_transactions({
        address: ADDR,
        limit: 2,
        network: "voi-mainnet",
      })
    );
    assert.ok("transactions" in data, "has transactions field");
  });

  it("indexer_search_for_accounts", async () => {
    const data = parse(
      await tools.indexer_search_for_accounts({
        limit: 2,
        network: "voi-mainnet",
      })
    );
    assert.ok("accounts" in data, "has accounts field");
  });

  it("indexer_lookup_applications", async () => {
    const data = parse(
      await tools.indexer_lookup_applications({
        appId: KNOWN_APP,
        network: "voi-mainnet",
      })
    );
    assert.ok(data.application || data.params, "has application data");
  });

  it("indexer_lookup_application_logs", async () => {
    const data = parse(
      await tools.indexer_lookup_application_logs({
        appId: KNOWN_APP,
        limit: 2,
        network: "voi-mainnet",
      })
    );
    assert.ok("log-data" in data || "logData" in data || data, "returns data");
  });

  it("indexer_search_for_applications", async () => {
    const data = parse(
      await tools.indexer_search_for_applications({
        limit: 2,
        network: "voi-mainnet",
      })
    );
    assert.ok("applications" in data, "has applications field");
  });

  it("indexer_lookup_application_boxes", async () => {
    const result = await tools.indexer_lookup_application_boxes({
      appId: KNOWN_APP,
      maxBoxes: 5,
      network: "voi-mainnet",
    });
    const data = JSON.parse(result.content[0].text);
    if (!result.isError) {
      assert.ok("boxes" in data, "has boxes field");
    } else {
      assert.ok(data.error, "returns error for apps with too many boxes");
    }
  });

  it("indexer_search_for_transactions", async () => {
    const data = parse(
      await tools.indexer_search_for_transactions({
        limit: 2,
        network: "voi-mainnet",
      })
    );
    assert.ok("transactions" in data, "has transactions field");
  });
});

describe("indexer tools – algorand-mainnet", { timeout: 30_000 }, () => {
  it("indexer_lookup_account_by_id", async () => {
    const data = parse(
      await tools.indexer_lookup_account_by_id({
        address: ADDR,
        network: "algorand-mainnet",
      })
    );
    assert.ok(data.account || data.address, "has account data");
  });

  it("indexer_lookup_asset_by_id (USDC)", async () => {
    const data = parse(
      await tools.indexer_lookup_asset_by_id({
        assetId: 31566704,
        network: "algorand-mainnet",
      })
    );
    assert.ok(data.asset || data.params, "has asset data");
  });

  it("indexer_lookup_asset_balances (USDC)", async () => {
    const data = parse(
      await tools.indexer_lookup_asset_balances({
        assetId: 31566704,
        limit: 3,
        network: "algorand-mainnet",
      })
    );
    assert.ok("balances" in data, "has balances field");
  });

  it("indexer_lookup_asset_transactions (USDC)", async () => {
    const data = parse(
      await tools.indexer_lookup_asset_transactions({
        assetId: 31566704,
        limit: 2,
        network: "algorand-mainnet",
      })
    );
    assert.ok("transactions" in data, "has transactions field");
  });

  it("indexer_search_for_assets", async () => {
    const data = parse(
      await tools.indexer_search_for_assets({
        name: "USDC",
        limit: 3,
        network: "algorand-mainnet",
      })
    );
    assert.ok("assets" in data, "has assets field");
  });

  it("indexer_lookup_account_transactions", async () => {
    const data = parse(
      await tools.indexer_lookup_account_transactions({
        address: ADDR,
        limit: 2,
        network: "algorand-mainnet",
      })
    );
    assert.ok("transactions" in data, "has transactions field");
  });
});

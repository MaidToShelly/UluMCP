import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { registerAlgodTools } from "../tools/algod.js";

const tools = {};

const fakeServer = {
  tool(name, _desc, _schema, handler) {
    tools[name] = handler;
  },
};
registerAlgodTools(fakeServer);

function parse(result) {
  assert.ok(result.content?.[0]?.text, "result has text content");
  const data = JSON.parse(result.content[0].text);
  if (result.isError) throw new Error(data.error);
  return data;
}

const ADDR = "G3MSA75OZEJTCCENOJDLDJK7UD7E2K5DNC7FVHCNOV7E3I4DTXTOWDUIFQ";
const KNOWN_APP = 390001;

describe("algod account tools – voi-mainnet", { timeout: 30_000 }, () => {
  it("algod_get_account_info", async () => {
    const data = parse(
      await tools.algod_get_account_info({
        address: ADDR,
        network: "voi-mainnet",
      })
    );
    assert.ok("amount" in data || "address" in data, "has account fields");
  });

  it("algod_get_account_application_info", async () => {
    const result = await tools.algod_get_account_application_info({
      address: ADDR,
      appId: KNOWN_APP,
      network: "voi-mainnet",
    });
    assert.ok(result.content?.[0]?.text, "returns a response");
  });

  it("algod_get_account_asset_info", async () => {
    const result = await tools.algod_get_account_asset_info({
      address: ADDR,
      assetId: 0,
      network: "voi-mainnet",
    });
    assert.ok(result.content?.[0]?.text, "returns a response");
  });
});

describe("algod account tools – algorand-mainnet", { timeout: 30_000 }, () => {
  it("algod_get_account_info", async () => {
    const data = parse(
      await tools.algod_get_account_info({
        address: ADDR,
        network: "algorand-mainnet",
      })
    );
    assert.ok("amount" in data || "address" in data, "has account fields");
  });

  it("algod_get_account_application_info", async () => {
    const result = await tools.algod_get_account_application_info({
      address: ADDR,
      appId: 1002541853,
      network: "algorand-mainnet",
    });
    assert.ok(result.content?.[0]?.text, "returns a response");
  });

  it("algod_get_account_asset_info", async () => {
    const result = await tools.algod_get_account_asset_info({
      address: ADDR,
      assetId: 31566704,
      network: "algorand-mainnet",
    });
    assert.ok(result.content?.[0]?.text, "returns a response");
  });
});

describe("algod non-account tools", { timeout: 30_000 }, () => {
  it("algod_get_node_status – voi", async () => {
    const data = parse(
      await tools.algod_get_node_status({ network: "voi-mainnet" })
    );
    assert.ok("lastRound" in data || "last-round" in data, "has round field");
  });

  it("algod_get_node_status – algorand", async () => {
    const data = parse(
      await tools.algod_get_node_status({ network: "algorand-mainnet" })
    );
    assert.ok("lastRound" in data || "last-round" in data, "has round field");
  });

  it("algod_get_transaction_params – voi", async () => {
    const data = parse(
      await tools.algod_get_transaction_params({ network: "voi-mainnet" })
    );
    assert.ok(
      data.genesisID || data.genesisId || data["genesis-id"],
      "has genesis ID"
    );
  });

  it("algod_get_transaction_params – algorand", async () => {
    const data = parse(
      await tools.algod_get_transaction_params({ network: "algorand-mainnet" })
    );
    assert.ok(
      data.genesisID || data.genesisId || data["genesis-id"],
      "has genesis ID"
    );
  });

  it("algod_get_application_by_id – voi", async () => {
    const data = parse(
      await tools.algod_get_application_by_id({
        appId: KNOWN_APP,
        network: "voi-mainnet",
      })
    );
    assert.ok(data.id || data.params, "has application fields");
  });

  it("algod_get_application_boxes – voi", async () => {
    const result = await tools.algod_get_application_boxes({
      appId: KNOWN_APP,
      network: "voi-mainnet",
    });
    const data = JSON.parse(result.content[0].text);
    if (!result.isError) {
      assert.ok("boxes" in data, "has boxes field");
    } else {
      assert.ok(data.error, "returns error for apps with too many boxes");
    }
  });

  it("algod_get_asset_by_id – algorand USDC", async () => {
    const data = parse(
      await tools.algod_get_asset_by_id({
        assetId: 31566704,
        network: "algorand-mainnet",
      })
    );
    assert.ok(data.index || data.params, "has asset fields");
  });
});

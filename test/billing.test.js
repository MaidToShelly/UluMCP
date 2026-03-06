import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";

process.env.BILLING_DB_PATH = "./test-billing.db";
process.env.WAD_DECIMALS = "6";
process.env.MIN_REQUIRED_BALANCE = "10";
process.env.MIN_REQUIRED_ALLOWANCE = "10";
process.env.SETTLEMENT_THRESHOLD = "1";
process.env.MAX_UNPAID_USAGE = "2";

const { parseWad, formatWad, WAD_UNIT, SETTLEMENT_THRESHOLD, MAX_UNPAID_USAGE } =
  await import("../billing/config.js");

describe("WAD math", () => {
  it("parseWad handles whole numbers", () => {
    assert.equal(parseWad("1"), WAD_UNIT);
    assert.equal(parseWad("10"), 10n * WAD_UNIT);
    assert.equal(parseWad("0"), 0n);
  });

  it("parseWad handles decimals", () => {
    assert.equal(parseWad("0.001"), 1000n);
    assert.equal(parseWad("0.000001"), 1n);
    assert.equal(parseWad("1.5"), 1500000n);
    assert.equal(parseWad("0.1"), 100000n);
  });

  it("formatWad round-trips correctly", () => {
    assert.equal(formatWad(parseWad("0.001")), "0.001");
    assert.equal(formatWad(parseWad("10")), "10");
    assert.equal(formatWad(parseWad("1.5")), "1.5");
    assert.equal(formatWad(parseWad("0.000001")), "0.000001");
    assert.equal(formatWad(0n), "0");
  });

  it("formatWad handles negative values", () => {
    assert.equal(formatWad(-1000n), "-0.001");
  });

  it("parseWad handles negative values", () => {
    assert.equal(parseWad("-1"), -WAD_UNIT);
  });
});

describe("Database", () => {
  let db;

  before(async () => {
    try { unlinkSync("./test-billing.db"); } catch {}
    db = await import("../billing/db.js");
    db.getDb();
  });

  after(() => {
    try { unlinkSync("./test-billing.db"); } catch {}
  });

  const ADDR = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

  it("creates and retrieves an agent", () => {
    db.upsertAgent(ADDR, { status: "active" });
    const agent = db.getAgent(ADDR);
    assert.equal(agent.address, ADDR);
    assert.equal(agent.status, "active");
    assert.equal(agent.accrued_usage, "0");
  });

  it("increments accrued usage", () => {
    db.incrementAccrued(ADDR, "1000");
    const agent = db.getAgent(ADDR);
    assert.equal(agent.accrued_usage, "1000");
  });

  it("increments accrued usage cumulatively", () => {
    db.incrementAccrued(ADDR, "2000");
    const agent = db.getAgent(ADDR);
    assert.equal(agent.accrued_usage, "3000");
  });

  it("reduces accrued usage", () => {
    db.reduceAccrued(ADDR, "1000");
    const agent = db.getAgent(ADDR);
    assert.equal(agent.accrued_usage, "2000");
  });

  it("does not go below zero", () => {
    db.reduceAccrued(ADDR, "999999999");
    const agent = db.getAgent(ADDR);
    assert.equal(agent.accrued_usage, "0");
  });

  it("records usage events", () => {
    db.addUsageEvent(ADDR, "arc200_balance_of", "1000", "req-1");
    db.addUsageEvent(ADDR, "snowball_quote", "5000", "req-2");
    const events = db.getAgentUsageEvents(ADDR);
    assert.equal(events.length, 2);
    const tools = events.map((e) => e.tool_name).sort();
    assert.ok(tools.includes("arc200_balance_of"));
    assert.ok(tools.includes("snowball_quote"));
  });

  it("creates and updates settlements", () => {
    const id = db.createSettlement(ADDR, "1000000");
    assert.ok(id);
    db.updateSettlement(id, { status: "confirmed", txid: "TX123" });
    const settlements = db.getAgentSettlements(ADDR);
    assert.equal(settlements[0].status, "confirmed");
    assert.equal(settlements[0].txid, "TX123");
  });

  it("stores and consumes nonces", () => {
    db.storeNonce(ADDR, "abc123", Date.now() + 60000);
    assert.equal(db.consumeNonce(ADDR, "abc123"), true);
    assert.equal(db.consumeNonce(ADDR, "abc123"), false);
  });

  it("rejects expired nonces", () => {
    db.storeNonce(ADDR, "expired1", Date.now() - 1000);
    assert.equal(db.consumeNonce(ADDR, "expired1"), false);
  });
});

describe("Pricing", () => {
  let pricing;

  before(async () => {
    pricing = await import("../billing/pricing.js");
  });

  it("returns correct costs for known tools", () => {
    assert.equal(pricing.getToolCost("arc200_balance_of"), 1000n);
    assert.equal(pricing.getToolCost("snowball_quote"), 5000n);
  });

  it("returns 0 for free tools", () => {
    assert.equal(pricing.getToolCost("x402_check"), 0n);
    assert.equal(pricing.isFreeTool("x402_check"), true);
  });

  it("returns 0 for unknown tools", () => {
    assert.equal(pricing.getToolCost("nonexistent_tool"), 0n);
  });

  it("getAllPrices returns all tools", () => {
    const prices = pricing.getAllPrices();
    assert.ok(prices.arc200_balance_of);
    assert.ok(prices.arc200_balance_of.display.includes("WAD"));
  });
});

describe("Metering", () => {
  let meter, db;
  const ADDR2 = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBCFKMI";

  before(async () => {
    try { unlinkSync("./test-billing.db"); } catch {}
    db = await import("../billing/db.js");
    db.getDb();
    meter = await import("../billing/meter.js");
  });

  after(() => {
    try { unlinkSync("./test-billing.db"); } catch {}
  });

  it("blocks unregistered agents", () => {
    const result = meter.checkCanExecute(ADDR2, "arc200_balance_of");
    assert.equal(result.allowed, false);
    assert.equal(result.code, "NOT_REGISTERED");
  });

  it("allows active agents", () => {
    db.upsertAgent(ADDR2, { status: "active" });
    const result = meter.checkCanExecute(ADDR2, "arc200_balance_of");
    assert.equal(result.allowed, true);
  });

  it("allows free tools without registration", () => {
    const result = meter.checkCanExecute("NOBODY", "x402_check");
    assert.equal(result.allowed, true);
    assert.equal(result.cost, 0n);
  });

  it("records usage and returns billing info", () => {
    const result = meter.recordUsage(ADDR2, "arc200_balance_of", 1000n, "r1");
    assert.equal(result.settlement_needed, false);
    assert.equal(result.suspended, false);
  });

  it("flags settlement needed at threshold", () => {
    for (let i = 0; i < 999; i++) {
      meter.recordUsage(ADDR2, "arc200_balance_of", 1000n);
    }
    const agent = db.getAgent(ADDR2);
    assert.ok(BigInt(agent.accrued_usage) >= SETTLEMENT_THRESHOLD);
  });

  it("suspends at max unpaid usage", () => {
    db.upsertAgent(ADDR2, { status: "active", accrued_usage: "0" });
    for (let i = 0; i < 2000; i++) {
      const check = meter.checkCanExecute(ADDR2, "arc200_balance_of");
      if (!check.allowed) break;
      meter.recordUsage(ADDR2, "arc200_balance_of", 1000n);
    }
    const agent = db.getAgent(ADDR2);
    assert.equal(agent.status, "suspended");
  });

  it("blocks suspended agents", () => {
    const result = meter.checkCanExecute(ADDR2, "arc200_balance_of");
    assert.equal(result.allowed, false);
    assert.equal(result.code, "SUSPENDED");
  });
});

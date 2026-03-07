import { parseWad, formatWad } from "./config.js";

const DEFAULT_PRICES = {
  arc200_list_tokens: "0.001",
  arc200_holders: "0.002",
  arc200_balance_of: "0.001",
  arc200_allowance: "0.001",
  arc200_transfers: "0.002",
  arc200_approvals: "0.002",
  arc72_tokens: "0.002",
  arc72_collections: "0.001",
  arc72_transfers: "0.002",
  humble_pool_state: "0.002",
  humble_quote: "0.005",
  humble_protocol_stats: "0.001",
  humble_pools: "0.001",
  humble_pool_details: "0.002",
  humble_pool_analytics: "0.002",
  humble_tokens: "0.001",
  humble_token_metadata: "0.001",
  humble_token_price: "0.002",
  humble_price_history: "0.005",
  humble_router: "0.005",
  humble_arbitrage: "0.005",
  snowball_quote: "0.005",
  snowball_pool: "0.002",
  snowball_pools: "0.001",
  snowball_tokens: "0.001",
  envoi_resolve_name: "0.001",
  envoi_resolve_address: "0.001",
  envoi_resolve_token: "0.001",
  envoi_search: "0.002",
  mp_listings: "0.002",
  mp_sales: "0.002",
  mp_deletes: "0.002",
  arc200_transfer_txn: "0.005",
  arc200_approve_txn: "0.005",
  arc200_transferFrom_txn: "0.005",
  arc72_transferFrom_txn: "0.005",
  humble_swap_txn: "0.01",
  envoi_purchase_txn: "0.01",
  aramid_bridge_txn: "0.005",
  payment_txn: "0.002",
  x402_check: "0",
  x402_pay_to: "0",
};

const priceOverrides = process.env.TOOL_PRICES
  ? JSON.parse(process.env.TOOL_PRICES)
  : {};

const registry = new Map();

for (const [tool, decimalPrice] of Object.entries({
  ...DEFAULT_PRICES,
  ...priceOverrides,
})) {
  registry.set(tool, parseWad(decimalPrice));
}

export function getToolCost(toolName) {
  return registry.get(toolName) ?? 0n;
}

export function isFreeTool(toolName) {
  return getToolCost(toolName) === 0n;
}

export function setToolCost(toolName, decimalPrice) {
  registry.set(toolName, parseWad(decimalPrice));
}

export function getAllPrices() {
  const prices = {};
  for (const [tool, cost] of registry) {
    prices[tool] = { cost: cost.toString(), display: formatWad(cost) + " WAD" };
  }
  return prices;
}

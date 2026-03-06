export const WAD_CONTRACT_ID = parseInt(
  process.env.WAD_CONTRACT_ID || "47138068",
  10
);
export const WAD_DECIMALS = parseInt(process.env.WAD_DECIMALS || "6", 10);
export const WAD_UNIT = 10n ** BigInt(WAD_DECIMALS);
export const WAD_NETWORK = process.env.WAD_NETWORK || "voi-mainnet";

export const TREASURY_ADDRESS =
  process.env.TREASURY_ADDRESS ||
  process.env.X402_AVM_PAY_TO ||
  "";
export const TREASURY_MNEMONIC = process.env.TREASURY_MNEMONIC || "";

export const MIN_REQUIRED_BALANCE = parseWad(
  process.env.MIN_REQUIRED_BALANCE || "10"
);
export const MIN_REQUIRED_ALLOWANCE = parseWad(
  process.env.MIN_REQUIRED_ALLOWANCE || "10"
);
export const SETTLEMENT_THRESHOLD = parseWad(
  process.env.SETTLEMENT_THRESHOLD || "1"
);
export const MAX_UNPAID_USAGE = parseWad(
  process.env.MAX_UNPAID_USAGE || "2"
);

export const WORKER_INTERVAL_MS = parseInt(
  process.env.WORKER_INTERVAL_MS || "30000",
  10
);
export const MAX_SETTLEMENT_RETRIES = parseInt(
  process.env.MAX_SETTLEMENT_RETRIES || "5",
  10
);

export const NONCE_EXPIRY_MS = parseInt(
  process.env.NONCE_EXPIRY_MS || "300000",
  10
);

export const DB_PATH = process.env.BILLING_DB_PATH || "./billing.db";
export const MCP_PORT = parseInt(process.env.MCP_PORT || "3000", 10);

export function parseWad(decimal) {
  if (typeof decimal === "bigint") return decimal;
  if (typeof decimal === "number") decimal = decimal.toString();
  const negative = decimal.startsWith("-");
  if (negative) decimal = decimal.slice(1);
  const [whole = "0", frac = ""] = decimal.split(".");
  const padded = frac.padEnd(WAD_DECIMALS, "0").slice(0, WAD_DECIMALS);
  const result = BigInt(whole) * WAD_UNIT + BigInt(padded);
  return negative ? -result : result;
}

export function formatWad(baseUnits) {
  const bi = BigInt(baseUnits);
  const negative = bi < 0n;
  const abs = negative ? -bi : bi;
  const whole = abs / WAD_UNIT;
  const frac = abs % WAD_UNIT;
  const prefix = negative ? "-" : "";
  if (frac === 0n) return `${prefix}${whole}`;
  const fracStr = frac.toString().padStart(WAD_DECIMALS, "0").replace(/0+$/, "");
  return `${prefix}${whole}.${fracStr}`;
}

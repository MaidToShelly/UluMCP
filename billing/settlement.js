import {
  SETTLEMENT_THRESHOLD,
  MAX_UNPAID_USAGE,
  MIN_REQUIRED_BALANCE,
  MIN_REQUIRED_ALLOWANCE,
  TREASURY_ADDRESS,
  MAX_SETTLEMENT_RETRIES,
  formatWad,
} from "./config.js";
import * as db from "./db.js";
import { getBalance, getAllowance, collectFromAgent } from "../chain/wad.js";

export async function attemptSettlement(address) {
  const agent = db.getAgent(address);
  if (!agent) return { success: false, error: "Agent not found" };

  const accrued = BigInt(agent.accrued_usage);
  if (accrued === 0n) return { success: true, settled: "0" };

  const settlementId = db.createSettlement(address, accrued.toString());

  try {
    const { txid } = await collectFromAgent(address, accrued.toString());

    db.updateSettlement(settlementId, {
      status: "confirmed",
      txid,
      confirmed_at: Date.now(),
    });
    db.reduceAccrued(address, accrued.toString());
    db.addLifetimeBilled(address, accrued.toString());
    db.upsertAgent(address, { last_settlement_at: Date.now() });

    console.log(
      `Settlement OK: ${address} paid ${formatWad(accrued)} WAD (tx: ${txid})`
    );
    return { success: true, txid, settled: formatWad(accrued) };
  } catch (err) {
    db.updateSettlement(settlementId, {
      status: "failed",
      error: err.message,
    });
    console.error(`Settlement FAILED for ${address}: ${err.message}`);

    if (accrued >= MAX_UNPAID_USAGE) {
      db.upsertAgent(address, {
        status: "suspended",
        suspension_reason: `settlement failed: ${err.message}`,
      });
    }

    return { success: false, error: err.message };
  }
}

export async function refreshAgentChainState(address) {
  try {
    const balance = await getBalance(address);
    const allowance = await getAllowance(address, TREASURY_ADDRESS);
    const now = Date.now();

    db.upsertAgent(address, {
      current_balance: balance.toString(),
      current_allowance: allowance.toString(),
      last_balance_check_at: now,
      last_allowance_check_at: now,
    });

    return { balance, allowance };
  } catch (err) {
    console.error(`Failed to refresh chain state for ${address}: ${err.message}`);
    return null;
  }
}

export async function tryUnsuspend(address) {
  const agent = db.getAgent(address);
  if (!agent || agent.status !== "suspended") return false;

  const state = await refreshAgentChainState(address);
  if (!state) return false;

  if (state.balance < MIN_REQUIRED_BALANCE) return false;
  if (state.allowance < MIN_REQUIRED_ALLOWANCE) return false;

  const accrued = BigInt(agent.accrued_usage);
  if (accrued > 0n) {
    const result = await attemptSettlement(address);
    if (!result.success) return false;
  }

  db.upsertAgent(address, {
    status: "active",
    suspension_reason: null,
  });
  console.log(`Agent unsuspended: ${address}`);
  return true;
}

export function checkExcessiveFailures(address) {
  const failures = db.getFailedSettlements(MAX_SETTLEMENT_RETRIES);
  return failures.some((f) => f.address === address);
}

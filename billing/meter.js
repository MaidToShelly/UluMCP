import {
  SETTLEMENT_THRESHOLD,
  MAX_UNPAID_USAGE,
  formatWad,
} from "./config.js";
import * as db from "./db.js";
import { getToolCost, isFreeTool } from "./pricing.js";

export function checkCanExecute(address, toolName) {
  if (isFreeTool(toolName)) return { allowed: true, cost: 0n };

  const agent = db.getAgent(address);
  if (!agent) {
    return {
      allowed: false,
      code: "NOT_REGISTERED",
      message: "Agent not registered",
    };
  }
  if (agent.status === "suspended") {
    return {
      allowed: false,
      code: "SUSPENDED",
      message: "Agent suspended: " + (agent.suspension_reason || "unpaid usage"),
      accrued_usage: formatWad(agent.accrued_usage),
      max_unpaid_usage: formatWad(MAX_UNPAID_USAGE),
    };
  }
  if (agent.status !== "active") {
    return {
      allowed: false,
      code: "INACTIVE",
      message: `Agent status: ${agent.status}`,
    };
  }

  const cost = getToolCost(toolName);
  const projectedUsage = BigInt(agent.accrued_usage) + cost;
  if (projectedUsage >= MAX_UNPAID_USAGE) {
    db.upsertAgent(address, {
      status: "suspended",
      suspension_reason: "accrued usage would exceed max unpaid limit",
    });
    return {
      allowed: false,
      code: "WOULD_EXCEED_LIMIT",
      message: "Request would exceed maximum unpaid usage",
      accrued_usage: formatWad(agent.accrued_usage),
      tool_cost: formatWad(cost),
      max_unpaid_usage: formatWad(MAX_UNPAID_USAGE),
    };
  }

  return { allowed: true, cost };
}

export function recordUsage(address, toolName, cost, requestId) {
  if (cost === 0n) return null;

  db.addUsageEvent(address, toolName, cost.toString(), requestId);
  db.incrementAccrued(address, cost.toString());

  const agent = db.getAgent(address);
  const accrued = BigInt(agent.accrued_usage);

  const needsSettlement = accrued >= SETTLEMENT_THRESHOLD;
  const needsSuspension = accrued >= MAX_UNPAID_USAGE;

  if (needsSuspension) {
    db.upsertAgent(address, {
      status: "suspended",
      suspension_reason: "accrued usage exceeded max unpaid limit",
    });
  }

  return {
    accrued_usage: formatWad(accrued),
    settlement_needed: needsSettlement,
    suspended: needsSuspension,
  };
}

export function buildBillingMeta(address, toolName, cost) {
  const agent = db.getAgent(address);
  return {
    tool: toolName,
    cost: formatWad(cost) + " WAD",
    accrued_usage: agent ? formatWad(agent.accrued_usage) : "0",
    settlement_threshold: formatWad(SETTLEMENT_THRESHOLD),
    status: agent?.status || "unknown",
  };
}

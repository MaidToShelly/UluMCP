import { WORKER_INTERVAL_MS, SETTLEMENT_THRESHOLD } from "./config.js";
import * as db from "./db.js";
import {
  attemptSettlement,
  refreshAgentChainState,
  tryUnsuspend,
} from "./settlement.js";

let intervalHandle = null;

async function tick() {
  try {
    const agents = db.getAgentsNeedingSettlement(SETTLEMENT_THRESHOLD);
    for (const agent of agents) {
      await attemptSettlement(agent.address).catch((err) =>
        console.error(`Worker settlement error for ${agent.address}:`, err.message)
      );
    }

    const suspended = db.getSuspendedAgents();
    for (const agent of suspended) {
      await tryUnsuspend(agent.address).catch((err) =>
        console.error(`Worker unsuspend error for ${agent.address}:`, err.message)
      );
    }

    const active = db.getAllActiveAgents();
    for (const agent of active) {
      const lastCheck = agent.last_balance_check_at || 0;
      if (Date.now() - lastCheck > WORKER_INTERVAL_MS * 10) {
        await refreshAgentChainState(agent.address).catch(() => {});
      }
    }

    db.cleanExpiredNonces();
  } catch (err) {
    console.error("Billing worker error:", err.message);
  }
}

export function startWorker() {
  if (intervalHandle) return;
  console.log(
    `Billing worker started (interval: ${WORKER_INTERVAL_MS}ms)`
  );
  intervalHandle = setInterval(tick, WORKER_INTERVAL_MS);
  setTimeout(tick, 5000);
}

export function stopWorker() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

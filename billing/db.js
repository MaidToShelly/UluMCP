import Database from "better-sqlite3";
import { DB_PATH } from "./config.js";

let db;

export function getDb() {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      address TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      accrued_usage TEXT NOT NULL DEFAULT '0',
      lifetime_billed TEXT NOT NULL DEFAULT '0',
      current_balance TEXT,
      current_allowance TEXT,
      last_balance_check_at INTEGER,
      last_allowance_check_at INTEGER,
      last_settlement_at INTEGER,
      suspension_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      cost TEXT NOT NULL,
      request_id TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL,
      amount TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      txid TEXT,
      error TEXT,
      attempted_at INTEGER NOT NULL,
      confirmed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS auth_nonces (
      address TEXT NOT NULL,
      nonce TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      PRIMARY KEY (address, nonce)
    );

    CREATE INDEX IF NOT EXISTS idx_usage_address ON usage_events(address);
    CREATE INDEX IF NOT EXISTS idx_settlements_address ON settlements(address);
    CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
  `);
}

export function getAgent(address) {
  return getDb().prepare("SELECT * FROM agents WHERE address = ?").get(address);
}

export function upsertAgent(address, fields) {
  const now = Date.now();
  const existing = getAgent(address);
  if (existing) {
    const sets = [];
    const vals = [];
    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    sets.push("updated_at = ?");
    vals.push(now);
    vals.push(address);
    getDb()
      .prepare(`UPDATE agents SET ${sets.join(", ")} WHERE address = ?`)
      .run(...vals);
  } else {
    getDb()
      .prepare(
        `INSERT INTO agents (address, status, accrued_usage, lifetime_billed, created_at, updated_at)
         VALUES (?, ?, '0', '0', ?, ?)`
      )
      .run(address, fields.status || "pending", now, now);
    if (Object.keys(fields).length > 1 || !fields.status) {
      upsertAgent(address, fields);
    }
  }
  return getAgent(address);
}

export function addUsageEvent(address, toolName, cost, requestId) {
  getDb()
    .prepare(
      `INSERT INTO usage_events (address, tool_name, cost, request_id, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(address, toolName, cost, requestId || null, Date.now());
}

export function incrementAccrued(address, amount) {
  const agent = getAgent(address);
  if (!agent) return;
  const newAccrued = (BigInt(agent.accrued_usage) + BigInt(amount)).toString();
  getDb()
    .prepare("UPDATE agents SET accrued_usage = ?, updated_at = ? WHERE address = ?")
    .run(newAccrued, Date.now(), address);
}

export function reduceAccrued(address, amount) {
  const agent = getAgent(address);
  if (!agent) return;
  const current = BigInt(agent.accrued_usage);
  const reduction = BigInt(amount);
  const newAccrued = (current > reduction ? current - reduction : 0n).toString();
  getDb()
    .prepare("UPDATE agents SET accrued_usage = ?, updated_at = ? WHERE address = ?")
    .run(newAccrued, Date.now(), address);
}

export function addLifetimeBilled(address, amount) {
  const agent = getAgent(address);
  if (!agent) return;
  const newTotal = (BigInt(agent.lifetime_billed) + BigInt(amount)).toString();
  getDb()
    .prepare("UPDATE agents SET lifetime_billed = ?, updated_at = ? WHERE address = ?")
    .run(newTotal, Date.now(), address);
}

export function createSettlement(address, amount) {
  const info = getDb()
    .prepare(
      `INSERT INTO settlements (address, amount, status, attempted_at)
       VALUES (?, ?, 'pending', ?)`
    )
    .run(address, amount, Date.now());
  return info.lastInsertRowid;
}

export function updateSettlement(id, fields) {
  const sets = [];
  const vals = [];
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  vals.push(id);
  getDb()
    .prepare(`UPDATE settlements SET ${sets.join(", ")} WHERE id = ?`)
    .run(...vals);
}

export function getPendingSettlements() {
  return getDb()
    .prepare("SELECT * FROM settlements WHERE status = 'pending' ORDER BY attempted_at ASC")
    .all();
}

export function getFailedSettlements(maxRetries) {
  return getDb()
    .prepare(
      `SELECT address, COUNT(*) as failures FROM settlements
       WHERE status = 'failed'
       GROUP BY address HAVING failures >= ?`
    )
    .all(maxRetries);
}

export function getAgentsNeedingSettlement(threshold) {
  return getDb()
    .prepare("SELECT * FROM agents WHERE status = 'active' AND CAST(accrued_usage AS INTEGER) >= ?")
    .all(Number(threshold));
}

export function getAllActiveAgents() {
  return getDb()
    .prepare("SELECT * FROM agents WHERE status = 'active'")
    .all();
}

export function getSuspendedAgents() {
  return getDb()
    .prepare("SELECT * FROM agents WHERE status = 'suspended'")
    .all();
}

export function storeNonce(address, nonce, expiresAt) {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO auth_nonces (address, nonce, expires_at)
       VALUES (?, ?, ?)`
    )
    .run(address, nonce, expiresAt);
}

export function consumeNonce(address, nonce) {
  const row = getDb()
    .prepare(
      "SELECT * FROM auth_nonces WHERE address = ? AND nonce = ? AND used_at IS NULL AND expires_at > ?"
    )
    .get(address, nonce, Date.now());
  if (!row) return false;
  getDb()
    .prepare("UPDATE auth_nonces SET used_at = ? WHERE address = ? AND nonce = ?")
    .run(Date.now(), address, nonce);
  return true;
}

export function cleanExpiredNonces() {
  getDb()
    .prepare("DELETE FROM auth_nonces WHERE expires_at < ? OR used_at IS NOT NULL")
    .run(Date.now());
}

export function getAgentUsageEvents(address, limit = 50) {
  return getDb()
    .prepare("SELECT * FROM usage_events WHERE address = ? ORDER BY created_at DESC LIMIT ?")
    .all(address, limit);
}

export function getAgentSettlements(address, limit = 50) {
  return getDb()
    .prepare("SELECT * FROM settlements WHERE address = ? ORDER BY attempted_at DESC LIMIT ?")
    .all(address, limit);
}

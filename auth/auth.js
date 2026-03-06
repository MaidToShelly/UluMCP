import { randomBytes, randomUUID } from "node:crypto";
import algosdk from "algosdk";
import {
  NONCE_EXPIRY_MS,
  MIN_REQUIRED_BALANCE,
  MIN_REQUIRED_ALLOWANCE,
  TREASURY_ADDRESS,
  formatWad,
} from "../billing/config.js";
import * as db from "../billing/db.js";
import { getBalance, getAllowance } from "../chain/wad.js";

const tokens = new Map();

export function generateChallenge(address) {
  const nonce = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + NONCE_EXPIRY_MS;
  db.storeNonce(address, nonce, expiresAt);
  return { nonce, expiresAt };
}

export function buildSignMessage(nonce) {
  return new Uint8Array(
    Buffer.from(`UluMCP-auth:${nonce}`, "utf-8")
  );
}

export async function verifyAndActivate(address, nonce, signatureB64) {
  if (!db.consumeNonce(address, nonce)) {
    throw new Error("Invalid or expired nonce");
  }

  const message = buildSignMessage(nonce);
  const signature = new Uint8Array(Buffer.from(signatureB64, "base64"));

  const addr = algosdk.Address.fromString(address);
  const valid = algosdk.verifyBytes(message, signature, addr);
  if (!valid) {
    throw new Error("Invalid signature");
  }

  const balance = await getBalance(address);
  if (balance < MIN_REQUIRED_BALANCE) {
    throw Object.assign(
      new Error("Insufficient WAD balance"),
      {
        code: "INSUFFICIENT_BALANCE",
        current_balance: formatWad(balance),
        required_balance: formatWad(MIN_REQUIRED_BALANCE),
      }
    );
  }

  const allowance = await getAllowance(address, TREASURY_ADDRESS);
  if (allowance < MIN_REQUIRED_ALLOWANCE) {
    throw Object.assign(
      new Error("Insufficient WAD allowance"),
      {
        code: "INSUFFICIENT_ALLOWANCE",
        current_allowance: formatWad(allowance),
        required_allowance: formatWad(MIN_REQUIRED_ALLOWANCE),
      }
    );
  }

  db.upsertAgent(address, {
    status: "active",
    current_balance: balance.toString(),
    current_allowance: allowance.toString(),
    last_balance_check_at: Date.now(),
    last_allowance_check_at: Date.now(),
  });

  const token = randomUUID();
  tokens.set(token, { address, createdAt: Date.now() });
  return { token, address };
}

export function resolveToken(token) {
  return tokens.get(token) || null;
}

export function revokeToken(token) {
  tokens.delete(token);
}

export function getAddressForToken(token) {
  const entry = tokens.get(token);
  return entry ? entry.address : null;
}

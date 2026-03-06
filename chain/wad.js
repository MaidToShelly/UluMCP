import algosdk from "algosdk";
import { arc200 } from "ulujs";
import { getAlgodClient, getIndexerClient } from "../lib/clients.js";
import { getMimirUrl, fetchBalances } from "../lib/mimir.js";
import {
  WAD_CONTRACT_ID,
  WAD_NETWORK,
  TREASURY_ADDRESS,
  TREASURY_MNEMONIC,
} from "../billing/config.js";

function getClients() {
  return {
    algod: getAlgodClient(WAD_NETWORK),
    indexer: getIndexerClient(WAD_NETWORK),
  };
}

function getReadContract() {
  const { algod, indexer } = getClients();
  return new arc200(WAD_CONTRACT_ID, algod, indexer);
}

function getTreasuryAccount() {
  if (!TREASURY_MNEMONIC) {
    throw new Error("TREASURY_MNEMONIC not configured");
  }
  return algosdk.mnemonicToSecretKey(TREASURY_MNEMONIC);
}

export async function getBalance(address) {
  const mimirUrl = getMimirUrl(WAD_NETWORK);
  if (mimirUrl) {
    const data = await fetchBalances(mimirUrl, {
      contractId: WAD_CONTRACT_ID,
      accountId: address,
    });
    const entry = (data.balances || []).find(
      (b) => b.contractId === WAD_CONTRACT_ID
    );
    return entry ? BigInt(entry.balance) : 0n;
  }
  const contract = getReadContract();
  const result = await contract.arc200_balanceOf(address);
  if (!result.success) throw new Error("Failed to fetch WAD balance");
  return BigInt(result.returnValue);
}

export async function getAllowance(owner, spender) {
  const contract = getReadContract();
  const result = await contract.arc200_allowance(owner, spender);
  if (!result.success) throw new Error("Failed to fetch WAD allowance");
  return BigInt(result.returnValue);
}

export async function transferFrom(from, to, amount) {
  const treasury = getTreasuryAccount();
  const { algod, indexer } = getClients();

  const contract = new arc200(WAD_CONTRACT_ID, algod, indexer, {
    acc: { addr: treasury.addr, sk: treasury.sk },
  });

  const result = await contract.arc200_transferFrom(
    from,
    to,
    BigInt(amount)
  );

  if (!result.success) {
    throw new Error(result.error || "WAD transferFrom failed");
  }

  return { txid: result.txId || result.txID || "unknown" };
}

export async function collectFromAgent(agentAddress, amount) {
  return transferFrom(agentAddress, TREASURY_ADDRESS, amount);
}

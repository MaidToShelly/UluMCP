# UluMCP Documentation

> Source of truth for the UluMCP project. Update this document as the system evolves.

**Version:** 0.0.1
**Last updated:** 2026-03-06

---

## Overview

UluMCP is an MCP (Model Context Protocol) server that gives AI agents structured access to Algorand AVM smart contracts on the Voi network. It provides tools for querying ARC-200 tokens, ARC-72 NFTs, DEX swaps, NFT marketplaces, and the enVoi naming service.

The server supports three deployment modes:

| Entry point | Transport | Billing | Use case |
|---|---|---|---|
| `index.js` | Stdio | None | Local MCP client (Cursor, Claude Desktop) |
| `serve.js` | HTTP (Streamable HTTP) | x402 per-request gating | Simple hosted API with payment wall |
| `serve-billed.js` | HTTP (Streamable HTTP) | WAD metered billing | Production hosted API with usage metering |

---

## Table of Contents

- [Project Structure](#project-structure)
- [Tools](#tools)
- [Deployment Modes](#deployment-modes)
  - [Stdio (local)](#stdio-local)
  - [HTTP with x402 gating](#http-with-x402-gating)
  - [HTTP with WAD metered billing](#http-with-wad-metered-billing)
- [Billing Architecture](#billing-architecture)
  - [Billing Model](#billing-model)
  - [Agent Onboarding](#agent-onboarding)
  - [Usage Metering](#usage-metering)
  - [Settlement](#settlement)
  - [Suspension](#suspension)
  - [Background Worker](#background-worker)
- [x402 Integration](#x402-integration)
- [Chain Integration](#chain-integration)
- [Configuration Reference](#configuration-reference)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Testing](#testing)
- [Future Work](#future-work)

---

## Project Structure

```
UluMCP/
  index.js                 # Stdio entry point (local MCP client)
  serve.js                 # HTTP entry point (x402 per-request gating)
  serve-billed.js          # HTTP entry point (WAD metered billing)
  package.json
  .env.example             # Environment configuration template

  config/
    networks.js            # Network config (Algorand mainnet, Voi mainnet)

  lib/
    clients.js             # Algod/Indexer client factory
    mimir.js               # Mimir API client (ARC-200, ARC-72, marketplace)
    snowball.js            # SnowballSwap API client
    humble.js              # HumbleSwap REST API client
    envoi.js               # enVoi naming service client
    x402.js                # x402 payment requirements and header parsing

  tools/
    arc200.js              # ARC-200 token tools
    arc72.js               # ARC-72 NFT tools
    swap200.js             # HumbleSwap on-chain pool tools (ulujs)
    humble.js              # HumbleSwap API tools (REST)
    snowball.js            # SnowballSwap aggregator tools
    envoi.js               # enVoi naming service tools
    marketplace.js         # NFT marketplace tools
    x402.js                # x402 payment tools

  billing/
    config.js              # Billing constants, WAD math (BigInt)
    db.js                  # SQLite schema and queries
    pricing.js             # Tool cost registry
    meter.js               # Usage tracking and threshold enforcement
    settlement.js          # On-chain WAD settlement via transferFrom
    worker.js              # Background settlement retry worker

  auth/
    auth.js                # Wallet authentication (challenge/verify/tokens)

  chain/
    wad.js                 # WAD ARC-200 token operations

  test/
    billing.test.js        # Billing logic tests (25 tests)

  docs/
    index.md               # This file (source of truth)
```

---

## Tools

All tools are available in every deployment mode. The billing layer is transparent -- existing tool implementations are not modified.

### ARC-200 Token Tools

| Tool | Description | WAD Cost |
|---|---|---|
| `arc200_list_tokens` | List ARC-200 tokens on the network (Mimir) | 0.001 |
| `arc200_balance_of` | Token balance for an address | 0.001 |
| `arc200_allowance` | Spending allowance (owner → spender) | 0.001 |
| `arc200_transfers` | Token transfer history | 0.002 |
| `arc200_approvals` | Token approval history | 0.002 |

### ARC-72 NFT Tools

| Tool | Description | WAD Cost |
|---|---|---|
| `arc72_tokens` | List/search NFTs by collection, owner, or token ID | 0.002 |
| `arc72_collections` | List NFT collections | 0.001 |
| `arc72_transfers` | NFT transfer history | 0.002 |

### HumbleSwap Pool Tools (on-chain)

| Tool | Description | WAD Cost |
|---|---|---|
| `humble_pool_state` | Pool reserves, token IDs, price (on-chain via ulujs) | 0.002 |
| `humble_quote` | Swap output estimate, constant-product (on-chain via ulujs) | 0.005 |

### HumbleSwap API Tools

Powered by the [HumbleSwap REST API](https://humble-api.voi.nautilus.sh/api-docs/) (Voi only).

| Tool | Description | WAD Cost |
|---|---|---|
| `humble_protocol_stats` | Protocol-wide stats: TVL, 24h volume, 24h fees, pool/token counts | 0.001 |
| `humble_pools` | List all liquidity pools with token pairs | 0.001 |
| `humble_pool_details` | Detailed pool info: reserves, fees, protocol balances, LP data | 0.002 |
| `humble_pool_analytics` | Pool analytics: TVL, liquidity depth | 0.002 |
| `humble_tokens` | List all tracked tokens with name, symbol, decimals, supply | 0.001 |
| `humble_token_metadata` | Enriched token metadata including market cap | 0.001 |
| `humble_token_price` | Current price across all pools a token trades in | 0.002 |
| `humble_price_history` | Historical price data for charting trends | 0.005 |
| `humble_router` | Find all swap paths (direct + multi-hop) with estimated outputs | 0.005 |
| `humble_arbitrage` | Detect arbitrage opportunities across pools | 0.005 |

### SnowballSwap Aggregator Tools

| Tool | Description | WAD Cost |
|---|---|---|
| `snowball_quote` | Multi-pool swap quote with routing | 0.005 |
| `snowball_pool` | Detailed pool info | 0.002 |
| `snowball_pools` | List all configured pools | 0.001 |
| `snowball_tokens` | List supported tokens with metadata | 0.001 |

### enVoi Naming Service Tools

| Tool | Description | WAD Cost |
|---|---|---|
| `envoi_resolve_name` | Address → enVoi name(s) + profile metadata | 0.001 |
| `envoi_resolve_address` | enVoi name → address + metadata | 0.001 |
| `envoi_resolve_token` | Token ID → name, owner, metadata | 0.001 |
| `envoi_search` | Search for enVoi names by pattern | 0.002 |

### Marketplace Tools

| Tool | Description | WAD Cost |
|---|---|---|
| `mp_listings` | Active NFT marketplace listings | 0.002 |
| `mp_sales` | NFT sales history | 0.002 |
| `mp_deletes` | Cancelled/deleted listings | 0.002 |

### x402 Payment Tools

| Tool | Description | WAD Cost |
|---|---|---|
| `x402_check` | Probe a URL for x402 payment requirements | Free |
| `x402_pay_to` | Return configured payment receiver addresses | Free |

---

## Deployment Modes

### Stdio (local)

```bash
npm install
node index.js
```

Cursor / Claude Desktop config:

```json
{
  "mcpServers": {
    "ulu-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/UluMCP/index.js"]
    }
  }
}
```

No billing. All tools are open access. Used for local development and personal AI assistants.

### HTTP with x402 gating

```bash
X402_AVM_PAY_TO=<your-address> X402_AVM_PRICE=1000000 node serve.js
```

Serves the MCP protocol over Streamable HTTP at `POST /mcp`. When `X402_AVM_PAY_TO` and `X402_AVM_PRICE` are both set, non-initialization tool calls require an x402 `PAYMENT-SIGNATURE` header. Without it, the server returns `402 Payment Required` with accepted payment options.

**Behavior:**
- Initialization requests pass through freely (clients can discover tools)
- Tool calls without payment header → 402 with x402 requirements in body and `PAYMENT-REQUIRED` header
- Tool calls with payment header → pass through to MCP server

**Payment verification is currently presence-based.** The server checks that the header exists but does not verify on-chain. Full AVM verification is planned for when an AVM scheme is added to x402.

**Environment variables:**

| Variable | Description | Default |
|---|---|---|
| `X402_AVM_PAY_TO` | AVM receiver address | (none) |
| `X402_AVM_PRICE` | Price per request in base units | `0` |
| `X402_AVM_ASSET` | Asset ID | `0` (native VOI) |
| `X402_AVM_NETWORK` | Network identifier | `avm:voi-mainnet` |
| `X402_EVM_PAY_TO` | EVM receiver address (future) | (none) |
| `X402_EVM_PRICE` | EVM price in base units (future) | `0` |
| `MCP_PORT` | HTTP listening port | `3000` |

Payment is only enforced when both `PAY_TO` and `PRICE` are set for a network.

### HTTP with WAD metered billing

```bash
cp .env.example .env
# Edit .env with treasury address and mnemonic
node serve-billed.js
```

Full metered billing using WAD (Whale Asset Dollar), an ARC-200 token on Voi (contract `47138068`, 6 decimals). Agents authenticate by wallet, usage is tracked internally, and charges are settled on-chain when accrued usage reaches the settlement threshold.

This is **not strict per-request 402 settlement**. It is an x402-inspired metered credit architecture where on-chain payment is not required for every request.

---

## Billing Architecture

### Billing Model

Each agent has a Voi wallet address. Before using the MCP server, the agent must:

1. Prove wallet ownership with a signature
2. Have at least **10 WAD** balance
3. Have at least **10 WAD** allowance approved to the treasury address

The server then:

1. Allows tool usage
2. Meters usage internally per wallet (no on-chain tx per request)
3. Attempts settlement when accrued usage >= **1 WAD**
4. Suspends the agent when unpaid usage >= **2 WAD**

**Constants (configurable via environment):**

| Parameter | Default | Env Variable |
|---|---|---|
| Minimum balance | 10 WAD | `MIN_REQUIRED_BALANCE` |
| Minimum allowance | 10 WAD | `MIN_REQUIRED_ALLOWANCE` |
| Settlement threshold | 1 WAD | `SETTLEMENT_THRESHOLD` |
| Max unpaid usage | 2 WAD | `MAX_UNPAID_USAGE` |

### Agent Onboarding

```
Agent                              Server
  │                                  │
  ├─ POST /auth/challenge ──────────►│  { address }
  │◄──────────────────────────────── │  { nonce, message, expiresAt }
  │                                  │
  │  sign(message) with wallet sk    │
  │                                  │
  ├─ POST /auth/verify ─────────────►│  { address, nonce, signature }
  │                                  │  verify signature
  │                                  │  check WAD balance >= 10
  │                                  │  check WAD allowance >= 10
  │◄──────────────────────────────── │  { token, status: "active" }
  │                                  │
  ├─ POST /mcp (init) ──────────────►│  Authorization: Bearer <token>
  │◄──────────────────────────────── │  MCP session established
  │                                  │
  ├─ POST /mcp (tool call) ─────────►│  mcp-session-id: <sid>
  │                                  │  check agent active, not suspended
  │                                  │  execute tool
  │                                  │  record usage, check thresholds
  │◄──────────────────────────────── │  result + _billing metadata
```

The signature message format is `UluMCP-auth:<nonce>` where nonce is 32 random hex bytes. The agent signs the UTF-8 encoded bytes with their Algorand/Voi private key. Nonces expire after 5 minutes (configurable) and are single-use.

### Usage Metering

Every paid tool call goes through the billing wrapper in `serve-billed.js`. The wrapper monkey-patches `McpServer.tool()` so all existing tool registration functions work unchanged.

**Before execution:**
1. Look up agent by MCP session ID → auth token → wallet address
2. Check agent status is `active` (not `suspended`, `pending`, etc.)
3. Check that projected usage (current accrued + tool cost) would not exceed `MAX_UNPAID_USAGE`

**After execution:**
1. Record usage event in `usage_events` table
2. Increment `accrued_usage` on the agent record
3. If accrued >= `SETTLEMENT_THRESHOLD`, trigger async settlement
4. If accrued >= `MAX_UNPAID_USAGE`, suspend the agent

**Billing metadata** is appended to tool responses as `_billing`:

```json
{
  "...tool result...",
  "_billing": {
    "tool": "arc200_balance_of",
    "cost": "0.001 WAD",
    "accrued_usage": "0.042",
    "settlement_threshold": "1",
    "status": "active"
  }
}
```

Free tools (`x402_check`, `x402_pay_to`) bypass billing entirely.

### Settlement

When accrued usage reaches `SETTLEMENT_THRESHOLD` (1 WAD):

1. Create a settlement record in `settlements` table (status: `pending`)
2. Call `arc200_transferFrom(agent, treasury, amount)` via ulujs
3. On success: reduce `accrued_usage`, add to `lifetime_billed`, log `confirmed`
4. On failure: log error, leave usage outstanding

Settlement is **async** -- it does not block the tool response. The server fires the settlement and continues.

The `transferFrom` call requires:
- The agent has approved the treasury address for WAD spending (`arc200_approve`)
- The treasury's mnemonic is configured (`TREASURY_MNEMONIC`) so the server can sign the transaction

### Suspension

An agent is suspended when:

- Accrued unpaid usage >= `MAX_UNPAID_USAGE` (2 WAD)
- A tool call would push accrued usage past the limit
- Repeated settlement failures (configurable via `MAX_SETTLEMENT_RETRIES`)

Suspended agents cannot execute paid tools. They receive structured errors:

```json
{
  "error": "Agent suspended: accrued usage exceeded max unpaid limit",
  "code": "SUSPENDED",
  "accrued_usage": "2.001",
  "max_unpaid_usage": "2"
}
```

**Unsuspension:** The background worker periodically checks suspended agents. An agent is unsuspended when:
1. WAD balance >= minimum (10 WAD)
2. WAD allowance >= minimum (10 WAD)
3. Outstanding usage is successfully settled

### Background Worker

`billing/worker.js` runs on a configurable interval (`WORKER_INTERVAL_MS`, default 30s):

1. **Settle** agents with accrued usage >= threshold
2. **Unsuspend** eligible agents (check balance, allowance, retry settlement)
3. **Refresh** on-chain state (balance/allowance) for agents not recently checked
4. **Clean** expired auth nonces

---

## x402 Integration

UluMCP includes two x402-related capabilities:

### Client-side tools (all deployment modes)

- `x402_check` -- Probe any URL with a plain HTTP request. If the server returns 402, parse and return the payment requirements (accepted networks, tokens, prices). No payment made.
- `x402_pay_to` -- Return the configured payment receiver addresses from environment variables (`X402_AVM_PAY_TO`, `X402_EVM_PAY_TO`). Config lookup only.

### Server-side gating (`serve.js`)

When `X402_AVM_PAY_TO` and `X402_AVM_PRICE` are set, `serve.js` returns `402 Payment Required` for tool calls without a `PAYMENT-SIGNATURE` header. The response includes x402 v2 payment requirements in both the JSON body and the `PAYMENT-REQUIRED` header (base64-encoded).

Payment verification is currently **presence-based** (checks header exists). Full on-chain AVM verification requires building an AVM scheme for x402 (planned future work).

### Design notes

The `serve-billed.js` billing model is x402-**inspired** but not strict x402. It uses internal metering with periodic on-chain settlement rather than per-request payment. The system is designed so that a future version could support:
- True x402 per-request payment for high-value operations
- An AVM scheme for x402 (so x402 endpoints can accept Voi/Algorand payments)
- Hybrid billing (metered for subscribed agents, x402 for anonymous access)

---

## Chain Integration

All WAD token operations are abstracted behind `chain/wad.js`:

| Function | Description | Source |
|---|---|---|
| `getBalance(address)` | WAD balance in base units | Mimir API (fast) or on-chain fallback |
| `getAllowance(owner, spender)` | WAD allowance in base units | On-chain via ulujs |
| `transferFrom(from, to, amount)` | Execute ARC-200 transferFrom | On-chain via ulujs (signed by treasury) |
| `collectFromAgent(address, amount)` | Transfer WAD from agent to treasury | Wrapper around transferFrom |

The interface is replaceable. To support a different token, network, or testnet, swap the implementation in `chain/wad.js`.

**Dependencies:** `algosdk` (v3) for Algod/Indexer clients, `ulujs` (v3) for ARC-200 contract interaction, Mimir API for fast balance lookups on Voi mainnet.

---

## Configuration Reference

All configuration is via environment variables. See `.env.example` for a template.

### WAD Token

| Variable | Description | Default |
|---|---|---|
| `WAD_CONTRACT_ID` | ARC-200 contract ID for WAD | `47138068` |
| `WAD_DECIMALS` | Token decimal places | `6` |
| `WAD_NETWORK` | Network for chain operations | `voi-mainnet` |

### Treasury

| Variable | Description | Default |
|---|---|---|
| `TREASURY_ADDRESS` | Address receiving settlements | `X402_AVM_PAY_TO` or empty |
| `TREASURY_MNEMONIC` | 25-word mnemonic for signing transferFrom | (none, required for settlement) |

### Billing Thresholds

| Variable | Description | Default |
|---|---|---|
| `MIN_REQUIRED_BALANCE` | Minimum WAD balance to activate (decimal) | `10` |
| `MIN_REQUIRED_ALLOWANCE` | Minimum WAD allowance to treasury (decimal) | `10` |
| `SETTLEMENT_THRESHOLD` | Trigger settlement at this accrued amount (decimal) | `1` |
| `MAX_UNPAID_USAGE` | Suspend agent at this accrued amount (decimal) | `2` |

### Worker

| Variable | Description | Default |
|---|---|---|
| `WORKER_INTERVAL_MS` | Background worker interval in ms | `30000` |
| `MAX_SETTLEMENT_RETRIES` | Suspend after this many failures | `5` |

### Auth

| Variable | Description | Default |
|---|---|---|
| `NONCE_EXPIRY_MS` | Auth nonce lifetime in ms | `300000` (5 min) |

### Server

| Variable | Description | Default |
|---|---|---|
| `MCP_PORT` | HTTP listening port | `3000` |
| `BILLING_DB_PATH` | SQLite database file path | `./billing.db` |

### Tool Pricing

| Variable | Description | Default |
|---|---|---|
| `TOOL_PRICES` | JSON object of tool name → WAD cost overrides | (none) |

Example: `TOOL_PRICES={"arc200_balance_of":"0.002","snowball_quote":"0.01"}`

### Network Endpoints

All default endpoints use the Nodely free tier ([docs](https://nodely.io/docs/free/endpoints/)).

| Network | Algod default | Indexer default |
|---|---|---|
| `algorand-mainnet` | `https://mainnet-api.4160.nodely.dev` | `https://mainnet-idx.4160.nodely.dev` |
| `voi-mainnet` | `https://mainnet-api.voi.nodely.dev` | `https://mainnet-idx.voi.nodely.dev` |

Voi mainnet also uses the Mimir API (`https://voi-mainnet-mimirapi.nftnavigator.xyz`) for fast ARC-200/ARC-72/marketplace lookups.

Override any endpoint via environment variables:

| Variable | Description |
|---|---|
| `ALGORAND_MAINNET_ALGOD_URL` | Algorand mainnet Algod endpoint |
| `ALGORAND_MAINNET_INDEXER_URL` | Algorand mainnet Indexer endpoint |
| `VOI_MAINNET_ALGOD_URL` | Voi mainnet Algod endpoint |
| `VOI_MAINNET_INDEXER_URL` | Voi mainnet Indexer endpoint |
| `VOI_MAINNET_MIMIR_URL` | Mimir API endpoint |
| `HUMBLE_API_URL` | HumbleSwap REST API endpoint |
| `SNOWBALL_API_URL` | SnowballSwap API endpoint |
| `ENVOI_API_URL` | enVoi API endpoint |

Each network also supports `*_ALGOD_TOKEN`, `*_ALGOD_PORT`, `*_INDEXER_TOKEN`, and `*_INDEXER_PORT` overrides for custom node setups.

---

## API Reference

### Auth Endpoints (serve-billed.js only)

#### `POST /auth/challenge`

Request:
```json
{ "address": "G3MSA75OZEJTCCENOJDLDJK7UD7E2K5DNC7FVHCNOV7E3I4DTXTOWDUIFQ" }
```

Response (200):
```json
{
  "address": "G3MSA75O...",
  "nonce": "a1b2c3d4...",
  "message": "UluMCP-auth:a1b2c3d4...",
  "expiresAt": 1741278900000
}
```

#### `POST /auth/verify`

Request:
```json
{
  "address": "G3MSA75O...",
  "nonce": "a1b2c3d4...",
  "signature": "<base64-encoded signature of message bytes>"
}
```

Response (200):
```json
{ "token": "uuid-token", "address": "G3MSA75O...", "status": "active" }
```

Error (401 invalid signature, 402 insufficient balance/allowance):
```json
{
  "error": "Insufficient WAD balance",
  "code": "INSUFFICIENT_BALANCE",
  "current_balance": "5.2",
  "required_balance": "10"
}
```

#### `GET /agent/:address/status`

Response (200):
```json
{
  "address": "G3MSA75O...",
  "status": "active",
  "accrued_usage": "0.042",
  "lifetime_billed": "3.5",
  "current_balance": "47.2",
  "current_allowance": "100",
  "suspension_reason": null,
  "last_settlement_at": 1741278000000
}
```

#### `GET /pricing`

Response (200):
```json
{
  "prices": {
    "arc200_balance_of": { "cost": "1000", "display": "0.001 WAD" },
    "snowball_quote": { "cost": "5000", "display": "0.005 WAD" },
    "x402_check": { "cost": "0", "display": "0 WAD" }
  }
}
```

### MCP Endpoint (serve.js and serve-billed.js)

#### `POST /mcp`

MCP Streamable HTTP protocol. Supports JSON-RPC over HTTP with SSE streaming.

Headers:
- `Content-Type: application/json`
- `Accept: application/json, text/event-stream`
- `mcp-session-id: <session-id>` (after initialization)
- `Authorization: Bearer <token>` (serve-billed.js, on init request)

#### `GET /mcp`

SSE stream for server-initiated messages. Requires `mcp-session-id` header.

#### `DELETE /mcp`

Session termination. Requires `mcp-session-id` header.

---

## Data Model

### `agents`

| Column | Type | Description |
|---|---|---|
| `address` | TEXT PK | Voi wallet address |
| `status` | TEXT | `pending`, `active`, `suspended` |
| `accrued_usage` | TEXT | Unpaid usage in base units (BigInt as string) |
| `lifetime_billed` | TEXT | Total settled amount in base units |
| `current_balance` | TEXT | Last known WAD balance |
| `current_allowance` | TEXT | Last known WAD allowance to treasury |
| `last_balance_check_at` | INTEGER | Timestamp of last balance refresh |
| `last_allowance_check_at` | INTEGER | Timestamp of last allowance refresh |
| `last_settlement_at` | INTEGER | Timestamp of last successful settlement |
| `suspension_reason` | TEXT | Reason for suspension (null if active) |
| `created_at` | INTEGER | Account creation timestamp |
| `updated_at` | INTEGER | Last update timestamp |

### `usage_events`

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `address` | TEXT | Agent wallet |
| `tool_name` | TEXT | MCP tool name |
| `cost` | TEXT | Cost in base units |
| `request_id` | TEXT | Optional request correlation ID |
| `metadata` | TEXT | Optional JSON metadata |
| `created_at` | INTEGER | Event timestamp |

### `settlements`

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `address` | TEXT | Agent wallet |
| `amount` | TEXT | Settlement amount in base units |
| `status` | TEXT | `pending`, `confirmed`, `failed` |
| `txid` | TEXT | On-chain transaction ID |
| `error` | TEXT | Error message on failure |
| `attempted_at` | INTEGER | Attempt timestamp |
| `confirmed_at` | INTEGER | Confirmation timestamp |

### `auth_nonces`

| Column | Type | Description |
|---|---|---|
| `address` | TEXT | Agent wallet (composite PK) |
| `nonce` | TEXT | Challenge nonce (composite PK) |
| `expires_at` | INTEGER | Expiry timestamp |
| `used_at` | INTEGER | Consumption timestamp (null if unused) |

---

## Testing

Run the billing test suite:

```bash
node --test test/billing.test.js
```

**25 tests** across 4 suites:

- **WAD math** (5) -- parseWad/formatWad round-trips, decimals, negatives
- **Database** (9) -- agent CRUD, accrued usage math, usage events, settlements, nonces
- **Pricing** (4) -- tool costs, free tools, unknown tools, registry listing
- **Metering** (7) -- access control, usage recording, settlement threshold, suspension

All amounts use BigInt internally. No floating point in token accounting.

---

## Future Work

- **AVM scheme for x402** -- Build an Algorand/Voi payment scheme so x402 endpoints can accept ARC-200 token payments natively. Would enable true per-request x402 payment alongside the metered billing model.
- **EVM payment signing** -- Add `@x402/evm` back for agents that want to pay for x402-protected endpoints on EVM chains (Base, Ethereum, etc.). Deferred to keep dependencies lean.
- **Billing contract** -- Replace raw `approve + transferFrom` with a dedicated escrow contract for stronger guarantees.
- **Multi-tier pricing** -- Per-agent pricing tiers based on volume or subscription level.
- **Admin endpoints** -- Inspect agent usage, force settlement retry, view metrics.
- **Webhook/event stream** -- Real-time notifications for settlement events.
- **TypeScript migration** -- The codebase is plain JavaScript. TypeScript would add type safety to the billing and chain modules.

# UluMCP

MCP server for Algorand AVM smart contracts via [ulujs](https://github.com/temptemp3/ulujs), [Mimir API](https://github.com/xarmian/mimir-api), and [SnowballSwap](https://swap-api-iota.vercel.app/).

Provides AI agents with structured tools to interact with ARC200 tokens, ARC72 NFTs, DEX swaps, and NFT marketplaces on Algorand-compatible networks.

## Setup

```bash
npm install
```

## Usage

### Stdio (local MCP client)

```bash
node index.js
```

### HTTP (remote hosting with x402 payment gating)

```bash
X402_AVM_PAY_TO=IR7EOSEN5S3L2HWHW6OXQW6CBG2I2N73VEGI3NXZLYPKZXAP3EUXG4EINU \
X402_AVM_PRICE=1000000 \
node serve.js
```

The HTTP server exposes the MCP protocol over Streamable HTTP at `/mcp` (default port 3000). When `X402_AVM_PAY_TO` and `X402_AVM_PRICE` are set, tool calls require an x402 payment header. Initialization and session management requests pass through without payment.

Set `MCP_PORT` to change the listening port.

### HTTP with WAD metered billing

```bash
cp .env.example .env
# Edit .env with your treasury address and mnemonic
node serve-billed.js
```

The billed server adds metered usage billing using WAD (Whale Asset Dollar, ARC-200 token `47138068`). Agents authenticate by wallet, usage is tracked internally, and charges are settled on-chain when accrued usage reaches the settlement threshold.

**Billing model:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `MIN_REQUIRED_BALANCE` | 10 WAD | Minimum WAD balance to activate |
| `MIN_REQUIRED_ALLOWANCE` | 10 WAD | Minimum WAD allowance to treasury |
| `SETTLEMENT_THRESHOLD` | 1 WAD | Trigger on-chain settlement |
| `MAX_UNPAID_USAGE` | 2 WAD | Suspend agent if unpaid |

**Agent onboarding flow:**

1. `POST /auth/challenge` with `{ "address": "<wallet>" }` → receive `{ nonce, message }`
2. Sign the message bytes with the wallet's private key
3. `POST /auth/verify` with `{ "address", "nonce", "signature" }` → receive `{ token }`
4. Connect to MCP at `POST /mcp` with `Authorization: Bearer <token>`

The server checks WAD balance and allowance during verification. The agent must have approved the treasury address for at least 10 WAD via ARC-200 `approve`.

**Endpoints:**

| Endpoint | Description |
|----------|-------------|
| `POST /auth/challenge` | Get auth challenge nonce |
| `POST /auth/verify` | Verify wallet signature, activate agent |
| `GET /agent/:address/status` | Agent billing status |
| `GET /pricing` | Tool pricing in WAD |
| `POST /mcp` | MCP protocol (Streamable HTTP) |

**Settlement:** When accrued usage reaches 1 WAD, the server calls `arc200_transferFrom` to collect from the agent's wallet to the treasury. A background worker retries failed settlements and can unsuspend agents once balance/allowance are restored.

## Adding to a Client

Add to your MCP client config (e.g. `claude_desktop_config.json`):

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

## Tools

### ARC200 Token Tools

| Tool | Description |
|------|-------------|
| `arc200_list_tokens` | Lists ARC200 tokens on the network (Mimir) |
| `arc200_balance_of` | Returns ARC200 token balance for an address |
| `arc200_allowance` | Returns spending allowance granted by owner to spender |
| `arc200_transfers` | Fetches token transfer history with optional user filter |
| `arc200_holders` | Lists holders of an ARC200 token sorted by balance (Mimir) |
| `arc200_approvals` | Fetches token approval history |

### ARC72 NFT Tools

| Tool | Description |
|------|-------------|
| `arc72_tokens` | Lists/searches ARC72 NFTs by collection, owner, or token ID (Mimir) |
| `arc72_collections` | Lists ARC72 NFT collections (Mimir) |
| `arc72_transfers` | Fetches ARC72 NFT transfer history (Mimir) |

### HumbleSwap Pool Tools

| Tool | Description |
|------|-------------|
| `humble_pool_state` | Returns pool state including token IDs, reserves, and price |
| `humble_quote` | Estimates swap output using constant-product formula with fees |

### HumbleSwap API Tools

| Tool | Description |
|------|-------------|
| `humble_protocol_stats` | Protocol-wide statistics (TVL, 24h volume, fees) |
| `humble_pools` | Lists all liquidity pools with token pairs and pool IDs |
| `humble_pool_details` | Detailed pool info (reserves, fees, protocol balances, LP token data) |
| `humble_pool_analytics` | Pool analytics including TVL and liquidity depth |
| `humble_tokens` | Lists all tracked tokens with name, symbol, decimals, and supply |
| `humble_token_metadata` | Enriched token metadata including market cap |
| `humble_token_price` | Current price data across all pools a token trades in |
| `humble_price_history` | Historical price data for charting trends |
| `humble_router` | Finds all swap paths between two tokens (direct and multi-hop) |
| `humble_arbitrage` | Detects arbitrage opportunities across pools |

### SnowballSwap Aggregator Tools

| Tool | Description |
|------|-------------|
| `snowball_quote` | Multi-pool swap quote across HumbleSwap and Nomadex with routing |
| `snowball_pool` | Detailed pool info (reserves, fees, liquidity) |
| `snowball_pools` | Lists all configured swap pools |
| `snowball_tokens` | Lists all supported tokens with metadata |

### enVoi Naming Service Tools

| Tool | Description |
|------|-------------|
| `envoi_resolve_name` | Resolves a VOI address to enVoi name(s) and profile metadata |
| `envoi_resolve_address` | Resolves an enVoi name (e.g. `shelly.voi`) to its address |
| `envoi_resolve_token` | Resolves an enVoi token ID to name, owner, and metadata |
| `envoi_search` | Searches for enVoi names matching a pattern |

### Marketplace Tools

| Tool | Description |
|------|-------------|
| `mp_listings` | Fetches active NFT marketplace listings (Mimir) |
| `mp_sales` | Fetches NFT marketplace sales history (Mimir) |
| `mp_deletes` | Fetches cancelled/deleted marketplace listings (Mimir) |

### Transaction Builder Tools

| Tool | Description |
|------|-------------|
| `arc200_transfer_txn` | Builds unsigned ARC-200 token transfer transactions |
| `arc200_approve_txn` | Builds unsigned ARC-200 approval transactions |
| `arc200_transferFrom_txn` | Builds unsigned ARC-200 delegated transfer transactions |
| `arc72_transferFrom_txn` | Builds unsigned ARC-72 NFT transfer transactions |
| `humble_swap_txn` | Builds unsigned HumbleSwap swap transactions (handles VOI wrapping) |
| `envoi_purchase_txn` | Builds unsigned enVoi name registration transactions |
| `aramid_bridge_txn` | Builds unsigned Aramid Bridge transactions (Voi ↔ Algorand) |
| `payment_txn` | Builds unsigned native payment transactions (VOI or ALGO) |

### Algod Tools

| Tool | Description |
|------|-------------|
| `algod_send_raw_transactions` | Submits signed transactions to the network (compatible with algorand-mcp) |

### x402 Payment Tools

| Tool | Description |
|------|-------------|
| `x402_pay_to` | Returns configured payment receiver addresses by network |
| `x402_check` | Probes a URL to discover its x402 payment requirements without paying |

## Supported Networks

- `algorand-mainnet`
- `voi-mainnet`

Override endpoints with environment variables:

```bash
ALGORAND_MAINNET_ALGOD_URL=https://your-node.example.com
ALGORAND_MAINNET_ALGOD_TOKEN=your-token
ALGORAND_MAINNET_INDEXER_URL=https://your-indexer.example.com
ALGORAND_MAINNET_INDEXER_TOKEN=your-token
```

The same pattern applies for other networks (`VOI_MAINNET_*`).

### Mimir API

Networks with [Mimir API](https://github.com/xarmian/mimir-api) support (currently `voi-mainnet`) use it as the primary data source for ARC200, ARC72, and marketplace tools. ARC200 tools fall back to direct on-chain queries via ulujs on networks without Mimir.

```bash
VOI_MAINNET_MIMIR_URL=https://voi-mainnet-mimirapi.nftnavigator.xyz
```

### SnowballSwap API

The SnowballSwap aggregator provides cross-DEX routing across HumbleSwap and Nomadex pools.

```bash
SNOWBALL_API_URL=https://swap-api-iota.vercel.app
```

### enVoi API

The [enVoi](https://api.envoi.sh/) naming service resolves VOI names and addresses.

```bash
ENVOI_API_URL=https://api.envoi.sh
```

### x402 Payments

The [x402](https://x402.org) protocol enables pay-per-request APIs. The `x402_check` tool probes endpoints to discover payment requirements. When hosting over HTTP (`serve.js`), tool calls are gated behind x402 payment.

```bash
X402_AVM_PAY_TO=IR7EOSEN5S3L2HWHW6OXQW6CBG2I2N73VEGI3NXZLYPKZXAP3EUXG4EINU
X402_AVM_PRICE=1000000        # Price per request in base units (e.g. 1 VOI)
X402_AVM_ASSET=0              # Asset ID (default: 0 for native VOI)
X402_AVM_NETWORK=avm:voi-mainnet  # Network identifier (default)
X402_EVM_PAY_TO=0xYourEvmAddress  # EVM receiver (future)
X402_EVM_PRICE=10000              # EVM price in base units (future)
```

Payment is enforced when both `PAY_TO` and `PRICE` are set for a network. Requests without a valid `PAYMENT-SIGNATURE` header receive a `402 Payment Required` response with accepted payment options.

## Project Structure

```
UluMCP/
  index.js              # MCP server entry point (stdio)
  serve.js              # HTTP server entry point (x402 gated)
  serve-billed.js       # HTTP server with WAD metered billing
  package.json
  .env.example          # Environment configuration template
  config/
    networks.js          # Network configuration with env overrides
  lib/
    clients.js           # Algod/Indexer client factory
    mimir.js             # Mimir API client
    snowball.js          # SnowballSwap API client
    envoi.js             # enVoi naming service client
    x402.js              # x402 payment client
  billing/
    config.js            # Billing constants and WAD math
    db.js                # SQLite schema and queries
    pricing.js           # Tool cost registry
    meter.js             # Usage tracking and thresholds
    settlement.js        # On-chain WAD settlement
    worker.js            # Background settlement worker
  auth/
    auth.js              # Wallet auth (challenge/verify/tokens)
  chain/
    wad.js               # WAD ARC-200 token operations
  test/
    billing.test.js      # Billing logic tests
  tools/
    arc200.js            # ARC200 token tools
    arc72.js             # ARC72 NFT tools
    swap200.js           # HumbleSwap pool tools
    snowball.js          # SnowballSwap aggregator tools
    envoi.js             # enVoi naming service tools
    marketplace.js       # NFT marketplace tools
    humble.js            # HumbleSwap API tools
    txns.js              # Transaction builder tools
    algod.js             # Algod tools (send raw transactions)
    x402.js              # x402 payment tools
```

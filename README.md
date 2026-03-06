# UluMCP

MCP server for Algorand AVM smart contracts via [ulujs](https://github.com/temptemp3/ulujs), [Mimir API](https://github.com/xarmian/mimir-api), and [SnowballSwap](https://swap-api-iota.vercel.app/).

Provides AI agents with structured tools to interact with ARC200 tokens, ARC72 NFTs, DEX swaps, and NFT marketplaces on Algorand-compatible networks.

## Setup

```bash
npm install
```

## Usage

```bash
node index.js
```

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

## Supported Networks

- `algorand-mainnet`
- `algorand-testnet`
- `voi-mainnet`
- `voi-testnet`

Override endpoints with environment variables:

```bash
ALGORAND_MAINNET_ALGOD_URL=https://your-node.example.com
ALGORAND_MAINNET_ALGOD_TOKEN=your-token
ALGORAND_MAINNET_INDEXER_URL=https://your-indexer.example.com
ALGORAND_MAINNET_INDEXER_TOKEN=your-token
```

The same pattern applies for other networks (`ALGORAND_TESTNET_*`, `VOI_MAINNET_*`, `VOI_TESTNET_*`).

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

## Project Structure

```
UluMCP/
  index.js              # MCP server entry point
  package.json
  config/
    networks.js          # Network configuration with env overrides
  lib/
    clients.js           # Algod/Indexer client factory
    mimir.js             # Mimir API client
    snowball.js          # SnowballSwap API client
    envoi.js             # enVoi naming service client
  tools/
    arc200.js            # ARC200 token tools
    arc72.js             # ARC72 NFT tools
    swap200.js           # HumbleSwap pool tools
    snowball.js          # SnowballSwap aggregator tools
    envoi.js             # enVoi naming service tools
    marketplace.js       # NFT marketplace tools
```

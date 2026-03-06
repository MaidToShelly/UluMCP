const HUMBLE_BASE_URL =
  process.env.HUMBLE_API_URL || "https://humble-api.voi.nautilus.sh";

async function humbleFetch(path, params = {}) {
  const url = new URL(path, HUMBLE_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `HumbleSwap API error: ${res.status} ${res.statusText} ${body}`
    );
  }
  return res.json();
}

export async function getProtocolStats() {
  return humbleFetch("/protocol/stats");
}

export async function getPools() {
  return humbleFetch("/pools");
}

export async function getPoolDetails(poolId) {
  return humbleFetch(`/pools/${poolId}/details`);
}

export async function getPoolAnalytics(poolId) {
  return humbleFetch(`/pools/${poolId}/analytics`);
}

export async function getPoolStats(poolId) {
  return humbleFetch(`/pools/${poolId}/stats`);
}

export async function getTokens() {
  return humbleFetch("/tokens");
}

export async function getTokenMetadata(assetId) {
  return humbleFetch(`/tokens/${assetId}/metadata`);
}

export async function getTokenStats(assetId) {
  return humbleFetch(`/tokens/${assetId}/stats`);
}

export async function getTokenPools(assetId) {
  return humbleFetch(`/tokens/${assetId}/pools`);
}

export async function getPrices() {
  return humbleFetch("/prices");
}

export async function getTokenPrice(tokenId) {
  return humbleFetch(`/prices/${tokenId}`);
}

export async function getPriceHistory(tokenId) {
  return humbleFetch(`/prices/${tokenId}/history`);
}

export async function getPriceTrends(tokenId) {
  return humbleFetch(`/prices/${tokenId}/trends`);
}

export async function getRouter(tokenA, tokenB) {
  return humbleFetch(`/router/${tokenA}/${tokenB}`);
}

export async function getArbitrageOpportunities() {
  return humbleFetch("/arbitrage/opportunities");
}

export async function getTriangularArbitrage() {
  return humbleFetch("/arbitrage/triangular");
}

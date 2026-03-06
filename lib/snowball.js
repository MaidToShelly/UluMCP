const SNOWBALL_BASE_URL =
  process.env.SNOWBALL_API_URL || "https://swap-api-iota.vercel.app";

async function snowballFetch(path, options = {}) {
  const url = new URL(path, SNOWBALL_BASE_URL);
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `SnowballSwap API error: ${res.status} ${res.statusText} ${body}`
    );
  }
  return res.json();
}

export async function getQuote({
  inputToken,
  outputToken,
  amount,
  slippageTolerance,
  poolId,
  dex,
}) {
  const body = { inputToken: String(inputToken), outputToken: String(outputToken), amount: String(amount) };
  if (slippageTolerance !== undefined) body.slippageTolerance = slippageTolerance;
  if (poolId !== undefined) body.poolId = poolId;
  if (dex !== undefined) body.dex = dex;
  return snowballFetch("/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getPool(poolId) {
  return snowballFetch(`/pool/${poolId}`);
}

export async function getPools() {
  return snowballFetch("/config/pools");
}

export async function getTokens() {
  return snowballFetch("/config/tokens");
}

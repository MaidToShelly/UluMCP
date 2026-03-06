const ENVOI_BASE_URL =
  process.env.ENVOI_API_URL || "https://api.envoi.sh";

async function envoiFetch(path) {
  const url = new URL(path, ENVOI_BASE_URL);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`enVoi API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function resolveName(address) {
  return envoiFetch(`/api/name/${encodeURIComponent(address)}`);
}

export async function resolveAddress(name) {
  return envoiFetch(`/api/address/${encodeURIComponent(name)}`);
}

export async function resolveToken(tokenId) {
  return envoiFetch(`/api/token/${encodeURIComponent(tokenId)}`);
}

export async function searchNames(pattern) {
  return envoiFetch(`/api/search?pattern=${encodeURIComponent(pattern)}`);
}

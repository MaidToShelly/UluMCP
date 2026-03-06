const X402_CONFIG = {
  avm: {
    payTo: process.env.X402_AVM_PAY_TO || "",
    price: process.env.X402_AVM_PRICE || "0",
    asset: process.env.X402_AVM_ASSET || "0",
    network: process.env.X402_AVM_NETWORK || "avm:voi-mainnet",
  },
  evm: {
    payTo: process.env.X402_EVM_PAY_TO || "",
    price: process.env.X402_EVM_PRICE || "0",
    asset: process.env.X402_EVM_ASSET || "",
    network: process.env.X402_EVM_NETWORK || "",
  },
};

export function getPayTo(network) {
  if (!network) {
    return Object.fromEntries(
      Object.entries(X402_CONFIG).map(([k, v]) => [k, v.payTo])
    );
  }
  const cfg = X402_CONFIG[network.toLowerCase()];
  return cfg?.payTo || null;
}

export function buildPaymentRequirements() {
  const accepts = Object.values(X402_CONFIG)
    .filter((cfg) => cfg.payTo && cfg.price !== "0")
    .map((cfg) => ({
      scheme: "exact",
      network: cfg.network,
      asset: cfg.asset,
      amount: cfg.price,
      payTo: cfg.payTo,
      maxTimeoutSeconds: 300,
      extra: {},
    }));
  return accepts;
}

export function hasPaymentHeader(req) {
  return !!(
    req.headers["payment-signature"] || req.headers["x-payment"]
  );
}

export function getPaymentPayload(req) {
  const raw =
    req.headers["payment-signature"] || req.headers["x-payment"];
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
  } catch {
    return { raw };
  }
}

export async function checkPaymentRequirements(url, { method = "GET", headers = {} } = {}) {
  const res = await fetch(url, { method, headers });

  if (res.status !== 402) {
    return {
      requiresPayment: false,
      status: res.status,
    };
  }

  const paymentRequiredHeader = res.headers.get("PAYMENT-REQUIRED");

  let requirements = null;
  try {
    const body = await res.json();
    requirements = body;
  } catch {
    if (paymentRequiredHeader) {
      try {
        requirements = JSON.parse(
          Buffer.from(paymentRequiredHeader, "base64").toString("utf-8")
        );
      } catch {
        requirements = { raw: paymentRequiredHeader };
      }
    }
  }

  return {
    requiresPayment: true,
    status: 402,
    requirements,
  };
}

import { z } from "zod";
import { checkPaymentRequirements, getPayTo } from "../lib/x402.js";

function success(data) {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function failure(error) {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: String(error) }) }],
    isError: true,
  };
}

export function registerX402Tools(server) {
  server.tool(
    "x402_pay_to",
    "Returns the configured x402 payment receiver addresses by network. Uses X402_AVM_PAY_TO and X402_EVM_PAY_TO environment variables.",
    {
      network: z
        .string()
        .optional()
        .describe("Filter by network (avm or evm). Omit to return all configured addresses."),
    },
    async ({ network }) => {
      try {
        if (network) {
          const address = getPayTo(network);
          if (!address) {
            return failure(`No pay-to address configured for network: ${network}`);
          }
          return success({ network, address });
        }
        const all = getPayTo();
        const configured = Object.entries(all)
          .filter(([, v]) => v)
          .map(([network, address]) => ({ network, address }));
        return success({ addresses: configured });
      } catch (err) {
        return failure(err.message);
      }
    }
  );

  server.tool(
    "x402_check",
    "Probes a URL to discover its x402 payment requirements without making a payment. Returns whether the endpoint requires payment and what payment options are accepted (networks, tokens, prices).",
    {
      url: z.string().describe("The URL to check for x402 payment requirements"),
      method: z
        .string()
        .optional()
        .describe("HTTP method (default GET)"),
      headers: z
        .record(z.string())
        .optional()
        .describe("Additional HTTP headers as key-value pairs"),
    },
    async ({ url, method, headers }) => {
      try {
        const data = await checkPaymentRequirements(url, {
          method: method || "GET",
          headers: headers || {},
        });
        return success(data);
      } catch (err) {
        return failure(err.message);
      }
    }
  );

}

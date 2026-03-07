import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerArc200Tools } from "./tools/arc200.js";
import { registerArc72Tools } from "./tools/arc72.js";
import { registerSwapTools } from "./tools/swap200.js";
import { registerMarketplaceTools } from "./tools/marketplace.js";
import { registerSnowballTools } from "./tools/snowball.js";
import { registerEnvoiTools } from "./tools/envoi.js";
import { registerHumbleApiTools } from "./tools/humble.js";
import { registerTxnTools } from "./tools/txns.js";
import { registerX402Tools } from "./tools/x402.js";
import { registerAlgodTools } from "./tools/algod.js";
import {
  buildPaymentRequirements,
  hasPaymentHeader,
  getPaymentPayload,
} from "./lib/x402.js";

function createMcpServer() {
  const server = new McpServer({
    name: "ulu-mcp",
    version: "0.0.1",
  });
  registerArc200Tools(server);
  registerArc72Tools(server);
  registerSwapTools(server);
  registerMarketplaceTools(server);
  registerSnowballTools(server);
  registerEnvoiTools(server);
  registerHumbleApiTools(server);
  registerTxnTools(server);
  registerX402Tools(server);
  registerAlgodTools(server);
  return server;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function isInitMessage(body) {
  if (Array.isArray(body)) return body.some(isInitializeRequest);
  return isInitializeRequest(body);
}

function requiresPayment() {
  const accepts = buildPaymentRequirements();
  return accepts.length > 0;
}

function sendPaymentRequired(res) {
  const accepts = buildPaymentRequirements();
  const payload = {
    x402Version: 2,
    error: "Payment Required",
    accepts,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
  res.writeHead(402, {
    "Content-Type": "application/json",
    "PAYMENT-REQUIRED": encoded,
  });
  res.end(JSON.stringify(payload));
}

const transports = {};

async function handlePost(req, res, body) {
  const sessionId = req.headers["mcp-session-id"];

  if (sessionId && transports[sessionId]) {
    if (requiresPayment() && !isInitMessage(body) && !hasPaymentHeader(req)) {
      sendPaymentRequired(res);
      return;
    }
    await transports[sessionId].handleRequest(req, res, body);
    return;
  }

  if (!sessionId && isInitMessage(body)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports[sid] = transport;
      },
    });
    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid && transports[sid]) delete transports[sid];
    };
    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
    return;
  }

  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: No valid session ID" },
      id: null,
    })
  );
}

async function handleGet(req, res) {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.writeHead(400);
    res.end("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
}

async function handleDelete(req, res) {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.writeHead(400);
    res.end("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
}

const PORT = parseInt(process.env.MCP_PORT || "3000", 10);

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/mcp") {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  try {
    if (req.method === "POST") {
      const body = await parseBody(req);
      await handlePost(req, res, body);
    } else if (req.method === "GET") {
      await handleGet(req, res);
    } else if (req.method === "DELETE") {
      await handleDelete(req, res);
    } else {
      res.writeHead(405);
      res.end("Method Not Allowed");
    }
  } catch (err) {
    console.error("Error handling request:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        })
      );
    }
  }
});

httpServer.listen(PORT, () => {
  const accepts = buildPaymentRequirements();
  console.log(`UluMCP HTTP server listening on port ${PORT}`);
  if (accepts.length > 0) {
    console.log(`x402 payment required: ${accepts.length} accepted payment option(s)`);
    for (const a of accepts) {
      console.log(`  ${a.network} → ${a.payTo} (${a.amount} of asset ${a.asset})`);
    }
  } else {
    console.log("x402 payment not configured (open access)");
  }
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  for (const sid of Object.keys(transports)) {
    await transports[sid].close().catch(() => {});
    delete transports[sid];
  }
  httpServer.close();
  process.exit(0);
});

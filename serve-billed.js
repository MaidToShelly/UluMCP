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
import { registerX402Tools } from "./tools/x402.js";
import { MCP_PORT, TREASURY_ADDRESS, formatWad } from "./billing/config.js";
import { getDb } from "./billing/db.js";
import { getToolCost, getAllPrices, isFreeTool } from "./billing/pricing.js";
import { checkCanExecute, recordUsage, buildBillingMeta } from "./billing/meter.js";
import { attemptSettlement } from "./billing/settlement.js";
import { startWorker, stopWorker } from "./billing/worker.js";
import {
  generateChallenge,
  verifyAndActivate,
  getAddressForToken,
} from "./auth/auth.js";
import * as db from "./billing/db.js";

getDb();

const sessionAgents = new Map();
const transports = {};

function createBilledMcpServer(sessionId) {
  const server = new McpServer({
    name: "ulu-mcp",
    version: "0.0.1",
  });

  const origTool = server.tool.bind(server);
  server.tool = function (name, description, schema, handler) {
    return origTool.call(this, name, description, schema, async (args, extra) => {
      const address = sessionAgents.get(extra.sessionId);

      if (!isFreeTool(name) && !address) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Not authenticated",
                code: "NOT_AUTHENTICATED",
                message: "Provide Authorization header with bearer token",
              }),
            },
          ],
          isError: true,
        };
      }

      const cost = getToolCost(name);

      if (cost > 0n && address) {
        const check = checkCanExecute(address, name);
        if (!check.allowed) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: check.message,
                  code: check.code,
                  ...check,
                }),
              },
            ],
            isError: true,
          };
        }
      }

      const result = await handler(args, extra);

      if (cost > 0n && address) {
        const usage = recordUsage(address, name, cost, extra.requestId);
        if (usage?.settlement_needed && !usage.suspended) {
          attemptSettlement(address).catch((err) =>
            console.error(`Async settlement error: ${err.message}`)
          );
        }

        const billing = buildBillingMeta(address, name, cost);
        const existing =
          result.content && result.content[0]?.type === "text"
            ? JSON.parse(result.content[0].text)
            : {};
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ...existing, _billing: billing }),
            },
          ],
        };
      }

      return result;
    });
  };

  registerArc200Tools(server);
  registerArc72Tools(server);
  registerSwapTools(server);
  registerMarketplaceTools(server);
  registerSnowballTools(server);
  registerEnvoiTools(server);
  registerHumbleApiTools(server);
  registerX402Tools(server);

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

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function extractBearerToken(req) {
  const auth = req.headers["authorization"] || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

function isInitMessage(body) {
  if (Array.isArray(body)) return body.some(isInitializeRequest);
  return isInitializeRequest(body);
}

// --- Auth routes ---

async function handleAuthChallenge(req, res) {
  const body = await parseBody(req);
  if (!body.address) {
    return sendJson(res, 400, { error: "address is required" });
  }
  const challenge = generateChallenge(body.address);
  sendJson(res, 200, {
    address: body.address,
    nonce: challenge.nonce,
    message: `UluMCP-auth:${challenge.nonce}`,
    expiresAt: challenge.expiresAt,
  });
}

async function handleAuthVerify(req, res) {
  const body = await parseBody(req);
  if (!body.address || !body.nonce || !body.signature) {
    return sendJson(res, 400, {
      error: "address, nonce, and signature are required",
    });
  }
  try {
    const result = await verifyAndActivate(
      body.address,
      body.nonce,
      body.signature
    );
    sendJson(res, 200, {
      token: result.token,
      address: result.address,
      status: "active",
    });
  } catch (err) {
    sendJson(res, err.code === "INSUFFICIENT_BALANCE" ||
      err.code === "INSUFFICIENT_ALLOWANCE" ? 402 : 401, {
      error: err.message,
      code: err.code,
      current_balance: err.current_balance,
      required_balance: err.required_balance,
      current_allowance: err.current_allowance,
      required_allowance: err.required_allowance,
    });
  }
}

async function handleAgentStatus(req, res, address) {
  const agent = db.getAgent(address);
  if (!agent) {
    return sendJson(res, 404, { error: "Agent not found" });
  }
  sendJson(res, 200, {
    address: agent.address,
    status: agent.status,
    accrued_usage: formatWad(agent.accrued_usage),
    lifetime_billed: formatWad(agent.lifetime_billed),
    current_balance: agent.current_balance
      ? formatWad(agent.current_balance)
      : null,
    current_allowance: agent.current_allowance
      ? formatWad(agent.current_allowance)
      : null,
    suspension_reason: agent.suspension_reason,
    last_settlement_at: agent.last_settlement_at,
  });
}

function handlePricing(req, res) {
  sendJson(res, 200, { prices: getAllPrices() });
}

// --- MCP routes ---

async function handleMcpPost(req, res, body) {
  const sessionId = req.headers["mcp-session-id"];

  if (sessionId && transports[sessionId]) {
    await transports[sessionId].handleRequest(req, res, body);
    return;
  }

  if (!sessionId && isInitMessage(body)) {
    const token = extractBearerToken(req);
    const address = token ? getAddressForToken(token) : null;

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports[sid] = transport;
        if (address) {
          sessionAgents.set(sid, address);
        }
      },
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) {
        delete transports[sid];
        sessionAgents.delete(sid);
      }
    };

    const server = createBilledMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
    return;
  }

  sendJson(res, 400, {
    jsonrpc: "2.0",
    error: { code: -32000, message: "Bad Request: No valid session ID" },
    id: null,
  });
}

async function handleMcpGet(req, res) {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.writeHead(400);
    res.end("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
}

async function handleMcpDelete(req, res) {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.writeHead(400);
    res.end("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
}

// --- Router ---

function matchRoute(method, pathname) {
  if (method === "POST" && pathname === "/auth/challenge") return handleAuthChallenge;
  if (method === "POST" && pathname === "/auth/verify") return handleAuthVerify;
  if (method === "GET" && pathname === "/pricing") return handlePricing;

  const agentMatch = pathname.match(/^\/agent\/([A-Z2-7]{58})\/status$/);
  if (method === "GET" && agentMatch) {
    return (req, res) => handleAgentStatus(req, res, agentMatch[1]);
  }

  return null;
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${MCP_PORT}`);
  const { pathname } = url;

  try {
    const handler = matchRoute(req.method, pathname);
    if (handler) {
      await handler(req, res);
      return;
    }

    if (pathname === "/mcp") {
      if (req.method === "POST") {
        const body = await parseBody(req);
        await handleMcpPost(req, res, body);
      } else if (req.method === "GET") {
        await handleMcpGet(req, res);
      } else if (req.method === "DELETE") {
        await handleMcpDelete(req, res);
      } else {
        res.writeHead(405);
        res.end("Method Not Allowed");
      }
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  } catch (err) {
    console.error("Request error:", err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal server error" });
    }
  }
});

startWorker();

httpServer.listen(MCP_PORT, () => {
  console.log(`UluMCP Billed HTTP server listening on port ${MCP_PORT}`);
  console.log(`Treasury: ${TREASURY_ADDRESS || "(not set)"}`);
  console.log("Endpoints:");
  console.log("  POST /auth/challenge    - Get auth challenge");
  console.log("  POST /auth/verify       - Verify signature & activate");
  console.log("  GET  /agent/:addr/status - Agent billing status");
  console.log("  GET  /pricing           - Tool pricing");
  console.log("  POST /mcp              - MCP protocol (tool calls)");
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  stopWorker();
  for (const sid of Object.keys(transports)) {
    await transports[sid].close().catch(() => {});
    delete transports[sid];
  }
  httpServer.close();
  process.exit(0);
});

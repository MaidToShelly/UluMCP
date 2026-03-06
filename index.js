import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerArc200Tools } from "./tools/arc200.js";
import { registerArc72Tools } from "./tools/arc72.js";
import { registerSwapTools } from "./tools/swap200.js";
import { registerMarketplaceTools } from "./tools/marketplace.js";
import { registerSnowballTools } from "./tools/snowball.js";
import { registerEnvoiTools } from "./tools/envoi.js";
import { registerHumbleApiTools } from "./tools/humble.js";
import { registerTxnTools } from "./tools/txns.js";
import { registerX402Tools } from "./tools/x402.js";

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

const transport = new StdioServerTransport();
await server.connect(transport);

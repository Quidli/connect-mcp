import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_ENDPOINT = process.env.MCP_ENDPOINT || "https://mcp.connect.quid.li";

async function main() {
  console.log(`MCP smoke test — endpoint: ${MCP_ENDPOINT}`);
  console.log(`Node: ${process.version}`);

  let transport;
  try {
    transport = new StreamableHTTPClientTransport(new URL(MCP_ENDPOINT), {
      requestInit: { timeout: 15_000 },
    });
  } catch (err) {
    console.error("Failed to create transport:", err);
    process.exit(1);
  }

  const client = new Client(
    { name: "connect-mcp-smoke-test", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log("Connected to MCP server");

    const toolsResult = await client.listTools();
    const tools = toolsResult?.tools ?? [];

    console.log(`tools/list returned ${tools.length} tool(s)`);
    if (tools.length === 0) {
      console.error("FAIL: tools/list returned no tools");
      process.exit(1);
    }

    for (const tool of tools) {
      console.log(`  - ${tool.name}: ${tool.description ?? "(no description)"}`);
    }

    console.log("PASS: connection established and tools listed successfully");
  } catch (err) {
    console.error("FAIL: MCP interaction failed:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled error in smoke test:", err);
  process.exit(1);
});

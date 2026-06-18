# @quidli/connect-mcp

MCP server exposing [Quidli Connect](https://connect.quid.li) product APIs as tools for Cursor, Claude Desktop, and other MCP hosts.

## Requirements

- Node.js 20+
- A Connect API key ([Enable API access](https://connect.quid.li))

## Cursor configuration

### Remote URL (recommended for production)

Same pattern as GitHub MCP — Cursor connects to a hosted endpoint and sends your API key in headers:

```json
{
  "mcpServers": {
    "connect": {
      "url": "https://mcp.connect.quid.li",
      "headers": {
        "x-api-key": "set-your-api-key-here"
      }
    }
  }
}
```

After one-click install, open **Cursor Settings → MCP → connect** and replace `set-your-api-key-here` with your real API key from [connect.quid.li](https://connect.quid.li) (Enable API access). Until you do, the server returns `401` with setup instructions.

**Add to Cursor** deeplink (placeholder key pre-filled):

```
cursor://anysphere.cursor-deeplink/mcp/install?name=connect&config=eyJ1cmwiOiJodHRwczovL21jcC5jb25uZWN0LnF1aWQubGkIiwiaGVhZGVycyI6eyJ4LWFwaS1rZXkiOiJzZXQteW91ci1hcGkta2V5LWhlcmUifX0=
```

Or generate programmatically:

```typescript
import { buildCursorMcpInstallDeeplink } from '@quidli/connect-mcp/deeplink';
// buildCursorMcpInstallDeeplink() in published package once exported — see src/deeplink.ts
```

### Local stdio (npm / development)

Add to `.cursor/mcp.json` (or global MCP settings):

```json
{
  "mcpServers": {
    "connect": {
      "command": "npx",
      "args": ["-y", "@quidli/connect-mcp"],
      "env": {
        "CONNECT_API_KEY": "<your-api-key>",
        "CONNECT_API_BASE_URL": "https://api.connect.quid.li"
      }
    }
  }
}
```

For local development from this monorepo:

```json
{
  "mcpServers": {
    "connect-local": {
      "command": "node",
      "args": ["/absolute/path/to/connect-backend/packages/connect-mcp/dist/index.js"],
      "env": {
        "CONNECT_API_KEY": "<your-api-key>",
        "CONNECT_API_BASE_URL": "https://api.staging.connect.quid.li"
      }
    }
  }
}
```

`CONNECT_API_KEY` is **required** for stdio mode — the process exits at startup if missing. Remote HTTP mode reads `x-api-key` from each request instead.

## HTTP server (hosted deployment)

### Embedded in connect-backend (production)

MCP runs inside the **same Cloud Run service** as `api.connect.quid.li`. Map `mcp.connect.quid.li` as an additional custom domain on that service. Requests with MCP `Host` headers are routed to the MCP handler; API traffic is unchanged.

See `docs/ai/deployment/feature-connect-api-mcp.md` in connect-backend for DNS, env vars, and smoke tests.

### Standalone binary (local / debugging)

```bash
cd packages/connect-mcp
npm run build
CONNECT_API_BASE_URL=https://api.connect.quid.li npm run start:http
```

Environment:

| Variable | Default | Description |
|----------|---------|-------------|
| `CONNECT_MCP_HTTP_HOST` | `0.0.0.0` | Bind address |
| `CONNECT_MCP_HTTP_PORT` | `8080` | Listen port |
| `CONNECT_API_BASE_URL` | `https://api.connect.quid.li` | Upstream Connect API |

Health check: `GET /health`

## Tools (7)

| Tool | HTTP | Auth |
|------|------|------|
| `connect_get_price` | `GET /price` | none |
| `connect_lookup` | `POST /lookup` | api-key |
| `connect_scores_batch` | `POST /scores` | api-key |
| `connect_scores_by_account` | `GET /scores/:platform/:identifier` | api-key |
| `connect_scores_by_username` | `GET /scores/u/:username` | api-key |
| `connect_drop` | `POST /drop` | api-key |
| `connect_agent_prompt` | `POST /agent` | api-key |

Not exposed: `POST /lookup/exposed`, agent feedback, member/admin routes.

## Auth notes

- **MCP uses api-key only.** x402 pay-per-call and Privy Bearer are HTTP-only (use [API docs](https://connect.quid.li/docs) or skills directly).
- `connect_get_price` is public on the HTTP API and does not send `x-api-key`.

## Development

```bash
cd packages/connect-mcp
npm install
npm test
npm run build
CONNECT_API_KEY=<key> npm start
```

## Publish

```bash
npm publish --access public
```

(Requires `@quidli` npm org access.)

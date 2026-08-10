# Quidli Connect MCP

Use [Quidli Connect](https://connect.quid.li) from Cursor, Claude Desktop, or any MCP-compatible client — wallet lookup, scores, Smart Send drops, and the Connect agent.

## Choose how to connect


|                 | **Hosted** (`mcp.connect.quid.li`)                                                   | **Local** (`npx @quidli/connect-mcp`)                                                      |
| --------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Setup**       | Add a URL in MCP settings                                                            | Run a local process via `npx`                                                              |
| **Auth**        | Connect API key only                                                                 | API key **or** x402 pay-per-call                                                           |
| **Pros**        | No install; always on Quidli infrastructure; simplest setup                          | Wallet private key never leaves your machine; pay per call with USDC instead of an API key |
| **Cons**        | Requires a Connect API key; no pay-per-call billing                                  | Requires Node.js 20+; `npx` may download the package on first run                          |
| **Limitations** | Cannot use x402 / wallet auth — do **not** send a private key to the hosted endpoint | x402 mode needs USDC on Base (mainnet `8453`); `connect_drop` requires an API key          |


Get a Connect API key at [connect.quid.li](https://connect.quid.li) → **Enable API access**.

---

## Hosted (recommended)

Best if you have a Connect API key and want zero local setup.

### Cursor

**If you already have other MCP servers:** skip the deeplink and [add manually](#cursor-manual) — the one-click install can overwrite your entire `mcp.json` in some Cursor versions.

[Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=quidli-connect&config=eyJ1cmwiOiJodHRwczovL21jcC5jb25uZWN0LnF1aWQubGkiLCJoZWFkZXJzIjp7IngtYXBpLWtleSI6IiJ9fQ==)

Or paste into **Cursor Settings → MCP → Add new MCP server**:

```
cursor://anysphere.cursor-deeplink/mcp/install?name=quidli-connect&config=eyJ1cmwiOiJodHRwczovL21jcC5jb25uZWN0LnF1aWQubGkiLCJoZWFkZXJzIjp7IngtYXBpLWtleSI6IiJ9fQ==
```

Then open **Cursor Settings → MCP → quidli-connect** and set `headers.x-api-key` to your Connect API key.

#### Add manually {#cursor-manual}

Merge this into `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project) under `mcpServers` — do not replace your existing entries:

```json
"quidli-connect": {
  "url": "https://mcp.connect.quid.li",
  "headers": {
    "x-api-key": "<your-connect-api-key>"
  }
}
```

### Claude Desktop

1. Open **Claude → Settings → Connectors** (or **Settings → Developer → Edit Config** on older versions).
2. Add a custom MCP connector with URL `https://mcp.connect.quid.li` and header `x-api-key: <your-connect-api-key>`.

Or merge this into your config file and restart Claude:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "quidli-connect": {
      "url": "https://mcp.connect.quid.li",
      "headers": {
        "x-api-key": "<your-connect-api-key>"
      }
    }
  }
}
```

If your Claude version does not support remote `url` connectors, use the local bridge instead (still hosted API, runs a small local helper):

```json
{
  "mcpServers": {
    "quidli-connect": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "--http",
        "https://mcp.connect.quid.li",
        "--header",
        "x-api-key:${CONNECT_API_KEY}"
      ],
      "env": {
        "CONNECT_API_KEY": "<your-connect-api-key>"
      }
    }
  }
}
```

Requires **Node.js 20+** for the bridge. Restart Claude Desktop after saving. You should see a hammer icon in the chat input when tools are available.

Until a valid API key is set, requests return `401` with setup instructions.

---

## Local (stdio)

Best if you want pay-per-call with a wallet, or prefer credentials in a local env file.

Requires **Node.js 20+**.

### Cursor

Add one of the following to `.cursor/mcp.json` (project) or your global MCP settings.

#### Option A — API key

Same billing model as hosted; credentials stay on your machine.

```json
{
  "mcpServers": {
    "quidli-connect": {
      "command": "npx",
      "args": ["-y", "@quidli/connect-mcp"],
      "env": {
        "CONNECT_API_KEY": "<your-connect-api-key>",
        "CONNECT_API_BASE_URL": "https://api.connect.quid.li"
      }
    }
  }
}
```

#### Option B — x402 pay-per-call (wallet)

No API key. Authenticated calls pay automatically when the API returns HTTP 402. Your wallet private key is only read by the local process.

```json
{
  "mcpServers": {
    "quidli-connect": {
      "command": "npx",
      "args": ["-y", "@quidli/connect-mcp"],
      "env": {
        "EVM_PRIVATE_KEY": "0x<wallet-with-usdc-on-base>",
        "CONNECT_API_BASE_URL": "https://api.connect.quid.li",
        "CONNECT_X402_EVM_NETWORK": "8453"
      }
    }
  }
}
```

Use `84532` for Base Sepolia when pointing at a staging API.

### Claude Desktop

1. Open **Claude → Settings → Developer → Edit Config** (enable Developer mode first if you do not see it).
2. Merge one of the blocks below into `mcpServers` in:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

3. Restart Claude Desktop.

#### Option A — API key

```json
{
  "mcpServers": {
    "quidli-connect": {
      "command": "npx",
      "args": ["-y", "@quidli/connect-mcp"],
      "env": {
        "CONNECT_API_KEY": "<your-connect-api-key>",
        "CONNECT_API_BASE_URL": "https://api.connect.quid.li"
      }
    }
  }
}
```

#### Option B — x402 pay-per-call (wallet)

```json
{
  "mcpServers": {
    "quidli-connect": {
      "command": "npx",
      "args": ["-y", "@quidli/connect-mcp"],
      "env": {
        "EVM_PRIVATE_KEY": "0x<wallet-with-usdc-on-base>",
        "CONNECT_API_BASE_URL": "https://api.connect.quid.li",
        "CONNECT_X402_EVM_NETWORK": "8453"
      }
    }
  }
}
```

If both `CONNECT_API_KEY` and `EVM_PRIVATE_KEY` are set, the API key is used.

At least one of `CONNECT_API_KEY` or `EVM_PRIVATE_KEY` is required for local mode.

---

## Tools


| Tool                         | What it does                                              |
| ---------------------------- | --------------------------------------------------------- |
| `connect_get_price`          | List reference prices (no auth)                           |
| `connect_lookup`             | Resolve social identities to EVM and SOL wallet addresses |
| `connect_lookup_exposed`     | List platforms a recipient has exposed on Connect         |
| `connect_scores_batch`       | Batch scores for accounts or usernames                    |
| `connect_scores_by_account`  | Scores for one linked account                             |
| `connect_scores_by_username` | Scores by Connect username                                |
| `connect_drop`               | Smart Send (batch token transfer) — **API key only**      |
| `connect_drop_balance`       | Smart Send wallet balances on a chain — **API key only**  |
| `connect_agent_prompt`       | Natural-language agent for recipients discovery           |


Ask your client to use these tools when you need Connect data or actions.
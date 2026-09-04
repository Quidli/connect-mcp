# Quidli Connect MCP

Identity and reputation for agents. Resolve a social handle to a wallet, check reputation, and send tokens — from Cursor, Claude Desktop, Claude Code, or any MCP-compatible client.

Public repository: [github.com/Quidli/connect-mcp](https://github.com/Quidli/connect-mcp)

## Try it in one command

No API key required.

**Claude Code:**

```bash
claude mcp add --transport http quidli https://mcp.connect.quid.li/
```

**Cursor:** [Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=quidli-connect&config=eyJ1cmwiOiJodHRwczovL21jcC5jb25uZWN0LnF1aWQubGkifQ==) (or paste that link into **Settings → MCP → Add new MCP server**)

**Claude Desktop:** **Settings → Connectors → Add custom connector**, URL `https://mcp.connect.quid.li`

**Local (any client)** — runs on your machine instead of the hosted endpoint:

```bash
npx -y @quidli/connect-mcp
```

See [Choose how to connect](#choose-how-to-connect) below for API keys, x402 wallet pay-per-call, and full config snippets.

Then ask your agent:

> Resolve the Farcaster handle `ahn.eth` to a wallet.

```json
{
  "status": "completed",
  "results": [
    {
      "type": "farcaster",
      "value": "ahn.eth",
      "ethWalletAddress": "0x07De92Ce6474D718c80e696516bf0bE53290fF5E",
      "solWalletAddress": "9DD2CqPKZJoo7ZRgCXxJNMjhzfgVihSKtkZpn8qnEWK9"
    }
  ]
}
```

Resolves across Telegram, Discord, Farcaster, X, GitHub, LinkedIn, email and phone — and generates a wallet for people who have never used Quidli.

Lookup, scores, agent and price run without a key under a shared anonymous quota. Add a [Connect API key](https://connect.quid.li) for higher limits, your own profile (`connect_me`), and Smart Send.

---

## Choose how to connect


|                 | **Hosted** (`mcp.connect.quid.li`)                                                   | **Local** (`npx @quidli/connect-mcp`)                                                      |
| --------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Setup**       | Add a URL in MCP settings                                                            | Run a local process via `npx`                                                              |
| **Auth**        | Optional API key. Without a key: lookup/scores/agent/price under a shared anonymous quota | API key, x402 pay-per-call, or none for lookup/scores/agent                                |
| **Pros**        | No install; try without a key; always on Quidli infrastructure                       | Wallet private key never leaves your machine; pay per call with USDC instead of an API key |
| **Cons**        | Anonymous traffic shares a global rate limit; no pay-per-call billing                | Requires Node.js 20+; `npx` may download the package on first run                          |
| **Limitations** | Cannot use x402 / wallet auth — do **not** send a private key to the hosted endpoint | x402 mode needs USDC on Base (mainnet `8453`); `connect_drop` requires an API key          |


Get a Connect API key at [connect.quid.li](https://connect.quid.li) → **Enable API access** for higher limits, `connect_me`, and Smart Send.

---

## Hosted (recommended)

Zero local setup. Lookup, scores, agent, and price work without an API key (shared anonymous quota). Add a key for higher limits, your profile (`connect_me`), and Smart Send.

### Cursor

**If you already have other MCP servers:** skip the deeplink and [add manually](#cursor-manual) — the one-click install can overwrite your entire `mcp.json` in some Cursor versions.

[Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=quidli-connect&config=eyJ1cmwiOiJodHRwczovL21jcC5jb25uZWN0LnF1aWQubGkifQ==)

Or paste into **Cursor Settings → MCP → Add new MCP server**:

```
cursor://anysphere.cursor-deeplink/mcp/install?name=quidli-connect&config=eyJ1cmwiOiJodHRwczovL21jcC5jb25uZWN0LnF1aWQubGkifQ==
```

#### Add manually {#cursor-manual}

Merge this into `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project) under `mcpServers` — do not replace your existing entries:

```json
"quidli-connect": {
  "url": "https://mcp.connect.quid.li"
}
```

Optional — higher limits and Smart Send:

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
2. Add a custom MCP connector with URL `https://mcp.connect.quid.li`. Optionally set header `x-api-key: <your-connect-api-key>`.

Or merge this into your config file and restart Claude:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "quidli-connect": {
      "url": "https://mcp.connect.quid.li"
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
        "https://mcp.connect.quid.li"
      ]
    }
  }
}
```

Requires **Node.js 20+** for the bridge. Restart Claude Desktop after saving. You should see a hammer icon in the chat input when tools are available.

Without a key, `initialize` / `tools/list` always succeed. Anonymous `tools/call` share a global quota (HTTP **429** when exceeded — get a key for higher limits). Placeholder keys still return **401**.

### Grok

1. Go to [grok.com/connectors](https://grok.com/connectors) and select **Custom**.
2. Enter the server URL: `https://mcp.connect.quid.li`

This gives Grok access to the anonymous-tier tools -- lookup, scores, agent, and price -- under the shared quota.

**Current limitation:** Grok's custom connector UI does not currently support attaching an API key or custom header. That means `connect_me`, `connect_drop`, and `connect_drop_balance` (all **API key only**) are not usable through Grok yet -- calls to them will return an unauthorized error. This isn't a `connect-mcp` limitation; it's Grok's custom-connector setup not exposing an auth field at this time.

---

## Smithery

If you already use [Smithery](https://smithery.ai/servers/quidli/connect), it will handle auth and sessions for you. Requires a Smithery account.

```bash
npx smithery login
npx smithery mcp add quidli/connect
```

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

#### Option C — no credentials (lookup / scores / agent)

The MCP process starts without `CONNECT_API_KEY` or `EVM_PRIVATE_KEY`. `connect_lookup`, `connect_scores_*`, `connect_agent_prompt`, and `connect_get_price` call the API without auth. That succeeds when x402 is disabled (price `0`, typical for local). On production with x402 enabled, those tools return HTTP 402 until you set a key or wallet.

`connect_me`, `connect_drop`, and `connect_drop_balance` still require `CONNECT_API_KEY`.

```json
{
  "mcpServers": {
    "quidli-connect": {
      "command": "npx",
      "args": ["-y", "@quidli/connect-mcp"],
      "env": {
        "CONNECT_API_BASE_URL": "http://127.0.0.1:3011"
      }
    }
  }
}
```

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

Credentials are optional in local mode. Without either variable, lookup/scores/agent still work when the API does not charge x402. `connect_me` and Smart Send tools require `CONNECT_API_KEY`.

---

## Troubleshooting

### `npx` hangs with no output when run from a background service

If you're launching `@quidli/connect-mcp` via `npx` from inside a background
process manager -- a macOS `launchd` agent, a systemd unit, a supervisor, or
any client config running without a normal interactive shell -- it can hang
**indefinitely with zero output and no error**. This isn't a crash; `npx` is
stuck resolving `PATH` in an environment that doesn't provide the same shell
initialization an interactive terminal gets.

**Workaround:** if you have [Bun](https://bun.sh) installed, use `bunx`
instead of `npx`. It performs the same job -- running the package without a
local install -- but doesn't hit this hang in restricted-`PATH` environments.

```json
{
  "mcpServers": {
    "quidli-connect": {
      "command": "bunx",
      "args": ["-y", "@quidli/connect-mcp"],
      "env": {
        "CONNECT_API_KEY": "your-api-key"
      }
    }
  }
}
```

If you're spawning the process yourself (rather than through a client's MCP
config) and want to be resilient to `bunx` not being on `PATH` either,
resolve it by absolute path first:

```ts
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const BUNX_PATH = (() => {
  const candidate = join(homedir(), ".bun", "bin", "bunx");
  return existsSync(candidate) ? candidate : "bunx";
})();

const proc = spawn(BUNX_PATH, ["-y", "@quidli/connect-mcp"], {
  stdio: ["pipe", "pipe", "pipe"],
});
```

This isn't a general claim that Bun is better than npm -- it's a targeted fix
for one specific, reproducible failure mode when `npx` is spawned outside an
interactive shell.

### Wrong environment variable name for the API key

Double-check you're setting `CONNECT_API_KEY`, not `API_KEY` -- the server
only reads `CONNECT_API_KEY`, and a mismatch here fails silently: your calls
will run in anonymous/unauthenticated mode instead of erroring, which can
look like a working-but-oddly-limited connection rather than a config
mistake.

## Tools


| Tool                         | What it does                                              |
| ---------------------------- | --------------------------------------------------------- |
| `connect_get_price`          | List reference prices (no auth)                           |
| `connect_lookup`             | Resolve social identities to EVM and SOL wallet addresses |
| `connect_lookup_exposed`     | List platforms a recipient has exposed on Connect         |
| `connect_scores_batch`       | Batch scores for accounts or usernames                    |
| `connect_scores_by_account`  | Scores for one linked account                             |
| `connect_scores_by_username` | Scores by Connect username                                |
| `connect_me`                 | API key owner profile, scores, and linked accounts — **API key only** |
| `connect_drop`               | Smart Send (batch token transfer) — **API key only**      |
| `connect_drop_balance`       | Smart Send wallet balances on a chain — **API key only**  |
| `connect_agent_prompt`       | Natural-language agent for recipients discovery           |


Ask your client to use these tools when you need Connect data or actions.
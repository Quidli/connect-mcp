---
name: connect-trust
description: >-
  Create, check, revoke, and list on-chain trust attestations (EAS on Base) between
  identities, and gate Smart Send payouts with them via trustFilter on POST /drop.
  Use when the user wants to vouch for a wallet/identity, restrict payouts to a
  known set of recipients, or query who trusts whom. Composes with connect-smart-send:
  attest first, then pass trustFilter on /drop to enforce it at payout time.
compatibility: >-
  Requires HTTPS access to a Connect backend via baseURL. Write routes (create/revoke)
  need a user-owned x-api-key or Privy Bearer token with a registered Smart Send
  signer — attestations are on-chain writes and cost Base gas. Read routes
  (check/graph) accept x-api-key or x402 USDC payment, same paywall as /scores.
metadata:
  publisher: Quidli
  version: "1.0"
---

# Connect Trust (`POST /trust`, `POST /trust/check`, `GET /trust/graph`)

On-chain trust attestations (EAS on Base) from one identity to another — a caller
saying "I trust this wallet/identity," optionally scoped to a **context** string and
an expiry, at a self-chosen **level 1–100**. Used standalone (look up who trusts
whom) or composed with Smart Send to restrict a payout batch to known recipients.

Configure `baseURL` to [https://api.connect.quid.li](https://api.connect.quid.li).

## level is not graded by the API — document this expectation with the user

`level` (1–100) is stored on the attestation but **"existence is what v1 checks"**
per the API's own schema — `POST /trust/check` and the `trustFilter` on `/drop`
today only test whether an active attestation exists (and, if `context` is given,
matches it). Neither enforces a minimum `level`. There is no fixed meaning per
number — each attester defines their own scale. Example from a live attestation:
`level: 100` with `context: "co-founder @ quidli"`, and separately `level: 80` with
`context: "team:quidli"` — a convention, not an API-enforced tier. If an integration
needs level-weighted behavior (e.g. "only auto-approve up to $X at level ≥ Y"), the
calling agent must read `level` from `/trust/check` or `/trust/graph` and apply that
threshold itself.

## Identity schema

`to` / `from` / `targets` use the same discriminated recipient schema as
[connect-wallet-lookup](../connect-wallet-lookup/SKILL.md) and
[connect-smart-send](../connect-smart-send/SKILL.md): exactly one of `id` or
`username` per identity, `type` one of `wallet`, `email`, `phone`, `telegram`,
`discord`, `farcaster`, `twitter`, `github`, `linkedin`, `slack`, or `username`
(Connect profile username). Unknown socials are provisioned the same way lookup/drop
provision them — attesting trust to an identity that hasn't linked a wallet yet still
creates the attestation.

## Authentication

- **Write routes** (`POST /trust`, `POST /trust/revoke`, `DELETE /trust/{uid}`):
  `x-api-key` (server-to-server) **or** a Privy Bearer token for a Connect member
  with a registered Smart Send signer. These are on-chain EAS writes on Base —
  the caller's embedded wallet pays gas.
- **Read routes** (`POST /trust/check`, `GET /trust/graph/{platform}/{identifier}`):
  same auth/paywall as `/scores` — `x-api-key`, or **x402 USDC payment** when no key
  is provided. Swagger's Try-it cannot complete the x402 handshake — use an API key
  when testing in the docs UI.

Never expose raw API keys in chat.

## Create an attestation

`POST {baseURL}/trust`

```ts
type CreateTrustDto = {
  to: Recipient;        // identity to trust
  level: number;         // 1–100, required — self-defined meaning, see above
  context?: string;      // e.g. "team:quidli" — omit for general trust
  expiresIn?: number;    // seconds; omit for no expiration
};
```

Identical active attestations — same `(attester, to, context, level)`, Base already
confirmed — are returned without a new transaction, safe to call repeatedly. A
**different `level`** for the same `to`+`context` is NOT idempotent: it creates a
**second** attestation (new UID). The edge used by `/trust/check` and
`/trust/graph` always reflects whichever attestation is newest, so re-attesting at
a new level effectively updates what callers see, but both UIDs remain on-chain
and a revoke-by-target removes all of them.

**If the caller hasn't enabled the attestation signer yet** (a second Privy signer,
separate from the existing Smart Send drop signer — existing Smart Send users must
re-enable once to add it), `POST /trust` returns `400` `"Trust attestations are
disabled"`. Direct the user to re-enable Smart Send at connect.quid.li/smart-send.

| HTTP | Meaning |
|------|---------|
| **200** | Identical attestation already active — no new tx |
| **201** | Attestation submitted |
| **202** | Target identity still provisioning — retry |
| **400** | Invalid payload |
| **401** | Missing/invalid auth |

Response (`TrustWriteResponseDto`): `{ uid, txHash, status }` — `status` one of
`pending`, `confirmed`, `failed`, `active`.

```bash
curl -sS -X POST "https://api.connect.quid.li/trust" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${CONNECT_API_KEY}" \
  -d '{
    "to": { "type": "github", "username": "torvalds" },
    "level": 80,
    "context": "team:quidli",
    "expiresIn": 31536000
  }'
```

## Revoke

**By target** — `POST {baseURL}/trust/revoke`, body `{ to: Recipient, context?: string }`.
Revokes **all** active attestations from the caller to `to`; omit `context` to revoke
every context for that pair. Returns `TrustRevokeManyResponseDto`:
`{ uids: string[], txHashes: string[] }`. 404 if nothing active matched.

**By UID** — `DELETE {baseURL}/trust/{uid}` where `uid` is the EAS attestation UID
(from a create/graph response). 403 if the caller isn't the original attester, 404
if not found.

## Check trust (depth 1)

`POST {baseURL}/trust/check`

```ts
type CheckTrustDto = {
  from: Recipient;       // the attester / graph owner
  targets: Recipient[];  // identities to test, min 1
  context?: string;      // omit to match any context
};
```

Response (`TrustCheckResponseDto`): `{ results: [{ trusted: boolean, level, context, expiresAt }] }`
— one result per target, in order. `trusted: false` when no active attestation at
depth 1 matches (and `context` if given) — `level`/`context`/`expiresAt` are `null`
in that case.

```bash
curl -sS -X POST "https://api.connect.quid.li/trust/check" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${CONNECT_API_KEY}" \
  -d '{
    "from": { "type": "username", "id": "justinquidli" },
    "targets": [{ "type": "github", "username": "torvalds" }],
    "context": "team:quidli"
  }'
```

## List a trust graph

`GET {baseURL}/trust/graph/{platform}/{identifier}?direction=out&context=&page=&limit=`

- `platform` — a linked-account platform, or `username` for a Connect username.
- `identifier` — numeric id, handle, EVM address, or URL-encoded value per platform.
- `direction` — `out` (default, who they trust) or `in` (who trusts them).
- `context`, `page`, `limit` — optional.

Response (`TrustGraphResponseDto`): `{ edges: [{ did, address, level, context, expiresAt, uid }], total, page, limit }`.

```bash
curl -sS \
  -H "x-api-key: ${CONNECT_API_KEY}" \
  "https://api.connect.quid.li/trust/graph/github/justinquidli?direction=in"
```

## Gating Smart Send with trust

`POST /drop` ([connect-smart-send](../connect-smart-send/SKILL.md)) accepts an
optional `trustFilter` on the request body:

```ts
trustFilter?: {
  mode: "require" | "skip"; // require = fail the whole drop if anyone is outside the graph; skip = silently drop them, pay the rest
  context?: string;          // restrict to this attestation context; omit to match any
};
```

This filters by **graph membership only** (same existence check as `/trust/check`),
not by `level`. Use it to stop an agent from paying out to a wallet nobody vouched
for — attest first (`POST /trust`), then include `trustFilter` on the `/drop` call.

```bash
curl -sS -X POST "https://api.connect.quid.li/drop" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${CONNECT_API_KEY}" \
  -d '{
    "idempotencyKey": "b3f1c2a0-...-uuid",
    "chainId": 8453,
    "tokenContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amountInWeiPerRecipient": "1000000",
    "recipients": [{ "type": "github", "username": "torvalds" }],
    "trustFilter": { "mode": "require", "context": "team:quidli" }
  }'
```

## MCP tool mapping

| MCP tool | REST route |
|----------|------------|
| `connect_trust_create` | `POST /trust` |
| `connect_trust_revoke` | `POST /trust/revoke` (by target, not by UID — `DELETE /trust/{uid}` has no MCP tool) |
| `connect_trust_check` | `POST /trust/check` |
| `connect_trust_graph` | `GET /trust/graph/{platform}/{identifier}` |
| — (no dedicated MCP tool) | `trustFilter` on `connect_drop` / `POST /drop` — pass it directly on the drop call |

## Agent rules

1. Attestations are on-chain writes (EAS on Base) and cost gas from the caller's
   embedded wallet — confirm with the user before `connect_trust_create` or a revoke,
   same as any Smart Send action.
2. `level` has no API-enforced meaning — don't present a created attestation's level
   as a graded/verified score. If the user wants level-weighted gating, that logic
   belongs in the calling agent, not assumed from the API.
3. `trustFilter` on `/drop` checks graph membership (and `context` if set) only — it
   does not look at `level`. Say so if the user expects a level threshold.
4. Prefer `mode: "skip"` when a partial payout to the trusted subset is acceptable;
   use `mode: "require"` when the whole batch should fail rather than silently drop
   someone.
5. Creating an identical active attestation is idempotent (200, no new tx) — safe to
   re-attest without checking first.
6. Never expose raw API keys in chat.

## Further reading

- Smart Send / payout gating: [connect-smart-send/SKILL.md](../connect-smart-send/SKILL.md)
- Reputation scores (separate from trust — computed, not attested): [connect-scores/SKILL.md](../connect-scores/SKILL.md)

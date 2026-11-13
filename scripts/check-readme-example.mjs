#!/usr/bin/env node
//
// check-readme-example.mjs
//
// Fails the build when a README's worked example no longer matches what the
// live server returns.
//
// The README's flagship example is simultaneously the npm package page, the
// Glama listing, the Smithery listing and the public repo landing page. When a
// hardcoded response in it drifts, it drifts on all four at once and nothing
// says so. That already happened: the Solana address in the published example
// stopped resolving and went unnoticed.
//
// Usage:
//   node scripts/check-readme-example.mjs [README.md] [--update]
//
// Exit codes:
//   0  example matches, or the server could not be reached
//   1  the server answered and the answer differs from the README
//   2  the README is malformed, or the marked block is missing
//
// An unreachable server exits 0 on purpose. Blocking a release because the
// network blipped trains people to pass --no-verify; blocking it because the
// documented output is wrong is the entire point.

import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

// The marked region looks like this in the README. The config lives in the
// opening HTML comment, invisible to readers; the fenced block beneath it is
// the example people actually see, and is what gets compared. So the check
// validates the rendered documentation rather than a parallel copy of it.
//
//   <!-- connect-example:start
//   {"tool":"connect_lookup","arguments":{...},"compare":["results.0.ethWalletAddress"]}
//   -->
//   ```json
//   { "status": "completed", "results": [ ... ] }
//   ```
//   <!-- connect-example:end -->
const START_RE = /<!--\s*connect-example:start\s*([\s\S]*?)-->/;
const END = '<!-- connect-example:end -->';
const DEFAULT_URL = process.env.CONNECT_MCP_URL ?? 'https://mcp.connect.quid.li/';
const TIMEOUT_MS = Number(process.env.CONNECT_TIMEOUT_MS ?? 20000);

const args = process.argv.slice(2);
const update = args.includes('--update');
const readmePath = args.find((a) => !a.startsWith('--')) ?? 'README.md';

/** @param {string} msg */
const fail = (msg, code = 2) => {
  console.error(`✖ ${msg}`);
  process.exit(code);
};

const readme = await readFile(readmePath, 'utf8').catch(() => fail(`cannot read ${readmePath}`));

const startMatch = readme.match(START_RE);
const endAt = readme.indexOf(END);

if (!startMatch || endAt === -1 || endAt < startMatch.index) {
  fail(
    `${readmePath} has no marked example block.\n` +
      `  Expected:\n` +
      `    <!-- connect-example:start\n` +
      `    {"tool":"connect_lookup","arguments":{...},"compare":["results.0.ethWalletAddress"]}\n` +
      `    -->\n` +
      '    ```json\n    { ...the response readers see... }\n    ```\n' +
      `    ${END}`,
  );
}

let spec;
try {
  spec = JSON.parse(startMatch[1].trim());
} catch (err) {
  fail(`the config in the opening comment does not parse: ${err.message}`);
}

if (!spec.tool || !spec.arguments) fail('the config needs "tool" and "arguments" keys');

const blockStart = startMatch.index + startMatch[0].length;
const block = readme.slice(blockStart, endAt);
const fence = block.match(/```json\s*\n([\s\S]*?)```/);
if (!fence) fail('the marked block contains no ```json fence for the example response');

try {
  spec.result = JSON.parse(fence[1]);
} catch (err) {
  fail(`the example response in the README does not parse as JSON: ${err.message}`);
}

// ---- call the live server ----------------------------------------------

// A lookup for an identity that is not warm in the cache answers
// `status: "processing"` and resolves on a later call. Retry before concluding
// anything: comparing against a processing response would fail the build on a
// cold cache rather than on real drift, which is the fastest way to get a
// check like this disabled.
const ATTEMPTS = Number(process.env.CONNECT_ATTEMPTS ?? 5);
const RETRY_MS = Number(process.env.CONNECT_RETRY_MS ?? 3000);

let payload;

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let text;
  try {
    const res = await fetch(DEFAULT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: attempt,
        method: 'tools/call',
        params: { name: spec.tool, arguments: spec.arguments },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`⚠ ${DEFAULT_URL} returned HTTP ${res.status}; skipping the README check`);
      process.exit(0);
    }
    text = await res.text();
  } catch (err) {
    console.warn(`⚠ could not reach ${DEFAULT_URL} (${err.message}); skipping the README check`);
    process.exit(0);
  } finally {
    clearTimeout(timer);
  }

  payload = parseRpc(text);

  const status = unwrap(payload?.result)?.status;
  if (status !== 'processing') break;

  if (attempt === ATTEMPTS) {
    console.warn(
      `⚠ ${spec.tool} still answered "processing" after ${ATTEMPTS} attempts; skipping the README check.\n` +
        `  If this recurs, the example identity is not reliably warm and is a poor choice for the README.`,
    );
    process.exit(0);
  }

  console.warn(`… "processing" (attempt ${attempt}/${ATTEMPTS}), retrying in ${RETRY_MS}ms`);
  await new Promise((r) => setTimeout(r, RETRY_MS));
}

if (payload?.error) {
  // A protocol-level error is a real failure: the documented call itself is
  // no longer valid, which is exactly the drift this guards against.
  fail(`${spec.tool} rejected the documented arguments: ${payload.error.message}`, 1);
}

const live = unwrap(payload?.result);

if (payload?.result?.isError) {
  fail(`${spec.tool} returned an error for the documented arguments: ${JSON.stringify(live)}`, 1);
}

// ---- compare -------------------------------------------------------------

const picked = spec.compare ? pick(live, spec.compare) : live;
const expectedPicked = spec.compare ? pick(spec.result, spec.compare) : spec.result;

if (update) {
  // Rewrite the fence with the live response, leaving every other byte of the
  // README untouched.
  const next =
    readme.slice(0, blockStart) +
    block.replace(fence[1], `${JSON.stringify(live, null, 2)}\n`) +
    readme.slice(endAt);
  await writeFile(readmePath, next);
  console.log(`✔ updated the example response in ${readmePath}`);
  process.exit(0);
}

if (JSON.stringify(picked) !== JSON.stringify(expectedPicked)) {
  console.error(`✖ ${readmePath}: the documented example no longer matches the live server.\n`);
  console.error(`  tool:      ${spec.tool}`);
  console.error(`  arguments: ${JSON.stringify(spec.arguments)}\n`);
  console.error(`  README says: ${JSON.stringify(expectedPicked)}`);
  console.error(`  server says: ${JSON.stringify(picked)}\n`);
  console.error(`  This README is the npm page, the Glama listing, the Smithery listing and the`);
  console.error(`  repo landing page. Fix it, or re-record with: node ${process.argv[1]} ${readmePath} --update`);
  process.exit(1);
}

console.log(`✔ ${readmePath}: example matches the live server`);

// ---- helpers -------------------------------------------------------------

function parseRpc(body) {
  const t = body.trim();
  if (t.startsWith('{') || t.startsWith('[')) return JSON.parse(t);
  for (const line of t.split('\n')) {
    if (line.startsWith('data:')) {
      const d = line.slice(5).trim();
      if (d && d !== '[DONE]') {
        try {
          return JSON.parse(d);
        } catch {}
      }
    }
  }
  fail(`unrecognised response body: ${t.slice(0, 200)}`);
}

function unwrap(result) {
  if (result && typeof result === 'object' && 'structuredContent' in result) return result.structuredContent;
  const parts = Array.isArray(result?.content) ? result.content : [];
  const text = parts.filter((p) => p?.type === 'text' && typeof p.text === 'string').map((p) => p.text).join('\n');
  if (!text) return result;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Compare only the fields the README actually shows. Without this, every
 * unrelated field the server adds — a new meta key, a timestamp — turns into a
 * red build and the check gets switched off within a month.
 *
 * `compare` is a list of dotted paths, e.g. ["results.0.ethWalletAddress"].
 */
function pick(value, paths) {
  const out = {};
  for (const path of paths) {
    let cur = value;
    for (const seg of path.split('.')) {
      cur = cur == null ? undefined : cur[seg];
    }
    out[path] = cur;
  }
  return out;
}

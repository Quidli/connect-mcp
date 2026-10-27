#!/usr/bin/env node
/**
 * Scheduled health check for the published @quidli/connect-mcp package.
 *
 * Speaks raw JSON-RPC over the stdio transport against the installed binary -
 * no MCP SDK, so the check never passes or fails for reasons of its own
 * dependency tree. Asserts the server initializes, lists its tools, and that
 * the keyless tools still answer.
 *
 * Exits non-zero on any failure so the workflow goes red.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const TIMEOUT_MS = 60_000;

// Tools the published package is expected to expose. A missing name means a
// regression; an unexpected extra one is reported but does not fail the run,
// so adding a tool never breaks the schedule.
const EXPECTED_TOOLS = [
  'connect_get_price',
  'connect_get_chains',
  'connect_lookup',
  'connect_lookup_exposed',
  'connect_scores_batch',
  'connect_scores_by_account',
  'connect_scores_by_username',
  'connect_me',
  'connect_drop',
  'connect_drop_balance',
  'connect_trust_create',
  'connect_trust_revoke',
  'connect_trust_check',
  'connect_trust_graph',
];

function resolveBin() {
  // The package restricts "exports", so require.resolve('.../package.json')
  // throws ERR_PACKAGE_PATH_NOT_EXPORTED. Read the installed manifest off disk
  // instead and take the bin path from it, so this keeps working if the entry
  // point is ever renamed.
  const fs = require('fs');
  const path = require('path');
  const pkgDir = path.join(process.cwd(), 'node_modules', '@quidli', 'connect-mcp');
  const manifest = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(manifest)) {
    throw new Error(`@quidli/connect-mcp is not installed at ${pkgDir}`);
  }
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.['connect-mcp'];
  if (!bin) throw new Error('package.json declares no connect-mcp bin entry');
  const entry = path.join(pkgDir, bin);
  if (!fs.existsSync(entry)) throw new Error(`bin entry missing on disk: ${entry}`);
  return { version: pkg.version, entry };
}

function rpc(child, id, method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
}

async function run() {
  const { entry, version } = resolveBin();
  console.log(`testing @quidli/connect-mcp@${version}`);
  const child = spawn(process.execPath, [entry], {
    stdio: ['pipe', 'pipe', 'pipe'],
    // No CONNECT_API_KEY: initialize, tools/list and the keyless tools must all
    // work without one. That is the quickstart path, so it is what we test.
    env: { ...process.env, CONNECT_API_KEY: '' },
  });

  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  const pending = new Map();
  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const resolve = pending.get(msg.id);
      if (resolve) { pending.delete(msg.id); resolve(msg); }
    }
  });

  // If the server process dies, every in-flight call must reject - otherwise the
  // event loop empties, node exits 0, and a dead server reads as a pass.
  let childExit = null;
  const exited = new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      childExit = { code, signal };
      resolve(childExit);
    });
    child.on('error', (err) => {
      childExit = { code: null, signal: null, err };
      resolve(childExit);
    });
  });

  const call = (id, method, params) => new Promise((resolve, reject) => {
    let timer;
    const settle = (fn) => (v) => { clearTimeout(timer); pending.delete(id); fn(v); };
    const ok = settle(resolve);
    const fail = settle(reject);
    pending.set(id, ok);
    timer = setTimeout(() => fail(new Error(`timed out waiting for ${method}`)), TIMEOUT_MS);
    exited.then((info) => fail(new Error(
      `server exited before answering ${method} (code=${info.code}, signal=${info.signal}` +
      (info.err ? `, error=${info.err.message}` : '') + ')',
    )));
    if (childExit) {
      fail(new Error(`server already exited (code=${childExit.code})`));
      return;
    }
    rpc(child, id, method, params);
  });

  const failures = [];
  try {
    const init = await call(1, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'connect-mcp-smoke-test', version: '1.0.0' },
    });
    if (init.error) failures.push(`initialize returned an error: ${JSON.stringify(init.error)}`);
    const serverName = init.result?.serverInfo?.name;
    console.log(`initialize ok - server: ${serverName} ${init.result?.serverInfo?.version ?? ''}`);

    const listed = await call(2, 'tools/list', {});
    if (listed.error) failures.push(`tools/list returned an error: ${JSON.stringify(listed.error)}`);
    const names = (listed.result?.tools ?? []).map((t) => t.name).sort();
    console.log(`tools/list ok - ${names.length} tools`);

    const missing = EXPECTED_TOOLS.filter((t) => !names.includes(t));
    const extra = names.filter((t) => !EXPECTED_TOOLS.includes(t));
    if (missing.length) failures.push(`missing expected tools: ${missing.join(', ')}`);
    if (extra.length) console.log(`note: tools present but not in the expected list: ${extra.join(', ')}`);

    // Keyless call: connect_get_price needs no API key and no network writes.
    const priced = await call(3, 'tools/call', { name: 'connect_get_price', arguments: {} });
    if (priced.error) {
      failures.push(`connect_get_price returned an error: ${JSON.stringify(priced.error)}`);
    } else if (priced.result?.isError) {
      failures.push(`connect_get_price reported isError: ${JSON.stringify(priced.result?.content)}`);
    } else {
      console.log('connect_get_price ok (keyless)');
    }
  } catch (err) {
    failures.push(err instanceof Error ? err.message : String(err));
  } finally {
    if (!childExit) child.kill('SIGTERM');
  }

  if (failures.length) {
    console.error('\nSMOKE TEST FAILED');
    for (const f of failures) console.error(`  - ${f}`);
    if (stderr.trim()) console.error(`\nserver stderr:\n${stderr.trim()}`);
    process.exit(1);
  }
  console.log('\nSMOKE TEST PASSED');
}

run().catch((err) => { console.error(err); process.exit(1); });

#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { compileRclWebApplication, emitStandaloneRclWebHtml, emitStandaloneRclWebServer } from '../src/web-application-compiler.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function check(checks, name, condition, detail = null) { checks[name] = { pass: Boolean(condition), ...(detail === null ? {} : { detail }) }; }
async function requestJson(baseUrl, pathname, options = {}) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${pathname}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers ?? {}) } });
  const body = await response.json();
  return { status: response.status, body, elapsedMs: performance.now() - started };
}

export async function verifyK04ServerCandidate({ sourcePath, specPath }) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const specSource = fs.readFileSync(specPath, 'utf8');
  const checks = {};
  let server;
  let directory;
  let error = null;
  let manifestRoot = null;
  let transactionElapsedMs = null;
  try {
    const manifest = compileRclWebApplication(source, JSON.parse(specSource));
    manifestRoot = manifest.manifestRoot;
    check(checks, 'program-identity', manifest.program === 'K02CompleteWebApp');
    check(checks, 'authority-binding', manifest.warrants.some((warrant) => warrant.subject === 'user' && warrant.capability === 'app.write' && warrant.target === 'app')
      && manifest.rules.every((rule) => rule.needs.some((need) => need.capability === 'app.write' && need.target === 'app')));
    const html = emitStandaloneRclWebHtml(manifest);
    const serverSource = emitStandaloneRclWebServer(manifest, html);
    check(checks, 'server-surface', serverSource.includes('/api/state') && serverSource.includes('/api/observe') && serverSource.includes('/api/rule/'));
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k04-server-verify-'));
    const serverPath = path.join(directory, 'candidate.server.mjs');
    fs.writeFileSync(serverPath, serverSource, 'utf8');
    const module = await import(`${pathToFileURL(serverPath).href}?root=${manifestRoot}`);
    server = module.server;
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const initial = await requestJson(baseUrl, '/api/state');
    const observed = await requestJson(baseUrl, '/api/observe', { method: 'POST', body: JSON.stringify({ path: 'app.todo_input', value: 'server-candidate' }) });
    const started = performance.now();
    const added = await requestJson(baseUrl, '/api/rule/addTodo', { method: 'POST', body: '{}' });
    const reset = await requestJson(baseUrl, '/api/rule/resetTodos', { method: 'POST', body: '{}' });
    transactionElapsedMs = performance.now() - started;
    check(checks, 'initial-state', initial.status === 200 && initial.body.state['app.todo_count'] === 0 && initial.body.state['app.last_action'] === 'boot');
    check(checks, 'observe-state', observed.status === 200 && observed.body.state['app.todo_input'] === 'server-candidate');
    check(checks, 'add-transaction', added.status === 200 && added.body.state['app.todo_count'] === 1 && added.body.state['app.todo_input'] === '' && added.body.state['app.last_action'] === 'server-candidate');
    check(checks, 'reset-transaction', reset.status === 200 && reset.body.state['app.todo_count'] === 0 && reset.body.state['app.last_action'] === 'reset');
    const unknownState = await requestJson(baseUrl, '/api/observe', { method: 'POST', body: JSON.stringify({ path: 'app.missing', value: 'x' }) });
    const unknownRule = await requestJson(baseUrl, '/api/rule/missing', { method: 'POST', body: '{}' });
    check(checks, 'unknown-state-rejection', unknownState.status === 404 && unknownState.body.error === 'RCL_WEB_OBSERVE_UNKNOWN');
    check(checks, 'unknown-rule-rejection', unknownRule.status === 400 && String(unknownRule.body.error).includes('RCL_WEB_RULE_UNKNOWN:missing'));
  } catch (caught) { error = String(caught?.stack ?? caught); }
  finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  }
  const pass = error === null && Object.values(checks).length === 9 && Object.values(checks).every((item) => item.pass);
  const payload = { format: 'rcl.k04.server-candidate-verification.v0.1', status: pass ? 'PASS' : 'FAIL', sourceSha256: sha256(source), specSha256: sha256(specSource), manifestRoot, transactionElapsedMs, checks, error };
  return { ...payload, reportRoot: evidenceRoot(payload) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await verifyK04ServerCandidate({
    sourcePath: path.resolve(process.argv[2] ?? path.join(ROOT, 'examples', 'universal-stress', 'k02-complete-web-app.rcl')),
    specPath: path.resolve(process.argv[3] ?? path.join(ROOT, 'examples', 'universal-stress', 'k02-complete-web-app.web.json')),
  });
  console.log(JSON.stringify(result));
  if (result.status !== 'PASS') process.exitCode = 1;
}

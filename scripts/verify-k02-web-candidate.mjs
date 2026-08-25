#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

import {
  compileRclWebApplication,
  emitStandaloneRclWebHtml,
  emitStandaloneRclWebServer,
} from '../src/web-application-compiler.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function check(checks, name, condition, detail = null) {
  checks[name] = { pass: Boolean(condition), ...(detail === null ? {} : { detail }) };
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json();
  return { status: response.status, body };
}

export async function verifyK02WebCandidate({ sourcePath, specPath }) {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const specSource = fs.readFileSync(specPath, 'utf8');
  const checks = {};
  let server;
  let directory;
  let error = null;
  let manifestRoot = null;

  try {
    const spec = JSON.parse(specSource);
    const manifest = compileRclWebApplication(source, spec);
    manifestRoot = manifest.manifestRoot;
    const html = emitStandaloneRclWebHtml(manifest);
    check(checks, 'program-identity', manifest.program === 'K02CompleteWebApp');
    check(checks, 'initial-state', manifest.state['app.todo_count'] === 0
      && manifest.state['app.todo_input'] === ''
      && manifest.state['app.last_action'] === 'boot');
    check(checks, 'authority-binding', manifest.warrants.some((warrant) => warrant.subject === 'user'
      && warrant.capability === 'app.write'
      && warrant.target === 'app')
      && manifest.rules.every((rule) => rule.needs.some((need) => need.capability === 'app.write' && need.target === 'app')));
    check(checks, 'reactive-html-binding', /<input[^>]*data-rcl-value="app\.todo_input"[^>]*data-rcl-observe="app\.todo_input"[^>]*>/u.test(html)
      && html.includes('data-rcl-text="app.todo_count"'));
    check(checks, 'rule-html-binding', html.includes('data-rcl-rule="addTodo"')
      && html.includes('data-rcl-rule="resetTodos"'));
    check(checks, 'server-surface', emitStandaloneRclWebServer(manifest, html).includes('/api/rule/'));

    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-k02-web-verify-'));
    const serverPath = path.join(directory, 'candidate.server.mjs');
    fs.writeFileSync(serverPath, emitStandaloneRclWebServer(manifest, html), 'utf8');
    const module = await import(`${pathToFileURL(serverPath).href}?root=${manifest.manifestRoot}`);
    server = module.server;
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const initial = await requestJson(baseUrl, '/api/state');
    const observed = await requestJson(baseUrl, '/api/observe', {
      method: 'POST',
      body: JSON.stringify({ path: 'app.todo_input', value: 'independent-repair' }),
    });
    const added = await requestJson(baseUrl, '/api/rule/addTodo', { method: 'POST', body: '{}' });
    const reset = await requestJson(baseUrl, '/api/rule/resetTodos', { method: 'POST', body: '{}' });
    check(checks, 'server-initial-state', initial.status === 200
      && initial.body.state['app.todo_count'] === 0);
    check(checks, 'server-observe', observed.status === 200
      && observed.body.state['app.todo_input'] === 'independent-repair');
    check(checks, 'server-add-rule', added.status === 200
      && added.body.state['app.todo_count'] === 1
      && added.body.state['app.todo_input'] === ''
      && added.body.state['app.last_action'] === 'independent-repair');
    check(checks, 'server-reset-rule', reset.status === 200
      && reset.body.state['app.todo_count'] === 0
      && reset.body.state['app.last_action'] === 'reset');
  } catch (caught) {
    error = String(caught?.stack ?? caught);
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    if (directory) fs.rmSync(directory, { recursive: true, force: true });
  }

  const pass = error === null && Object.values(checks).length >= 10
    && Object.values(checks).every((item) => item.pass);
  const payload = {
    format: 'rcl.k02.web-candidate-verification.v0.1',
    status: pass ? 'PASS' : 'FAIL',
    sourceSha256: sha256(source),
    specSha256: sha256(specSource),
    manifestRoot,
    checks,
    error,
  };
  return { ...payload, reportRoot: evidenceRoot(payload) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const sourcePath = path.resolve(process.argv[2] ?? path.join(ROOT, 'examples', 'universal-stress', 'k02-complete-web-app.rcl'));
  const specPath = path.resolve(process.argv[3] ?? path.join(ROOT, 'examples', 'universal-stress', 'k02-complete-web-app.web.json'));
  const result = await verifyK02WebCandidate({ sourcePath, specPath });
  console.log(JSON.stringify(result));
  if (result.status !== 'PASS') process.exitCode = 1;
}

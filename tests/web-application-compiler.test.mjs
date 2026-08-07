import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRclWebApplication, emitStandaloneRclWebHtml, emitStandaloneRclWebServer } from '../src/web-application-compiler.mjs';
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source=fs.readFileSync(path.join(ROOT,'examples/universal-stress/k02-complete-web-app.rcl'),'utf8');
const spec=JSON.parse(fs.readFileSync(path.join(ROOT,'examples/universal-stress/k02-complete-web-app.web.json'),'utf8'));

test('K02 compiler lowers RCL state, authority and rules into a rooted web manifest',()=>{
  const manifest=compileRclWebApplication(source,spec);
  assert.equal(manifest.program,'K02CompleteWebApp');
  assert.equal(manifest.state['app.todo_count'],0);
  assert.equal(manifest.rules.length,2);
  assert.deepEqual(manifest.rules[0].needs,[{capability:'app.write',target:'app'}]);
  assert.equal(manifest.warrants[0].subject,'user');
  assert.match(manifest.manifestRoot,/^[0-9a-f]{64}$/u);
});

test('K02 HTML output contains structural markup, CSS and RCL event bindings',()=>{
  const html=emitStandaloneRclWebHtml(compileRclWebApplication(source,spec));
  assert.match(html,/<!doctype html>/u);
  assert.match(html,/data-rcl-observe="app\.todo_input"/u);
  assert.match(html,/data-rcl-rule="addTodo"/u);
  assert.match(html,/\.card\{/u);
  assert.match(html,/window\.RCLWeb/u);
});

test('unsupported non-literal initialization fails closed',()=>{
  const bad=source.replace('facet app.todo_count : Number = 0','facet app.todo_count : Number = 1 + 1');
  assert.throws(()=>compileRclWebApplication(bad,spec),/RCL_WEB_NON_LITERAL_INITIAL_FACET/u);
});

test('K02 emits a Node HTTP/API server from the same RCL web manifest',()=>{
  const manifest=compileRclWebApplication(source,spec);
  const server=emitStandaloneRclWebServer(manifest);
  assert.match(server,/createServer/);
  assert.match(server,/\/api\/state/);
  assert.match(server,/\/api\/observe/);
  assert.match(server,/\/api\/rule\//);
});

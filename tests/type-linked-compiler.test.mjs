import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  compileReality,
  tryCompileReality,
  runTypeLinkedCompilerDemo,
} from '../src/index.mjs';

const typeModuleSources = {
  'core.rcltype': `module core
export record User<T> {
  id: Text
  payload: T
}
export alias MaybeUser = Option<User<Text>>`,
};

const typedReality = `reality TypedLinkedApp {
  facet app.currentUser : core.User<Text> = "proxy-user"
  facet app.maybeUser : MaybeUser = "proxy-maybe"
}`;

test('P3 typed compiler links .rcl facet declarations to .rcltype semantic IR', () => {
  const result = tryCompileReality(typedReality, { typeModuleSources });
  assert.equal(result.ok, true);
  assert.equal(result.program.typeModules.format, 'rcl.type-module.semantic-ir.v0.29');
  assert.equal(result.program.semanticMap.format, 'rcl.typed-compiler.semantic-map.v0.34');
  assert.equal(result.program.semanticMap.typedFacetCount, 2);
  assert.equal(result.program.typeBindings.facets['app.currentUser'].canonicalType, 'core::User<Text>');
  assert.equal(result.program.typeBindings.facets['app.maybeUser'].canonicalType, 'core::MaybeUser');
  assert.equal(result.program.sourceMap.facets['app.currentUser'].location.line, 2);
  assert.match(result.program.programRoot, /^[0-9a-f]{64}$/);
});

test('P3 typed compiler keeps legacy compileReality path working without type modules', () => {
  const untyped = compileReality('reality Legacy { facet world.ready : Truth = true }');
  assert.equal(untyped.typeModules, null);
  assert.equal(untyped.semanticMap.facets['world.ready'].canonicalType, 'Truth');
});

test('P3 typed compiler rejects custom .rcl types when the linked .rcltype graph is absent', () => {
  const result = tryCompileReality(typedReality);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_TYPE_UNKNOWN'));
});

test('P3 typed compiler diagnoses arity mismatches through the linked type module graph', () => {
  const result = tryCompileReality('reality BadTypedApp { facet app.bad : core.User<Text, Number> = "proxy" }', { typeModuleSources });
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(item => item.code === 'RCL_TYPE_ARITY_MISMATCH'));
});

test('P3 typed compiler CLI exposes demo and compile-typed report', () => {
  const cwd = new URL('..', import.meta.url);
  const demoOut = execFileSync('node', ['src/cli.mjs', 'type-linked-demo'], { cwd, encoding: 'utf8' });
  const demo = JSON.parse(demoOut);
  assert.equal(demo.ok, true);
  assert.equal(demo.typedFacetCount, 2);
  assert.equal(demo.currentUserCanonicalType, 'core::User<Text>');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-typed-compile-'));
  fs.writeFileSync(path.join(dir, 'core.rcltype'), typeModuleSources['core.rcltype']);
  const rclPath = path.join(dir, 'app.rcl');
  const reportPath = path.join(dir, 'typed-report.json');
  fs.writeFileSync(rclPath, typedReality);
  const out = execFileSync('node', ['src/cli.mjs', 'compile-typed', rclPath, dir, reportPath], { cwd, encoding: 'utf8' });
  const report = JSON.parse(out);
  assert.equal(report.ok, true);
  assert.equal(report.semanticMap.typedFacetCount, 2);
  assert.equal(fs.existsSync(reportPath), true);
  assert.equal(JSON.parse(fs.readFileSync(reportPath, 'utf8')).typeBindings.facets['app.maybeUser'].canonicalType, 'core::MaybeUser');
});

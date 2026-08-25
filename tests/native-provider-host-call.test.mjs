import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { compileRealityToBytecode, decodeBytecode, tryCompileRealityToBytecode } from '../src/index.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROVIDER_DEMO = path.join(PACKAGE_ROOT, 'native', process.platform === 'win32' ? 'provider_demo.exe' : 'provider_demo');

function nativeRun(source) {
  const output = path.join(os.tmpdir(), `rcl-native-provider-host-call-${process.pid}-${Date.now()}.rbc`);
  fs.writeFileSync(output, compileRealityToBytecode(source));
  try {
    return spawnSync(PROVIDER_DEMO, [output], { encoding: 'utf8' });
  } finally {
    fs.rmSync(output, { force: true });
  }
}

test('rule-level native host call lowers after warrant check and records provider evidence', () => {
  const source = fs.readFileSync(path.join(PACKAGE_ROOT, 'examples', 'native-provider-host-call.rcl'), 'utf8');
  const decoded = decodeBytecode(compileRealityToBytecode(source));
  const names = decoded.instructions.map(instruction => instruction.name);
  assert.ok(names.indexOf('CHECK_WARRANT') < names.indexOf('CALL_PROVIDER'));
  assert.ok(names.indexOf('CALL_PROVIDER') < names.indexOf('COMMIT_TX'));

  const run = nativeRun(source);
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.match(result.state['provider.reply'], /hello-provider-host-call/);
  assert.equal(result.history[0].authority.needs[0].capability, 'computer.invoke');
  assert.equal(result.history[0].authority.activeWarrants[0].target, 'echo');
  assert.deepEqual(result.history[0].witnesses, ['rcl:native-provider-host-call']);
  assert.equal(result.history[0].hostCalls[0].providerId, 'echo');
  assert.equal(result.history[0].hostCalls[0].capability, 'text');
  assert.equal(result.history[0].hostCalls[0].requestJson, '{"message":"hello-provider-host-call"}');
  assert.match(result.history[0].hostCalls[0].requestRoot, /^[0-9a-f]{64}$/);
  assert.equal(result.history[0].changes[0].source, 'host:echo.text');
});

test('missing warrant is rejected before native bytecode emission', () => {
  const source = `reality DeniedProviderCall {
    facet provider.reply : Text = "none"
    host echo { offers text -> Text }
    subject intruder { }
    emergence observe {
      cause intruder
      when provider.reply == "none"
      needs computer.invoke on echo
      call echo.text("{}") -> provider.reply
    }
    realize observe
  }`;
  const denied = tryCompileRealityToBytecode(source);
  assert.equal(denied.ok, false);
  assert.ok(denied.diagnostics.some(item => item.code === 'RCL_WARRANT_MISSING'), JSON.stringify(denied.diagnostics));
});

test('missing native provider fails without a committed result', () => {
  const source = `reality MissingProvider {
    facet provider.reply : Text = "none"
    subject operator { warrant computer.invoke on absent }
    host absent { offers text -> Text }
    emergence observe {
      cause operator
      when provider.reply == "none"
      needs computer.invoke on absent
      call absent.text("{}") -> provider.reply
    }
    realize observe
  }`;
  const run = nativeRun(source);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /RCL_NATIVE_PROVIDER_MISSING/);
  assert.equal(run.stdout, '');
});

test('foresee and non-literal Text request shapes remain fail-closed', () => {
  const foresee = tryCompileRealityToBytecode(`reality UnsupportedSimulation {
    facet provider.reply : Text = "none"
    subject operator { warrant computer.invoke on echo }
    host echo { offers text -> Text }
    emergence observe {
      cause operator
      when provider.reply == "none"
      needs computer.invoke on echo
      call echo.text("{}") -> provider.reply
    }
    foresee observe
  }`);
  assert.equal(foresee.ok, false);
  assert.ok(
    foresee.diagnostics.some(item => item.code === 'RCL_NATIVE_HOST_CALL_FORESEE_UNSUPPORTED'),
    JSON.stringify(foresee.diagnostics),
  );

  const wrongType = tryCompileRealityToBytecode(`reality WrongRequestType {
    facet provider.reply : Text = "none"
    subject operator { warrant computer.invoke on echo }
    host echo { offers text -> Text }
    emergence observe {
      cause operator
      when provider.reply == "none"
      needs computer.invoke on echo
      call echo.text(7) -> provider.reply
    }
    realize observe
  }`);
  assert.equal(wrongType.ok, false);
  assert.ok(
    wrongType.diagnostics.some(item => item.code === 'RCL_NATIVE_HOST_CALL_REQUEST_TYPE'),
    JSON.stringify(wrongType.diagnostics),
  );

  const dynamicRequest = tryCompileRealityToBytecode(`reality DynamicRequest {
    facet provider.reply : Text = "none"
    facet provider.request : Text = "{}"
    subject operator { warrant computer.invoke on echo }
    host echo { offers text -> Text }
    emergence observe {
      cause operator
      when provider.reply == "none"
      needs computer.invoke on echo
      call echo.text(provider.request) -> provider.reply
    }
    realize observe
  }`);
  assert.equal(dynamicRequest.ok, false);
  assert.ok(
    dynamicRequest.diagnostics.some(item => item.code === 'RCL_NATIVE_HOST_CALL_REQUEST_TYPE'),
    JSON.stringify(dynamicRequest.diagnostics),
  );
});

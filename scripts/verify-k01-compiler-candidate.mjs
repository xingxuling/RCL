#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function check(checks, name, condition, detail = null) {
  checks[name] = { pass: Boolean(condition), ...(detail === null ? {} : { detail }) };
}

export function verifyK01CompilerCandidate({ corePath, mainPath }) {
  const core = fs.readFileSync(corePath, 'utf8');
  const main = fs.readFileSync(mainPath, 'utf8');
  const source = `${core}\n${main}`;
  const checks = {};
  let error = null;
  let compilerArtifactSha256 = null;

  try {
    const mappings = [
      ['add-opcode', /choose\(operator == "\+", 6,/u],
      ['subtract-opcode', /choose\(operator == minus_operator\(\), 7,/u],
      ['multiply-opcode', /choose\(operator == "\*", 8,/u],
      ['divide-opcode', /choose\(operator == "\/", 9,/u],
      ['equal-opcode', /choose\(operator == "==", 10,/u],
      ['not-equal-opcode', /choose\(operator == "!=", 11,/u],
      ['less-opcode', /choose\(operator == "<", 12,/u],
      ['less-equal-opcode', /choose\(operator == "<=", 13,/u],
      ['greater-opcode', /choose\(operator == ">", 14,/u],
      ['greater-equal-and-fallback', /choose\(operator == ">=", 15, 44\)/u],
    ];
    check(checks, 'single-binary-opcode-definition', (core.match(/reckon binary_opcode\(operator : Text\) -> Number =/gu) ?? []).length === 1);
    for (const [name, pattern] of mappings) check(checks, name, pattern.test(core));
    check(checks, 'main-entrypoint', /facet compiler\.source : Text = provider_call\("compiler_input", "source", "\{\}"\)/u.test(main)
      && /facet compiler\.output : Sequence = encode_rbc\(/u.test(main));
    const artifact = Buffer.from(compileRealityToBytecode(source));
    compilerArtifactSha256 = sha256(artifact);
    check(checks, 'compiler-artifact-emitted', artifact.length > 0, artifact.length);
  } catch (caught) {
    error = String(caught?.stack ?? caught);
  }

  const pass = error === null && Object.values(checks).length === 13
    && Object.values(checks).every((item) => item.pass);
  const payload = {
    format: 'rcl.k01.compiler-candidate-verification.v0.1',
    status: pass ? 'PASS' : 'FAIL',
    coreSha256: sha256(core),
    mainSha256: sha256(main),
    compilerArtifactSha256,
    checks,
    error,
  };
  return { ...payload, reportRoot: evidenceRoot(payload) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK01CompilerCandidate({
    corePath: path.resolve(process.argv[2] ?? path.join(ROOT, 'selfhost', 'compiler-core.rcl')),
    mainPath: path.resolve(process.argv[3] ?? path.join(ROOT, 'selfhost', 'compiler-main.rcl')),
  });
  console.log(JSON.stringify(result));
  if (result.status !== 'PASS') process.exitCode = 1;
}

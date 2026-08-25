#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { evidenceRoot } from '../src/universal-program-stress.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function check(checks, name, condition, detail = null) { checks[name] = { pass: Boolean(condition), ...(detail === null ? {} : { detail }) }; }

export function verifyK327CompilerCandidate({ corePath, mainPath }) {
  const core = fs.readFileSync(corePath, 'utf8');
  const main = fs.readFileSync(mainPath, 'utf8');
  const source = `${core}\n${main}`;
  const checks = {};
  let error = null;
  let compilerArtifactSha256 = null;
  try {
    check(checks, 'single-builtin-id-definition', (core.match(/reckon builtin_id\(name : Text\) -> Number =/gu) ?? []).length === 1);
    check(checks, 'contains-builtin-id', /choose\(name == "contains", 1,/u.test(core));
    check(checks, 'sequence-concat-builtin-id', /choose\(name == "sequence_concat", 62,/u.test(core));
    check(checks, 'utf8-bytes-builtin-id', /choose\(name == "utf8_bytes", 68,/u.test(core));
    check(checks, 'sha256-and-unknown-boundary', /choose\(name == "sha256_text", 70, 0\)/u.test(core));
    check(checks, 'main-entrypoint', /facet compiler\.source : Text = provider_call\("compiler_input", "source", "\{\}"\)/u.test(main)
      && /facet compiler\.output : Sequence = encode_rbc\(/u.test(main));
    const artifact = Buffer.from(compileRealityToBytecode(source));
    compilerArtifactSha256 = sha256(artifact);
    check(checks, 'compiler-artifact-emitted', artifact.length > 0, artifact.length);
    check(checks, 'compiler-artifact-identity', compilerArtifactSha256 === '00321946e2b4651b4a05b229e7ec650c76375b394afebbc89fb7e095fc28779b');
  } catch (caught) { error = String(caught?.stack ?? caught); }
  const pass = error === null && Object.values(checks).length === 8 && Object.values(checks).every((item) => item.pass);
  const payload = { format: 'rcl.k327.compiler-candidate-verification.v0.1', status: pass ? 'PASS' : 'FAIL', coreSha256: sha256(core), mainSha256: sha256(main), compilerArtifactSha256, checks, error };
  return { ...payload, reportRoot: evidenceRoot(payload) };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = verifyK327CompilerCandidate({
    corePath: path.resolve(process.argv[2] ?? path.join(ROOT, 'selfhost', 'compiler-core.rcl')),
    mainPath: path.resolve(process.argv[3] ?? path.join(ROOT, 'selfhost', 'compiler-main.rcl')),
  });
  console.log(JSON.stringify(result));
  if (result.status !== 'PASS') process.exitCode = 1;
}

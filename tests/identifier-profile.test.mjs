import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isIdentifierStart, isIdentifierPart, IDENTIFIER_PROFILE } from '../src/identifier-profile.mjs';
import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';

test('pinned category profile matches every scalar in the Unicode 17 reference engine', {skip: process.versions.unicode !== '17.0'}, () => {
  assert.equal(IDENTIFIER_PROFILE, 'rcl.identifier-categories.unicode-17.0.v1');
  for (let cp = 0; cp <= 0x10ffff; cp++) {
    const text = String.fromCodePoint(cp);
    assert.equal(isIdentifierStart(text), /^[_\p{L}]$/u.test(text), `start U+${cp.toString(16)}`);
    assert.equal(isIdentifierPart(text), /^[_\p{L}\p{N}]$/u.test(text), `part U+${cp.toString(16)}`);
  }
});

test('category assets and embedded header reproduce exactly', {skip: process.versions.unicode !== '17.0'}, () => {
  const script = fileURLToPath(new URL('../scripts/build-identifier-profile.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, '--check'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
});

test('native classifier agrees at each Unicode letter/number range boundary', () => {
  const header = fs.readFileSync(new URL('../native/identifier_profile.h', import.meta.url), 'utf8');
  const values = new Set([0x5f, 0x10ffff]);
  for (const pair of header.matchAll(/\{(0x[0-9a-f]+), (0x[0-9a-f]+)\}/g)) {
    for (const endpoint of [Number(pair[1]), Number(pair[2])]) {
      for (const cp of [endpoint - 1, endpoint, endpoint + 1]) {
        if (cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff)) values.add(cp);
      }
    }
  }
  const chars = [...values].sort((a, b) => a - b).map(cp => String.fromCodePoint(cp));
  for (let start = 0; start < chars.length; start += 80) {
    const chunk = chars.slice(start, start + 80);
    const source = 'reality IdentifierBoundaries {' + chunk.flatMap((text, i) => [
      `facet s${i} : Truth = is_identifier_start(${JSON.stringify(text)})`,
      `facet p${i} : Truth = is_identifier_part(${JSON.stringify(text)})`,
    ]).join('\n') + '}';
    const actual = runNativeBytecode(compileRealityToBytecode(source)).state;
    for (const [i, text] of chunk.entries()) {
      assert.equal(actual[`s${i}`], isIdentifierStart(text), `start ${JSON.stringify(text)}`);
      assert.equal(actual[`p${i}`], isIdentifierPart(text), `part ${JSON.stringify(text)}`);
    }
  }
});

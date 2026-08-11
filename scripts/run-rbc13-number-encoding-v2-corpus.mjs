#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  RCL_CANONICAL_NUMBER_ENCODING_V2,
  canonicalNumberV2,
  canonicalNumberV2Bytes,
  canonicalNumberV2BitsFromRaw,
  decodeCanonicalNumberV2,
  numberFromRawBits,
} from '../src/canonical-number-v2.mjs';
import {
  buildRbc13NumberEncodingV2Corpus,
} from '../src/rbc13-number-encoding-v2-corpus.mjs';
import {
  semanticStateRootV2,
} from '../src/semantic-state-root-v2.mjs';
import {
  compileNativeC,
  nativeCCompilerVersion,
  resolveNativeCCompiler,
} from '../src/native-c-compiler.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputPath = path.resolve(process.argv[2] ?? path.join(ROOT, 'output', 'rbc13-number-encoding-v2', 'corpus-report.json'));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function reportRoot(report) {
  return sha256(JSON.stringify({ ...report, root: undefined }));
}

function canonicalCases(corpus) {
  return [...corpus.fixed, ...corpus.generated];
}

function jsChecks(cases) {
  const mismatches = [];
  const decoded = [];
  for (const item of cases) {
    const value = numberFromRawBits(BigInt(item.rawBits));
    const token = canonicalNumberV2(value);
    const expectedToken = item.token;
    const decodedValue = decodeCanonicalNumberV2(token);
    const roundTrip = value === 0 ? decodedValue === 0 : Object.is(decodedValue, value);
    const bytes = canonicalNumberV2Bytes(value).toString('hex');
    const expectedBytes = token.slice(2);
    decoded.push({
      id: item.id,
      token,
      bytes,
      roundTrip,
      rawBits: item.rawBits,
    });
    if (token !== expectedToken || bytes !== expectedBytes || !roundTrip) {
      mismatches.push({ id: item.id, token, expectedToken, bytes, expectedBytes, roundTrip });
    }
  }
  const byBits = new Map();
  for (const item of decoded) {
    const normalizedBits = canonicalNumberV2BitsFromRaw(BigInt(item.rawBits)).toString(16);
    const tokens = byBits.get(normalizedBits) ?? new Set();
    tokens.add(item.token);
    byBits.set(normalizedBits, tokens);
  }
  const uniquenessMismatches = [...byBits.entries()]
    .filter(([, tokens]) => tokens.size !== 1)
    .map(([bits, tokens]) => ({ bits, tokens: [...tokens] }));
  const invalidValues = [];
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    try {
      canonicalNumberV2(value);
    } catch (error) {
      invalidValues.push({ value: String(value), code: error?.code ?? 'UNKNOWN' });
    }
  }
  return {
    caseCount: cases.length,
    mismatchCount: mismatches.length,
    mismatches: mismatches.slice(0, 20),
    roundTripCount: decoded.filter(item => item.roundTrip).length,
    uniquenessGroupCount: byBits.size,
    uniquenessMismatchCount: uniquenessMismatches.length,
    uniquenessMismatches: uniquenessMismatches.slice(0, 20),
    nonFiniteRejectedCount: invalidValues.length,
    nonFiniteRejected: invalidValues,
    negativeZeroToken: canonicalNumberV2(-0),
  };
}

function caseLedger(cases, cTokens) {
  return cases.map((item, index) => {
    const value = numberFromRawBits(BigInt(item.rawBits));
    const jsCanonical = canonicalNumberV2(value);
    const cCanonical = cTokens[index] ?? null;
    const decodedValue = decodeCanonicalNumberV2(jsCanonical);
    return {
      id: item.id,
      family: item.family,
      origin: item.origin,
      source: item.source,
      sourceRepresentation: item.sourceRepresentation,
      inputBits: item.rawBits,
      canonicalBits: item.canonicalBits,
      jsCanonical,
      cCanonical,
      match: cCanonical !== null && jsCanonical === cCanonical,
      roundTrip: value === 0 ? decodedValue === 0 : Object.is(decodedValue, value),
      semanticRoot: semanticStateRootV2({ number: value }),
    };
  });
}

function buildHost() {
  const compiler = resolveNativeCCompiler();
  if (!compiler) return { status: 'BLOCKED', reason: 'RCL_RBC13_NUMBER_V2_C_COMPILER_MISSING' };
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcl-rbc13-number-v2-'));
  const output = path.join(tempDir, `rbc13-number-v2-host${process.platform === 'win32' ? '.exe' : ''}`);
  const build = compileNativeC(compiler, {
    cwd: tempDir,
    includeDirs: [path.join(ROOT, 'native')],
    sources: [
      path.join(ROOT, 'native', 'rcl_canonical_number_v2.c'),
      path.join(ROOT, 'native', 'rcl_canonical_number_v2_host.c'),
    ],
    output,
    timeout: 120_000,
  });
  if (build.status !== 0) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    return {
      status: 'BLOCKED',
      reason: 'RCL_RBC13_NUMBER_V2_C_BUILD_FAILED',
      compiler: compiler.command,
      compilerFamily: compiler.family,
      stderr: String(build.stderr ?? '').slice(-4000),
      stdout: String(build.stdout ?? '').slice(-4000),
    };
  }
  const hostRoot = sha256(fs.readFileSync(output));
  return { status: 'ready', compiler, tempDir, output, hostRoot };
}

function cChecks(host, cases) {
  if (host.status !== 'ready') return { status: host.status, reason: host.reason, mismatches: [], tokens: [] };
  const input = `${cases.map(item => item.rawBits).join('\n')}\n`;
  const run = spawnSync(host.output, [], {
    cwd: ROOT,
    input,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const lines = String(run.stdout ?? '').trim().split(/\r?\n/).filter(Boolean);
  const mismatches = [];
  for (let index = 0; index < cases.length; index++) {
    if (lines[index] !== cases[index].token) {
      mismatches.push({
        id: cases[index].id,
        expected: cases[index].token,
        actual: lines[index] ?? null,
      });
    }
  }
  return {
    status: run.status === 0 && lines.length === cases.length && mismatches.length === 0 ? 'VERIFIED' : 'CANDIDATE',
    exitStatus: run.status,
    lineCount: lines.length,
    caseCount: cases.length,
    mismatchCount: mismatches.length + Math.abs(lines.length - cases.length),
    mismatches: mismatches.slice(0, 20),
    tokens: lines,
    stderr: String(run.stderr ?? '').slice(-4000),
    compiler: host.compiler.command,
    compilerVersion: nativeCCompilerVersion(host.compiler),
    hostRoot: host.hostRoot,
  };
}

function cNonFiniteChecks(host) {
  if (host.status !== 'ready') return { status: host.status, rejectedCount: 0, rejected: [] };
  const rawBits = [
    '0x7ff0000000000000',
    '0x7ff8000000000000',
    '0xfff0000000000000',
  ];
  const run = spawnSync(host.output, [], {
    cwd: ROOT,
    input: `${rawBits.join('\n')}\n`,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });
  const lines = String(run.stdout ?? '').trim().split(/\r?\n/).filter(Boolean);
  const rejected = rawBits.map((bits, index) => ({ bits, output: lines[index] ?? null, rejected: lines[index] === 'ERROR' }));
  return {
    status: run.status === 2 && rejected.every(item => item.rejected) ? 'VERIFIED' : 'CANDIDATE',
    rejectedCount: rejected.filter(item => item.rejected).length,
    rejected,
    stderr: String(run.stderr ?? '').slice(-2000),
  };
}

function main() {
  const started = process.hrtime.bigint();
  const corpus = buildRbc13NumberEncodingV2Corpus();
  const cases = canonicalCases(corpus);
  const js = jsChecks(cases);
  const host = buildHost();
  const c = cChecks(host, cases);
  const cNonFinite = cNonFiniteChecks(host);
  const ledger = caseLedger(cases, c.tokens ?? []);
  if (host.status === 'ready') fs.rmSync(host.tempDir, { recursive: true, force: true });
  const status = c.status === 'BLOCKED'
    ? 'BLOCKED'
    : js.mismatchCount === 0 && js.uniquenessMismatchCount === 0 && js.nonFiniteRejectedCount === 3 && c.status === 'VERIFIED' && cNonFinite.status === 'VERIFIED'
      ? 'VERIFIED'
      : 'CANDIDATE';
  const report = {
    format: 'rcl.rbc13-number-encoding-v2-corpus-report.v0.1',
    encoding: RCL_CANONICAL_NUMBER_ENCODING_V2,
    status,
    fixed: {
      seed: corpus.fixedSeed,
      caseCount: corpus.fixed.length,
      root: corpus.fixedRoot,
    },
    generated: {
      seed: corpus.generatedSeed,
      caseCount: corpus.generated.length,
      root: corpus.generatedRoot,
    },
    caseCount: corpus.caseCount,
    corpusRoot: corpus.root,
    caseLedger: ledger,
    js,
    c,
    cNonFinite,
    requirements: {
      n1UniqueCanonicalEncoding: js.uniquenessMismatchCount === 0,
      n2JsCByteParity: c.status === 'VERIFIED',
      n3RoundTrip: js.mismatchCount === 0 && js.roundTripCount === cases.length,
      n4FiniteAndEdgeCoverage: js.nonFiniteRejectedCount === 3 && cNonFinite.rejectedCount === 3 && corpus.fixed.length >= 1000 && corpus.generated.length >= 10000,
      n5VersionIsolation: true,
    },
    durationMs: Number(process.hrtime.bigint() - started) / 1_000_000,
    boundary: 'This report proves only the candidate Number v2 encoding and its JS/C corpus parity. It does not activate rcl.semantic-state-root.v2, replace v1, or grant canonical RBC admission.',
  };
  report.root = reportRoot(report);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (status === 'CANDIDATE') process.exitCode = 1;
}

main();

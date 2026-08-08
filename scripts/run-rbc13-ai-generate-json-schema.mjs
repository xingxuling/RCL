#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractCapabilitiesFromJsonSchema } from '../src/json-schema-source-frontend.mjs';
import { forgeEquivalenceCorpus } from '../src/equivalence-corpus-forge.mjs';
import { realityRoot } from '../src/canonical.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CONTRACT_PATH = path.join(ROOT, 'examples', 'rbc13-ai-donor-json-schema-contract.json');
const CONTRACT = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
const MODEL = CONTRACT.model;
const outputPath = path.resolve(process.argv[2] ?? path.join(ROOT, 'output', 'rbc13-ai-generate-json-schema', 'report.json'));
const replayIndex = process.argv.indexOf('--replay');
const replayPath = replayIndex >= 0 ? path.resolve(process.argv[replayIndex + 1]) : null;

const PROMPT = [
  'You are a blinded donor generator.',
  'You do not have repository source code, implementation code, test code, or expected outputs.',
  'Return exactly one JSON object and nothing else. The object itself must be a JSON Schema draft 2020-12, not an instance and not a wrapper.',
  'Schema intent: describe a DonorMeasurement object with required fields id, value, unit, confidence.',
  'The root must be an object and additionalProperties must be false.',
  'id is a non-empty string; value is a number; unit is a non-empty string; confidence is a number from 0 through 1.',
  'Include the $schema draft 2020-12 URI, a title, and a short description.',
  'Do not output markdown. Do not mention or generate RCL, DOMAIN_CALL, native organs, providers, repository files, or implementations.',
].join(' ');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function firstJsonObject(text) {
  const source = String(text ?? '');
  const start = source.indexOf('{');
  if (start < 0) throw new Error('AI_GENERATE response contains no JSON object');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index++) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') { inString = true; continue; }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error('AI_GENERATE response contains an incomplete JSON object');
}

function generateResponse() {
  if (replayPath) return { status: 'replay', raw: fs.readFileSync(replayPath, 'utf8'), replayPath };
  const run = spawnSync('ollama', ['run', MODEL, '--format', 'json', '--hidethinking', PROMPT], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (run.error || run.status !== 0) {
    return {
      status: 'BLOCKED',
      reason: 'RCL_RBC13_AI_GENERATE_MODEL_UNAVAILABLE',
      exitStatus: run.status,
      error: String(run.error?.message ?? ''),
      stderr: String(run.stderr ?? '').slice(-4000),
      stdout: String(run.stdout ?? '').slice(-4000),
    };
  }
  return { status: 'live', raw: String(run.stdout ?? '') };
}

function evaluateSchema(schema) {
  const properties = schema?.properties ?? {};
  const expected = CONTRACT.requirements;
  const required = Array.isArray(schema?.required) ? schema.required : [];
  const exactRequired = required.length === expected.requiredExactly.length
    && expected.requiredExactly.every(name => required.includes(name));
  const checks = {
    draft2020: typeof schema?.$schema === 'string' && schema.$schema.includes('2020-12'),
    rootObject: schema?.type === expected.rootType,
    titlePresent: typeof schema?.title === 'string' && schema.title.length > 0,
    requiredExact: exactRequired,
    additionalPropertiesFalse: schema?.additionalProperties === expected.additionalProperties,
    id: properties.id?.type === 'string' && Number(properties.id?.minLength) >= 1,
    value: properties.value?.type === 'number',
    unit: properties.unit?.type === 'string' && Number(properties.unit?.minLength) >= 1,
    confidence: properties.confidence?.type === 'number'
      && Number(properties.confidence?.minimum) === 0
      && Number(properties.confidence?.maximum) === 1,
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}

function runNegativeSchemaControl(schema) {
  const mutated = structuredClone(schema);
  delete mutated.additionalProperties;
  const evaluation = evaluateSchema(mutated);
  return {
    mutation: 'remove-additionalProperties-false',
    detected: evaluation.passed === false,
    evaluation,
  };
}

function main() {
  const started = process.hrtime.bigint();
  const generated = generateResponse();
  if (generated.status === 'BLOCKED') {
    const blocked = {
      format: 'rcl.rbc13-ai-generate-json-schema-report.v0.1',
      status: 'BLOCKED',
      gate: 'AI_GENERATE',
      model: MODEL,
      promptRoot: realityRoot(PROMPT),
      detail: generated,
      implementationCodeSent: false,
      targetSourceSent: false,
      boundary: 'No AI_GENERATE claim is made because the local model did not produce a response.',
    };
    blocked.root = sha256(JSON.stringify({ ...blocked, root: undefined }));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(blocked, null, 2)}\n`);
    console.log(JSON.stringify(blocked, null, 2));
    process.exitCode = 2;
    return;
  }

  let parsed;
  let parseError = null;
  try {
    parsed = JSON.parse(firstJsonObject(generated.raw));
  } catch (error) {
    parseError = String(error?.message ?? error);
  }
  const schemaEvaluation = parsed ? evaluateSchema(parsed) : { checks: {}, passed: false };
  let extraction = null;
  let corpus = null;
  let extractionError = null;
  if (parsed) {
    try {
      extraction = extractCapabilitiesFromJsonSchema(parsed, {
        id: 'ai_donor_measurement',
        provenance: ['ai-generate:blind-json-schema-donor'],
      });
      corpus = forgeEquivalenceCorpus(extraction, { maxCasesPerCapability: 64 });
    } catch (error) {
      extractionError = String(error?.message ?? error);
    }
  }
  const corpusSummary = corpus ? {
    format: corpus.format,
    root: corpus.root,
    capabilityCount: corpus.capabilityCount,
    corpora: corpus.corpora.map(item => ({ capability: item.capability, root: item.root, caseCount: item.caseCount, mutationPlanCount: item.mutationPlanCount })),
  } : null;
  const negativeControl = parsed ? runNegativeSchemaControl(parsed) : { mutation: 'unavailable', detected: false };
  const contractPass = parseError === null
    && schemaEvaluation.passed
    && extraction !== null
    && corpus !== null
    && negativeControl.detected;
  const report = {
    format: 'rcl.rbc13-ai-generate-json-schema-report.v0.1',
    status: contractPass ? 'CANDIDATE' : 'NEGATIVE_RESULT',
    gate: contractPass ? 'PASS' : 'FAIL',
    model: MODEL,
    execution: generated.status,
    promptRoot: realityRoot(PROMPT),
    rawResponseRoot: generated.raw ? sha256(generated.raw) : null,
    rawResponseTail: generated.raw ? String(generated.raw).slice(-4000) : null,
    promptPolicy: {
      implementationCodeSent: false,
      targetSourceSent: false,
      expectedRuntimeOutputSent: false,
      repositoryPathSent: false,
    },
    responseRoot: parsed ? realityRoot(parsed) : null,
    response: parsed ?? null,
    parseError,
    schemaEvaluation,
    extraction: extraction ? { format: extraction.format, root: extraction.root, capabilityCount: extraction.capabilityCount, sourceRoot: extraction.sourceRoot } : null,
    extractionError,
    corpus: corpusSummary,
    negativeControl,
    successfulTrials: contractPass ? 1 : 0,
    requiredTrials: 1,
    boundary: contractPass
      ? 'One independent donor schema passed the blinded output contract and deterministic extraction/corpus gates. This is candidate AI_GENERATE evidence, not native execution or canonical admission.'
      : 'The model response was captured and evaluated, but the donor contract did not pass. This negative result blocks Universal Stress AI_GENERATE credit and canonical admission.',
    durationMs: Number(process.hrtime.bigint() - started) / 1_000_000,
  };
  report.root = sha256(JSON.stringify({ ...report, root: undefined }));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!contractPass) process.exitCode = 1;
}

main();

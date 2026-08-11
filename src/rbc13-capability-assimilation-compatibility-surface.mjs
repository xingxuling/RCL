import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  RBC13_JSON_SCHEMA_MUTATION_CONTROLS,
  buildRbc13JsonSchemaDonorCorpus,
} from './rbc13-json-schema-donor-corpus.mjs';
import {
  loadRbc13JsonSchemaDonorContract,
  validateRbc13JsonSchemaDonorContract,
} from './rbc13-json-schema-contract.mjs';
import { evaluateRbc13JsonSchemaCandidate } from './rbc13-json-schema-candidate-adapter.mjs';
import { realityRoot } from './canonical.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ORACLE_PATH = path.join(ROOT, 'oracle', 'rbc13-json-schema-donor-oracle.mjs');

export const RBC13_CAPABILITY_ASSIMILATION_COMPATIBILITY_SURFACE_FORMAT =
  'rcl.rbc13-capability-assimilation-compatibility-surface.v0.1';
export const RBC13_CAPABILITY_ASSIMILATION_PROTOCOL_VERSION =
  'same-donor-schema-independent-differential-v0.1';
export const RBC13_CAPABILITY_ASSIMILATION_ACL_LEVELS = Object.freeze(['ACL0', 'ACL1', 'ACL2', 'ACL3', 'ACL4']);
export const RBC13_CAPABILITY_ASSIMILATION_TIERS = Object.freeze([
  Object.freeze({ tier: 'tiny', model: 'aetherseed-tinyllama-runtime:latest' }),
  Object.freeze({ tier: 'medium', model: 'aetherseed-trained-smoke:latest' }),
  Object.freeze({ tier: 'strong', model: 'qwen3.5:latest' }),
]);

export const RBC13_CAPABILITY_ASSIMILATION_PROMPT = [
  'You are a blinded JSON Schema donor generator.',
  'Return exactly one JSON object and nothing else.',
  'The object itself must be a JSON Schema draft 2020-12, not an instance and not a wrapper.',
  'The schema must describe a bounded DonorMeasurement record.',
  'Include $schema equal to https://json-schema.org/draft/2020-12/schema, a $id, a title, and a description.',
  'The root is an object with additionalProperties false and required exactly id, value, unit.',
  'Properties are exactly id, value, unit, confidence, tags, metadata.',
  'id is a string with minLength 3 and maxLength 64.',
  'value is a number with minimum -1000 and maximum 1000.',
  'unit is a string enum of exactly mL, ml, and g.',
  'confidence is a number with minimum 0 and maximum 1.',
  'tags is an array with minItems 0 and maxItems 4; each item is a string with minLength 1 and maxLength 16.',
  'metadata is an object with required source, optional verified boolean, source string minLength 1 maxLength 32, and additionalProperties false.',
  'Use only JSON Schema keywords needed for that fixed subset.',
  'Do not output markdown. Do not mention or generate RCL, DOMAIN_CALL, native organs, providers, repository files, tests, an oracle, a corpus, mutants, or implementation code.',
].join(' ');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function firstJsonObject(text) {
  const source = String(text ?? '');
  const start = source.indexOf('{');
  if (start < 0) throw new Error('response contains no JSON object');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
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
  throw new Error('response contains an incomplete JSON object');
}

function endpointFrom(value) {
  if (String(value ?? '').startsWith('http')) return String(value).replace(/\/$/, '') + '/api/generate';
  return `http://${value || '127.0.0.1:11434'}/api/generate`;
}

function listModels() {
  const result = spawnSync('ollama', ['list'], { encoding: 'utf8', timeout: 30_000 });
  if (result.status !== 0) return [];
  return String(result.stdout ?? '').split(/\r?\n/).slice(1).map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split(/\s+/);
    return { row: line, name: parts[0] ?? null, modelVersion: parts[1] ?? null, size: parts.slice(2, 4).join(' ') || null, rowRoot: sha256(line) };
  });
}

function modelInfo(model, listedModels) {
  const listed = listedModels.find(item => item.name === model) ?? null;
  const shown = spawnSync('ollama', ['show', model, '--modelfile'], { encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
  const modelfile = shown.status === 0 ? String(shown.stdout ?? '') : '';
  return {
    available: Boolean(listed),
    model,
    modelVersion: listed?.modelVersion ?? null,
    listedSize: listed?.size ?? null,
    listRowRoot: listed?.rowRoot ?? null,
    modelfileRoot: modelfile ? sha256(modelfile) : null,
  };
}

async function generateWithOllama(model, prompt, protocol) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), protocol.timeoutMs);
  const started = process.hrtime.bigint();
  try {
    const response = await fetch(protocol.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: 'json',
        options: {
          temperature: protocol.temperature,
          seed: protocol.seed,
          top_p: 1,
          num_predict: protocol.numPredict,
        },
      }),
      signal: controller.signal,
    });
    const rawPayload = await response.text();
    if (!response.ok) return { status: 'BLOCKED', reason: 'ollama-http-error', httpStatus: response.status, rawPayloadTail: rawPayload.slice(-4000), durationMs: Number(process.hrtime.bigint() - started) / 1_000_000 };
    const payload = JSON.parse(rawPayload);
    const rawResponse = String(payload.response ?? '');
    return { status: 'live', model: payload.model ?? model, rawResponse, responseRoot: sha256(rawResponse), apiPayloadRoot: sha256(rawPayload), createdAt: payload.created_at ?? null, durationMs: Number(process.hrtime.bigint() - started) / 1_000_000 };
  } catch (error) {
    return { status: 'BLOCKED', reason: error?.name === 'AbortError' ? 'ollama-timeout' : 'ollama-request-failed', error: String(error?.message ?? error), durationMs: Number(process.hrtime.bigint() - started) / 1_000_000 };
  } finally {
    clearTimeout(timer);
  }
}

function donorSchemaFromContract(contract) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'urn:rcl:rbc13:donor-measurement:fixed-subset:v1',
    title: contract.intent.title,
    description: contract.intent.description,
    type: contract.intent.rootType,
    required: [...contract.intent.requiredFields],
    properties: structuredClone(contract.intent.properties),
    additionalProperties: contract.intent.additionalProperties,
  };
}

function oracleEvaluate(schema, cases) {
  const run = spawnSync(process.execPath, [ORACLE_PATH], {
    input: JSON.stringify({ schema, cases }),
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  let payload = null;
  try { payload = JSON.parse(String(run.stdout ?? '')); } catch (error) {
    return { status: 'BLOCKED', reason: 'oracle-invalid-json', details: { exitCode: run.status, stderr: String(run.stderr ?? ''), parseError: String(error.message ?? error) } };
  }
  if (run.status !== 0 || payload.status !== 'OK') return { status: 'BLOCKED', reason: 'oracle-failed', details: payload };
  return payload;
}

function compareCandidateToOracle(schema, cases, oracleOutputs, mutation = null) {
  const candidateOutputs = cases.map(item => {
    const result = evaluateRbc13JsonSchemaCandidate(schema, item.instance, { mutation });
    return { caseId: item.id, valid: result.valid, errors: result.errors };
  });
  const mismatches = candidateOutputs.flatMap((candidate, index) => {
    const expected = oracleOutputs[index];
    return candidate.valid === expected.valid && JSON.stringify(candidate.errors) === JSON.stringify(expected.errors)
      ? []
      : [{ caseId: candidate.caseId, candidate, oracle: expected }];
  });
  return { candidateOutputs, mismatches, exact: mismatches.length === 0 };
}

function runMutationControls(schema, cases, oracleOutputs) {
  return RBC13_JSON_SCHEMA_MUTATION_CONTROLS.map(control => {
    const result = compareCandidateToOracle(schema, cases, oracleOutputs, control.id);
    return { ...control, detected: result.mismatches.length > 0, mismatchCount: result.mismatches.length, exampleCaseId: result.mismatches[0]?.caseId ?? null };
  });
}

function aclFor({ contract, differential }) {
  if (!contract) return 'ACL0';
  if (!differential) return 'ACL1';
  return 'ACL2';
}

async function runModel({ spec, contract, corpus, oracle, protocol, info }) {
  const attempts = [];
  let generated = await generateWithOllama(spec.model, RBC13_CAPABILITY_ASSIMILATION_PROMPT, protocol);
  attempts.push({ kind: 'initial', promptRoot: sha256(RBC13_CAPABILITY_ASSIMILATION_PROMPT), ...generated });
  let schema = null;
  let parseError = null;
  let contractEvaluation = null;
  for (let repair = 0; repair <= protocol.maxAutomaticRepairs; repair += 1) {
    if (generated.status !== 'live') break;
    try {
      schema = JSON.parse(firstJsonObject(generated.rawResponse));
      parseError = null;
    } catch (error) {
      schema = null;
      parseError = String(error.message ?? error);
    }
    contractEvaluation = schema ? validateRbc13JsonSchemaDonorContract(schema) : { valid: false, errors: [parseError] };
    if (contractEvaluation.valid) break;
    if (repair === protocol.maxAutomaticRepairs) break;
    const repairPrompt = [
      'Return exactly one corrected JSON Schema object and nothing else.',
      'The previous donor object did not satisfy the fixed donor contract.',
      'Keep the same blinded task and correct the contract without asking a human and without using repository source, hidden cases, an oracle, or implementation code.',
      'Do not include markdown or explanations.',
    ].join(' ');
    generated = await generateWithOllama(spec.model, repairPrompt, { ...protocol, seed: protocol.seed + repair + 1 });
    attempts.push({ kind: 'automatic-repair', repairNumber: repair + 1, promptRoot: sha256(repairPrompt), ...generated });
  }
  const contractPassed = generated.status === 'live' && contractEvaluation?.valid === true;
  const base = {
    tier: spec.tier,
    model: spec.model,
    modelInfo: info,
    protocol: {
      version: RBC13_CAPABILITY_ASSIMILATION_PROTOCOL_VERSION,
      promptRoot: sha256(RBC13_CAPABILITY_ASSIMILATION_PROMPT),
      temperature: protocol.temperature,
      seed: protocol.seed,
      format: 'json',
      numPredict: protocol.numPredict,
      maxAutomaticRepairs: protocol.maxAutomaticRepairs,
    },
    attempts: attempts.map(item => ({ ...item, rawResponseTail: item.rawResponse?.slice(-4000) ?? null })),
    humanRepairs: 0,
    automaticRepairs: attempts.filter(item => item.kind === 'automatic-repair' && item.status === 'live').length,
    candidateStartedEmpty: true,
    hiddenCorpusProvidedToModel: false,
    oracleProvidedToModel: false,
    previousCandidateProvidedToModel: false,
    contract: { passed: contractPassed, parseError, evaluation: contractEvaluation },
  };
  if (!contractPassed) {
    return {
      ...base,
      status: generated.status === 'live' ? 'NEGATIVE_RESULT' : 'BLOCKED',
      acl: 'ACL0',
      differential: { status: 'NOT_RUN', reason: generated.status === 'live' ? 'donor-contract-invalid' : generated.reason },
      mutationControls: [],
      replay: { status: 'NOT_RUN' },
      nativeCandidate: { status: 'BLOCKED', reason: 'ACL3 requires a separately admitted native organ candidate' },
      nativePromotion: { status: 'BLOCKED', reason: 'ACL4 requires native promotion evidence' },
    };
  }
  const firstOracle = oracleEvaluate(schema, corpus.cases);
  if (firstOracle.status !== 'OK') {
    return {
      ...base,
      status: 'BLOCKED',
      acl: 'ACL1',
      schemaRoot: realityRoot(schema),
      differential: { status: 'BLOCKED', reason: firstOracle.reason, details: firstOracle.details },
      mutationControls: [],
      replay: { status: 'BLOCKED' },
      nativeCandidate: { status: 'BLOCKED', reason: 'independent oracle did not execute' },
      nativePromotion: { status: 'BLOCKED', reason: 'independent oracle did not execute' },
    };
  }
  const differential = compareCandidateToOracle(schema, corpus.cases, firstOracle.outputs);
  const mutationControls = runMutationControls(schema, corpus.cases, firstOracle.outputs);
  const replayOracle = oracleEvaluate(schema, corpus.cases);
  const replayCandidate = compareCandidateToOracle(schema, corpus.cases, replayOracle.outputs);
  const replay = {
    status: replayOracle.status === 'OK' && differential.exact === replayCandidate.exact && JSON.stringify(firstOracle.outputs) === JSON.stringify(replayOracle.outputs) ? 'VERIFIED' : 'BLOCKED',
    oracleRoot: realityRoot(firstOracle.outputs),
    replayOracleRoot: realityRoot(replayOracle.outputs ?? []),
    candidateRoot: realityRoot(differential.candidateOutputs),
    replayCandidateRoot: realityRoot(replayCandidate.candidateOutputs),
  };
  const mutationPass = mutationControls.length === 5 && mutationControls.every(item => item.detected);
  const differentialPass = differential.exact && mutationPass && replay.status === 'VERIFIED';
  return {
    ...base,
    status: differentialPass ? 'CANDIDATE' : 'NEGATIVE_RESULT',
    acl: aclFor({ contract: true, differential: differentialPass }),
    schemaRoot: realityRoot(schema),
    differential: {
      status: differentialPass ? 'VERIFIED' : 'NEGATIVE_RESULT',
      exact: differential.exact,
      caseCount: corpus.cases.length,
      mismatchCount: differential.mismatches.length,
      positiveNegativeBoundary: corpus.classificationCounts,
      candidateOutputRoot: realityRoot(differential.candidateOutputs),
      oracleOutputRoot: realityRoot(firstOracle.outputs),
      mismatches: differential.mismatches.slice(0, 8),
    },
    mutationControls: { status: mutationPass ? 'VERIFIED' : 'NEGATIVE_RESULT', controls: mutationControls, detectedCount: mutationControls.filter(item => item.detected).length },
    replay,
    nativeCandidate: { status: 'BLOCKED', reason: 'No separate C/RCL JSON Schema Native Organ candidate is admitted by this compatibility surface.' },
    nativePromotion: { status: 'BLOCKED', reason: 'Native Candidate, Native Process, Semantic Root, Replay, and Promotion gates are not present for this donor.' },
  };
}

export async function runRbc13CapabilityAssimilationCompatibilitySurface(options = {}) {
  const contract = options.contract ?? loadRbc13JsonSchemaDonorContract();
  const corpus = options.corpus ?? buildRbc13JsonSchemaDonorCorpus();
  const models = options.models ?? RBC13_CAPABILITY_ASSIMILATION_TIERS;
  const listedModels = options.listedModels ?? listModels();
  const protocol = {
    endpoint: endpointFrom(options.endpoint ?? process.env.OLLAMA_HOST ?? '127.0.0.1:11434'),
    temperature: options.temperature ?? 0,
    seed: options.seed ?? 13013,
    numPredict: options.numPredict ?? 768,
    timeoutMs: options.timeoutMs ?? 180_000,
    maxAutomaticRepairs: options.maxAutomaticRepairs ?? 2,
  };
  const attempts = [];
  for (const spec of models) {
    const info = modelInfo(spec.model, listedModels);
    if (!info.available) {
      attempts.push({ tier: spec.tier, model: spec.model, modelInfo: info, status: 'BLOCKED', acl: 'ACL0', humanRepairs: 0, automaticRepairs: 0, candidateStartedEmpty: true, blockedReason: 'model-not-present-in-ollama-list' });
      continue;
    }
    attempts.push(await runModel({ spec, contract, corpus, protocol, info, oracle: null }));
  }
  const tested = attempts.filter(item => item.attempts?.some(attempt => attempt.status === 'live'));
  const allRequiredModelsPresent = attempts.length === models.length && attempts.every(item => item.modelInfo?.available === true);
  const bestAclIndex = Math.max(...attempts.map(item => RBC13_CAPABILITY_ASSIMILATION_ACL_LEVELS.indexOf(item.acl)), -1);
  const bestAcl = bestAclIndex >= 0 ? RBC13_CAPABILITY_ASSIMILATION_ACL_LEVELS[bestAclIndex] : null;
  const formalA10 = attempts.length === models.length
    && attempts.every(item => item.acl === 'ACL4' && item.humanRepairs === 0 && item.differential?.status === 'VERIFIED' && item.mutationControls?.status === 'VERIFIED' && item.replay?.status === 'VERIFIED');
  const status = formalA10 ? 'VERIFIED' : (allRequiredModelsPresent && tested.length === models.length ? 'NEGATIVE_RESULT' : 'BLOCKED');
  const body = {
    format: RBC13_CAPABILITY_ASSIMILATION_COMPATIBILITY_SURFACE_FORMAT,
    version: '0.1.0',
    status,
    surface: 'RCL Capability Assimilation Compatibility Surface',
    protocol: {
      version: RBC13_CAPABILITY_ASSIMILATION_PROTOCOL_VERSION,
      promptRoot: sha256(RBC13_CAPABILITY_ASSIMILATION_PROMPT),
      donorContractRoot: realityRoot(contract),
      corpusRoot: corpus.root,
      endpoint: protocol.endpoint,
      temperature: protocol.temperature,
      seed: protocol.seed,
      format: 'json',
      numPredict: protocol.numPredict,
      maxAutomaticRepairs: protocol.maxAutomaticRepairs,
      sameProtocolForAllModels: true,
      candidateStartsEmpty: true,
      hiddenCorpus: true,
      oracleHidden: true,
      previousCandidateHidden: true,
      humanRepairs: 0,
    },
    donor: {
      format: contract.format,
      root: realityRoot(contract),
      subset: contract.subset,
      contractValidation: validateRbc13JsonSchemaDonorContract(donorSchemaFromContract(contract)),
    },
    corpus: {
      format: corpus.format,
      root: corpus.root,
      deterministic: corpus.deterministic,
      hiddenFromModel: corpus.hiddenFromModel,
      caseCount: corpus.caseCount,
      classificationCounts: corpus.classificationCounts,
      mutationControls: RBC13_JSON_SCHEMA_MUTATION_CONTROLS,
    },
    oracle: {
      path: 'oracle/rbc13-json-schema-donor-oracle.mjs',
      implementation: 'Ajv2020',
      dependency: 'ajv@8.20.0',
      processBoundary: 'separate Node process per model differential and replay',
      sharedCandidateImports: false,
      semanticProjection: ['valid', 'errors[].keyword', 'errors[].instancePath', 'errors[].schemaPath', 'errors[].params'],
    },
    attempts,
    accessControlLevels: {
      ACL0: 'invalid donor contract or unavailable donor response',
      ACL1: 'valid contract but candidate fails independent differential',
      ACL2: 'candidate passes independent differential, mutation controls, and replay',
      ACL3: 'Native Organ candidate contract separately verified',
      ACL4: 'Native Promotion separately verified',
    },
    summary: {
      modelCount: models.length,
      liveModelCount: tested.length,
      availableModelCount: attempts.filter(item => item.modelInfo?.available === true).length,
      humanRepairs: 0,
      automaticRepairs: attempts.reduce((sum, item) => sum + Number(item.automaticRepairs ?? 0), 0),
      bestAcl,
      aclByModel: Object.fromEntries(attempts.map(item => [item.tier, item.acl ?? null])),
      independentDifferentialVerifiedModels: attempts.filter(item => item.differential?.status === 'VERIFIED').map(item => item.tier),
      nativePromotionVerifiedModels: attempts.filter(item => item.nativePromotion?.status === 'VERIFIED').map(item => item.tier),
      formalA10,
      assimilationMonotonic: 'NOT_ESTABLISHED',
      compatibilityConclusion: 'Compatibility is alignment-sensitive and donor/protocol scoped; model scale alone does not establish monotonic assimilation.',
    },
    strictGrowthAssessment: {
      globalLevel: bestAcl === 'ACL2' || bestAcl === 'ACL3' || bestAcl === 'ACL4' ? 'Level 2 VERIFIED' : 'Level 2 CANDIDATE',
      nextLevel: formalA10 ? 'Level 3 CANDIDATE' : 'Level 3 CANDIDATE/BLOCKED',
      reason: 'Only an AI-generated implementation with independent differential verification can establish strict Level 3. Native promotion is a separate gate and is not inferred from schema compatibility.',
    },
    formalA10: {
      status: formalA10 ? 'VERIFIED' : 'NEGATIVE_RESULT',
      requiresNativePromotion: true,
      chain: ['AI-generated donor', 'contract', 'independent positive/negative differential', 'mutation controls', 'replay', 'Native Candidate', 'Native Process', 'Semantic Root', 'Replay', 'Promotion'],
      conclusion: formalA10 ? 'All models reached ACL4 with zero human repair.' : 'No Native Promotion proof is present; formal A10 is not VERIFIED.',
    },
    boundaries: [
      'This is a domain/protocol compatibility result, not a general intelligence ranking.',
      'The candidate adapter is not the independent oracle and the oracle imports no RCL candidate helper.',
      'No model receives the hidden corpus, oracle implementation, mutation controls, previous candidate, or human repair.',
      'No ACL2 result grants native execution, canonical permission, or promotion authority.',
    ],
    reproductionCommand: 'npm run verify:rbc13-ai-assimilation-compatibility',
  };
  return Object.freeze({ ...body, root: realityRoot(body) });
}

export function renderRbc13CapabilityAssimilationCompatibilitySurfaceMarkdown(report) {
  const rows = report.attempts.map(item => `| ${item.tier ?? 'unknown'} | ${item.model} | ${item.modelInfo?.modelVersion ?? 'UNAVAILABLE'} | ${item.status} | ${item.acl ?? 'ACL0'} | ${item.humanRepairs ?? 0} | ${item.automaticRepairs ?? 0} | ${item.differential?.status ?? 'NOT_RUN'} | ${item.nativePromotion?.status ?? 'BLOCKED'} |`).join('\n');
  return `# RCL Capability Assimilation Compatibility Surface v0.1\n\n- Status: **${report.status}**\n- Evidence root: \`${report.root}\`\n- Donor contract root: \`${report.donor.root}\`\n- Corpus root: \`${report.corpus.root}\`; cases=${report.corpus.caseCount}; positive=${report.corpus.classificationCounts.positive}; negative=${report.corpus.classificationCounts.negative}; boundary=${report.corpus.classificationCounts.boundary}\n- Independent oracle: **${report.oracle.implementation} ${report.oracle.dependency}**, separate process\n- Human repairs: **${report.summary.humanRepairs}**; automatic repairs: **${report.summary.automaticRepairs}**\n\n## Model results\n\n| Tier | Model | Ollama version | Status | ACL | Human repair | Auto repair | Differential | Native Promotion |\n|---|---|---|---|---|---:|---:|---|---|\n${rows}\n\n## ACL ruling\n\n${Object.entries(report.accessControlLevels).map(([level, description]) => `- **${level}**: ${description}`).join('\n')}\n\nBest observed ACL: **${report.summary.bestAcl ?? 'none'}**. Strict global growth assessment: **${report.strictGrowthAssessment.globalLevel}**; next level: **${report.strictGrowthAssessment.nextLevel}**.\n\n## Differential contract\n\nThe comparison projection is exact over ${report.oracle.semanticProjection.join(', ')}. Mutation controls: ${report.corpus.mutationControls.map(item => item.id).join(', ')}. ${report.summary.compatibilityConclusion}\n\n## Formal A10\n\n- Status: **${report.formalA10.status}**\n- Requires Native Promotion: **${report.formalA10.requiresNativePromotion}**\n- Chain: ${report.formalA10.chain.join(' → ')}\n- Conclusion: ${report.formalA10.conclusion}\n\n## Boundary\n\n${report.boundaries.map(item => `- ${item}`).join('\n')}\n`;
}


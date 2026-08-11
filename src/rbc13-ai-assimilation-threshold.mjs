import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extractCapabilitiesFromJsonSchema } from './json-schema-source-frontend.mjs';
import { forgeEquivalenceCorpus } from './equivalence-corpus-forge.mjs';
import { metabolizeSourceCapabilityBundle } from './source-capability-frontends.mjs';
import { realityRoot } from './canonical.mjs';

export const RBC13_AI_ASSIMILATION_THRESHOLD_FORMAT =
  'rcl.rbc13-ai-assimilation-threshold-results.v0.1';
export const RBC13_AI_ASSIMILATION_PROTOCOL_VERSION = 'same-json-schema-donor-v0.1';
export const RBC13_AI_ASSIMILATION_LEVELS = Object.freeze(['L0', 'L1', 'L2', 'L3', 'L4']);

export const RBC13_AI_ASSIMILATION_TIERS = Object.freeze([
  Object.freeze({ tier: 'small', model: 'aetherseed-tinyllama-runtime:latest' }),
  Object.freeze({ tier: 'medium', model: 'aetherseed-trained-smoke:latest' }),
  Object.freeze({ tier: 'strong', model: 'qwen3.5:latest' }),
]);

export const RBC13_AI_ASSIMILATION_PROMPT = [
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
  throw new Error('AI_GENERATE response contains an incomplete JSON object');
}

function evaluateSchema(schema, contract) {
  const properties = schema?.properties ?? {};
  const expected = contract.requirements;
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
  return Object.freeze({ checks: Object.freeze(checks), passed: Object.values(checks).every(Boolean) });
}

function runNegativeSchemaControl(schema, contract) {
  const mutated = structuredClone(schema);
  delete mutated.additionalProperties;
  const evaluation = evaluateSchema(mutated, contract);
  return Object.freeze({
    mutation: 'remove-additionalProperties-false',
    detected: evaluation.passed === false,
    evaluation,
  });
}

function listModels() {
  const result = spawnSync('ollama', ['list'], { encoding: 'utf8', timeout: 30_000 });
  const raw = String(result.stdout ?? '');
  const rows = raw.split(/\r?\n/).slice(1).map(line => line.trim()).filter(Boolean);
  return Object.freeze(rows.map(line => {
    const parts = line.split(/\s+/);
    return Object.freeze({
      row: line,
      name: parts[0] ?? null,
      modelVersion: parts[1] ?? null,
      size: parts.slice(2, 4).join(' ') || null,
      rowRoot: sha256(line),
    });
  }));
}

function modelInfo(model, models) {
  const listed = models.find(item => item.name === model) ?? null;
  const shown = spawnSync('ollama', ['show', model, '--modelfile'], {
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const modelfile = shown.status === 0 ? String(shown.stdout ?? '') : '';
  return Object.freeze({
    available: Boolean(listed),
    model,
    modelVersion: listed?.modelVersion ?? null,
    listedSize: listed?.size ?? null,
    listRowRoot: listed?.rowRoot ?? null,
    modelfileRoot: modelfile ? sha256(modelfile) : null,
  });
}

async function generateWithOllama(model, protocol) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), protocol.timeoutMs);
  const started = process.hrtime.bigint();
  try {
    const response = await fetch(protocol.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: RBC13_AI_ASSIMILATION_PROMPT,
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
    if (!response.ok) {
      return Object.freeze({
        status: 'BLOCKED',
        reason: 'ollama-http-error',
        httpStatus: response.status,
        rawPayloadTail: rawPayload.slice(-4000),
        durationMs: Number(process.hrtime.bigint() - started) / 1_000_000,
      });
    }
    const payload = JSON.parse(rawPayload);
    return Object.freeze({
      status: 'live',
      model: payload.model ?? model,
      rawResponse: String(payload.response ?? ''),
      responseRoot: sha256(String(payload.response ?? '')),
      apiPayloadRoot: sha256(rawPayload),
      createdAt: payload.created_at ?? null,
      durationMs: Number(process.hrtime.bigint() - started) / 1_000_000,
    });
  } catch (error) {
    return Object.freeze({
      status: 'BLOCKED',
      reason: error?.name === 'AbortError' ? 'ollama-timeout' : 'ollama-request-failed',
      error: String(error?.message ?? error),
      durationMs: Number(process.hrtime.bigint() - started) / 1_000_000,
    });
  } finally {
    clearTimeout(timer);
  }
}

function summarizeCorpus(corpus) {
  return corpus ? Object.freeze({
    format: corpus.format,
    root: corpus.root,
    capabilityCount: corpus.capabilityCount,
    corpora: corpus.corpora.map(item => ({
      capability: item.capability,
      root: item.root,
      caseCount: item.caseCount,
      mutationPlanCount: item.mutationPlanCount,
      classifications: item.cases.reduce((counts, item) => {
        counts[item.classification] = (counts[item.classification] ?? 0) + 1;
        return counts;
      }, {}),
    })),
  }) : null;
}

export function classifyAiAssimilationLevel(stages = {}) {
  if (stages.contract !== true) return 'L0';
  if (stages.extraction !== true || stages.corpus !== true) return 'L1';
  if (stages.candidate !== true) return 'L1';
  if (stages.differential !== true) return 'L2';
  if (stages.nativeCandidate !== true) return 'L3';
  if (stages.promotion !== true) return 'L3';
  return 'L4';
}

async function runAttempt({ tier, model, contract, modelInfoValue, protocol, humanInterventions = 0 }) {
  const generated = await generateWithOllama(model, protocol);
  const base = {
    tier,
    model,
    modelInfo: modelInfoValue,
    attempt: 1,
    protocol: {
      version: RBC13_AI_ASSIMILATION_PROTOCOL_VERSION,
      promptRoot: realityRoot(RBC13_AI_ASSIMILATION_PROMPT),
      temperature: protocol.temperature,
      seed: protocol.seed,
      format: 'json',
      numPredict: protocol.numPredict,
    },
    humanInterventions,
    repairAttempt: {
      attempted: false,
      humanInterventions,
      modelRepairCalls: 0,
      reason: 'single-pass donor protocol; no hidden or human repair is permitted',
    },
  };
  if (generated.status !== 'live') {
    const stages = { contract: false, extraction: false, corpus: false, candidate: false, differential: false, nativeCandidate: false, promotion: false };
    return Object.freeze({
      ...base,
      status: 'BLOCKED',
      level: 'L0',
      stages,
      generation: generated,
      blockedReason: generated.reason,
      donorSpec: { root: realityRoot(contract), format: contract.format },
      nativeCandidate: { status: 'BLOCKED', reason: 'no donor output' },
      promotionAttempt: { status: 'BLOCKED', reason: 'no donor output', canonicalAdmission: false },
    });
  }

  let schema = null;
  let parseError = null;
  try {
    schema = JSON.parse(firstJsonObject(generated.rawResponse));
  } catch (error) {
    parseError = String(error?.message ?? error);
  }
  const schemaEvaluation = schema ? evaluateSchema(schema, contract) : { checks: {}, passed: false };
  const contractPass = parseError === null && schemaEvaluation.passed;
  let extraction = null;
  let corpus = null;
  let metabolism = null;
  let extractionError = null;
  if (schema) {
    try {
      extraction = extractCapabilitiesFromJsonSchema(schema, {
        id: 'ai_donor_measurement',
        provenance: ['ai-assimilation-threshold:blind-json-schema-donor'],
      });
      corpus = forgeEquivalenceCorpus(extraction, { maxCasesPerCapability: 64 });
      metabolism = metabolizeSourceCapabilityBundle(extraction, {
        subject: `rbc13_ai_assimilation_${tier}`,
      });
    } catch (error) {
      extractionError = String(error?.message ?? error);
    }
  }
  const negativeControl = schema
    ? runNegativeSchemaControl(schema, contract)
    : { mutation: 'unavailable', detected: false };
  const candidateReport = metabolism?.reports?.[0] ?? null;
  const stages = {
    contract: contractPass,
    extraction: Boolean(extraction),
    signature: Boolean(schema) && Boolean(generated.responseRoot),
    corpus: Boolean(corpus) && Number(corpus.capabilityCount ?? 0) > 0,
    candidate: Boolean(candidateReport) && ['semantic-absorbed', 'native-candidate'].includes(candidateReport.assessment?.stage),
    differential: false,
    mutantDetection: negativeControl.detected === true,
    nativeCandidate: false,
    promotion: false,
  };
  const level = classifyAiAssimilationLevel(stages);
  const status = level === 'L4' ? 'VERIFIED' : (contractPass ? 'NEGATIVE_RESULT' : 'NEGATIVE_RESULT');
  return Object.freeze({
    ...base,
    status,
    level,
    generation: {
      status: generated.status,
      model: generated.model,
      responseRoot: generated.responseRoot,
      apiPayloadRoot: generated.apiPayloadRoot,
      createdAt: generated.createdAt,
      durationMs: generated.durationMs,
      responseTail: generated.rawResponse.slice(-4000),
    },
    donorSpec: {
      root: realityRoot(contract),
      format: contract.format,
      task: contract.task,
    },
    schema: schema ? {
      root: realityRoot(schema),
      responseRoot: generated.responseRoot,
      parseError,
      evaluation: schemaEvaluation,
    } : { root: null, responseRoot: generated.responseRoot, parseError, evaluation: schemaEvaluation },
    extraction: extraction ? {
      format: extraction.format,
      root: extraction.root,
      sourceRoot: extraction.sourceRoot,
      capabilityCount: extraction.capabilityCount,
    } : null,
    signature: {
      promptRoot: realityRoot(RBC13_AI_ASSIMILATION_PROMPT),
      responseRoot: generated.responseRoot,
      schemaRoot: schema ? realityRoot(schema) : null,
      extractionRoot: extraction?.root ?? null,
    },
    contract: {
      passed: contractPass,
      evaluation: schemaEvaluation,
      parseError,
    },
    corpus: summarizeCorpus(corpus),
    candidate: candidateReport ? {
      status: candidateReport.assessment?.stage ?? 'UNKNOWN',
      root: candidateReport.root,
      specRoot: candidateReport.specRoot,
      semanticKernelRoot: candidateReport.semanticKernelRoot,
      generatedRclRoot: candidateReport.generatedRclRoot,
      absorptionRoot: candidateReport.absorptionRoot,
      gaps: candidateReport.assessment?.gaps ?? [],
    } : null,
    differential: {
      status: 'BLOCKED',
      reason: 'RCL has no independent executable JSON Schema validator adapter in this repository; schema extraction is not differential execution',
      sourceAdapter: 'unavailable',
      absorbedAdapter: 'unavailable',
      humanInterventions: 0,
    },
    negativeControl,
    repairAttempt: base.repairAttempt,
    nativeCandidate: {
      status: 'BLOCKED',
      reason: 'no native JSON Schema validator/bytecode adapter is present; no implementation was generated or repaired',
      candidateRoot: candidateReport?.root ?? null,
    },
    promotionAttempt: {
      status: 'BLOCKED',
      reason: 'promotion requires independent differential plus native candidate evidence',
      canonicalAdmission: false,
    },
    stages,
    extractionError,
    boundary: 'The model is credited only for the blind donor response and the RCL source-frontend extraction/corpus stages. Differential, native-candidate, and promotion stages remain uncredited without an independent executable JSON Schema adapter.',
  });
}

export async function runRbc13AiAssimilationThreshold(options = {}) {
  const contractPath = options.contractPath;
  const contract = options.contract ?? JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const models = options.models ?? RBC13_AI_ASSIMILATION_TIERS;
  const listedModels = options.listedModels ?? listModels();
  const protocol = {
    endpoint: options.endpoint ?? `${process.env.OLLAMA_HOST?.startsWith('http') ? process.env.OLLAMA_HOST : `http://${process.env.OLLAMA_HOST ?? '127.0.0.1:11434'}`}/api/generate`,
    temperature: options.temperature ?? 0,
    seed: options.seed ?? 13013,
    numPredict: options.numPredict ?? 384,
    timeoutMs: options.timeoutMs ?? 180_000,
  };
  const attempts = [];
  for (const modelSpec of models) {
    const info = modelInfo(modelSpec.model, listedModels);
    if (!info.available) {
      attempts.push(Object.freeze({
        tier: modelSpec.tier,
        model: modelSpec.model,
        modelInfo: info,
        attempt: 1,
        status: 'BLOCKED',
        level: 'L0',
        humanInterventions: 0,
        protocol: {
          version: RBC13_AI_ASSIMILATION_PROTOCOL_VERSION,
          promptRoot: realityRoot(RBC13_AI_ASSIMILATION_PROMPT),
          temperature: protocol.temperature,
          seed: protocol.seed,
          format: 'json',
          numPredict: protocol.numPredict,
        },
        blockedReason: 'model-not-present-in-ollama-list',
        repairAttempt: { attempted: false, humanInterventions: 0, modelRepairCalls: 0 },
        stages: { contract: false, extraction: false, corpus: false, candidate: false, differential: false, nativeCandidate: false, promotion: false },
      }));
      continue;
    }
    attempts.push(await runAttempt({
      tier: modelSpec.tier,
      model: modelSpec.model,
      contract,
      modelInfoValue: info,
      protocol,
    }));
  }
  const allTiersPresent = attempts.every(item => item.modelInfo?.available === true);
  const allL4 = attempts.length === models.length && attempts.every(item => item.level === 'L4');
  const maxLevel = Math.max(...attempts.map(item => RBC13_AI_ASSIMILATION_LEVELS.indexOf(item.level)), -1);
  const minLevel = Math.min(...attempts.map(item => RBC13_AI_ASSIMILATION_LEVELS.indexOf(item.level)), 0);
  const conclusion = allL4 && attempts.every(item => item.humanInterventions === 0)
    ? 'VERIFIED'
    : (allTiersPresent ? 'NEGATIVE_RESULT' : 'BLOCKED');
  const body = {
    format: RBC13_AI_ASSIMILATION_THRESHOLD_FORMAT,
    version: '0.1.0',
    status: conclusion,
    protocol: {
      version: RBC13_AI_ASSIMILATION_PROTOCOL_VERSION,
      promptRoot: realityRoot(RBC13_AI_ASSIMILATION_PROMPT),
      donorSpecRoot: realityRoot(contract),
      temperature: protocol.temperature,
      seed: protocol.seed,
      format: 'json',
      numPredict: protocol.numPredict,
      endpoint: protocol.endpoint,
    },
    donorSpec: {
      format: contract.format,
      root: realityRoot(contract),
      modelDeclaredByHistoricalContract: contract.model,
    },
    baseline: options.baseline ?? null,
    attempts,
    summary: {
      tierCount: models.length,
      testedTierCount: attempts.filter(item => item.generation?.status === 'live').length,
      availableTierCount: attempts.filter(item => item.modelInfo?.available === true).length,
      humanInterventions: attempts.reduce((sum, item) => sum + Number(item.humanInterventions ?? 0), 0),
      minimumObservedLevel: minLevel >= 0 ? RBC13_AI_ASSIMILATION_LEVELS[minLevel] : null,
      maximumObservedLevel: maxLevel >= 0 ? RBC13_AI_ASSIMILATION_LEVELS[maxLevel] : null,
      allTiersReachedL4: allL4,
      allTiersPresent,
    },
    threshold: {
      levels: {
        L0: 'donor response unavailable or contract invalid',
        L1: 'contract plus extraction/corpus not complete',
        L2: 'semantic candidate exists but independent differential is unavailable or failed',
        L3: 'independent differential exists but native candidate or promotion is incomplete',
        L4: 'native candidate and promotion evidence are independently verified with zero human repair',
      },
      conclusion: allL4 ? 'L4 observed across every tested tier' : 'No tested tier reached L4; no native promotion credit is granted',
      scope: 'This threshold conclusion is scoped to the declared JSON Schema donor, protocol, and listed local Ollama models. It is not a general claim about AI capability.',
    },
    chain: [
      'Donor Spec', 'Extraction', 'Signature', 'Contract', 'Positive/Negative Corpus',
      'Candidate', 'Differential', 'Mutant Detection', 'Repair Attempt', 'Native Candidate', 'Promotion Attempt',
    ],
    boundary: 'No implementation code, hidden tests, expected outputs, or human repair were sent to or applied to any model. A failed model is not repaired or upgraded.',
    reproductionCommand: 'npm run verify:rbc13-ai-assimilation-threshold',
  };
  return Object.freeze({ ...body, root: realityRoot(body) });
}

export function renderRbc13AiAssimilationThresholdMarkdown(report) {
  const rows = report.attempts.map(attempt => `| ${attempt.tier} | ${attempt.model} | ${attempt.modelInfo?.modelVersion ?? 'UNAVAILABLE'} | ${attempt.status} | ${attempt.level} | ${attempt.humanInterventions} | ${attempt.candidate?.status ?? 'none'} | ${attempt.nativeCandidate?.status ?? 'BLOCKED'} | ${attempt.promotionAttempt?.status ?? 'BLOCKED'} |`).join('\n');
  return `# RCL AI Assimilation Intelligence Threshold v0.1\n\n- Status: **${report.status}**\n- Evidence root: \`${report.root}\`\n- Donor spec root: \`${report.donorSpec.root}\`\n- Prompt root: \`${report.protocol.promptRoot}\`\n- Protocol: ${report.protocol.version}; temperature=${report.protocol.temperature}; seed=${report.protocol.seed}; format=${report.protocol.format}\n- Human interventions: ${report.summary.humanInterventions}\n\n## Tier results\n\n| Tier | Model | Ollama version | Status | Level | Human repair | Candidate | Native candidate | Promotion |\n|---|---|---|---|---|---:|---|---|---|\n${rows}\n\n## Threshold levels\n\n${Object.entries(report.threshold.levels).map(([level, description]) => `- ${level}: ${description}`).join('\n')}\n\n## Required chain\n\n${report.chain.join(' → ')}\n\n## Conclusion\n\n${report.threshold.conclusion}. Minimum observed level: **${report.summary.minimumObservedLevel ?? 'none'}**; maximum observed level: **${report.summary.maximumObservedLevel ?? 'none'}**. ${report.threshold.scope}\n\n## Boundary\n\n${report.boundary}\n`;
}

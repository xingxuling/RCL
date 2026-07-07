import { RCLRuntimeError } from './errors.mjs';
import { runtimeType } from './quantity.mjs';

function bounded(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new RCLRuntimeError('RCL_COGNITIVE_SCORE_RANGE', `${label} must be between 0 and 1`, { value });
  }
  return number;
}

export function utterance(text, options = {}) {
  if (typeof text !== 'string') throw new RCLRuntimeError('RCL_UTTERANCE_TYPE', 'Utterance text must be Text');
  return Object.freeze({
    kind: 'Utterance',
    text,
    speaker: options.speaker ?? 'unknown',
    locale: options.locale ?? 'und',
    channel: options.channel ?? 'text',
    evidence: [...new Set(options.evidence ?? [])],
    formedAtRoot: options.formedAtRoot ?? null,
  });
}

export function isUtterance(value) { return Boolean(value) && value.kind === 'Utterance' && typeof value.text === 'string'; }

export function intent(name, options = {}) {
  return Object.freeze({
    kind: 'Intent',
    name,
    active: Boolean(options.active),
    action: options.action ?? '',
    target: options.target ?? '',
    confidence: bounded(options.confidence ?? 1, 'Intent confidence'),
    evidence: [...new Set(options.evidence ?? [])],
    utterances: [...new Set(options.utterances ?? [])],
    slots: structuredClone(options.slots ?? {}),
    formedAtRoot: options.formedAtRoot ?? null,
  });
}

export function isIntent(value) { return Boolean(value) && value.kind === 'Intent' && typeof value.name === 'string'; }

export function understandingType(baseType) { return `Understand<${baseType}>`; }
export function isUnderstandingType(type) { return typeof type === 'string' && /^Understand<.+>$/.test(type); }
export function understandingBaseType(type) { return isUnderstandingType(type) ? type.slice(11, -1) : null; }

export function understanding(baseType, value, options = {}) {
  const actual = runtimeType(value);
  if (actual !== baseType) {
    throw new RCLRuntimeError('RCL_UNDERSTANDING_TYPE', `Understanding ${baseType} received ${actual}`, { baseType, actual });
  }
  return Object.freeze({
    kind: 'Understanding',
    baseType,
    value,
    confidence: bounded(options.confidence ?? 1, 'Understanding confidence'),
    explanation: options.explanation ?? '',
    evidence: [...new Set(options.evidence ?? [])],
    dependencies: [...new Set(options.dependencies ?? [])],
    coverage: bounded(options.coverage ?? 1, 'Understanding coverage'),
    coherence: bounded(options.coherence ?? 1, 'Understanding coherence'),
    status: options.status ?? 'hypothesis',
    formedAtRoot: options.formedAtRoot ?? null,
  });
}

export function isUnderstanding(value) {
  return Boolean(value) && value.kind === 'Understanding' && typeof value.baseType === 'string'
    && typeof value.confidence === 'number';
}

export function creationType(baseType) { return `Create<${baseType}>`; }
export function isCreationType(type) { return typeof type === 'string' && /^Create<.+>$/.test(type); }
export function creationBaseType(type) { return isCreationType(type) ? type.slice(7, -1) : null; }

export function creationCandidate(baseType, value, options = {}) {
  const actual = runtimeType(value);
  if (actual !== baseType) {
    throw new RCLRuntimeError('RCL_CREATION_TYPE', `Creation ${baseType} received ${actual}`, { baseType, actual });
  }
  const novelty = bounded(options.novelty ?? 0.5, 'Creation novelty');
  const utility = bounded(options.utility ?? 0.5, 'Creation utility');
  const feasibility = bounded(options.feasibility ?? 0.5, 'Creation feasibility');
  const risk = bounded(options.risk ?? 0.5, 'Creation risk');
  const active = options.active !== false;
  const score = active
    ? Math.max(0, Math.min(1, (utility * 0.45) + (feasibility * 0.30) + (novelty * 0.15) + ((1 - risk) * 0.10)))
    : 0;
  return Object.freeze({
    kind: 'Creation',
    baseType,
    value,
    active,
    target: options.target ?? '',
    novelty,
    utility,
    feasibility,
    risk,
    score,
    status: options.status ?? (active ? 'candidate' : 'inactive'),
    evidence: [...new Set(options.evidence ?? [])],
    basedOn: [...new Set(options.basedOn ?? [])],
    formedAtRoot: options.formedAtRoot ?? null,
  });
}

export function selectCreation(candidate, selectedFrom = []) {
  if (!isCreation(candidate)) throw new RCLRuntimeError('RCL_EXPECTED_CREATION', 'Selection expects a creation candidate');
  return Object.freeze({
    ...structuredClone(candidate),
    status: 'selected',
    selectedFrom: [...selectedFrom],
  });
}

export function isCreation(value) {
  return Boolean(value) && value.kind === 'Creation' && typeof value.baseType === 'string'
    && typeof value.score === 'number';
}

export function evidenceConfidence(value) {
  if (isIntent(value) || isUnderstanding(value)) return value.confidence;
  if (isCreation(value)) return value.score;
  if (isUtterance(value)) return 1;
  if (value && typeof value === 'object' && typeof value.confidence === 'number') return value.confidence;
  throw new RCLRuntimeError('RCL_EXPECTED_COGNITIVE_OBJECT', 'Expected an evidence-bearing cognitive object');
}

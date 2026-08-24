import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { realityRoot } from './canonical.mjs';
import { compileReality } from './compiler.mjs';

export const LANGUAGE_FEDERATION_VERSION = '0.1.0';
export const LANGUAGE_FEDERATION_FORMAT = 'taowind.language-federation.result.v0.1';
export const ASIL_PROGRAMMING_PROFILE_FORMAT = 'taowind.asil.programming-profile.v0.1';
export const RSL_SURFACE_AST_FORMAT = 'taowind.rsl.surface-ast.v0.1';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_ROOT = path.join(ROOT, 'language-federation', 'registry');
const STATUS = new Set(['IDEA', 'HISTORICAL', 'SPECIFIED', 'FORMALIZED', 'EXECUTABLE', 'CANDIDATE', 'READY', 'VERIFIED', 'SUPERSEDED', 'ARCHIVED', 'UNKNOWN']);
const LANGUAGE_FIELDS = [
  'id', 'name', 'version', 'role', 'status', 'canonical_owner_of', 'does_not_own',
  'input', 'output', 'compiler_target', 'runtime', 'authority_model', 'evidence_model',
  'lifecycle', 'source_repository', 'source_revision', 'source_paths', 'tests', 'verification',
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadLanguageFederationRegistry(root = REGISTRY_ROOT) {
  return {
    languages: readJson(path.join(root, 'languages.json')),
    owners: readJson(path.join(root, 'semantic-owners.json')),
    profiles: readJson(path.join(root, 'profiles.json')),
    translators: readJson(path.join(root, 'translators.json')),
    backends: readJson(path.join(root, 'execution-backends.json')),
  };
}

export function validateLanguageFederationRegistry(registry = loadLanguageFederationRegistry()) {
  const failures = [];
  const ids = new Set();
  const profileIds = new Set(registry.profiles?.profiles?.map((profile) => profile.id) ?? []);
  for (const language of registry.languages?.languages ?? []) {
    for (const field of LANGUAGE_FIELDS) if (!(field in language)) failures.push(`language:${language.id ?? 'unknown'}:missing:${field}`);
    if (!STATUS.has(language.status)) failures.push(`language:${language.id}:invalid-status:${language.status}`);
    if (ids.has(language.id)) failures.push(`language:duplicate-id:${language.id}`);
    ids.add(language.id);
    for (const field of ['canonical_owner_of', 'does_not_own', 'input', 'output', 'compiler_target', 'runtime', 'source_paths', 'tests']) {
      if (!Array.isArray(language[field])) failures.push(`language:${language.id}:${field}:not-array`);
    }
  }
  for (const owner of registry.owners?.owners ?? []) {
    if (!ids.has(owner.owner)) failures.push(`owner:${owner.capability}:unknown-language:${owner.owner}`);
  }
  for (const translator of registry.translators?.translators ?? []) {
    if (!ids.has(translator.source)) failures.push(`translator:${translator.id}:unknown-source:${translator.source}`);
    if (!ids.has(translator.target)) failures.push(`translator:${translator.id}:unknown-target:${translator.target}`);
    if (!profileIds.has(translator.profile)) failures.push(`translator:${translator.id}:unknown-profile:${translator.profile}`);
  }
  return { valid: failures.length === 0, failures, registryRoot: realityRoot(registry) };
}

export function detectDuplicateSemanticOwners(registry = loadLanguageFederationRegistry()) {
  const declared = new Map();
  for (const language of registry.languages?.languages ?? []) {
    for (const capability of language.canonical_owner_of ?? []) {
      if (!declared.has(capability)) declared.set(capability, []);
      declared.get(capability).push(language.id);
    }
  }
  const conflicts = [...declared.entries()]
    .filter(([, owners]) => new Set(owners).size > 1)
    .map(([capability, owners]) => ({ capability, owners: [...new Set(owners)].sort(), status: 'CONFLICT' }));

  const exclusive = new Map();
  for (const owner of registry.owners?.owners ?? []) {
    if (!owner.exclusive) continue;
    const key = `${owner.scope}:${owner.capability}`;
    if (!exclusive.has(key)) exclusive.set(key, []);
    exclusive.get(key).push(owner.owner);
  }
  for (const [key, owners] of exclusive) {
    if (new Set(owners).size > 1) conflicts.push({ capability: key, owners: [...new Set(owners)].sort(), status: 'CONFLICT' });
  }
  return { status: conflicts.length ? 'CONFLICT' : 'PASS', conflicts, checkedClaims: declared.size, root: realityRoot({ conflicts }) };
}

function normalizeProjectId(value) {
  if (!/^[a-z][a-z0-9_-]{2,31}$/.test(value ?? '')) throw new Error('RSL_PROJECT_ID_INVALID');
  return value;
}

export function parseRslSurface(text, locale) {
  const source = String(text ?? '').trim();
  let match;
  let ast;
  if (locale === 'zh-CN' && (match = /^建立项目\s+([a-z][a-z0-9_-]{2,31})$/.exec(source))) {
    ast = { format: RSL_SURFACE_AST_FORMAT, locale, type: 'RslZhCnVerbObjectCommand', verb: '建立', object: '项目', projectId: normalizeProjectId(match[1]) };
  } else if (locale === 'en-US' && (match = /^create project\s+([a-z][a-z0-9_-]{2,31})$/i.exec(source))) {
    ast = { format: RSL_SURFACE_AST_FORMAT, locale, type: 'RslEnUsImperative', verb: 'create', directObject: 'project', projectId: normalizeProjectId(match[1].toLowerCase()) };
  } else {
    return {
      status: 'CLARIFICATION_REQUIRED',
      locale,
      source,
      ambiguity: 'unsupported-or-ambiguous-surface',
      alternatives: ['建立项目 <project-id>', 'create project <project-id>'],
      authorityGranted: false,
      root: realityRoot({ locale, source, status: 'CLARIFICATION_REQUIRED' }),
    };
  }
  ast.root = realityRoot(ast);
  return { status: 'PARSED', locale, source, ast, root: realityRoot({ locale, source, astRoot: ast.root }) };
}

export function rslAstToAsilProgrammingProfile(ast, { evidenceRefs = ['federation:rsl-corpus:v0.1'] } = {}) {
  if (!ast || ast.format !== RSL_SURFACE_AST_FORMAT) throw new Error('RSL_AST_REQUIRED');
  const semantic = {
    format: ASIL_PROGRAMMING_PROFILE_FORMAT,
    profile: 'programming',
    frameType: 'TaskFrame',
    W: { speech_act: 'request', literal_goal: 'create-project' },
    B: { entity: 'project', relation: 'create', project_id: normalizeProjectId(ast.projectId), negation: false, scope: 'named-project' },
    G: { action: 'propose-project-creation', permission: 'candidate-only', effect: 'no-reality-commit' },
    E: { epistemic_status: 'candidate', evidence: [...evidenceRefs].sort(), uncertainty: 'none-within-frozen-subset' },
    M: { version: LANGUAGE_FEDERATION_VERSION, artifact: 'rcl-candidate-program' },
  };
  const meaningRoot = realityRoot(semantic);
  return {
    format: 'taowind.asil.surface-envelope.v0.1',
    semantic,
    meaningRoot,
    surface: { locale: ast.locale, astRoot: ast.root },
    authorityGranted: false,
    realityCommitRequested: false,
    root: realityRoot({ semantic, surface: { locale: ast.locale, astRoot: ast.root } }),
  };
}

export function renderRslSurface(semanticOrEnvelope, locale) {
  const semantic = semanticOrEnvelope?.semantic ?? semanticOrEnvelope;
  if (semantic?.format !== ASIL_PROGRAMMING_PROFILE_FORMAT || semantic?.B?.relation !== 'create') throw new Error('ASIL_PROGRAMMING_PROFILE_UNSUPPORTED');
  const projectId = normalizeProjectId(semantic.B.project_id);
  if (locale === 'zh-CN') return `建立项目 ${projectId}`;
  if (locale === 'en-US') return `create project ${projectId}`;
  throw new Error(`RSL_LOCALE_UNSUPPORTED:${locale}`);
}

export function renderAsilProgrammingProfileToRcl(semanticOrEnvelope) {
  const semantic = semanticOrEnvelope?.semantic ?? semanticOrEnvelope;
  if (semantic?.format !== ASIL_PROGRAMMING_PROFILE_FORMAT || semantic?.G?.permission !== 'candidate-only') throw new Error('ASIL_AUTHORITY_BOUNDARY_REQUIRED');
  const projectId = normalizeProjectId(semantic.B.project_id);
  const realityName = `FederationProject_${projectId.replaceAll('-', '_')}`;
  return `reality ${realityName} {
  facet project.id : Text = "${projectId}"
  facet project.status : Text = "candidate"

  subject requester {
    warrant project.propose on project
  }

  emergence propose {
    cause requester
    when project.status == "candidate"
    needs project.propose on project
    alter project.status <- "proposed"
    preserve project.status == "proposed"
    witness "language-federation:rsl-to-asil-to-rcl:v0.1"
  }

  foresee propose
}
`;
}

export function compileRslSurfaceToRcl(text, locale) {
  const parsed = parseRslSurface(text, locale);
  if (parsed.status !== 'PARSED') return { ...parsed, format: LANGUAGE_FEDERATION_FORMAT };
  const asil = rslAstToAsilProgrammingProfile(parsed.ast);
  const rclSource = renderAsilProgrammingProfileToRcl(asil);
  const rclProgram = compileReality(rclSource);
  return {
    format: LANGUAGE_FEDERATION_FORMAT,
    version: LANGUAGE_FEDERATION_VERSION,
    status: 'CANDIDATE',
    locale,
    surfaceAst: parsed.ast,
    meaningRoot: asil.meaningRoot,
    semantic: asil.semantic,
    rclSource,
    rclProgramRoot: rclProgram.programRoot,
    authorityGranted: false,
    realityCommitRequested: false,
    canonicalPath: ['rsl-candidate', 'asil-programming-profile', 'rcl'],
    root: realityRoot({ meaningRoot: asil.meaningRoot, rclProgramRoot: rclProgram.programRoot, authorityGranted: false }),
  };
}

export function runRslFederationBenchmark(corpus) {
  const cases = corpus?.cases ?? [];
  const results = cases.map((entry) => {
    const left = compileRslSurfaceToRcl(entry.surfaces['zh-CN'], 'zh-CN');
    const right = compileRslSurfaceToRcl(entry.surfaces['en-US'], 'en-US');
    const zhRoundTrip = compileRslSurfaceToRcl(renderRslSurface(left.semantic, 'zh-CN'), 'zh-CN');
    const enRoundTrip = compileRslSurfaceToRcl(renderRslSurface(right.semantic, 'en-US'), 'en-US');
    const pass = left.status === 'CANDIDATE' && right.status === 'CANDIDATE'
      && left.surfaceAst.root !== right.surfaceAst.root
      && left.meaningRoot === right.meaningRoot
      && left.rclProgramRoot === right.rclProgramRoot
      && zhRoundTrip.meaningRoot === left.meaningRoot
      && enRoundTrip.meaningRoot === right.meaningRoot
      && left.authorityGranted === false
      && right.authorityGranted === false;
    return { id: entry.id, pass, meaningRoot: left.meaningRoot, rclProgramRoot: left.rclProgramRoot, surfaceRootsDiffer: left.surfaceAst.root !== right.surfaceAst.root };
  });
  const negatives = (corpus?.negative_cases ?? []).map((entry) => {
    const result = compileRslSurfaceToRcl(entry.surface, entry.locale);
    return { id: entry.id, pass: result.status === entry.expected_status && result.authorityGranted === false, status: result.status };
  });
  return {
    format: 'taowind.language-federation.benchmark-report.v0.1',
    version: LANGUAGE_FEDERATION_VERSION,
    status: results.every((entry) => entry.pass) && negatives.every((entry) => entry.pass) ? 'PASS' : 'FAIL',
    caseCount: results.length,
    surfaceCount: results.length * 2,
    negativeCaseCount: negatives.length,
    results,
    negatives,
    boundary: 'Only the frozen create-project subset is verified. This does not establish a general RSL, general ASIL-to-RCL compiler, or translation-granted authority.',
    root: realityRoot({ results, negatives }),
  };
}

export function buildLanguageFederationEvidence({ corpus } = {}) {
  const registry = loadLanguageFederationRegistry();
  const validation = validateLanguageFederationRegistry(registry);
  const duplication = detectDuplicateSemanticOwners(registry);
  const benchmark = runRslFederationBenchmark(corpus ?? readJson(path.join(ROOT, 'examples', 'language-federation', 'rsl-corpus.v0.1.json')));
  const result = {
    format: 'taowind.language-federation.evidence.v0.1',
    version: LANGUAGE_FEDERATION_VERSION,
    status: validation.valid && duplication.status === 'PASS' && benchmark.status === 'PASS' ? 'CANDIDATE' : 'BLOCKED',
    registry: { languageCount: registry.languages.languages.length, translatorCount: registry.translators.translators.length, backendCount: registry.backends.backends.length, root: validation.registryRoot },
    duplicateSemantics: duplication,
    benchmark,
    knownUnknowns: ['IAL-to-ASIL round-trip', 'SNLL-to-ASIL adapter', 'CSL-to-ASIL adapter', 'general RSL grammar', 'general ASIL-to-RCL lowering'],
  };
  result.root = realityRoot(result);
  return result;
}

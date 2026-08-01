import {
  createCorpusCase,
  createMutationPlan,
  finalizeCapabilityCorpus,
  safeIdentifier,
} from './equivalence-corpus-common.mjs';

function sampleForLabel(label) {
  const value = String(label ?? 'any').toLowerCase();
  if (value.includes('integer') || value.includes('number')) return 1;
  if (value.includes('boolean')) return true;
  if (value.includes('array')) return [];
  if (value.includes('object') || value.includes('json')) return {};
  return 'value';
}

function modelFromSpec(spec) {
  const model = { method: 'GET', path: '/', parameters: [], requestBodyRequired: false, requestContent: [], responses: [] };
  for (const invariant of spec.semantics?.invariants ?? []) {
    const text = String(invariant);
    const method = text.match(/^http method (.+)$/);
    const path = text.match(/^http path (.+)$/);
    const parameter = text.match(/^required (path|query|header|cookie) parameter ([^:]+):(.+)$/);
    const requestContent = text.match(/^request content (.+)$/);
    const response = text.match(/^declared response (.+)$/);
    if (method) model.method = method[1];
    else if (path) model.path = path[1];
    else if (parameter) model.parameters.push({ in: parameter[1], name: parameter[2], schema: parameter[3] });
    else if (text === 'request body required') model.requestBodyRequired = true;
    else if (requestContent) model.requestContent.push(requestContent[1]);
    else if (response) model.responses.push(response[1]);
  }
  return model;
}

function nominalInput(model) {
  const parameters = { path: {}, query: {}, header: {}, cookie: {} };
  for (const parameter of model.parameters) parameters[parameter.in][parameter.name] = sampleForLabel(parameter.schema);
  const firstContent = model.requestContent[0] ?? null;
  return {
    kind: 'openapi-contract-probe',
    mode: 'request',
    method: model.method,
    pathTemplate: model.path,
    parameters,
    requestBody: firstContent ? { contract: firstContent, value: sampleForLabel(firstContent) } : null,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function forgeOpenApiCapabilityCorpus(spec, options = {}) {
  const capability = safeIdentifier(spec.id);
  const model = modelFromSpec(spec);
  const maxCases = Number.isInteger(options.maxCasesPerCapability) ? options.maxCasesPerCapability : 64;
  const cases = [];
  const plans = [];
  const add = raw => {
    if (cases.length >= maxCases) return null;
    const testCase = createCorpusCase(raw);
    cases.push(testCase);
    return testCase;
  };
  const nominal = nominalInput(model);
  add({
    id: `${capability}_valid_nominal_request`, capability, classification: 'valid', input: nominal,
    expected: { status: 'accept', reason: 'all extracted required request contracts are present' },
    targets: [`method:${model.method}`, `path:${model.path}`], tags: ['openapi', 'request'], provenance: [spec.root],
  });

  for (const parameter of model.parameters) {
    const missing = clone(nominal);
    delete missing.parameters[parameter.in][parameter.name];
    const missingCase = add({
      id: `${capability}_invalid_missing_${parameter.in}_${parameter.name}`, capability, classification: 'invalid', input: missing,
      expected: { status: 'reject', reason: `required ${parameter.in} parameter '${parameter.name}' is absent`, errorClass: 'required-parameter' },
      targets: [`required:${parameter.in}:${parameter.name}:${parameter.schema}`], tags: ['openapi', 'required-parameter'], provenance: [spec.root],
    });
    if (missingCase) plans.push(createMutationPlan({
      id: `${capability}_mutant_ignore_${parameter.in}_${parameter.name}`, capability, operator: 'ignore-required-parameter',
      target: `${parameter.in}:${parameter.name}`, description: `Mutant accepts a request missing required parameter '${parameter.name}'.`,
      expectedDetectionCaseIds: [missingCase.id],
    }));
    const empty = clone(nominal);
    empty.parameters[parameter.in][parameter.name] = '';
    add({
      id: `${capability}_boundary_empty_${parameter.in}_${parameter.name}`, capability, classification: 'boundary', input: empty,
      expected: { status: 'observe', reason: 'required parameter presence is known, but emptiness semantics are not encoded by the extracted contract' },
      targets: [`required:${parameter.in}:${parameter.name}`], tags: ['openapi', 'boundary', 'no-overclaim'], provenance: [spec.root],
    });
  }

  if (model.requestBodyRequired) {
    const missingBody = clone(nominal);
    missingBody.requestBody = null;
    const bodyCase = add({
      id: `${capability}_invalid_missing_request_body`, capability, classification: 'invalid', input: missingBody,
      expected: { status: 'reject', reason: 'request body is declared required', errorClass: 'required-body' },
      targets: ['request-body:required'], tags: ['openapi', 'request-body'], provenance: [spec.root],
    });
    if (bodyCase) plans.push(createMutationPlan({
      id: `${capability}_mutant_ignore_required_body`, capability, operator: 'ignore-required-body', target: 'requestBody',
      description: 'Mutant accepts a request without its required body.', expectedDetectionCaseIds: [bodyCase.id],
    }));
  }

  for (const status of model.responses) {
    add({
      id: `${capability}_response_contract_${status}`, capability, classification: 'boundary',
      input: {
        kind: 'openapi-contract-probe', mode: 'response', method: model.method,
        pathTemplate: model.path, status, responseBody: null,
      },
      expected: { status: 'observe', reason: `status ${status} is declared, but a concrete response body witness is not preserved in v0.1 invariants` },
      targets: [`response:${status}`], tags: ['openapi', 'response', 'no-overclaim'], provenance: [spec.root],
    });
  }

  plans.push(createMutationPlan({
    id: `${capability}_mutant_accept_undeclared_status`, capability, operator: 'accept-undeclared-status', target: 'responses',
    description: 'Mutant treats an undeclared response status as contract-valid.',
    expectedDetectionCaseIds: [],
  }));

  return finalizeCapabilityCorpus({
    spec,
    frontend: 'openapi',
    cases,
    mutationPlans: plans,
    diagnostics: [{
      level: 'info', code: 'RCL_CORPUS_OPENAPI_NO_NETWORK_EXECUTION',
      message: 'Corpus cases are contract probes. The forge never invokes declared servers or performs HTTP side effects.',
    }],
    coverage: {
      method: model.method,
      path: model.path,
      requiredParameterCount: model.parameters.length,
      requestBodyRequired: model.requestBodyRequired,
      declaredResponseCount: model.responses.length,
      requestCaseCount: cases.filter(testCase => testCase.input?.mode === 'request').length,
      responseProbeCount: cases.filter(testCase => testCase.input?.mode === 'response').length,
      truncated: cases.length >= maxCases,
    },
  });
}

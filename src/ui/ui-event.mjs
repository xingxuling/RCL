import { evaluateUiExpression } from './ui-reactive.mjs';

function cloneState(value) {
  return structuredClone(value);
}

function matchesUiType(value, valueType) {
  if (valueType === 'Number') return typeof value === 'number' && Number.isFinite(value);
  if (valueType === 'Text') return typeof value === 'string';
  if (valueType === 'Truth') return typeof value === 'boolean';
  return false;
}

function nodeMap(root, map = new Map()) {
  map.set(root.id, root);
  for (const child of root.children) nodeMap(child, map);
  return map;
}

export function createNativeUiRuntime(program, options = {}) {
  const state = Object.fromEntries(program.state.map((item) => [item.id, cloneState(item.initial)]));
  const nodes = nodeMap(program.viewTree);
  const trace = [];
  const lifecycleTrace = [];
  const gateway = options.realityGateway ?? null;

  const projection = (event = {}) => {
    const derivedCache = new Map();
    const derived = (id) => {
      if (derivedCache.has(id)) return derivedCache.get(id);
      const decl = program.derivedState.find((item) => item.id === id);
      if (!decl) throw new Error(`RCL_UI_DERIVED_MISSING:${id}`);
      const value = evaluateUiExpression(decl.expression, { state, event, derived });
      derivedCache.set(id, value);
      return value;
    };
    const values = {};
    for (const item of program.derivedState) values[item.id] = derived(item.id);
    const rendered = {};
    for (const [id, node] of nodes) {
      rendered[id] = Object.fromEntries(node.bindings.map((binding) => [
        binding.property,
        evaluateUiExpression(binding.expression, { state, event, derived }),
      ]));
    }
    return { state: cloneState(state), derived: values, rendered };
  };

  const lifecycle = (stage, snapshot = null) => {
    if (!program.lifecycle.stages.includes(stage)) throw new Error(`RCL_UI_LIFECYCLE_NOT_DECLARED:${stage}`);
    if (stage === 'create' && snapshot) {
      for (const id of program.lifecycle.restore) {
        if (Object.prototype.hasOwnProperty.call(snapshot, id)) {
          const declaration = program.state.find((item) => item.id === id);
          if (!matchesUiType(snapshot[id], declaration.valueType)) throw new Error(`RCL_UI_RESTORE_TYPE:${id}:${declaration.valueType}`);
          state[id] = cloneState(snapshot[id]);
        }
      }
    }
    const record = { stage, state: cloneState(state) };
    lifecycleTrace.push(record);
    return record;
  };

  const dispatch = (nodeId, eventType, payload = {}) => {
    const node = nodes.get(nodeId);
    if (!node) throw new Error(`RCL_UI_EVENT_NODE_UNKNOWN:${nodeId}`);
    const handler = node.events.find((item) => item.type === eventType);
    if (!handler) throw new Error(`RCL_UI_EVENT_HANDLER_UNKNOWN:${nodeId}:${eventType}`);
    for (const parameter of handler.parameters) {
      if (!Object.prototype.hasOwnProperty.call(payload, parameter.id)) throw new Error(`RCL_UI_EVENT_PARAMETER_MISSING:${nodeId}:${eventType}:${parameter.id}`);
      if (!matchesUiType(payload[parameter.id], parameter.valueType)) throw new Error(`RCL_UI_EVENT_PARAMETER_RUNTIME_TYPE:${nodeId}:${eventType}:${parameter.id}:${parameter.valueType}`);
    }
    const before = cloneState(state);
    const derived = (id) => {
      const decl = program.derivedState.find((item) => item.id === id);
      if (!decl) throw new Error(`RCL_UI_DERIVED_MISSING:${id}`);
      return evaluateUiExpression(decl.expression, { state: before, event: payload, derived });
    };
    if (handler.authority === 'reality-transaction') {
      if (!gateway) throw new Error(`RCL_UI_REALITY_GATEWAY_REQUIRED:${nodeId}:${eventType}`);
      for (const statement of handler.statements) gateway({ kind: 'CandidateReality', rule: statement.rule, nodeId, eventType, payload: cloneState(payload) });
    } else {
      const proposed = cloneState(before);
      for (const statement of handler.statements) {
        const next = evaluateUiExpression(statement.expression, { state: before, event: payload, derived });
        const declaration = program.state.find((item) => item.id === statement.target);
        if (!matchesUiType(next, declaration.valueType)) throw new Error(`RCL_UI_EVENT_MUTATION_RUNTIME_TYPE:${statement.target}:${declaration.valueType}`);
        proposed[statement.target] = next;
      }
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, proposed);
    }
    const afterProjection = projection(payload);
    const record = {
      sequence: trace.length + 1,
      event: { nodeId, type: eventType, payload: cloneState(payload), authority: handler.authority },
      beforeState: before,
      afterState: cloneState(state),
      renderedSemanticState: afterProjection.rendered,
    };
    trace.push(record);
    return record;
  };

  return Object.freeze({
    program,
    state,
    trace,
    lifecycleTrace,
    dispatch,
    lifecycle,
    projection,
    snapshot: () => cloneState(state),
  });
}

export function runNativeUiSemanticTrace(program, events, platform = 'canonical') {
  const runtime = createNativeUiRuntime(program);
  runtime.lifecycle('create');
  runtime.lifecycle('activate');
  const initial = runtime.projection();
  runtime.lifecycle('resume');
  for (const event of events) runtime.dispatch(event.nodeId, event.type, event.payload ?? {});
  runtime.lifecycle('suspend');
  runtime.lifecycle('destroy');
  return {
    format: 'rcl.native-ui.semantic-trace.v0.1',
    platform,
    uiProgramRoot: program.semanticRoot,
    initialState: initial.state,
    initialRenderedSemanticState: initial.rendered,
    events: cloneState(runtime.trace),
    finalState: runtime.snapshot(),
    finalRenderedSemanticState: runtime.projection().rendered,
    lifecycle: cloneState(runtime.lifecycleTrace),
  };
}

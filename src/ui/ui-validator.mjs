import {
  RCL_NATIVE_UI_FORMAT,
  UI_BINDABLE_PROPERTIES_BY_ROLE,
  UI_EVENT_TYPES,
  UI_PROPERTY_TYPES,
  UI_ROLES,
} from './ui-schema.mjs';
import { nativeUiRoot } from './ui-ir.mjs';

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

export function validateCanonicalNativeUi(program) {
  assert(program && program.format === RCL_NATIVE_UI_FORMAT, 'RCL_UI_SCHEMA_FORMAT');
  assert(typeof program.id === 'string' && program.id.length > 0, 'RCL_UI_SCHEMA_ID');
  assert(Array.isArray(program.state), 'RCL_UI_SCHEMA_STATE');
  assert(program.viewTree && typeof program.viewTree === 'object', 'RCL_UI_SCHEMA_VIEW_TREE');
  const stateIds = new Set();
  const stateTypes = new Map();
  for (const state of program.state) {
    assert(typeof state.id === 'string' && state.id.length > 0, 'RCL_UI_SCHEMA_STATE_ID');
    assert(!stateIds.has(state.id), `RCL_UI_STATE_DUPLICATE:${state.id}`);
    stateIds.add(state.id);
    assert(['Number', 'Text', 'Truth'].includes(state.valueType), `RCL_UI_SCHEMA_STATE_TYPE:${state.id}`);
    stateTypes.set(state.id, state.valueType);
  }
  const nodeIds = new Set();
  const walk = (node, identityPath = node.id) => {
    assert(typeof node.id === 'string' && node.id.length > 0, 'RCL_UI_NODE_ID_REQUIRED');
    assert(!nodeIds.has(node.id), `RCL_UI_NODE_ID_DUPLICATE:${node.id}`);
    assert(UI_ROLES.includes(node.role), `RCL_UI_NODE_ROLE:${node.role}`);
    assert(node.identityPath === identityPath, `RCL_UI_NODE_IDENTITY_PATH:${node.id}`);
    assert(Array.isArray(node.localProperties), `RCL_UI_NODE_PROPERTIES:${node.id}`);
    assert(Array.isArray(node.bindings), `RCL_UI_NODE_BINDINGS:${node.id}`);
    assert(Array.isArray(node.events), `RCL_UI_NODE_EVENTS:${node.id}`);
    assert(Array.isArray(node.children), `RCL_UI_NODE_CHILDREN:${node.id}`);
    nodeIds.add(node.id);
    for (const property of node.localProperties) {
      assert(UI_PROPERTY_TYPES[property.property] === property.valueType, `RCL_UI_SCHEMA_PROPERTY_TYPE:${node.id}:${property.property}`);
    }
    for (const binding of node.bindings) {
      assert(UI_BINDABLE_PROPERTIES_BY_ROLE[node.role].includes(binding.property), `RCL_UI_SCHEMA_BINDING_PROPERTY:${node.id}:${binding.property}`);
      assert(binding.expression?.valueType === UI_PROPERTY_TYPES[binding.property], `RCL_UI_SCHEMA_BINDING_TYPE:${node.id}:${binding.property}`);
    }
    for (const event of node.events ?? []) {
      assert(UI_EVENT_TYPES.includes(event.type), `RCL_UI_EVENT_TYPE:${event.type}`);
      const parameterIds = new Set();
      for (const parameter of event.parameters ?? []) {
        assert(typeof parameter.id === 'string' && parameter.id.length > 0, `RCL_UI_SCHEMA_EVENT_PARAMETER:${node.id}:${event.type}`);
        assert(!parameterIds.has(parameter.id), `RCL_UI_SCHEMA_EVENT_PARAMETER_DUPLICATE:${node.id}:${event.type}:${parameter.id}`);
        assert(['Number', 'Text', 'Truth'].includes(parameter.valueType), `RCL_UI_SCHEMA_EVENT_PARAMETER_TYPE:${node.id}:${event.type}:${parameter.id}`);
        parameterIds.add(parameter.id);
      }
      for (const statement of event.statements ?? []) {
        if (statement.kind === 'set-state') {
          assert(stateTypes.has(statement.target), `RCL_UI_SCHEMA_EVENT_TARGET:${node.id}:${statement.target}`);
          assert(statement.expression?.valueType === stateTypes.get(statement.target), `RCL_UI_SCHEMA_EVENT_MUTATION_TYPE:${node.id}:${statement.target}`);
        }
      }
    }
    for (const child of node.children ?? []) walk(child, `${identityPath}/${child.id}`);
  };
  walk(program.viewTree);
  assert(typeof program.semanticRoot === 'string' && /^[0-9a-f]{64}$/u.test(program.semanticRoot), 'RCL_UI_SCHEMA_ROOT');
  const draft = structuredClone(program);
  delete draft.semanticRoot;
  assert(nativeUiRoot(draft) === program.semanticRoot, 'RCL_UI_SEMANTIC_ROOT_MISMATCH');
  return true;
}

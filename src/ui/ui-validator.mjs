import {
  RCL_NATIVE_UI_FORMAT,
  RCL_NATIVE_UI_NAVIGATION_FORMAT,
  UI_BINDABLE_PROPERTIES_BY_ROLE,
  UI_EVENT_TYPES,
  UI_PROPERTY_TYPES,
  UI_ROLES,
} from './ui-schema.mjs';
import { nativeUiRoot, nativeUiSemanticGenome } from './ui-ir.mjs';

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

export function validateCanonicalNativeUi(program) {
  assert(program && program.format === RCL_NATIVE_UI_FORMAT, 'RCL_UI_SCHEMA_FORMAT');
  assert(typeof program.id === 'string' && program.id.length > 0, 'RCL_UI_SCHEMA_ID');
  assert(Array.isArray(program.state), 'RCL_UI_SCHEMA_STATE');
  assert(program.viewTree && typeof program.viewTree === 'object', 'RCL_UI_SCHEMA_VIEW_TREE');
  assert(program.styleSheet?.format === 'rcl.native-ui.style-sheet.v0.1', 'RCL_UI_SCHEMA_STYLE_FORMAT');
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
  const navigationStatements = [];
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
    const expectedAccessibilityLabel = node.localProperties.find((property) => property.property === 'accessibility_label')?.value ?? null;
    assert(node.accessibility?.label === expectedAccessibilityLabel, `RCL_UI_SCHEMA_ACCESSIBILITY:${node.id}`);
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
      let localCount = 0;
      let realityCount = 0;
      let navigateCount = 0;
      for (const statement of event.statements ?? []) {
        if (statement.kind === 'set-state') {
          localCount += 1;
          assert(stateTypes.has(statement.target), `RCL_UI_SCHEMA_EVENT_TARGET:${node.id}:${statement.target}`);
          assert(statement.expression?.valueType === stateTypes.get(statement.target), `RCL_UI_SCHEMA_EVENT_MUTATION_TYPE:${node.id}:${statement.target}`);
        } else if (statement.kind === 'realize-reality') realityCount += 1;
        else if (statement.kind === 'navigate') {
          localCount += 1;
          navigateCount += 1;
          navigationStatements.push({ nodeId: node.id, eventType: event.type, route: statement.route });
        } else assert(false, `RCL_UI_SCHEMA_EVENT_STATEMENT:${node.id}:${event.type}:${statement.kind}`);
      }
      assert(!(localCount > 0 && realityCount > 0), `RCL_UI_EVENT_MIXED_AUTHORITY:${node.id}:${event.type}`);
      assert(navigateCount <= 1, `RCL_UI_EVENT_MULTIPLE_NAVIGATION:${node.id}:${event.type}`);
      assert(event.authority === (realityCount > 0 ? 'reality-transaction' : 'ui-local'), `RCL_UI_SCHEMA_EVENT_AUTHORITY:${node.id}:${event.type}`);
    }
    for (const child of node.children ?? []) walk(child, `${identityPath}/${child.id}`);
  };
  walk(program.viewTree);
  const navigation = program.extensionPoints?.navigation ?? null;
  if (navigation === null) assert(navigationStatements.length === 0, 'RCL_UI_NAVIGATION_REQUIRED');
  else {
    assert(navigation.format === RCL_NATIVE_UI_NAVIGATION_FORMAT, 'RCL_UI_NAVIGATION_FORMAT');
    assert(Array.isArray(navigation.routes) && navigation.routes.length > 0, 'RCL_UI_NAVIGATION_ROUTE_REQUIRED');
    const routeIds = new Set();
    const routeTargets = new Set();
    const directTargets = new Set(program.viewTree.children.map((node) => node.id));
    for (const route of navigation.routes) {
      assert(typeof route.id === 'string' && route.id.length > 0, 'RCL_UI_NAVIGATION_ROUTE_ID');
      assert(!routeIds.has(route.id), `RCL_UI_NAVIGATION_ROUTE_DUPLICATE:${route.id}`);
      assert(!routeTargets.has(route.target), `RCL_UI_NAVIGATION_TARGET_DUPLICATE:${route.target}`);
      assert(directTargets.has(route.target), `RCL_UI_NAVIGATION_TARGET_UNKNOWN:${route.id}:${route.target}`);
      routeIds.add(route.id);
      routeTargets.add(route.target);
    }
    assert(routeIds.has(navigation.initialRoute), `RCL_UI_NAVIGATION_INITIAL_UNKNOWN:${navigation.initialRoute}`);
    for (const statement of navigationStatements) assert(routeIds.has(statement.route), `RCL_UI_NAVIGATION_ROUTE_UNKNOWN:${statement.nodeId}:${statement.eventType}:${statement.route}`);
  }
  assert(typeof program.semanticRoot === 'string' && /^[0-9a-f]{64}$/u.test(program.semanticRoot), 'RCL_UI_SCHEMA_ROOT');
  const draft = structuredClone(program);
  delete draft.semanticRoot;
  assert(nativeUiRoot(nativeUiSemanticGenome(draft)) === program.semanticRoot, 'RCL_UI_SEMANTIC_ROOT_MISMATCH');
  return true;
}

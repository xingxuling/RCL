import { parseRealityWithLocations } from './parser.mjs';

// Bind references through the parsed language tree, never through textual matches.
// Function parameters, match bindings and UI-local state have separate namespaces.
export function buildFacetOccurrences(source, facets, uri) {
  const { ast, locations, typeLocations } = parseRealityWithLocations(source);
  const names = new Set(facets.map(facet => facet.path));
  const qualified = [...names].sort((a, b) => b.length - a.length);
  const declarations = {}, occurrences = [];
  const resolve = (path, locals) => {
    if (locals.has(path)) return null;
    if (names.has(path)) return path;
    if (locals.has(path.split('.')[0])) return null;
    return qualified.find(name => path.startsWith(name + '.')) ?? null;
  };
  const occurrence = (facet, node, kind) => {
    const range = locations.get(node);
    if (facet && range) occurrences.push({ facet, uri, range, kind });
  };
  const walk = (node, locals = new Set()) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const item of node) walk(item, locals); return; }
    if (node.kind === 'NativeUIDecl') return;
    if (node.kind === 'ReckonDecl') { walk(node.expression, new Set(node.params.map(param => param.name))); return; }
    if (node.kind === 'MatchUnionExpr') {
      walk(node.target, locals);
      for (const item of node.cases) walk(item.expression, new Set([...locals, ...item.bindings]));
      return;
    }
    if (node.kind === 'FacetDecl' && names.has(node.path)) {
      declarations[node.path] = { range: locations.get(node), typeRange: typeLocations.get(node) };
      occurrence(node.path, node, 'declaration');
      walk(node.value, locals);
      return;
    }
    if (node.kind === 'PathExpr') { occurrence(resolve(node.path, locals), node, 'reference'); return; }
    if (typeof node.target === 'string' && locations.has(node)) occurrence(resolve(node.target, new Set()), node, 'write');
    for (const value of Object.values(node)) walk(value, locals);
  };
  walk(ast);
  return { declarations, occurrences };
}

import { compileTypedModuleGraph } from './type-module-kernel.mjs';
import { canonicalReality } from './canonical.mjs';

export function buildLinkedTypeGraphAdmission(typeModuleSources) {
  const report = compileTypedModuleGraph(typeModuleSources, { throwOnError: true });
  const canonicalIr = canonicalReality(report.ir);
  return Object.freeze({
    format: 'rcl.selfhost-linked-type-graph-admission.v0.1',
    irRoot: report.irRoot,
    canonicalIr,
    moduleCount: report.ir.moduleCount,
    declarationCount: report.ir.declarationCount,
    boundary: 'TYPE_GRAPH_CONSTRUCTED_BY_EXISTING_LINKER_RCL_OWNS_ROOT_ADMISSION_ONLY',
  });
}

export function renderRclTypeGraphAdmission(admission, options = {}) {
  if (!admission || admission.format !== 'rcl.selfhost-linked-type-graph-admission.v0.1') throw new Error('RCL_TYPE_GRAPH_ADMISSION_INVALID');
  const declaredRoot = options.declaredRoot ?? admission.irRoot;
  return `reality RCLLinkedTypeGraphAdmissionV01 {
  facet linked_type.canonical_ir : Text = ${JSON.stringify(admission.canonicalIr)}
  facet linked_type.declared_root : Text = ${JSON.stringify(declaredRoot)}
  facet linked_type.module_count : Number = ${admission.moduleCount}
  facet linked_type.declaration_count : Number = ${admission.declarationCount}
  facet linked_type.computed_root : Text = sha256_text(linked_type.canonical_ir)
  facet linked_type.accepted : Truth = semantic_assert(
    linked_type.computed_root == linked_type.declared_root,
    "RCL_LINKED_TYPE_GRAPH_ROOT_MISMATCH",
    linked_type.declared_root,
    make_span(0, 1, 1, 0)
  )
  facet linked_type.claim : Text = "root_verified_linked_type_graph_only_not_raw_rcltype_selfhost_parsing"
}`;
}

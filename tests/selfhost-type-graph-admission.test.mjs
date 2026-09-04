import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRealityToBytecode } from '../src/bytecode.mjs';
import { runNativeBytecode } from '../src/native-vm.mjs';
import {
  buildLinkedTypeGraphAdmission,
  renderRclTypeGraphAdmission,
} from '../src/selfhost-type-graph-admission.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tensorSource = fs.readFileSync(path.join(ROOT, 'examples/native-ai/types/tensor.rcltype'), 'utf8');

function execute(source) {
  return runNativeBytecode(Buffer.from(compileRealityToBytecode(source)), {
    timeout: 60_000,
    maxBuffer: 32 * 1024 * 1024,
  });
}

test('AI008 RCL-owned admission recomputes and accepts the linked Tensor type-graph root', () => {
  const admission = buildLinkedTypeGraphAdmission([tensorSource]);
  const result = execute(renderRclTypeGraphAdmission(admission));
  assert.equal(result.state['linked_type.accepted'], true);
  assert.equal(result.state['linked_type.computed_root'], admission.irRoot);
  assert.equal(result.state['linked_type.module_count'], 1);
  assert.equal(result.state['linked_type.declaration_count'], 2);
  assert.equal(admission.boundary, 'TYPE_GRAPH_CONSTRUCTED_BY_EXISTING_LINKER_RCL_OWNS_ROOT_ADMISSION_ONLY');
});

test('AI008 linked type-graph admission fails closed on root drift', () => {
  const admission = buildLinkedTypeGraphAdmission([tensorSource]);
  assert.throws(
    () => execute(renderRclTypeGraphAdmission(admission, { declaredRoot: '0'.repeat(64) })),
    error => error?.code === 'RCL_SEMANTIC_ASSERT' && /0{64}/u.test(error.message),
  );
});

test('AI008 linker rejects invalid raw type source before RCL admission', () => {
  assert.throws(
    () => buildLinkedTypeGraphAdmission(['module tensor\nexport record Broken { missing Nope }']),
    error => error?.name === 'RCLTypeModuleError'
      && Array.isArray(error.diagnostics)
      && error.diagnostics.some(item => item.code === 'RCL_RECORD_FIELD_INVALID'),
  );
});

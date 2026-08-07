#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializeRbc13DomainVmWithPublicApi } from './materialize-rbc13-domain-vm-public-api.mjs';

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0 || source.indexOf(from, first + from.length) >= 0) {
    throw new Error(`RBC13 semantic-error materializer expected exactly one ${label} anchor`);
  }
  return source.slice(0, first) + to + source.slice(first + from.length);
}

export function materializeRbc13DomainVmWithSemanticErrors(sourceText) {
  let source = materializeRbc13DomainVmWithPublicApi(sourceText);

  source = replaceOnce(
    source,
    'typedef struct {\n  const char *code;\n  char message[512];\n} VmError;',
    'typedef struct {\n  char code_storage[RCL_DOMAIN_ERROR_CODE_MAX];\n  const char *code;\n  char message[512];\n} VmError;',
    'owned VmError code storage',
  );

  source = replaceOnce(
    source,
    'static void vm_fail(VM *vm, const char *code, const char *message) {\n  if (vm->error.code) return;\n  vm->error.code = code;\n  snprintf(vm->error.message, sizeof(vm->error.message), "%s", message);\n}',
    'static void vm_fail(VM *vm, const char *code, const char *message) {\n  if (vm->error.code) return;\n  snprintf(vm->error.code_storage, sizeof(vm->error.code_storage), "%s", code && code[0] ? code : "RCL_NATIVE_FAILURE");\n  vm->error.code = vm->error.code_storage;\n  snprintf(vm->error.message, sizeof(vm->error.message), "%s", message ? message : "RCL native VM execution failed");\n}',
    'owned vm_fail code',
  );

  source = replaceOnce(
    source,
    '          char organ_error[512]; organ_error[0] = \'\\0\';\n          int organ_ok = rcl_domain_organ_invoke(\n            &vm->domain_organs, domain, operation, vm->domain_minimum_tier,\n            args, argc, &domain_result, organ_error, sizeof(organ_error)\n          );\n          if (!organ_ok) {\n            vm_fail(vm, "RCL_NATIVE_DOMAIN_ORGAN_FAILURE", organ_error[0] ? organ_error : "DOMAIN_CALL organ invocation failed");\n          } else {',
    '          RclDomainOrganErrorV1 organ_error;\n          rcl_domain_organ_error_clear(&organ_error);\n          int organ_ok = rcl_domain_organ_invoke(\n            &vm->domain_organs, domain, operation, vm->domain_minimum_tier,\n            args, argc, &domain_result, &organ_error\n          );\n          if (!organ_ok) {\n            vm_fail(\n              vm,\n              organ_error.code[0] ? organ_error.code : "RCL_DOMAIN_ORGAN_FAILURE",\n              organ_error.message[0] ? organ_error.message : "RCL_DOMAIN_ORGAN_FAILURE: DOMAIN_CALL organ invocation failed"\n            );\n          } else {',
    'structured DOMAIN_CALL error forwarding',
  );

  return source;
}

const SELF = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  const input = path.resolve(process.argv[2] ?? 'native/rclvm.c');
  const output = path.resolve(process.argv[3] ?? 'output/rbc13-domain-vm/rclvm-rbc13-domain-semantic-error-candidate.c');
  const candidate = materializeRbc13DomainVmWithSemanticErrors(fs.readFileSync(input, 'utf8'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, candidate);
  process.stdout.write(`${output}\n`);
}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializeRbc13DomainVmCandidate } from './materialize-rbc13-domain-vm-candidate.mjs';

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0 || source.indexOf(from, first + from.length) >= 0) {
    throw new Error(`RBC13 public-API materializer expected exactly one ${label} anchor`);
  }
  return source.slice(0, first) + to + source.slice(first + from.length);
}

export function materializeRbc13DomainVmWithPublicApi(sourceText) {
  let source = materializeRbc13DomainVmCandidate(sourceText);

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

  const api = `int rclvm_instance_register_domain_organ(\n  RclVmInstance *instance,\n  const RclDomainOrganV1 *organ,\n  char *error,\n  size_t error_capacity\n) {\n  if (!instance || !organ) {\n    if (error && error_capacity) snprintf(error, error_capacity, "Invalid domain-organ registration");\n    return 0;\n  }\n  return rcl_domain_organ_register(&instance->vm.domain_organs, organ, error, error_capacity);\n}\n\nint rclvm_instance_set_domain_minimum_tier(\n  RclVmInstance *instance,\n  RclDomainOrganEvidenceTier minimum_tier,\n  char *error,\n  size_t error_capacity\n) {\n  if (!instance || minimum_tier < RCL_DOMAIN_ORGAN_QUARANTINED || minimum_tier > RCL_DOMAIN_ORGAN_NATIVE_VERIFIED) {\n    if (error && error_capacity) snprintf(error, error_capacity, "Invalid domain-organ minimum evidence tier");\n    return 0;\n  }\n  instance->vm.domain_minimum_tier = minimum_tier;\n  return 1;\n}\n\nsize_t rclvm_instance_domain_organ_count(const RclVmInstance *instance) {\n  return instance ? instance->vm.domain_organs.count : 0;\n}\n\nRclDomainOrganEvidenceTier rclvm_instance_domain_minimum_tier(const RclVmInstance *instance) {\n  return instance ? instance->vm.domain_minimum_tier : RCL_DOMAIN_ORGAN_NATIVE_VERIFIED;\n}\n\n`;
  source = replaceOnce(
    source,
    'int rclvm_instance_run(RclVmInstance *instance, int reset_state, char **result_json, char *error, size_t error_capacity) {',
    api + 'int rclvm_instance_run(RclVmInstance *instance, int reset_state, char **result_json, char *error, size_t error_capacity) {',
    'instance run/public API insertion',
  );
  return source;
}

const SELF = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  const input = path.resolve(process.argv[2] ?? 'native/rclvm.c');
  const output = path.resolve(process.argv[3] ?? 'output/rbc13-domain-vm/rclvm-rbc13-domain-public-candidate.c');
  const candidate = materializeRbc13DomainVmWithPublicApi(fs.readFileSync(input, 'utf8'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, candidate);
  process.stdout.write(`${output}\n`);
}

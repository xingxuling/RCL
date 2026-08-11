#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0 || source.indexOf(from, first + from.length) >= 0) {
    throw new Error(`RBC13 materializer expected exactly one ${label} anchor`);
  }
  return source.slice(0, first) + to + source.slice(first + from.length);
}

export function materializeRbc13DomainVmCandidate(sourceText) {
  let source = String(sourceText);

  source = replaceOnce(
    source,
    '#include "rclvm.h"\n',
    '#include "rclvm.h"\n#include "rcl_domain_organ.h"\n',
    'rclvm include',
  );

  source = replaceOnce(
    source,
    '  OP_GET_TYPED_REF_ID = 43,\n  OP_MOD = 44,\n};',
    '  OP_GET_TYPED_REF_ID = 43,\n  OP_MOD = 44,\n  OP_DOMAIN_CALL = 45,\n};',
    'opcode enum',
  );

  source = replaceOnce(
    source,
    'typedef struct {\n  const char *code;\n  char message[512];\n} VmError;',
    'typedef struct {\n  char code_storage[RCL_DOMAIN_ERROR_CODE_MAX];\n  const char *code;\n  char message[512];\n} VmError;',
    'owned VmError code storage',
  );

  source = replaceOnce(
    source,
    '  ProviderRegistration providers[MAX_PROVIDERS];\n  size_t provider_count;\n  uint64_t next_typed_object_id;',
    '  ProviderRegistration providers[MAX_PROVIDERS];\n  size_t provider_count;\n  RclDomainOrganRegistry domain_organs;\n  RclDomainOrganEvidenceTier domain_minimum_tier;\n  uint64_t next_typed_object_id;',
    'VM domain registry',
  );

  source = replaceOnce(
    source,
    'static void vm_fail(VM *vm, const char *code, const char *message) {\n  if (vm->error.code) return;\n  vm->error.code = code;\n  snprintf(vm->error.message, sizeof(vm->error.message), "%s", message);\n}',
    'static void vm_fail(VM *vm, const char *code, const char *message) {\n  if (vm->error.code) return;\n  snprintf(vm->error.code_storage, sizeof(vm->error.code_storage), "%s", code && code[0] ? code : "RCL_NATIVE_FAILURE");\n  vm->error.code = vm->error.code_storage;\n  snprintf(vm->error.message, sizeof(vm->error.message), "%s", message ? message : "RCL native VM execution failed");\n}',
    'owned vm_fail code',
  );

  source = replaceOnce(
    source,
    '  entry->marked = 0;\n  return 1;\n}\n\nstatic Value typed_heap_make_ref',
    '  entry->marked = 0;\n  return 1;\n}\n\n#include "rcl_domain_vm_value_bridge.inc"\n\nstatic Value typed_heap_make_ref',
    'Domain Value membrane insertion',
  );

  source = replaceOnce(
    source,
    '  if (major != 1 || minor < 1 || minor > 2) {\n    char message[128];\n    snprintf(message, sizeof(message), "Unsupported RBC version %u.%u; native VM supports 1.1 and 1.2", major, minor);',
    '  if (major != 1 || minor < 1 || minor > 3) {\n    char message[128];\n    snprintf(message, sizeof(message), "Unsupported RBC version %u.%u; candidate native VM supports 1.1, 1.2 and experimental 1.3", major, minor);',
    'validator version gate',
  );

  source = replaceOnce(
    source,
    '    if (op > OP_MOD) return validation_fail(error, "RCL_NATIVE_OPCODE_UNKNOWN", "RBC contains an unknown opcode");\n    if (minor == 1 && (op == OP_MOD || (op == OP_CALL_PROVIDER && (instruction_flags & 1)))) {\n      return validation_fail(error, "RCL_NATIVE_BYTECODE_FEATURE_VERSION", "RBC 1.2 feature is encoded under a 1.1 header");\n    }\n    if (op == OP_CALL_PROVIDER && (instruction_flags & ~1u)) return validation_fail(error, "RCL_NATIVE_BYTECODE_FLAGS", "CALL_PROVIDER contains unknown flags");',
    '    if (op > OP_DOMAIN_CALL) return validation_fail(error, "RCL_NATIVE_OPCODE_UNKNOWN", "RBC contains an unknown opcode");\n    if (minor == 1 && (op == OP_MOD || (op == OP_CALL_PROVIDER && (instruction_flags & 1)))) {\n      return validation_fail(error, "RCL_NATIVE_BYTECODE_FEATURE_VERSION", "RBC 1.2 feature is encoded under a 1.1 header");\n    }\n    if (minor < 3 && op == OP_DOMAIN_CALL) {\n      return validation_fail(error, "RCL_NATIVE_BYTECODE_FEATURE_VERSION", "DOMAIN_CALL requires the experimental RBC 1.3 header");\n    }\n    if (op == OP_CALL_PROVIDER && (instruction_flags & ~1u)) return validation_fail(error, "RCL_NATIVE_BYTECODE_FLAGS", "CALL_PROVIDER contains unknown flags");\n    if (op == OP_DOMAIN_CALL && (instruction_flags & ~1u)) return validation_fail(error, "RCL_NATIVE_BYTECODE_FLAGS", "DOMAIN_CALL contains unknown flags");',
    'validator opcode gate',
  );

  source = replaceOnce(
    source,
    '      case OP_CALL_PROVIDER:\n        valid = (instruction_flags & 1) || (pool_index_valid(a, string_count) && pool_index_valid(b, string_count) && pool_index_valid(c, string_count)); break;',
    '      case OP_CALL_PROVIDER:\n        valid = (instruction_flags & 1) || (pool_index_valid(a, string_count) && pool_index_valid(b, string_count) && pool_index_valid(c, string_count)); break;\n      case OP_DOMAIN_CALL:\n        valid = c >= 0 && (uint32_t)c <= RCL_DOMAIN_VALUE_MAX_ITEMS\n          && ((instruction_flags & 1) ? (a == 0 && b == 0) : (pool_index_valid(a, string_count) && pool_index_valid(b, string_count)));\n        break;',
    'DOMAIN_CALL operand validation',
  );

  source = replaceOnce(
    source,
    'program->minor < 1 || program->minor > 2',
    'program->minor < 1 || program->minor > 3',
    'loader version gate',
  );

  const domainExecution = `      case OP_DOMAIN_CALL: {\n        size_t argc = (size_t)instruction.c;\n        int dynamic = (instruction.flags & 1) != 0;\n        size_t required_stack = argc + (dynamic ? 2u : 0u);\n        if (vm->stack_count < required_stack) { vm_fail(vm, "RCL_NATIVE_DOMAIN_STACK", "DOMAIN_CALL stack underflow"); break; }\n        RclDomainValueV1 *args = (RclDomainValueV1 *)calloc(argc ? argc : 1, sizeof(RclDomainValueV1));\n        if (!args) { vm_fail(vm, "RCL_NATIVE_OOM", "Unable to allocate DOMAIN_CALL arguments"); break; }\n        for (size_t i = 0; i < argc; i++) rcl_domain_value_init(&args[i]);\n        int converted = 1;\n        for (size_t i = argc; i > 0; i--) {\n          Value native_arg = stack_pop(vm);\n          if (vm->error.code || !rcl_domain_bridge_native_to_domain(vm, &native_arg, &args[i - 1])) converted = 0;\n          value_free(&native_arg);\n          if (!converted) break;\n        }\n        Value domain_value = value_null(), operation_value = value_null();\n        const char *domain = NULL, *operation = NULL;\n        if (converted && dynamic) {\n          operation_value = stack_pop(vm);\n          domain_value = stack_pop(vm);\n          if (vm->error.code || domain_value.type != VALUE_STRING || operation_value.type != VALUE_STRING) {\n            vm_fail(vm, "RCL_NATIVE_DOMAIN_DISPATCH_TYPE", "Dynamic DOMAIN_CALL requires Text domain and operation values");\n            converted = 0;\n          } else {\n            domain = domain_value.string;\n            operation = operation_value.string;\n          }\n        } else if (converted) {\n          domain = pool_string(vm, instruction.a);\n          operation = pool_string(vm, instruction.b);\n        }\n        if (converted && !vm->error.code) {\n          RclDomainValueV1 domain_result;\n          rcl_domain_value_init(&domain_result);\n          RclDomainOrganErrorV1 organ_error;\n          rcl_domain_organ_error_clear(&organ_error);\n          int organ_ok = rcl_domain_organ_invoke(\n            &vm->domain_organs, domain, operation, vm->domain_minimum_tier,\n            args, argc, &domain_result, &organ_error\n          );\n          if (!organ_ok) {\n            vm_fail(\n              vm,\n              organ_error.code[0] ? organ_error.code : "RCL_DOMAIN_ORGAN_FAILURE",\n              organ_error.message[0] ? organ_error.message : "RCL_DOMAIN_ORGAN_FAILURE: DOMAIN_CALL organ invocation failed"\n            );\n          } else {\n            Value native_result = rcl_domain_bridge_domain_to_native(vm, &domain_result);\n            if (!vm->error.code) stack_push(vm, native_result); else value_free(&native_result);\n          }\n          rcl_domain_value_free(&domain_result);\n        }\n        value_free(&domain_value); value_free(&operation_value);\n        for (size_t i = 0; i < argc; i++) rcl_domain_value_free(&args[i]);\n        free(args);\n        break;\n      }\n`;

  source = replaceOnce(
    source,
    '      case OP_MAKE_TYPED_RECORD: {',
    domainExecution + '      case OP_MAKE_TYPED_RECORD: {',
    'DOMAIN_CALL execution insertion',
  );

  source = replaceOnce(
    source,
    'RclVmInstance *rclvm_instance_create(void) {\n  RclVmInstance *instance = (RclVmInstance *)calloc(1, sizeof(RclVmInstance));\n  if (instance) instance->vm.next_typed_object_id = 1;\n  return instance;\n}',
    'RclVmInstance *rclvm_instance_create(void) {\n  RclVmInstance *instance = (RclVmInstance *)calloc(1, sizeof(RclVmInstance));\n  if (instance) {\n    instance->vm.next_typed_object_id = 1;\n    rcl_domain_organ_registry_init(&instance->vm.domain_organs);\n    instance->vm.domain_minimum_tier = RCL_DOMAIN_ORGAN_NATIVE_VERIFIED;\n  }\n  return instance;\n}',
    'instance create',
  );

  source = replaceOnce(
    source,
    '  vm_free(&instance->vm);\n  for (size_t i = 0; i < instance->vm.provider_count; i++) free(instance->vm.providers[i].provider_id);\n  free(instance);',
    '  vm_free(&instance->vm);\n  for (size_t i = 0; i < instance->vm.provider_count; i++) free(instance->vm.providers[i].provider_id);\n  rcl_domain_organ_registry_free(&instance->vm.domain_organs);\n  free(instance);',
    'instance destroy',
  );

  source = replaceOnce(
    source,
    '    ProviderRegistration saved[MAX_PROVIDERS]; size_t saved_count = instance->vm.provider_count;\n    memcpy(saved, instance->vm.providers, sizeof(saved));\n    memset(&instance->vm, 0, sizeof(instance->vm));\n    instance->vm.next_typed_object_id = 1;\n    memcpy(instance->vm.providers, saved, sizeof(saved)); instance->vm.provider_count = saved_count;',
    '    ProviderRegistration saved[MAX_PROVIDERS]; size_t saved_count = instance->vm.provider_count;\n    RclDomainOrganRegistry saved_domain_organs = instance->vm.domain_organs;\n    RclDomainOrganEvidenceTier saved_domain_tier = instance->vm.domain_minimum_tier;\n    memcpy(saved, instance->vm.providers, sizeof(saved));\n    memset(&instance->vm, 0, sizeof(instance->vm));\n    instance->vm.next_typed_object_id = 1;\n    memcpy(instance->vm.providers, saved, sizeof(saved)); instance->vm.provider_count = saved_count;\n    instance->vm.domain_organs = saved_domain_organs;\n    instance->vm.domain_minimum_tier = saved_domain_tier;',
    'instance reload preservation',
  );

  return source;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = path.resolve(process.argv[2] ?? 'native/rclvm.c');
  const output = path.resolve(process.argv[3] ?? 'output/rbc13-domain-vm/rclvm-rbc13-domain-candidate.c');
  const source = fs.readFileSync(input, 'utf8');
  const candidate = materializeRbc13DomainVmCandidate(source);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, candidate);
  process.stdout.write(`${output}\n`);
}

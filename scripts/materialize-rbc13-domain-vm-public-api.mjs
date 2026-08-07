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

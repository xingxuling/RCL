import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { materializeRbc13DomainVmCandidate } from '../scripts/materialize-rbc13-domain-vm-candidate.mjs';
import { materializeRbc13DomainVmWithPublicApi } from '../scripts/materialize-rbc13-domain-vm-public-api.mjs';

test('base candidate VM owns dynamic error codes and forwards organ semantic errors directly', () => {
  const source = fs.readFileSync('native/rclvm.c', 'utf8');
  const candidate = materializeRbc13DomainVmCandidate(source);
  assert.match(candidate, /char code_storage\[RCL_DOMAIN_ERROR_CODE_MAX\]/);
  assert.match(candidate, /RclDomainOrganErrorV1 organ_error/);
  assert.match(candidate, /organ_error\.code\[0\] \? organ_error\.code/);
  assert.doesNotMatch(candidate, /vm_fail\(vm, "RCL_NATIVE_DOMAIN_ORGAN_FAILURE", organ_error/);
  assert.match(candidate, /OP_DOMAIN_CALL = 45/);
});

test('public candidate VM inherits semantic errors and adds registration API without a second patch layer', () => {
  const source = fs.readFileSync('native/rclvm.c', 'utf8');
  const candidate = materializeRbc13DomainVmWithPublicApi(source);
  assert.match(candidate, /rclvm_instance_register_domain_organ/);
  assert.match(candidate, /rclvm_instance_set_domain_minimum_tier/);
  assert.match(candidate, /char code_storage\[RCL_DOMAIN_ERROR_CODE_MAX\]/);
  assert.equal((candidate.match(/RclDomainOrganErrorV1 organ_error/g) ?? []).length, 1);
});

#include "rcl_domain_organ.h"

#include <stdio.h>
#include <string.h>

static int fail(char *error, size_t capacity, const char *message) {
  if (error && capacity) snprintf(error, capacity, "%s", message);
  return 0;
}

void rcl_domain_organ_registry_init(RclDomainOrganRegistry *registry) {
  if (registry) memset(registry, 0, sizeof(*registry));
}

int rcl_domain_organ_register(RclDomainOrganRegistry *registry, const RclDomainOrganV1 *organ, char *error, size_t error_capacity) {
  if (!registry || !organ || organ->abi_version != RCL_DOMAIN_ORGAN_ABI_V1 || !organ->domain || !organ->domain[0]
      || !organ->operation || !organ->operation[0] || !organ->semantic_identity || !organ->semantic_identity[0]
      || !organ->implementation_id || !organ->implementation_id[0] || !organ->invoke) {
    return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_INVALID: invalid organ registration");
  }
  if (organ->evidence_tier < RCL_DOMAIN_ORGAN_QUARANTINED || organ->evidence_tier > RCL_DOMAIN_ORGAN_NATIVE_VERIFIED) {
    return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_TIER: invalid evidence tier");
  }
  for (size_t i = 0; i < registry->count; i++) {
    if (strcmp(registry->entries[i].domain, organ->domain) == 0 && strcmp(registry->entries[i].operation, organ->operation) == 0) {
      return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_DUPLICATE: duplicate domain operation");
    }
  }
  if (registry->count >= RCL_DOMAIN_ORGAN_MAX) return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_FULL: registry capacity exceeded");
  registry->entries[registry->count++] = *organ;
  return 1;
}

const RclDomainOrganV1 *rcl_domain_organ_resolve(const RclDomainOrganRegistry *registry, const char *domain, const char *operation) {
  if (!registry || !domain || !operation) return NULL;
  for (size_t i = 0; i < registry->count; i++) {
    if (strcmp(registry->entries[i].domain, domain) == 0 && strcmp(registry->entries[i].operation, operation) == 0) return &registry->entries[i];
  }
  return NULL;
}

int rcl_domain_organ_invoke(
  const RclDomainOrganRegistry *registry,
  const char *domain,
  const char *operation,
  RclDomainOrganEvidenceTier required_tier,
  const char *request_json,
  char *response_json,
  size_t response_capacity,
  char *error,
  size_t error_capacity
) {
  const RclDomainOrganV1 *organ = rcl_domain_organ_resolve(registry, domain, operation);
  if (!organ) return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_MISSING: domain operation is not registered");
  if (required_tier < RCL_DOMAIN_ORGAN_QUARANTINED || required_tier > RCL_DOMAIN_ORGAN_NATIVE_VERIFIED) {
    return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_TIER: invalid required evidence tier");
  }
  if (organ->evidence_tier < required_tier) return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_EVIDENCE_TIER: organ has not reached required evidence tier");
  if (!response_json || response_capacity == 0) return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_OUTPUT: response buffer is required");
  response_json[0] = '\0';
  return organ->invoke(organ->userdata, domain, operation, request_json ? request_json : "null", response_json, response_capacity, error, error_capacity);
}

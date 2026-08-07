#include "rcl_domain_organ.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int fail(char *error, size_t capacity, const char *message) {
  if (error && capacity) snprintf(error, capacity, "%s", message);
  return 0;
}

static char *copy_text(const char *text) {
  if (!text) return NULL;
  size_t length = strlen(text);
  if (length > RCL_DOMAIN_VALUE_MAX_TEXT_BYTES) return NULL;
  char *copy = (char *)malloc(length + 1);
  if (!copy) return NULL;
  memcpy(copy, text, length + 1);
  return copy;
}

static void free_entry(RclDomainOrganV1 *entry) {
  if (!entry) return;
  free((void *)entry->domain);
  free((void *)entry->operation);
  free((void *)entry->semantic_identity);
  free((void *)entry->implementation_id);
  free((void *)entry->artifact_root);
  memset(entry, 0, sizeof(*entry));
}

void rcl_domain_organ_registry_init(RclDomainOrganRegistry *registry) {
  if (registry) memset(registry, 0, sizeof(*registry));
}

void rcl_domain_organ_registry_free(RclDomainOrganRegistry *registry) {
  if (!registry) return;
  for (size_t i = 0; i < registry->count; i++) free_entry(&registry->entries[i]);
  memset(registry, 0, sizeof(*registry));
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

  RclDomainOrganV1 copy = *organ;
  copy.domain = copy_text(organ->domain);
  copy.operation = copy_text(organ->operation);
  copy.semantic_identity = copy_text(organ->semantic_identity);
  copy.implementation_id = copy_text(organ->implementation_id);
  copy.artifact_root = organ->artifact_root ? copy_text(organ->artifact_root) : NULL;
  if (!copy.domain || !copy.operation || !copy.semantic_identity || !copy.implementation_id || (organ->artifact_root && !copy.artifact_root)) {
    free_entry(&copy);
    return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_OOM: unable to own organ identity strings");
  }
  registry->entries[registry->count++] = copy;
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
  const RclDomainValueV1 *args,
  size_t argc,
  RclDomainValueV1 *result,
  char *error,
  size_t error_capacity
) {
  const RclDomainOrganV1 *organ = rcl_domain_organ_resolve(registry, domain, operation);
  if (!organ) return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_MISSING: domain operation is not registered");
  if (required_tier < RCL_DOMAIN_ORGAN_QUARANTINED || required_tier > RCL_DOMAIN_ORGAN_NATIVE_VERIFIED) {
    return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_TIER: invalid required evidence tier");
  }
  if (organ->evidence_tier < required_tier) return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_EVIDENCE_TIER: organ has not reached required evidence tier");
  if ((argc && !args) || !result || argc > RCL_DOMAIN_VALUE_MAX_ITEMS) return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_ARGUMENT: args/result contract is invalid");
  for (size_t i = 0; i < argc; i++) {
    if (!rcl_domain_value_validate(&args[i])) return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_VALUE_INVALID: argument violates domain value ABI");
  }
  if (result->abi_version != RCL_DOMAIN_VALUE_ABI_V1) return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_OUTPUT_INIT: result must be initialized with rcl_domain_value_init");
  rcl_domain_value_free(result);
  if (!organ->invoke(organ->userdata, domain, operation, args, argc, result, error, error_capacity)) {
    rcl_domain_value_free(result);
    return 0;
  }
  if (!rcl_domain_value_validate(result)) {
    rcl_domain_value_free(result);
    return fail(error, error_capacity, "RCL_DOMAIN_ORGAN_VALUE_INVALID: organ returned an invalid domain value");
  }
  return 1;
}

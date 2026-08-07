#include "rcl_domain_organ.h"
#include <stdio.h>
#include <string.h>

static int echo(void *userdata, const char *domain, const char *operation, const char *request, char *response, size_t capacity, char *error, size_t error_capacity) {
  (void)userdata; (void)domain; (void)operation; (void)error; (void)error_capacity;
  int written = snprintf(response, capacity, "%s", request);
  return written >= 0 && (size_t)written < capacity;
}

int main(void) {
  RclDomainOrganRegistry registry;
  rcl_domain_organ_registry_init(&registry);
  RclDomainOrganV1 organ = {
    RCL_DOMAIN_ORGAN_ABI_V1, "core", "echo", "core.echo", "smoke.echo", NULL,
    RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, 1, echo, NULL
  };
  char error[256] = {0};
  char response[256] = {0};
  if (!rcl_domain_organ_register(&registry, &organ, error, sizeof(error))) return 10;
  if (rcl_domain_organ_invoke(&registry, "core", "echo", RCL_DOMAIN_ORGAN_NATIVE_VERIFIED, "\"hello\"", response, sizeof(response), error, sizeof(error))) return 11;
  if (strstr(error, "RCL_DOMAIN_ORGAN_EVIDENCE_TIER") == NULL) return 12;
  error[0] = '\0';
  if (!rcl_domain_organ_invoke(&registry, "core", "echo", RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, "\"hello\"", response, sizeof(response), error, sizeof(error))) return 13;
  if (strcmp(response, "\"hello\"") != 0) return 14;
  puts("domain-organ-smoke: PASS");
  return 0;
}

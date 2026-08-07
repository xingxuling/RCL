#include "rcl_domain_organ.h"
#include <stdio.h>
#include <string.h>

static int echo(
  void *userdata,
  const char *domain,
  const char *operation,
  const RclDomainValueV1 *args,
  size_t argc,
  RclDomainValueV1 *result,
  char *error,
  size_t error_capacity
) {
  (void)userdata; (void)domain; (void)operation;
  if (argc != 1) {
    if (error && error_capacity) snprintf(error, error_capacity, "echo expects one argument");
    return 0;
  }
  return rcl_domain_value_clone(result, &args[0]);
}

static int set_field(RclDomainValueV1 *record, size_t index, const char *name, RclDomainValueV1 *value) {
  int ok = rcl_domain_value_record_set(record, index, name, value);
  rcl_domain_value_free(value);
  return ok;
}

int main(void) {
  RclDomainOrganRegistry registry;
  rcl_domain_organ_registry_init(&registry);
  RclDomainOrganV1 organ = {
    RCL_DOMAIN_ORGAN_ABI_V1, "core", "echo", "core.echo", "smoke.echo", NULL,
    RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, 1, echo, NULL
  };
  char error[256] = {0};
  RclDomainValueV1 text, result;
  rcl_domain_value_init(&text);
  rcl_domain_value_init(&result);
  if (!rcl_domain_value_set_text(&text, "hello", "Text")) return 9;
  if (!rcl_domain_organ_register(&registry, &organ, error, sizeof(error))) return 10;

  if (rcl_domain_organ_invoke(&registry, "core", "echo", RCL_DOMAIN_ORGAN_NATIVE_VERIFIED, &text, 1, &result, error, sizeof(error))) return 11;
  if (strstr(error, "RCL_DOMAIN_ORGAN_EVIDENCE_TIER") == NULL) return 12;
  error[0] = '\0';
  if (!rcl_domain_organ_invoke(&registry, "core", "echo", RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, &text, 1, &result, error, sizeof(error))) return 13;
  if (!rcl_domain_value_equal(&text, &result)) return 14;
  rcl_domain_value_free(&result);

  RclDomainValueV1 quantity, field;
  rcl_domain_value_init(&quantity);
  rcl_domain_value_init(&field);
  if (!rcl_domain_value_make_record(&quantity, "Quantity", 4, "Temperature")) return 15;
  if (!rcl_domain_value_set_text(&field, "Quantity", "Text") || !set_field(&quantity, 0, "kind", &field)) return 16;
  if (!rcl_domain_value_set_text(&field, "Temperature", "Text") || !set_field(&quantity, 1, "type", &field)) return 17;
  if (!rcl_domain_value_set_number(&field, 25, "Number") || !set_field(&quantity, 2, "value", &field)) return 18;
  if (!rcl_domain_value_set_text(&field, "°C", "Text") || !set_field(&quantity, 3, "unit", &field)) return 19;
  if (!rcl_domain_value_validate(&quantity)) return 20;
  if (!rcl_domain_organ_invoke(&registry, "core", "echo", RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, &quantity, 1, &result, error, sizeof(error))) return 21;
  if (!rcl_domain_value_equal(&quantity, &result)) return 22;
  rcl_domain_value_free(&result);

  if (!rcl_domain_value_set_text(&field, "duplicate", "Text")) return 23;
  if (rcl_domain_value_record_set(&quantity, 3, "type", &field)) return 24;
  rcl_domain_value_free(&field);
  if (!rcl_domain_value_validate(&quantity)) return 25;

  RclDomainValueV1 invalid;
  rcl_domain_value_init(&invalid);
  if (!rcl_domain_value_set_truth(&invalid, 1, "Truth")) return 26;
  invalid.as.truth = 2;
  error[0] = '\0';
  if (rcl_domain_organ_invoke(&registry, "core", "echo", RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, &invalid, 1, &result, error, sizeof(error))) return 27;
  if (strstr(error, "RCL_DOMAIN_ORGAN_VALUE_INVALID") == NULL) return 28;
  invalid.as.truth = 1;
  rcl_domain_value_free(&invalid);

  RclDomainValueV1 uninitialized;
  memset(&uninitialized, 0, sizeof(uninitialized));
  error[0] = '\0';
  if (rcl_domain_organ_invoke(&registry, "core", "echo", RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, &text, 1, &uninitialized, error, sizeof(error))) return 29;
  if (strstr(error, "RCL_DOMAIN_ORGAN_OUTPUT_INIT") == NULL) return 30;

  rcl_domain_value_free(&quantity);
  rcl_domain_value_free(&text);
  puts("domain-organ-value-smoke: PASS");
  return 0;
}

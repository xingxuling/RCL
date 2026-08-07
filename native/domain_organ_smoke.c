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
  RclDomainOrganErrorV1 *error
) {
  (void)userdata; (void)domain; (void)operation;
  if (argc != 1) {
    rcl_domain_organ_error_set(error, "RCL_DOMAIN_ECHO_ARITY", "RCL_DOMAIN_ECHO_ARITY: echo expects one argument");
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
  char registration_error[256] = {0};
  RclDomainOrganErrorV1 error;
  rcl_domain_organ_error_clear(&error);
  RclDomainValueV1 text, result;
  rcl_domain_value_init(&text);
  rcl_domain_value_init(&result);
  if (!rcl_domain_value_set_text(&text, "hello", "Text")) return 9;
  if (!rcl_domain_organ_register(&registry, &organ, registration_error, sizeof(registration_error))) return 10;

  if (rcl_domain_organ_invoke(&registry, "core", "echo", RCL_DOMAIN_ORGAN_NATIVE_VERIFIED, &text, 1, &result, &error)) return 11;
  if (strcmp(error.code, "RCL_DOMAIN_ORGAN_EVIDENCE_TIER") != 0) return 12;
  if (!rcl_domain_organ_invoke(&registry, "core", "echo", RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, &text, 1, &result, &error)) return 13;
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
  if (!rcl_domain_organ_invoke(&registry, "core", "echo", RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, &quantity, 1, &result, &error)) return 21;
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
  if (rcl_domain_organ_invoke(&registry, "core", "echo", RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, &invalid, 1, &result, &error)) return 27;
  if (strcmp(error.code, "RCL_DOMAIN_ORGAN_VALUE_INVALID") != 0) return 28;
  invalid.as.truth = 1;
  rcl_domain_value_free(&invalid);

  RclDomainValueV1 uninitialized;
  memset(&uninitialized, 0, sizeof(uninitialized));
  if (rcl_domain_organ_invoke(&registry, "core", "echo", RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, &text, 1, &uninitialized, &error)) return 29;
  if (strcmp(error.code, "RCL_DOMAIN_ORGAN_OUTPUT_INIT") != 0) return 30;

  rcl_domain_value_free(&quantity);
  rcl_domain_value_free(&text);
  rcl_domain_organ_registry_free(&registry);
  puts("domain-organ-value-smoke: PASS");
  return 0;
}

#include "rcl_domain_admitted_organs.h"

#include <stdio.h>
#include <string.h>

static int set_field(RclDomainValueV1 *record, size_t index, const char *name, RclDomainValueV1 *value) {
  int ok = rcl_domain_value_record_set(record, index, name, value);
  rcl_domain_value_free(value);
  return ok;
}

static int core_echo(
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
    if (error && error_capacity) snprintf(error, error_capacity, "RCL_DOMAIN_CORE_ECHO_ARITY: core.echo expects one argument");
    return 0;
  }
  if (!rcl_domain_value_clone(result, &args[0])) {
    if (error && error_capacity) snprintf(error, error_capacity, "RCL_DOMAIN_CORE_ECHO_CLONE: unable to clone core.echo argument");
    return 0;
  }
  return 1;
}

static const char *default_unit(const char *type) {
  static const struct { const char *type; const char *unit; } units[] = {
    { "Length", "m" }, { "Time", "s" }, { "Mass", "kg" }, { "Velocity", "m/s" },
    { "Acceleration", "m/s²" }, { "Force", "N" }, { "Energy", "J" },
    { "Temperature", "°C" }, { "Frequency", "Hz" }, { "Area", "m²" },
    { "Volume", "m³" }, { "Pressure", "Pa" }, { "Power", "W" }, { "Information", "bit" },
  };
  for (size_t i = 0; i < sizeof(units) / sizeof(units[0]); i++) {
    if (strcmp(units[i].type, type) == 0) return units[i].unit;
  }
  return NULL;
}

static int quantity_make(
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
  if (argc != 3 || args[0].kind != RCL_DOMAIN_VALUE_TEXT || args[1].kind != RCL_DOMAIN_VALUE_NUMBER || args[2].kind != RCL_DOMAIN_VALUE_TEXT) {
    if (error && error_capacity) snprintf(error, error_capacity, "RCL_DOMAIN_QUANTITY_ARGUMENT: quantity.make expects Text type, Number value and Text unit");
    return 0;
  }
  const char *type = args[0].as.text.data;
  const char *fallback = default_unit(type);
  if (!fallback) {
    if (error && error_capacity) snprintf(error, error_capacity, "RCL_DOMAIN_QUANTITY_TYPE: unknown quantity type '%s'", type ? type : "");
    return 0;
  }
  const char *unit = args[2].as.text.length ? args[2].as.text.data : fallback;
  if (!rcl_domain_value_make_record(result, "Quantity", 4, type)) {
    if (error && error_capacity) snprintf(error, error_capacity, "RCL_DOMAIN_QUANTITY_OOM: unable to construct quantity result");
    return 0;
  }
  RclDomainValueV1 field;
  rcl_domain_value_init(&field);
  if (!rcl_domain_value_set_text(&field, "Quantity", "Text") || !set_field(result, 0, "kind", &field)
      || !rcl_domain_value_set_text(&field, type, "Text") || !set_field(result, 1, "type", &field)
      || !rcl_domain_value_set_number(&field, args[1].as.number, "Number") || !set_field(result, 2, "value", &field)
      || !rcl_domain_value_set_text(&field, unit, "Text") || !set_field(result, 3, "unit", &field)) {
    rcl_domain_value_free(&field);
    rcl_domain_value_free(result);
    if (error && error_capacity) snprintf(error, error_capacity, "RCL_DOMAIN_QUANTITY_BUILD: unable to populate quantity result");
    return 0;
  }
  return 1;
}

int rcl_domain_register_admitted_candidates_v01(
  RclDomainOrganRegistry *registry,
  char *error,
  size_t error_capacity
) {
  const RclDomainOrganV1 organs[] = {
    {
      RCL_DOMAIN_ORGAN_ABI_V1,
      "core", "echo", "core.echo", "candidate.native.core.echo.v0.1", NULL,
      RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, 1, core_echo, NULL,
    },
    {
      RCL_DOMAIN_ORGAN_ABI_V1,
      "quantity", "make", "quantity.make", "candidate.native.quantity.make.v0.1", NULL,
      RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, 1, quantity_make, NULL,
    },
  };
  for (size_t i = 0; i < sizeof(organs) / sizeof(organs[0]); i++) {
    if (!rcl_domain_organ_register(registry, &organs[i], error, error_capacity)) return 0;
  }
  return 1;
}

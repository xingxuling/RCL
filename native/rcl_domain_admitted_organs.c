#include "rcl_domain_admitted_organs.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int fail(char *error, size_t capacity, const char *message) {
  if (error && capacity) snprintf(error, capacity, "%s", message);
  return 0;
}

static int set_field(RclDomainValueV1 *record, size_t index, const char *name, RclDomainValueV1 *value) {
  int ok = rcl_domain_value_record_set(record, index, name, value);
  rcl_domain_value_free(value);
  return ok;
}

static int set_field_clone(RclDomainValueV1 *record, size_t index, const char *name, const RclDomainValueV1 *source) {
  RclDomainValueV1 copy;
  rcl_domain_value_init(&copy);
  if (!rcl_domain_value_clone(&copy, source)) return 0;
  return set_field(record, index, name, &copy);
}

static const RclDomainValueV1 *record_field(const RclDomainValueV1 *record, const char *name) {
  if (!record || record->kind != RCL_DOMAIN_VALUE_RECORD) return NULL;
  for (size_t i = 0; i < record->as.record.count; i++) {
    const RclDomainFieldV1 *field = &record->as.record.fields[i];
    if (field->name && field->value && strcmp(field->name, name) == 0) return field->value;
  }
  return NULL;
}

static const char *domain_runtime_type(const RclDomainValueV1 *value) {
  if (!value) return NULL;
  if (value->semantic_type && value->semantic_type[0]) return value->semantic_type;
  switch (value->kind) {
    case RCL_DOMAIN_VALUE_NULL: return "Null";
    case RCL_DOMAIN_VALUE_NUMBER: return "Number";
    case RCL_DOMAIN_VALUE_TRUTH: return "Truth";
    case RCL_DOMAIN_VALUE_TEXT: return "Text";
    case RCL_DOMAIN_VALUE_SEQUENCE: return "Sequence";
    case RCL_DOMAIN_VALUE_RECORD: return value->as.record.type_name;
    default: return NULL;
  }
}

static char *generic_type(const char *family, const char *base_type) {
  size_t family_length = strlen(family);
  size_t base_length = strlen(base_type);
  if (family_length + base_length + 3 > RCL_DOMAIN_VALUE_MAX_TEXT_BYTES) return NULL;
  char *result = (char *)malloc(family_length + base_length + 3);
  if (!result) return NULL;
  snprintf(result, family_length + base_length + 3, "%s<%s>", family, base_type);
  return result;
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
  if (argc != 1) return fail(error, error_capacity, "RCL_DOMAIN_CORE_ECHO_ARITY: core.echo expects one argument");
  if (!rcl_domain_value_clone(result, &args[0])) return fail(error, error_capacity, "RCL_DOMAIN_CORE_ECHO_CLONE: unable to clone core.echo argument");
  return 1;
}

static const char *default_unit(const char *type) {
  static const struct { const char *type; const char *unit; } units[] = {
    { "Length", "m" }, { "Time", "s" }, { "Mass", "kg" }, { "Velocity", "m/s" },
    { "Acceleration", "m/s²" }, { "Force", "N" }, { "Energy", "J" },
    { "Temperature", "°C" }, { "Frequency", "Hz" }, { "Area", "m²" },
    { "Volume", "m³" }, { "Pressure", "Pa" }, { "Power", "W" }, { "Information", "bit" },
  };
  for (size_t i = 0; i < sizeof(units) / sizeof(units[0]); i++) if (strcmp(units[i].type, type) == 0) return units[i].unit;
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
    return fail(error, error_capacity, "RCL_DOMAIN_QUANTITY_ARGUMENT: quantity.make expects Text type, Number value and Text unit");
  }
  const char *type = args[0].as.text.data;
  const char *fallback = default_unit(type);
  if (!fallback) {
    char message[384];
    snprintf(message, sizeof(message), "RCL_DOMAIN_QUANTITY_TYPE: unknown quantity type '%s'", type ? type : "");
    return fail(error, error_capacity, message);
  }
  const char *unit = args[2].as.text.length ? args[2].as.text.data : fallback;
  if (!rcl_domain_value_make_record(result, "Quantity", 4, type)) return fail(error, error_capacity, "RCL_DOMAIN_QUANTITY_OOM: unable to construct quantity result");
  RclDomainValueV1 field;
  rcl_domain_value_init(&field);
  if (!rcl_domain_value_set_text(&field, "Quantity", "Text") || !set_field(result, 0, "kind", &field)
      || !rcl_domain_value_set_text(&field, type, "Text") || !set_field(result, 1, "type", &field)
      || !rcl_domain_value_set_number(&field, args[1].as.number, "Number") || !set_field(result, 2, "value", &field)
      || !rcl_domain_value_set_text(&field, unit, "Text") || !set_field(result, 3, "unit", &field)) {
    rcl_domain_value_free(&field);
    rcl_domain_value_free(result);
    return fail(error, error_capacity, "RCL_DOMAIN_QUANTITY_BUILD: unable to populate quantity result");
  }
  return 1;
}

static int quantitative_measure(
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
  if (argc != 8 || args[0].kind != RCL_DOMAIN_VALUE_TEXT || args[3].kind != RCL_DOMAIN_VALUE_NUMBER
      || args[4].kind != RCL_DOMAIN_VALUE_TEXT || args[5].kind != RCL_DOMAIN_VALUE_TEXT
      || args[6].kind != RCL_DOMAIN_VALUE_SEQUENCE || args[7].kind != RCL_DOMAIN_VALUE_TEXT) {
    return fail(error, error_capacity, "RCL_DOMAIN_MEASUREMENT_ARGUMENT: quantitative.measure expects baseType, value, uncertainty, confidence, unit, scale, evidence and calibratedBy");
  }
  const char *base_type = args[0].as.text.data;
  const char *value_type = domain_runtime_type(&args[1]);
  const char *uncertainty_type = domain_runtime_type(&args[2]);
  if (!value_type || strcmp(value_type, base_type) != 0) return fail(error, error_capacity, "RCL_DOMAIN_MEASUREMENT_TYPE: measurement value does not match base type");
  if (strcmp(base_type, "Text") != 0 && strcmp(base_type, "Truth") != 0
      && (!uncertainty_type || strcmp(uncertainty_type, base_type) != 0)) {
    return fail(error, error_capacity, "RCL_DOMAIN_MEASUREMENT_UNCERTAINTY: uncertainty does not match base type");
  }
  double confidence = args[3].as.number;
  if (confidence < 0 || confidence > 1) return fail(error, error_capacity, "RCL_DOMAIN_MEASUREMENT_CONFIDENCE: confidence must be between 0 and 1");

  char *semantic_type = generic_type("Measure", base_type);
  if (!semantic_type || !rcl_domain_value_make_record(result, "Measurement", 9, semantic_type)) {
    free(semantic_type);
    return fail(error, error_capacity, "RCL_DOMAIN_MEASUREMENT_OOM: unable to construct measurement result");
  }
  free(semantic_type);

  RclDomainValueV1 field;
  rcl_domain_value_init(&field);
  int ok = rcl_domain_value_set_text(&field, "Measurement", "Text") && set_field(result, 0, "kind", &field)
    && rcl_domain_value_set_text(&field, base_type, "Text") && set_field(result, 1, "baseType", &field)
    && set_field_clone(result, 2, "value", &args[1])
    && set_field_clone(result, 3, "uncertainty", &args[2])
    && rcl_domain_value_set_number(&field, confidence, "Number") && set_field(result, 4, "confidence", &field);

  if (ok) {
    if (args[4].as.text.length) {
      ok = rcl_domain_value_set_text_n(&field, args[4].as.text.data, args[4].as.text.length, "Text") && set_field(result, 5, "unit", &field);
    } else {
      const RclDomainValueV1 *value_unit = record_field(&args[1], "unit");
      if (value_unit && value_unit->kind == RCL_DOMAIN_VALUE_TEXT) ok = set_field_clone(result, 5, "unit", value_unit);
      else ok = rcl_domain_value_set_null(&field, "Null") && set_field(result, 5, "unit", &field);
    }
  }
  if (ok) ok = rcl_domain_value_set_text_n(&field, args[5].as.text.data, args[5].as.text.length, "Text") && set_field(result, 6, "scale", &field);
  if (ok) ok = set_field_clone(result, 7, "evidence", &args[6]);
  if (ok) {
    if (args[7].as.text.length) ok = rcl_domain_value_set_text_n(&field, args[7].as.text.data, args[7].as.text.length, "Text") && set_field(result, 8, "calibratedBy", &field);
    else ok = rcl_domain_value_set_null(&field, "Null") && set_field(result, 8, "calibratedBy", &field);
  }
  if (!ok) {
    rcl_domain_value_free(&field);
    rcl_domain_value_free(result);
    return fail(error, error_capacity, "RCL_DOMAIN_MEASUREMENT_BUILD: unable to populate measurement result");
  }
  return 1;
}

static int unique_sequence(const RclDomainValueV1 *source, RclDomainValueV1 *target) {
  if (!source || source->kind != RCL_DOMAIN_VALUE_SEQUENCE) return 0;
  size_t unique_count = 0;
  for (size_t i = 0; i < source->as.sequence.count; i++) {
    int duplicate = 0;
    for (size_t j = 0; j < i; j++) {
      if (rcl_domain_value_equal(&source->as.sequence.items[i], &source->as.sequence.items[j])) { duplicate = 1; break; }
    }
    if (!duplicate) unique_count++;
  }
  if (!rcl_domain_value_make_sequence(target, unique_count, "Sequence")) return 0;
  size_t out = 0;
  for (size_t i = 0; i < source->as.sequence.count; i++) {
    int duplicate = 0;
    for (size_t j = 0; j < i; j++) {
      if (rcl_domain_value_equal(&source->as.sequence.items[i], &source->as.sequence.items[j])) { duplicate = 1; break; }
    }
    if (!duplicate && !rcl_domain_value_sequence_set(target, out++, &source->as.sequence.items[i])) {
      rcl_domain_value_free(target);
      return 0;
    }
  }
  return 1;
}

static int knowledge_claim(
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
  if (argc != 10 || args[0].kind != RCL_DOMAIN_VALUE_TEXT || args[2].kind != RCL_DOMAIN_VALUE_NUMBER
      || args[3].kind != RCL_DOMAIN_VALUE_SEQUENCE || args[4].kind != RCL_DOMAIN_VALUE_TEXT
      || args[5].kind != RCL_DOMAIN_VALUE_TEXT || args[6].kind != RCL_DOMAIN_VALUE_TEXT
      || args[7].kind != RCL_DOMAIN_VALUE_SEQUENCE || args[8].kind != RCL_DOMAIN_VALUE_NUMBER
      || args[9].kind != RCL_DOMAIN_VALUE_TEXT) {
    return fail(error, error_capacity, "RCL_DOMAIN_KNOWLEDGE_ARGUMENT: knowledge.claim expects baseType, value, confidence, evidence, source, scope, status, dependencies, revision and formedAtRoot");
  }
  const char *base_type = args[0].as.text.data;
  const char *value_type = domain_runtime_type(&args[1]);
  if (!value_type || strcmp(value_type, base_type) != 0) return fail(error, error_capacity, "RCL_DOMAIN_KNOWLEDGE_TYPE: knowledge value does not match base type");
  if (args[2].as.number < 0 || args[2].as.number > 1) return fail(error, error_capacity, "RCL_DOMAIN_KNOWLEDGE_CONFIDENCE: confidence must be between 0 and 1");

  char *semantic_type = generic_type("Know", base_type);
  if (!semantic_type || !rcl_domain_value_make_record(result, "Knowledge", 12, semantic_type)) {
    free(semantic_type);
    return fail(error, error_capacity, "RCL_DOMAIN_KNOWLEDGE_OOM: unable to construct knowledge result");
  }
  free(semantic_type);

  RclDomainValueV1 field, evidence, dependencies, alternatives;
  rcl_domain_value_init(&field);
  rcl_domain_value_init(&evidence);
  rcl_domain_value_init(&dependencies);
  rcl_domain_value_init(&alternatives);
  if (!unique_sequence(&args[3], &evidence) || !unique_sequence(&args[7], &dependencies)
      || !rcl_domain_value_make_sequence(&alternatives, 0, "Sequence")) {
    rcl_domain_value_free(&evidence); rcl_domain_value_free(&dependencies); rcl_domain_value_free(&alternatives);
    rcl_domain_value_free(result);
    return fail(error, error_capacity, "RCL_DOMAIN_KNOWLEDGE_SEQUENCE: unable to normalize evidence/dependencies");
  }

  int ok = rcl_domain_value_set_text(&field, "Knowledge", "Text") && set_field(result, 0, "kind", &field)
    && rcl_domain_value_set_text(&field, base_type, "Text") && set_field(result, 1, "baseType", &field)
    && set_field_clone(result, 2, "value", &args[1])
    && rcl_domain_value_set_number(&field, args[2].as.number, "Number") && set_field(result, 3, "confidence", &field)
    && set_field(result, 4, "evidence", &evidence);

  if (ok) {
    if (args[4].as.text.length) ok = rcl_domain_value_set_text_n(&field, args[4].as.text.data, args[4].as.text.length, "Text") && set_field(result, 5, "source", &field);
    else ok = rcl_domain_value_set_null(&field, "Null") && set_field(result, 5, "source", &field);
  }
  if (ok) ok = rcl_domain_value_set_text_n(&field, args[5].as.text.data, args[5].as.text.length, "Text") && set_field(result, 6, "scope", &field);
  if (ok) ok = rcl_domain_value_set_text_n(&field, args[6].as.text.data, args[6].as.text.length, "Text") && set_field(result, 7, "status", &field);
  if (ok) ok = set_field(result, 8, "dependencies", &dependencies);
  if (ok) ok = rcl_domain_value_set_number(&field, args[8].as.number, "Number") && set_field(result, 9, "revision", &field);
  if (ok) ok = set_field(result, 10, "alternatives", &alternatives);
  if (ok) {
    if (args[9].as.text.length) ok = rcl_domain_value_set_text_n(&field, args[9].as.text.data, args[9].as.text.length, "Text") && set_field(result, 11, "formedAtRoot", &field);
    else ok = rcl_domain_value_set_null(&field, "Null") && set_field(result, 11, "formedAtRoot", &field);
  }

  if (!ok) {
    rcl_domain_value_free(&field);
    rcl_domain_value_free(&evidence);
    rcl_domain_value_free(&dependencies);
    rcl_domain_value_free(&alternatives);
    rcl_domain_value_free(result);
    return fail(error, error_capacity, "RCL_DOMAIN_KNOWLEDGE_BUILD: unable to populate knowledge result");
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
    {
      RCL_DOMAIN_ORGAN_ABI_V1,
      "quantitative", "measure", "quantitative.measure", "candidate.native.quantitative.measure.v0.1", NULL,
      RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, 1, quantitative_measure, NULL,
    },
    {
      RCL_DOMAIN_ORGAN_ABI_V1,
      "knowledge", "claim", "knowledge.claim", "candidate.native.knowledge.claim.v0.1", NULL,
      RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, 1, knowledge_claim, NULL,
    },
  };
  for (size_t i = 0; i < sizeof(organs) / sizeof(organs[0]); i++) {
    if (!rcl_domain_organ_register(registry, &organs[i], error, error_capacity)) return 0;
  }
  return 1;
}

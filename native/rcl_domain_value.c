#include "rcl_domain_value.h"

#include <math.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

static char *copy_text_n(const char *text, size_t length) {
  if (length > RCL_DOMAIN_VALUE_MAX_TEXT_BYTES) return NULL;
  char *copy = (char *)malloc(length + 1);
  if (!copy) return NULL;
  if (length && text) memcpy(copy, text, length);
  copy[length] = '\0';
  return copy;
}

static char *copy_text(const char *text) {
  return text ? copy_text_n(text, strlen(text)) : NULL;
}

static int same_optional_text(const char *left, const char *right) {
  if (!left || !right) return left == right;
  return strcmp(left, right) == 0;
}

void rcl_domain_value_init(RclDomainValueV1 *value) {
  if (!value) return;
  memset(value, 0, sizeof(*value));
  value->abi_version = RCL_DOMAIN_VALUE_ABI_V1;
  value->kind = RCL_DOMAIN_VALUE_NULL;
}

void rcl_domain_value_free(RclDomainValueV1 *value) {
  if (!value) return;
  free(value->semantic_type);
  value->semantic_type = NULL;
  switch (value->kind) {
    case RCL_DOMAIN_VALUE_TEXT:
      free(value->as.text.data);
      break;
    case RCL_DOMAIN_VALUE_SEQUENCE:
      for (size_t i = 0; i < value->as.sequence.count; i++) rcl_domain_value_free(&value->as.sequence.items[i]);
      free(value->as.sequence.items);
      break;
    case RCL_DOMAIN_VALUE_RECORD:
      free(value->as.record.type_name);
      for (size_t i = 0; i < value->as.record.count; i++) {
        free(value->as.record.fields[i].name);
        if (value->as.record.fields[i].value) {
          rcl_domain_value_free(value->as.record.fields[i].value);
          free(value->as.record.fields[i].value);
        }
      }
      free(value->as.record.fields);
      break;
    default:
      break;
  }
  rcl_domain_value_init(value);
}

static int set_semantic_type(RclDomainValueV1 *value, const char *semantic_type) {
  value->semantic_type = copy_text(semantic_type);
  return !semantic_type || value->semantic_type != NULL;
}

int rcl_domain_value_set_null(RclDomainValueV1 *value, const char *semantic_type) {
  if (!value) return 0;
  rcl_domain_value_free(value);
  value->kind = RCL_DOMAIN_VALUE_NULL;
  return set_semantic_type(value, semantic_type);
}

int rcl_domain_value_set_number(RclDomainValueV1 *value, double number, const char *semantic_type) {
  if (!value || !isfinite(number)) return 0;
  rcl_domain_value_free(value);
  value->kind = RCL_DOMAIN_VALUE_NUMBER;
  value->as.number = number;
  return set_semantic_type(value, semantic_type);
}

int rcl_domain_value_set_truth(RclDomainValueV1 *value, int truth, const char *semantic_type) {
  if (!value) return 0;
  rcl_domain_value_free(value);
  value->kind = RCL_DOMAIN_VALUE_TRUTH;
  value->as.truth = truth ? 1 : 0;
  return set_semantic_type(value, semantic_type);
}

int rcl_domain_value_set_text_n(RclDomainValueV1 *value, const char *text, size_t length, const char *semantic_type) {
  if (!value || (length && !text) || length > RCL_DOMAIN_VALUE_MAX_TEXT_BYTES) return 0;
  rcl_domain_value_free(value);
  value->kind = RCL_DOMAIN_VALUE_TEXT;
  value->as.text.data = copy_text_n(text ? text : "", length);
  if (!value->as.text.data) { rcl_domain_value_free(value); return 0; }
  value->as.text.length = length;
  if (!set_semantic_type(value, semantic_type)) { rcl_domain_value_free(value); return 0; }
  return 1;
}

int rcl_domain_value_set_text(RclDomainValueV1 *value, const char *text, const char *semantic_type) {
  return rcl_domain_value_set_text_n(value, text ? text : "", text ? strlen(text) : 0, semantic_type);
}

int rcl_domain_value_make_sequence(RclDomainValueV1 *value, size_t count, const char *semantic_type) {
  if (!value || count > RCL_DOMAIN_VALUE_MAX_ITEMS || count > SIZE_MAX / sizeof(RclDomainValueV1)) return 0;
  rcl_domain_value_free(value);
  value->kind = RCL_DOMAIN_VALUE_SEQUENCE;
  if (count) {
    value->as.sequence.items = (RclDomainValueV1 *)calloc(count, sizeof(RclDomainValueV1));
    if (!value->as.sequence.items) { rcl_domain_value_free(value); return 0; }
    for (size_t i = 0; i < count; i++) rcl_domain_value_init(&value->as.sequence.items[i]);
  }
  value->as.sequence.count = count;
  if (!set_semantic_type(value, semantic_type)) { rcl_domain_value_free(value); return 0; }
  return 1;
}

int rcl_domain_value_sequence_set(RclDomainValueV1 *sequence, size_t index, const RclDomainValueV1 *item) {
  if (!sequence || sequence->kind != RCL_DOMAIN_VALUE_SEQUENCE || !item || index >= sequence->as.sequence.count) return 0;
  return rcl_domain_value_clone(&sequence->as.sequence.items[index], item);
}

int rcl_domain_value_make_record(RclDomainValueV1 *value, const char *type_name, size_t field_count, const char *semantic_type) {
  if (!value || !type_name || !type_name[0] || strlen(type_name) > RCL_DOMAIN_VALUE_MAX_TEXT_BYTES
      || field_count > RCL_DOMAIN_VALUE_MAX_ITEMS || field_count > SIZE_MAX / sizeof(RclDomainFieldV1)) return 0;
  rcl_domain_value_free(value);
  value->kind = RCL_DOMAIN_VALUE_RECORD;
  value->as.record.type_name = copy_text(type_name);
  if (!value->as.record.type_name) { rcl_domain_value_free(value); return 0; }
  if (field_count) {
    value->as.record.fields = (RclDomainFieldV1 *)calloc(field_count, sizeof(RclDomainFieldV1));
    if (!value->as.record.fields) { rcl_domain_value_free(value); return 0; }
  }
  value->as.record.count = field_count;
  if (!set_semantic_type(value, semantic_type)) { rcl_domain_value_free(value); return 0; }
  return 1;
}

int rcl_domain_value_record_set(RclDomainValueV1 *record, size_t index, const char *field_name, const RclDomainValueV1 *field_value) {
  if (!record || record->kind != RCL_DOMAIN_VALUE_RECORD || index >= record->as.record.count || !field_name || !field_name[0]
      || strlen(field_name) > RCL_DOMAIN_VALUE_MAX_TEXT_BYTES || !field_value) return 0;
  for (size_t i = 0; i < record->as.record.count; i++) {
    if (i != index && record->as.record.fields[i].name && strcmp(record->as.record.fields[i].name, field_name) == 0) return 0;
  }
  RclDomainFieldV1 *field = &record->as.record.fields[index];
  char *name = copy_text(field_name);
  RclDomainValueV1 *copy = (RclDomainValueV1 *)malloc(sizeof(RclDomainValueV1));
  if (!name || !copy) { free(name); free(copy); return 0; }
  rcl_domain_value_init(copy);
  if (!rcl_domain_value_clone(copy, field_value)) { free(name); rcl_domain_value_free(copy); free(copy); return 0; }
  free(field->name);
  if (field->value) { rcl_domain_value_free(field->value); free(field->value); }
  field->name = name;
  field->value = copy;
  return 1;
}

static int validate_value(const RclDomainValueV1 *value, size_t depth) {
  if (!value || value->abi_version != RCL_DOMAIN_VALUE_ABI_V1 || depth > RCL_DOMAIN_VALUE_MAX_DEPTH) return 0;
  if (value->semantic_type && strlen(value->semantic_type) > RCL_DOMAIN_VALUE_MAX_TEXT_BYTES) return 0;
  switch (value->kind) {
    case RCL_DOMAIN_VALUE_NULL:
      return 1;
    case RCL_DOMAIN_VALUE_NUMBER:
      return isfinite(value->as.number);
    case RCL_DOMAIN_VALUE_TRUTH:
      return value->as.truth == 0 || value->as.truth == 1;
    case RCL_DOMAIN_VALUE_TEXT:
      return value->as.text.length <= RCL_DOMAIN_VALUE_MAX_TEXT_BYTES
        && (value->as.text.length == 0 || value->as.text.data != NULL);
    case RCL_DOMAIN_VALUE_SEQUENCE:
      if (value->as.sequence.count > RCL_DOMAIN_VALUE_MAX_ITEMS || (value->as.sequence.count && !value->as.sequence.items)) return 0;
      for (size_t i = 0; i < value->as.sequence.count; i++) if (!validate_value(&value->as.sequence.items[i], depth + 1)) return 0;
      return 1;
    case RCL_DOMAIN_VALUE_RECORD:
      if (!value->as.record.type_name || !value->as.record.type_name[0] || strlen(value->as.record.type_name) > RCL_DOMAIN_VALUE_MAX_TEXT_BYTES
          || value->as.record.count > RCL_DOMAIN_VALUE_MAX_ITEMS || (value->as.record.count && !value->as.record.fields)) return 0;
      for (size_t i = 0; i < value->as.record.count; i++) {
        const RclDomainFieldV1 *field = &value->as.record.fields[i];
        if (!field->name || !field->name[0] || strlen(field->name) > RCL_DOMAIN_VALUE_MAX_TEXT_BYTES || !field->value || !validate_value(field->value, depth + 1)) return 0;
        for (size_t j = i + 1; j < value->as.record.count; j++) {
          if (value->as.record.fields[j].name && strcmp(field->name, value->as.record.fields[j].name) == 0) return 0;
        }
      }
      return 1;
    default:
      return 0;
  }
}

int rcl_domain_value_validate(const RclDomainValueV1 *value) {
  return validate_value(value, 0);
}

int rcl_domain_value_clone(RclDomainValueV1 *target, const RclDomainValueV1 *source) {
  if (!target || !source || target == source) return target == source;
  if (!rcl_domain_value_validate(source)) return 0;
  rcl_domain_value_free(target);
  int ok = 0;
  switch (source->kind) {
    case RCL_DOMAIN_VALUE_NULL:
      ok = rcl_domain_value_set_null(target, source->semantic_type);
      break;
    case RCL_DOMAIN_VALUE_NUMBER:
      ok = rcl_domain_value_set_number(target, source->as.number, source->semantic_type);
      break;
    case RCL_DOMAIN_VALUE_TRUTH:
      ok = rcl_domain_value_set_truth(target, source->as.truth, source->semantic_type);
      break;
    case RCL_DOMAIN_VALUE_TEXT:
      ok = rcl_domain_value_set_text_n(target, source->as.text.data, source->as.text.length, source->semantic_type);
      break;
    case RCL_DOMAIN_VALUE_SEQUENCE:
      ok = rcl_domain_value_make_sequence(target, source->as.sequence.count, source->semantic_type);
      if (ok) for (size_t i = 0; i < source->as.sequence.count; i++) if (!rcl_domain_value_sequence_set(target, i, &source->as.sequence.items[i])) { ok = 0; break; }
      break;
    case RCL_DOMAIN_VALUE_RECORD:
      ok = rcl_domain_value_make_record(target, source->as.record.type_name, source->as.record.count, source->semantic_type);
      if (ok) for (size_t i = 0; i < source->as.record.count; i++) {
        const RclDomainFieldV1 *field = &source->as.record.fields[i];
        if (!rcl_domain_value_record_set(target, i, field->name, field->value)) { ok = 0; break; }
      }
      break;
    default:
      ok = 0;
      break;
  }
  if (!ok) rcl_domain_value_free(target);
  return ok;
}

static const RclDomainFieldV1 *find_field(const RclDomainValueV1 *record, const char *name) {
  for (size_t i = 0; i < record->as.record.count; i++) {
    const RclDomainFieldV1 *field = &record->as.record.fields[i];
    if (field->name && strcmp(field->name, name) == 0) return field;
  }
  return NULL;
}

int rcl_domain_value_equal(const RclDomainValueV1 *left, const RclDomainValueV1 *right) {
  if (!rcl_domain_value_validate(left) || !rcl_domain_value_validate(right)) return 0;
  if (left->kind != right->kind || !same_optional_text(left->semantic_type, right->semantic_type)) return 0;
  switch (left->kind) {
    case RCL_DOMAIN_VALUE_NULL:
      return 1;
    case RCL_DOMAIN_VALUE_NUMBER:
      return left->as.number == right->as.number;
    case RCL_DOMAIN_VALUE_TRUTH:
      return left->as.truth == right->as.truth;
    case RCL_DOMAIN_VALUE_TEXT:
      return left->as.text.length == right->as.text.length
        && memcmp(left->as.text.data, right->as.text.data, left->as.text.length) == 0;
    case RCL_DOMAIN_VALUE_SEQUENCE:
      if (left->as.sequence.count != right->as.sequence.count) return 0;
      for (size_t i = 0; i < left->as.sequence.count; i++) if (!rcl_domain_value_equal(&left->as.sequence.items[i], &right->as.sequence.items[i])) return 0;
      return 1;
    case RCL_DOMAIN_VALUE_RECORD:
      if (!same_optional_text(left->as.record.type_name, right->as.record.type_name) || left->as.record.count != right->as.record.count) return 0;
      for (size_t i = 0; i < left->as.record.count; i++) {
        const RclDomainFieldV1 *field = &left->as.record.fields[i];
        const RclDomainFieldV1 *other = find_field(right, field->name);
        if (!other || !rcl_domain_value_equal(field->value, other->value)) return 0;
      }
      return 1;
    default:
      return 0;
  }
}

/*
 * Candidate-only private membrane between native/rclvm.c Value and
 * RclDomainValueV1. Include this file only after the VM Value/VM helpers are
 * defined. It deliberately covers only the value subset needed by the first
 * admitted DOMAIN_CALL operations.
 */
#include "rcl_domain_value.h"

static void rcl_domain_bridge_fail(VM *vm, const char *message) {
  vm_fail(vm, "RCL_NATIVE_DOMAIN_VALUE_UNSUPPORTED", message);
}

static const Value *rcl_domain_bridge_record_field(const TypedRecord *record, const char *name) {
  int index = typed_record_field_index(record, name);
  return index < 0 ? NULL : &record->field_values[(size_t)index];
}

static const char *rcl_domain_bridge_record_family(const TypedRecord *record) {
  const Value *kind = rcl_domain_bridge_record_field(record, "kind");
  if (kind && kind->type == VALUE_STRING && kind->string && kind->string[0]) return kind->string;
  return record->type_name;
}

static int rcl_domain_bridge_native_to_domain_impl(VM *vm, const Value *source, RclDomainValueV1 *target, size_t depth) {
  if (!source || !target || depth > RCL_DOMAIN_VALUE_MAX_DEPTH) {
    rcl_domain_bridge_fail(vm, "Native value exceeds Domain Value recursion boundary");
    return 0;
  }
  switch (source->type) {
    case VALUE_NULL:
      return rcl_domain_value_set_null(target, "Null");
    case VALUE_NUMBER:
      if (!isfinite(source->number)) {
        rcl_domain_bridge_fail(vm, "Non-finite Number is not admitted by Domain Value ABI v1");
        return 0;
      }
      return rcl_domain_value_set_number(target, source->number, "Number");
    case VALUE_BOOL:
      return rcl_domain_value_set_truth(target, source->boolean, "Truth");
    case VALUE_STRING: {
      size_t length = source->string ? shared_string_header(source->string)->byte_length : 0;
      return rcl_domain_value_set_text_n(target, source->string ? source->string : "", length, "Text");
    }
    case VALUE_SEQUENCE: {
      if (!source->sequence || source->sequence->count > RCL_DOMAIN_VALUE_MAX_ITEMS
          || !rcl_domain_value_make_sequence(target, source->sequence->count, "Sequence")) {
        rcl_domain_bridge_fail(vm, "Native Sequence exceeds Domain Value boundary");
        return 0;
      }
      sequence_materialize(source->sequence);
      for (size_t i = 0; i < source->sequence->count; i++) {
        if (!rcl_domain_bridge_native_to_domain_impl(vm, &source->sequence->items[i], &target->as.sequence.items[i], depth + 1)) return 0;
      }
      return 1;
    }
    case VALUE_TYPED_RECORD: {
      if (!source->typed_record || source->typed_record->field_count > RCL_DOMAIN_VALUE_MAX_ITEMS) {
        rcl_domain_bridge_fail(vm, "Native typed Record exceeds Domain Value boundary");
        return 0;
      }
      const char *family = rcl_domain_bridge_record_family(source->typed_record);
      if (!rcl_domain_value_make_record(
        target,
        family && family[0] ? family : source->typed_record->type_name,
        source->typed_record->field_count,
        source->typed_record->type_name
      )) {
        rcl_domain_bridge_fail(vm, "Unable to allocate Domain Value Record");
        return 0;
      }
      for (size_t i = 0; i < source->typed_record->field_count; i++) {
        RclDomainValueV1 field_value;
        rcl_domain_value_init(&field_value);
        int converted = rcl_domain_bridge_native_to_domain_impl(vm, &source->typed_record->field_values[i], &field_value, depth + 1);
        int stored = converted && rcl_domain_value_record_set(target, i, source->typed_record->field_names[i], &field_value);
        rcl_domain_value_free(&field_value);
        if (!stored) {
          if (!vm->error.code) rcl_domain_bridge_fail(vm, "Unable to store Domain Value Record field");
          return 0;
        }
      }
      return 1;
    }
    default:
      rcl_domain_bridge_fail(vm, "Native value kind is not admitted by Domain Value ABI v1");
      return 0;
  }
}

static int rcl_domain_bridge_native_to_domain(VM *vm, const Value *source, RclDomainValueV1 *target) {
  if (!target || target->abi_version != RCL_DOMAIN_VALUE_ABI_V1) {
    rcl_domain_bridge_fail(vm, "Domain Value output must be initialized");
    return 0;
  }
  rcl_domain_value_free(target);
  if (!rcl_domain_bridge_native_to_domain_impl(vm, source, target, 0)) {
    rcl_domain_value_free(target);
    return 0;
  }
  if (!rcl_domain_value_validate(target)) {
    rcl_domain_value_free(target);
    rcl_domain_bridge_fail(vm, "Converted Domain Value failed recursive validation");
    return 0;
  }
  return 1;
}

static Value rcl_domain_bridge_domain_to_native_impl(VM *vm, const RclDomainValueV1 *source, size_t depth) {
  if (!source || depth > RCL_DOMAIN_VALUE_MAX_DEPTH) {
    rcl_domain_bridge_fail(vm, "Domain Value exceeds native recursion boundary");
    return value_null();
  }
  switch (source->kind) {
    case RCL_DOMAIN_VALUE_NULL:
      return value_null();
    case RCL_DOMAIN_VALUE_NUMBER:
      return value_number(source->as.number);
    case RCL_DOMAIN_VALUE_TRUTH:
      return value_bool(source->as.truth);
    case RCL_DOMAIN_VALUE_TEXT:
      return value_string_n(source->as.text.data ? source->as.text.data : "", source->as.text.length);
    case RCL_DOMAIN_VALUE_SEQUENCE: {
      Value result = value_null();
      result.type = VALUE_SEQUENCE;
      result.sequence = sequence_create();
      size_t count = source->as.sequence.count;
      if (count) {
        result.sequence->items = (Value *)calloc(count, sizeof(Value));
        if (!result.sequence->items) {
          sequence_free(result.sequence);
          rcl_domain_bridge_fail(vm, "Unable to allocate native Sequence from Domain Value");
          return value_null();
        }
      }
      result.sequence->count = count;
      for (size_t i = 0; i < count; i++) {
        result.sequence->items[i] = rcl_domain_bridge_domain_to_native_impl(vm, &source->as.sequence.items[i], depth + 1);
        if (vm->error.code) {
          value_free(&result);
          return value_null();
        }
      }
      return result;
    }
    case RCL_DOMAIN_VALUE_RECORD: {
      size_t count = source->as.record.count;
      char **field_names = (char **)calloc(count ? count : 1, sizeof(char *));
      Value *field_values = (Value *)calloc(count ? count : 1, sizeof(Value));
      if (!field_names || !field_values) {
        free(field_names); free(field_values);
        rcl_domain_bridge_fail(vm, "Unable to allocate native Record from Domain Value");
        return value_null();
      }
      for (size_t i = 0; i < count; i++) {
        field_names[i] = source->as.record.fields[i].name;
        field_values[i] = rcl_domain_bridge_domain_to_native_impl(vm, source->as.record.fields[i].value, depth + 1);
        if (vm->error.code) {
          for (size_t j = 0; j <= i; j++) value_free(&field_values[j]);
          free(field_names); free(field_values);
          return value_null();
        }
      }
      const char *native_type = source->semantic_type && source->semantic_type[0]
        ? source->semantic_type
        : source->as.record.type_name;
      uint64_t object_id = vm->next_typed_object_id++;
      vm->typed_heap_allocated++;
      Value result = value_typed_record_with_id(object_id, native_type, field_names, field_values, count);
      for (size_t i = 0; i < count; i++) value_free(&field_values[i]);
      free(field_names); free(field_values);
      if (!typed_heap_register(vm, &result)) {
        value_free(&result);
        return value_null();
      }
      return result;
    }
    default:
      rcl_domain_bridge_fail(vm, "Domain Value kind is not admitted by native membrane v1");
      return value_null();
  }
}

static Value rcl_domain_bridge_domain_to_native(VM *vm, const RclDomainValueV1 *source) {
  if (!rcl_domain_value_validate(source)) {
    rcl_domain_bridge_fail(vm, "Domain Value failed validation before native conversion");
    return value_null();
  }
  return rcl_domain_bridge_domain_to_native_impl(vm, source, 0);
}

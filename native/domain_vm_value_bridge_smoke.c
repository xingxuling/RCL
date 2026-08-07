#define RCLVM_EMBEDDED_ONLY
#include "rclvm.c"
#include "rcl_domain_vm_value_bridge.inc"

static int set_domain_field(RclDomainValueV1 *record, size_t index, const char *name, RclDomainValueV1 *value) {
  int ok = rcl_domain_value_record_set(record, index, name, value);
  rcl_domain_value_free(value);
  return ok;
}

int main(void) {
  VM *vm = (VM *)calloc(1, sizeof(VM));
  if (!vm) return 5;
  vm->next_typed_object_id = 1;

  Value native_text = value_string("hello");
  RclDomainValueV1 domain_text, roundtrip_domain;
  rcl_domain_value_init(&domain_text);
  rcl_domain_value_init(&roundtrip_domain);
  if (!rcl_domain_bridge_native_to_domain(vm, &native_text, &domain_text)) return 10;
  Value roundtrip_text = rcl_domain_bridge_domain_to_native(vm, &domain_text);
  if (vm->error.code || !values_equal(&native_text, &roundtrip_text)) return 11;
  value_free(&native_text);
  value_free(&roundtrip_text);
  rcl_domain_value_free(&domain_text);

  RclDomainValueV1 quantity, field;
  rcl_domain_value_init(&quantity);
  rcl_domain_value_init(&field);
  if (!rcl_domain_value_make_record(&quantity, "Quantity", 4, "Temperature")) return 12;
  if (!rcl_domain_value_set_text(&field, "Quantity", "Text") || !set_domain_field(&quantity, 0, "kind", &field)) return 13;
  if (!rcl_domain_value_set_text(&field, "Temperature", "Text") || !set_domain_field(&quantity, 1, "type", &field)) return 14;
  if (!rcl_domain_value_set_number(&field, 25, "Number") || !set_domain_field(&quantity, 2, "value", &field)) return 15;
  if (!rcl_domain_value_set_text(&field, "°C", "Text") || !set_domain_field(&quantity, 3, "unit", &field)) return 16;

  Value native_quantity = rcl_domain_bridge_domain_to_native(vm, &quantity);
  if (vm->error.code || native_quantity.type != VALUE_TYPED_RECORD) return 17;
  if (strcmp(native_quantity.typed_record->type_name, "Temperature") != 0) return 18;
  if (!rcl_domain_bridge_native_to_domain(vm, &native_quantity, &roundtrip_domain)) return 19;
  if (!rcl_domain_value_equal(&quantity, &roundtrip_domain)) return 20;
  rcl_domain_value_free(&roundtrip_domain);
  value_free(&native_quantity);
  rcl_domain_value_free(&quantity);

  RclDomainValueV1 sequence, item;
  rcl_domain_value_init(&sequence);
  rcl_domain_value_init(&item);
  if (!rcl_domain_value_make_sequence(&sequence, 2, "Sequence")) return 21;
  if (!rcl_domain_value_set_text(&item, "a", "Text") || !rcl_domain_value_sequence_set(&sequence, 0, &item)) return 22;
  if (!rcl_domain_value_set_number(&item, 7, "Number") || !rcl_domain_value_sequence_set(&sequence, 1, &item)) return 23;
  rcl_domain_value_free(&item);
  Value native_sequence = rcl_domain_bridge_domain_to_native(vm, &sequence);
  if (vm->error.code || native_sequence.type != VALUE_SEQUENCE) return 24;
  if (!rcl_domain_bridge_native_to_domain(vm, &native_sequence, &roundtrip_domain)) return 25;
  if (!rcl_domain_value_equal(&sequence, &roundtrip_domain)) return 26;
  value_free(&native_sequence);
  rcl_domain_value_free(&roundtrip_domain);
  rcl_domain_value_free(&sequence);

  memset(&vm->error, 0, sizeof(vm->error));
  Value unsupported = value_span(0, 1, 1, 0);
  rcl_domain_value_init(&roundtrip_domain);
  if (rcl_domain_bridge_native_to_domain(vm, &unsupported, &roundtrip_domain)) return 27;
  if (!vm->error.code || strcmp(vm->error.code, "RCL_NATIVE_DOMAIN_VALUE_UNSUPPORTED") != 0) return 28;
  value_free(&unsupported);
  rcl_domain_value_free(&roundtrip_domain);

  typed_heap_clear(vm);
  free(vm);
  puts("domain-vm-value-bridge-smoke: PASS");
  return 0;
}

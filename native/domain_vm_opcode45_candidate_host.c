#define RCLVM_EMBEDDED_ONLY
#include "rclvm-rbc13-domain-candidate.c"
#include "rcl_domain_vm_candidate.h"
#include "rcl_domain_admitted_organs.h"

static int register_admitted_organs(RclVmInstance *instance, char *error, size_t error_capacity) {
  RclDomainOrganRegistry admitted;
  rcl_domain_organ_registry_init(&admitted);
  if (!rcl_domain_register_admitted_candidates_v01(&admitted, error, error_capacity)) {
    rcl_domain_organ_registry_free(&admitted);
    return 0;
  }
  int ok = 1;
  for (size_t i = 0; i < admitted.count; i++) {
    if (!rclvm_instance_register_domain_organ(instance, &admitted.entries[i], error, error_capacity)) {
      ok = 0;
      break;
    }
  }
  rcl_domain_organ_registry_free(&admitted);
  return ok;
}

int main(int argc, char **argv) {
  if (argc < 2 || argc > 3) {
    fprintf(stderr, "usage: domain-vm-opcode45-candidate <program.rbc> [--candidate-minimum]\n");
    return 64;
  }

  RclVmInstance *instance = rclvm_instance_create();
  if (!instance) return 70;
  char error[1024]; error[0] = '\0';
  if (!register_admitted_organs(instance, error, sizeof(error))) {
    fprintf(stderr, "%s\n", error);
    rclvm_instance_destroy(instance);
    return 71;
  }
  if (rclvm_instance_domain_organ_count(instance) != 4) {
    fprintf(stderr, "candidate host expected exactly four admitted organs\n");
    rclvm_instance_destroy(instance);
    return 72;
  }
  if (argc == 3 && strcmp(argv[2], "--candidate-minimum") == 0) {
    if (!rclvm_instance_set_domain_minimum_tier(instance, RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, error, sizeof(error))) {
      fprintf(stderr, "%s\n", error);
      rclvm_instance_destroy(instance);
      return 73;
    }
  }

  if (!rclvm_instance_load_file(instance, argv[1], error, sizeof(error))) {
    fprintf(stderr, "%s\n", error);
    rclvm_instance_destroy(instance);
    return 74;
  }

  char *result_json = NULL;
  int ok = rclvm_instance_run(instance, 1, &result_json, error, sizeof(error));
  if (result_json) {
    fputs(result_json, stdout);
    rclvm_free_string(result_json);
  } else if (error[0]) {
    fprintf(stderr, "%s\n", error);
  }
  rclvm_instance_destroy(instance);
  return ok ? 0 : 2;
}

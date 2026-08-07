#define RCLVM_EMBEDDED_ONLY
#include "rclvm-rbc13-domain-candidate.c"
#include "rcl_domain_admitted_organs.h"

int main(int argc, char **argv) {
  if (argc < 2 || argc > 3) {
    fprintf(stderr, "usage: domain-vm-opcode45-candidate <program.rbc> [--candidate-minimum]\n");
    return 64;
  }

  RclVmInstance *instance = rclvm_instance_create();
  if (!instance) return 70;
  char error[1024]; error[0] = '\0';
  if (!rcl_domain_register_admitted_candidates_v01(&instance->vm.domain_organs, error, sizeof(error))) {
    fprintf(stderr, "%s\n", error);
    rclvm_instance_destroy(instance);
    return 71;
  }
  if (argc == 3 && strcmp(argv[2], "--candidate-minimum") == 0) {
    instance->vm.domain_minimum_tier = RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE;
  }

  if (!rclvm_instance_load_file(instance, argv[1], error, sizeof(error))) {
    fprintf(stderr, "%s\n", error);
    rclvm_instance_destroy(instance);
    return 72;
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

#define RCLVM_EMBEDDED_ONLY
#include "rclvm-rbc13-domain-candidate.c"

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

int main(int argc, char **argv) {
  if (argc < 2 || argc > 3) {
    fprintf(stderr, "usage: domain-vm-opcode45-candidate <program.rbc> [--candidate-minimum]\n");
    return 64;
  }

  RclVmInstance *instance = rclvm_instance_create();
  if (!instance) return 70;
  RclDomainOrganV1 echo = {
    RCL_DOMAIN_ORGAN_ABI_V1,
    "core",
    "echo",
    "core.echo",
    "candidate.native.core.echo.v0.1",
    NULL,
    RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE,
    1,
    core_echo,
    NULL,
  };
  char error[1024]; error[0] = '\0';
  if (!rcl_domain_organ_register(&instance->vm.domain_organs, &echo, error, sizeof(error))) {
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

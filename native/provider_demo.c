#include "rclvm.h"
#include <stdio.h>
#include <string.h>

static int echo_invoke(void *userdata, const char *capability, const char *request_json,
                       char *response_json, size_t response_capacity,
                       char *error, size_t error_capacity) {
  (void)userdata;
  if (strcmp(capability, "echo.text") != 0 && strcmp(capability, "text") != 0) {
    snprintf(error, error_capacity, "Unsupported capability: %s", capability);
    return 0;
  }
  snprintf(response_json, response_capacity, "{\"provider\":\"echo\",\"request\":%s}", request_json);
  return 1;
}

int main(int argc, char **argv) {
  if (argc != 2) { fprintf(stderr, "Usage: provider_demo <provider-abi.rbc>\n"); return 2; }
  char error[512] = {0}; char *json = NULL;
  RclVmInstance *vm = rclvm_instance_create();
  if (!vm) return 2;
  RclVmProviderV1 provider = { RCLVM_PROVIDER_ABI_V1, "echo", echo_invoke, NULL };
  if (!rclvm_instance_register_provider(vm, &provider, error, sizeof(error)) ||
      !rclvm_instance_load_file(vm, argv[1], error, sizeof(error)) ||
      !rclvm_instance_run(vm, 1, &json, error, sizeof(error))) {
    fprintf(stderr, "%s\n", error); rclvm_instance_destroy(vm); return 1;
  }
  fputs(json, stdout);
  rclvm_free_string(json); rclvm_instance_destroy(vm); return 0;
}

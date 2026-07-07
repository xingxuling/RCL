#ifndef RCLVM_H
#define RCLVM_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define RCLVM_PROVIDER_ABI_V1 1u

typedef struct RclVmInstance RclVmInstance;

typedef int (*RclVmProviderInvokeFn)(
  void *userdata,
  const char *capability,
  const char *request_json,
  char *response_json,
  size_t response_capacity,
  char *error,
  size_t error_capacity
);

typedef struct {
  uint32_t abi_version;
  const char *provider_id;
  RclVmProviderInvokeFn invoke;
  void *userdata;
} RclVmProviderV1;

const char *rclvm_version(void);
RclVmInstance *rclvm_instance_create(void);
void rclvm_instance_destroy(RclVmInstance *instance);
int rclvm_instance_load_file(RclVmInstance *instance, const char *path, char *error, size_t error_capacity);
int rclvm_instance_register_provider(RclVmInstance *instance, const RclVmProviderV1 *provider, char *error, size_t error_capacity);
int rclvm_instance_run(RclVmInstance *instance, int reset_state, char **result_json, char *error, size_t error_capacity);
int rclvm_instance_reset(RclVmInstance *instance, int clear_state);
void rclvm_free_string(char *value);

#ifdef __cplusplus
}
#endif
#endif

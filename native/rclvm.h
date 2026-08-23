#ifndef RCLVM_H
#define RCLVM_H

#include <stddef.h>
#include <stdint.h>

#if defined(_WIN32)
#if defined(RCLVM_BUILD_DLL)
#define RCLVM_API __declspec(dllexport)
#elif defined(RCLVM_USE_DLL)
#define RCLVM_API __declspec(dllimport)
#else
#define RCLVM_API
#endif
#elif defined(__GNUC__) && __GNUC__ >= 4
#define RCLVM_API __attribute__((visibility("default")))
#else
#define RCLVM_API
#endif

#ifdef __cplusplus
extern "C" {
#endif

#define RCLVM_PROVIDER_ABI_V1 1u
#define RCLVM_MAX_VALUE_STACK 131072u
#define RCLVM_MAX_CALL_FRAMES 32768u
#define RCLVM_MAX_EXECUTED_INSTRUCTIONS 300000000ULL

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

RCLVM_API const char *rclvm_version(void);
RCLVM_API int rclvm_validate_bytecode(const uint8_t *bytes, size_t length, char *error, size_t error_capacity);
RCLVM_API RclVmInstance *rclvm_instance_create(void);
RCLVM_API void rclvm_instance_destroy(RclVmInstance *instance);
RCLVM_API int rclvm_instance_load_file(RclVmInstance *instance, const char *path, char *error, size_t error_capacity);
RCLVM_API int rclvm_instance_register_provider(RclVmInstance *instance, const RclVmProviderV1 *provider, char *error, size_t error_capacity);
RCLVM_API int rclvm_instance_run(RclVmInstance *instance, int reset_state, char **result_json, char *error, size_t error_capacity);
RCLVM_API int rclvm_instance_reset(RclVmInstance *instance, int clear_state);
RCLVM_API int rclvm_instance_get_state_text(
  RclVmInstance *instance,
  const char *path,
  char **text,
  size_t *text_length,
  char *error,
  size_t error_capacity
);
RCLVM_API int rclvm_instance_get_state_bytes(
  RclVmInstance *instance,
  const char *path,
  uint8_t **bytes,
  size_t *byte_length,
  char *error,
  size_t error_capacity
);
RCLVM_API size_t rclvm_instance_get_peak_stack_depth(const RclVmInstance *instance);
RCLVM_API size_t rclvm_instance_get_peak_call_frame_depth(const RclVmInstance *instance);
RCLVM_API uint64_t rclvm_instance_get_executed_instruction_count(const RclVmInstance *instance);
RCLVM_API void rclvm_free_string(char *value);
RCLVM_API void rclvm_free_bytes(uint8_t *value);

#ifdef __cplusplus
}
#endif
#endif

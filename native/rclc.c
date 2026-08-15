#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#include <process.h>
#include <share.h>
#include <windows.h>
#else
#include <unistd.h>
#endif
#include "rclvm.h"

#define RCLC_MAX_SOURCE_BYTES ((16 * 1024 * 1024) - 1)

typedef struct {
  char *source;
  size_t length;
} CompilerInput;

static void print_json_string(FILE *out, const char *value) {
  fputc('"', out);
  for (const unsigned char *cursor = (const unsigned char *)(value ? value : ""); *cursor; cursor++) {
    switch (*cursor) {
      case '"': fputs("\\\"", out); break;
      case '\\': fputs("\\\\", out); break;
      case '\b': fputs("\\b", out); break;
      case '\f': fputs("\\f", out); break;
      case '\n': fputs("\\n", out); break;
      case '\r': fputs("\\r", out); break;
      case '\t': fputs("\\t", out); break;
      default:
        if (*cursor < 0x20) fprintf(out, "\\u%04x", *cursor);
        else fputc(*cursor, out);
    }
  }
  fputc('"', out);
}

static int fail(const char *code, const char *message) {
  fputs("{\"status\":\"error\",\"code\":", stderr);
  print_json_string(stderr, code);
  fputs(",\"message\":", stderr);
  print_json_string(stderr, message);
  fputs("}\n", stderr);
  return 1;
}

static int read_source_file(const char *path, CompilerInput *input, char *error, size_t error_capacity) {
  memset(input, 0, sizeof(*input));
  FILE *file = fopen(path, "rb");
  if (!file) {
    snprintf(error, error_capacity, "Cannot open source '%s': %s", path, strerror(errno));
    return 0;
  }
  if (fseek(file, 0, SEEK_END) != 0) {
    snprintf(error, error_capacity, "Cannot seek source '%s'", path);
    fclose(file);
    return 0;
  }
  long length = ftell(file);
  if (length < 0 || (unsigned long)length > RCLC_MAX_SOURCE_BYTES || fseek(file, 0, SEEK_SET) != 0) {
    snprintf(error, error_capacity, "Source '%s' exceeds the %d-byte compiler_input limit", path, RCLC_MAX_SOURCE_BYTES);
    fclose(file);
    return 0;
  }
  input->source = (char *)malloc((size_t)length + 1);
  if (!input->source) {
    snprintf(error, error_capacity, "Unable to allocate source input buffer");
    fclose(file);
    return 0;
  }
  input->length = fread(input->source, 1, (size_t)length, file);
  if (input->length != (size_t)length || ferror(file)) {
    snprintf(error, error_capacity, "Cannot read source '%s'", path);
    free(input->source);
    memset(input, 0, sizeof(*input));
    fclose(file);
    return 0;
  }
  fclose(file);
  if (memchr(input->source, '\0', input->length)) {
    snprintf(error, error_capacity, "Source '%s' contains an embedded NUL byte", path);
    free(input->source);
    memset(input, 0, sizeof(*input));
    return 0;
  }
  input->source[input->length] = '\0';
  return 1;
}

static int compiler_input_invoke(
  void *userdata,
  const char *capability,
  const char *request_json,
  char *response_json,
  size_t response_capacity,
  char *error,
  size_t error_capacity
) {
  (void)capability;
  (void)request_json;
  CompilerInput *input = (CompilerInput *)userdata;
  if (!input || !input->source || !response_json || response_capacity <= input->length) {
    if (error && error_capacity) snprintf(error, error_capacity, "compiler_input source exceeds provider response capacity");
    return 0;
  }
  memcpy(response_json, input->source, input->length);
  response_json[input->length] = '\0';
  return 1;
}

static unsigned long process_id(void) {
#ifdef _WIN32
  return (unsigned long)_getpid();
#else
  return (unsigned long)getpid();
#endif
}

static int sync_file(FILE *file) {
  if (fflush(file) != 0) return 0;
#ifdef _WIN32
  return _commit(_fileno(file)) == 0;
#else
  return fsync(fileno(file)) == 0;
#endif
}

static int replace_file(const char *temporary_path, const char *output_path) {
#ifdef _WIN32
  return MoveFileExA(temporary_path, output_path, MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH) != 0;
#else
  return rename(temporary_path, output_path) == 0;
#endif
}

static FILE *open_exclusive_binary(const char *path) {
#ifdef _WIN32
  int descriptor = -1;
  int result = _sopen_s(
    &descriptor,
    path,
    _O_WRONLY | _O_CREAT | _O_EXCL | _O_BINARY,
    _SH_DENYRW,
    0600
  );
  if (result != 0) {
    errno = result;
    return NULL;
  }
  FILE *file = _fdopen(descriptor, "wb");
  if (!file) {
    int saved_errno = errno;
    _close(descriptor);
    remove(path);
    errno = saved_errno;
  }
  return file;
#else
  return fopen(path, "wbx");
#endif
}

static int write_output_file_atomic(const char *path, const uint8_t *bytes, size_t length, char *error, size_t error_capacity) {
  static unsigned long temporary_counter = 0;
  size_t temporary_capacity = strlen(path) + 64;
  char *temporary_path = (char *)malloc(temporary_capacity);
  if (!temporary_path) {
    snprintf(error, error_capacity, "Unable to allocate temporary output path");
    return 0;
  }

  FILE *file = NULL;
  for (unsigned int attempt = 0; attempt < 100; attempt++) {
    unsigned long counter = temporary_counter++;
    snprintf(temporary_path, temporary_capacity, "%s.tmp.%lu.%lu", path, process_id(), counter);
    errno = 0;
    file = open_exclusive_binary(temporary_path);
    if (file || errno != EEXIST) break;
  }
  if (!file) {
    snprintf(error, error_capacity, "Cannot create temporary output beside '%s': %s", path, strerror(errno));
    free(temporary_path);
    return 0;
  }

  size_t written = length ? fwrite(bytes, 1, length, file) : 0;
  int ok = written == length;
  if (ok && !sync_file(file)) ok = 0;
  if (fclose(file) != 0) ok = 0;
  if (!ok) {
    snprintf(error, error_capacity, "Cannot write complete output '%s'", path);
    remove(temporary_path);
    free(temporary_path);
    return 0;
  }
  if (!replace_file(temporary_path, path)) {
    snprintf(error, error_capacity, "Cannot atomically replace output '%s': %s", path, strerror(errno));
    remove(temporary_path);
    free(temporary_path);
    return 0;
  }
  free(temporary_path);
  return 1;
}

static int is_missing_state_error(const char *error) {
  return error && strncmp(error, "RCL_STATE_MISSING:", strlen("RCL_STATE_MISSING:")) == 0;
}

static int get_output_bytes(
  RclVmInstance *instance,
  const char **selected_path,
  char **declared_path,
  uint8_t **bytes,
  size_t *length,
  char *error,
  size_t error_capacity
) {
  const char *environment_path = getenv("RCLC_OUTPUT_STATE");
  if (environment_path && environment_path[0]) {
    *selected_path = environment_path;
    return rclvm_instance_get_state_bytes(instance, environment_path, bytes, length, error, error_capacity);
  }

  char declaration_error[512] = {0};
  if (rclvm_instance_get_state_text(instance, "compiler.output_state", declared_path, NULL, declaration_error, sizeof(declaration_error))) {
    if (!(*declared_path)[0]) {
      snprintf(error, error_capacity, "RCL_STATE_BYTES_INVALID: compiler.output_state is empty");
      return 0;
    }
    *selected_path = *declared_path;
    return rclvm_instance_get_state_bytes(instance, *declared_path, bytes, length, error, error_capacity);
  }
  if (!is_missing_state_error(declaration_error)) {
    snprintf(error, error_capacity, "%s", declaration_error);
    return 0;
  }

  static const char *fallbacks[] = { "compiler.output", "compiler.rbc_bytes", "target.rbc_bytes", "output.rbc_bytes" };
  for (size_t i = 0; i < sizeof(fallbacks) / sizeof(fallbacks[0]); i++) {
    error[0] = '\0';
    if (rclvm_instance_get_state_bytes(instance, fallbacks[i], bytes, length, error, error_capacity)) {
      *selected_path = fallbacks[i];
      return 1;
    }
    if (!is_missing_state_error(error)) return 0;
  }
  snprintf(error, error_capacity, "RCL_STATE_MISSING: compiler produced no RBC byte Sequence in a supported output state");
  return 0;
}

int main(int argc, char **argv) {
  if (argc != 4) {
    fprintf(stderr, "Usage: rclc <compiler.rbc> <source.rcl> <output.rbc>\n");
    return 2;
  }

  char error[1024] = {0};
  CompilerInput input;
  if (!read_source_file(argv[2], &input, error, sizeof(error))) return fail("RCLC_SOURCE_IO", error);

  RclVmInstance *instance = rclvm_instance_create();
  if (!instance) {
    free(input.source);
    return fail("RCLC_OOM", "Unable to create native VM instance");
  }

  int ok = rclvm_instance_load_file(instance, argv[1], error, sizeof(error));
  RclVmProviderV1 provider = {
    RCLVM_PROVIDER_ABI_V1,
    "compiler_input",
    compiler_input_invoke,
    &input,
  };
  if (ok) ok = rclvm_instance_register_provider(instance, &provider, error, sizeof(error));
  if (ok) ok = rclvm_instance_run(instance, 1, NULL, error, sizeof(error));
  if (!ok) {
    rclvm_instance_destroy(instance);
    free(input.source);
    return fail("RCLC_COMPILER_FAILURE", error[0] ? error : "Native compiler execution failed");
  }

  const char *output_state = NULL;
  char *declared_output_state = NULL;
  uint8_t *output_bytes = NULL;
  size_t output_length = 0;
  ok = get_output_bytes(instance, &output_state, &declared_output_state, &output_bytes, &output_length, error, sizeof(error));
  if (ok) ok = rclvm_validate_bytecode(output_bytes, output_length, error, sizeof(error));
  if (ok) ok = write_output_file_atomic(argv[3], output_bytes, output_length, error, sizeof(error));

  if (ok) {
    fputs("{\"status\":\"ok\",\"outputState\":", stdout);
    print_json_string(stdout, output_state);
    fprintf(
      stdout,
      ",\"bytes\":%zu,\"peakStackDepth\":%zu,\"peakCallFrames\":%zu,\"output\":",
      output_length,
      rclvm_instance_get_peak_stack_depth(instance),
      rclvm_instance_get_peak_call_frame_depth(instance)
    );
    print_json_string(stdout, argv[3]);
    fputs("}\n", stdout);
  }

  rclvm_free_bytes(output_bytes);
  rclvm_free_string(declared_output_state);
  rclvm_instance_destroy(instance);
  free(input.source);
  return ok ? 0 : fail("RCLC_OUTPUT_FAILURE", error[0] ? error : "Unable to export compiler bytecode state");
}

#define _POSIX_C_SOURCE 200809L
#include "rclvm.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#ifdef _WIN32
#include <windows.h>
#else
#include <time.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/file.h>
#endif

/* The operating system releases this lock on normal exit or process death.
 * No stale PID, timeout lease or destructive lock-file recovery is needed. */
#ifdef _WIN32
static HANDLE writer_lock = INVALID_HANDLE_VALUE;
#else
static int writer_lock = -1;
#endif

static int acquire_writer_lock(const char *path) {
#ifdef _WIN32
  int count = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, path, -1, NULL, 0);
  if (!count) return 0;
  wchar_t *wide = (wchar_t *)calloc((size_t)count, sizeof(wchar_t));
  if (!wide) return 0;
  MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, path, -1, wide, count);
  writer_lock = CreateFileW(wide, GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, NULL,
    OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT, NULL);
  free(wide);
  if (writer_lock == INVALID_HANDLE_VALUE) return 0;
  BY_HANDLE_FILE_INFORMATION info;
  OVERLAPPED overlap = {0};
  if (!GetFileInformationByHandle(writer_lock, &info) || (info.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT)
      || !LockFileEx(writer_lock, LOCKFILE_EXCLUSIVE_LOCK | LOCKFILE_FAIL_IMMEDIATELY, 0, MAXDWORD, MAXDWORD, &overlap)) {
    CloseHandle(writer_lock); writer_lock = INVALID_HANDLE_VALUE; return 0;
  }
#else
  writer_lock = open(path, O_CREAT | O_RDWR | O_NOFOLLOW, 0600);
  if (writer_lock < 0) return 0;
  if (flock(writer_lock, LOCK_EX | LOCK_NB) != 0) { close(writer_lock); writer_lock = -1; return 0; }
#endif
  return 1;
}

static void release_writer_lock(void) {
#ifdef _WIN32
  if (writer_lock != INVALID_HANDLE_VALUE) CloseHandle(writer_lock);
#else
  if (writer_lock >= 0) close(writer_lock);
#endif
}

static double now_ms(void) {
#ifdef _WIN32
  LARGE_INTEGER frequency;
  LARGE_INTEGER counter;
  QueryPerformanceFrequency(&frequency);
  QueryPerformanceCounter(&counter);
  return (double)counter.QuadPart * 1000.0 / (double)frequency.QuadPart;
#else
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (double)ts.tv_sec * 1000.0 + (double)ts.tv_nsec / 1000000.0;
#endif
}

#define MAX_SESSION_WIRE (2u * 1024u * 1024u)

static void print_error_json(const char *error) {
  fputs("{\"status\":\"error\",\"message\":\"", stdout);
  for (const unsigned char *p = (const unsigned char *)error; *p; p++) {
    if (*p == '"' || *p == '\\') { putchar('\\'); putchar(*p); }
    else if (*p < 32) printf("\\u%04x", *p);
    else putchar(*p);
  }
  puts("\"}");
}

static int hex_digit(char ch) {
  return ch >= '0' && ch <= '9' ? ch - '0' : ch >= 'a' && ch <= 'f' ? ch - 'a' + 10 : -1;
}

static uint32_t wire_u32(const uint8_t *data, size_t *offset) {
  uint32_t result = (uint32_t)data[*offset] | (uint32_t)data[*offset + 1] << 8
    | (uint32_t)data[*offset + 2] << 16 | (uint32_t)data[*offset + 3] << 24;
  *offset += 4; return result;
}

static char *wire_text(const uint8_t *data, size_t length, size_t *offset, size_t *text_length) {
  if (*offset > length || length - *offset < 4) return NULL;
  uint32_t count = wire_u32(data, offset);
  if (count > length - *offset || memchr(data + *offset, 0, count)) return NULL;
  char *text = (char *)malloc((size_t)count + 1);
  if (!text) return NULL;
  memcpy(text, data + *offset, count); text[count] = 0; *offset += count;
  if (text_length) *text_length = count;
  return text;
}

static int run_session_step(RclVmInstance *vm, char *line, char **json, char *error, size_t capacity) {
  char *mode = strtok(line + 5, " ");
  char *rule = strtok(NULL, " ");
  char *hex = strtok(NULL, " ");
  if (!mode || (strcmp(mode, "0") && strcmp(mode, "1")) || !rule || !hex || strtok(NULL, " ")) goto invalid;
  size_t hex_length = strlen(hex);
  if (hex_length < 16 || hex_length % 2 || hex_length / 2 > MAX_SESSION_WIRE) goto invalid;
  size_t length = hex_length / 2;
  uint8_t *data = (uint8_t *)malloc(length);
  if (!data) goto invalid;
  for (size_t i = 0; i < length; i++) {
    int high = hex_digit(hex[i * 2]), low = hex_digit(hex[i * 2 + 1]);
    if (high < 0 || low < 0) { free(data); goto invalid; }
    data[i] = (uint8_t)(high * 16 + low);
  }
  if (memcmp(data, "RCI1", 4)) { free(data); goto invalid; }
  size_t offset = 4;
  uint32_t count = wire_u32(data, &offset);
  if (count > 2048) { free(data); goto invalid; }
  RclVmInputV1 *inputs = (RclVmInputV1 *)calloc(count ? count : 1, sizeof(*inputs));
  if (!inputs) { free(data); goto invalid; }
  int valid = 1;
  for (uint32_t i = 0; i < count && valid; i++) {
    inputs[i].path = wire_text(data, length, &offset, NULL);
    if (!inputs[i].path || offset >= length) { valid = 0; break; }
    inputs[i].type = data[offset++];
    if (inputs[i].type == 1 && length - offset >= 8) {
      uint64_t bits = 0;
      for (unsigned j = 0; j < 8; j++) bits |= (uint64_t)data[offset++] << (j * 8);
      memcpy(&inputs[i].number, &bits, 8);
    } else if (inputs[i].type == 2 && offset < length) inputs[i].truth = data[offset++];
    else if (inputs[i].type == 3) {
      inputs[i].text = wire_text(data, length, &offset, &inputs[i].text_length);
      if (!inputs[i].text) valid = 0;
    } else valid = 0;
  }
  int result = 0;
  if (valid && offset == length) result = rclvm_instance_session_step(vm, rule, mode[0] == '1', inputs, count, json, error, capacity);
  else snprintf(error, capacity, "RCL_SESSION_PROTOCOL_INVALID");
  for (uint32_t i = 0; i < count; i++) { free((void *)inputs[i].path); free((void *)inputs[i].text); }
  free(inputs); free(data); return result;
invalid:
  snprintf(error, capacity, "RCL_SESSION_PROTOCOL_INVALID"); return 0;
}

int main(int argc, char **argv) {
  if (argc != 2 && argc != 3) { fprintf(stderr, "Usage: rclvmd <program.rbc> [writer-lock-path]\n"); return 2; }
  if (argc == 3 && !acquire_writer_lock(argv[2])) { fprintf(stderr, "RCL_SESSION_WRITER_BUSY_OR_LOCK_INVALID\n"); return 1; }
  RclVmInstance *vm = rclvm_instance_create();
  char error[512] = {0};
  if (!vm || !rclvm_instance_load_file(vm, argv[1], error, sizeof(error))) {
    fprintf(stderr, "{\"status\":\"error\",\"message\":\"%s\"}\n", error);
    rclvm_instance_destroy(vm); release_writer_lock(); return 1;
  }
  printf("{\"status\":\"ready\",\"vm\":\"%s\"}\n", rclvm_version()); fflush(stdout);
  size_t line_capacity = MAX_SESSION_WIRE * 2u + 4096u;
  char *line = (char *)malloc(line_capacity);
  if (!line) { rclvm_instance_destroy(vm); release_writer_lock(); return 1; }
  while (fgets(line, (int)line_capacity, stdin)) {
    if (!strchr(line, '\n') && !feof(stdin)) {
      int ch; while ((ch = getchar()) != '\n' && ch != EOF) {}
      print_error_json("RCL_SESSION_PROTOCOL_LIMIT"); fflush(stdout); continue;
    }
    line[strcspn(line, "\r\n")] = '\0';
    if (strcmp(line, "QUIT") == 0) break;
    if (strcmp(line, "RESET") == 0) { rclvm_instance_reset(vm, 1); puts("{\"status\":\"reset\"}"); fflush(stdout); continue; }
    if (strcmp(line, "RUN") == 0 || strcmp(line, "RUN_RESET") == 0 || strcmp(line, "INIT") == 0 || strncmp(line, "STEP ", 5) == 0) {
      char *json = NULL; error[0] = '\0'; double start = now_ms();
      int ok = strcmp(line, "INIT") == 0 ? rclvm_instance_session_initialize(vm, &json, error, sizeof(error))
        : strncmp(line, "STEP ", 5) == 0 ? run_session_step(vm, line, &json, error, sizeof(error))
        : rclvm_instance_run(vm, strcmp(line, "RUN_RESET") == 0, &json, error, sizeof(error));
      double elapsed = now_ms() - start;
      if (json) {
        size_t n = strlen(json); while (n && (json[n-1] == '\n' || json[n-1] == '\r')) json[--n] = '\0';
        printf("{\"daemonElapsedMs\":%.6f,\"result\":%s}\n", elapsed, json);
        rclvm_free_string(json);
      } else print_error_json(error);
      fflush(stdout);
      if (!ok) continue;
      continue;
    }
    print_error_json("commands: RUN, RUN_RESET, RESET, INIT, STEP, QUIT"); fflush(stdout);
  }
  free(line);
  rclvm_instance_destroy(vm);
  release_writer_lock();
  return 0;
}

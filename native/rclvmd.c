#define _POSIX_C_SOURCE 200809L
#include "rclvm.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef _WIN32
#include <windows.h>
#else
#include <time.h>
#endif

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

int main(int argc, char **argv) {
  if (argc != 2) { fprintf(stderr, "Usage: rclvmd <program.rbc>\n"); return 2; }
  RclVmInstance *vm = rclvm_instance_create();
  char error[512] = {0};
  if (!vm || !rclvm_instance_load_file(vm, argv[1], error, sizeof(error))) {
    fprintf(stderr, "{\"status\":\"error\",\"message\":\"%s\"}\n", error);
    rclvm_instance_destroy(vm); return 1;
  }
  printf("{\"status\":\"ready\",\"vm\":\"%s\"}\n", rclvm_version()); fflush(stdout);
  char line[256];
  while (fgets(line, sizeof(line), stdin)) {
    line[strcspn(line, "\r\n")] = '\0';
    if (strcmp(line, "QUIT") == 0) break;
    if (strcmp(line, "RESET") == 0) { rclvm_instance_reset(vm, 1); puts("{\"status\":\"reset\"}"); fflush(stdout); continue; }
    if (strcmp(line, "RUN") == 0 || strcmp(line, "RUN_RESET") == 0) {
      char *json = NULL; error[0] = '\0'; double start = now_ms();
      int ok = rclvm_instance_run(vm, strcmp(line, "RUN_RESET") == 0, &json, error, sizeof(error));
      double elapsed = now_ms() - start;
      if (json) {
        size_t n = strlen(json); while (n && (json[n-1] == '\n' || json[n-1] == '\r')) json[--n] = '\0';
        printf("{\"daemonElapsedMs\":%.6f,\"result\":%s}\n", elapsed, json);
        rclvm_free_string(json);
      } else printf("{\"status\":\"error\",\"message\":\"%s\"}\n", error);
      fflush(stdout);
      if (!ok) continue;
      continue;
    }
    puts("{\"status\":\"error\",\"message\":\"commands: RUN, RUN_RESET, RESET, QUIT\"}"); fflush(stdout);
  }
  rclvm_instance_destroy(vm);
  return 0;
}

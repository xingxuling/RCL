#define _POSIX_C_SOURCE 200809L
#include "rclvm.h"
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

static double now_ms(void) {
  struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts);
  return (double)ts.tv_sec * 1000.0 + (double)ts.tv_nsec / 1000000.0;
}

int main(int argc, char **argv) {
  if (argc < 2 || argc > 3) { fprintf(stderr, "Usage: embedded_benchmark <program.rbc> [iterations]\n"); return 2; }
  long iterations = argc == 3 ? strtol(argv[2], NULL, 10) : 10000;
  if (iterations <= 0) return 2;
  char error[512] = {0}; RclVmInstance *vm = rclvm_instance_create();
  if (!vm || !rclvm_instance_load_file(vm, argv[1], error, sizeof(error))) { fprintf(stderr, "%s\n", error); return 1; }
  double start = now_ms();
  for (long i = 0; i < iterations; i++) {
    if (!rclvm_instance_run(vm, i == 0, NULL, error, sizeof(error))) { fprintf(stderr, "%s\n", error); return 1; }
  }
  double elapsed = now_ms() - start;
  printf("{\"vm\":\"%s\",\"iterations\":%ld,\"totalMs\":%.6f,\"perRunMs\":%.9f,\"runsPerSecond\":%.3f}\n",
    rclvm_version(), iterations, elapsed, elapsed / (double)iterations, (double)iterations * 1000.0 / elapsed);
  rclvm_instance_destroy(vm); return 0;
}

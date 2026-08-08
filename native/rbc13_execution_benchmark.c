#include "rcl_domain_admitted_organs.h"

#include <inttypes.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
#include <windows.h>
#include <psapi.h>
#else
#include <sys/resource.h>
#include <time.h>
#endif

typedef struct {
  uint64_t elapsed_ns;
  uint64_t allocation_count;
  uint64_t allocation_bytes;
  uint64_t organ_clone_calls;
} PathRun;

static uint64_t timer_ns(void) {
#ifdef _WIN32
  static LARGE_INTEGER frequency;
  static int initialized = 0;
  LARGE_INTEGER counter;
  if (!initialized) { QueryPerformanceFrequency(&frequency); initialized = 1; }
  QueryPerformanceCounter(&counter);
  return (uint64_t)((counter.QuadPart * UINT64_C(1000000000)) / frequency.QuadPart);
#else
  struct timespec now;
  clock_gettime(CLOCK_MONOTONIC, &now);
  return (uint64_t)now.tv_sec * UINT64_C(1000000000) + (uint64_t)now.tv_nsec;
#endif
}

static uint64_t rss_bytes(void) {
#ifdef _WIN32
  PROCESS_MEMORY_COUNTERS counters;
  memset(&counters, 0, sizeof(counters));
  if (GetProcessMemoryInfo(GetCurrentProcess(), &counters, sizeof(counters))) return (uint64_t)counters.WorkingSetSize;
  return 0;
#else
  struct rusage usage;
  if (getrusage(RUSAGE_SELF, &usage) != 0) return 0;
  return (uint64_t)usage.ru_maxrss * UINT64_C(1024);
#endif
}

static double primitive_opcode(double input) {
  return input;
}

static int provider_json_echo(double input, char **response, uint64_t *allocation_count, uint64_t *allocation_bytes) {
  char request[128];
  int request_length = snprintf(request, sizeof(request), "{\"operation\":\"core.echo\",\"value\":%.17g}", input);
  if (request_length < 0 || (size_t)request_length >= sizeof(request)) return 0;
  size_t length = (size_t)request_length;
  char *copy = (char *)malloc(length + 1);
  if (!copy) return 0;
  memcpy(copy, request, length + 1);
  *response = copy;
  *allocation_count += 1;
  *allocation_bytes += (uint64_t)(length + 1);
  return 1;
}

static int run_primitive(double input, uint64_t iterations, volatile double *sink, PathRun *run) {
  uint64_t started = timer_ns();
  for (uint64_t index = 0; index < iterations; index++) *sink = primitive_opcode(input);
  run->elapsed_ns = timer_ns() - started;
  return 1;
}

static int run_native_organ(
  RclDomainOrganRegistry *registry,
  double input,
  uint64_t iterations,
  volatile double *sink,
  PathRun *run
) {
  RclDomainValueV1 argument;
  rcl_domain_value_init(&argument);
  if (!rcl_domain_value_set_number(&argument, input, "Number")) return 0;
  uint64_t started = timer_ns();
  for (uint64_t index = 0; index < iterations; index++) {
    RclDomainValueV1 result;
    RclDomainOrganErrorV1 error;
    rcl_domain_value_init(&result);
    rcl_domain_organ_error_clear(&error);
    if (!rcl_domain_organ_invoke(
      registry, "core", "echo", RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE,
      &argument, 1, &result, &error
    )) {
      rcl_domain_value_free(&argument);
      return 0;
    }
    if (result.kind == RCL_DOMAIN_VALUE_NUMBER) *sink = result.as.number;
    rcl_domain_value_free(&result);
    run->organ_clone_calls += 1;
  }
  run->elapsed_ns = timer_ns() - started;
  rcl_domain_value_free(&argument);
  return 1;
}

static int run_provider(double input, uint64_t iterations, volatile double *sink, PathRun *run) {
  uint64_t started = timer_ns();
  for (uint64_t index = 0; index < iterations; index++) {
    char *response = NULL;
    if (!provider_json_echo(input, &response, &run->allocation_count, &run->allocation_bytes)) return 0;
    if (response) *sink = input;
    free(response);
  }
  run->elapsed_ns = timer_ns() - started;
  return 1;
}

static int run_path(
  const char *path,
  RclDomainOrganRegistry *registry,
  double input,
  uint64_t iterations,
  volatile double *sink,
  PathRun *run
) {
  memset(run, 0, sizeof(*run));
  if (strcmp(path, "primitive") == 0) return run_primitive(input, iterations, sink, run);
  if (strcmp(path, "native-organ") == 0) return run_native_organ(registry, input, iterations, sink, run);
  if (strcmp(path, "provider") == 0) return run_provider(input, iterations, sink, run);
  return 0;
}

static int parse_u64(const char *text, uint64_t *value) {
  char *end = NULL;
  unsigned long long parsed = strtoull(text, &end, 10);
  if (!text[0] || !end || *end != '\0') return 0;
  *value = (uint64_t)parsed;
  return 1;
}

static void print_run(const PathRun *run) {
  printf(
    "{\"elapsedNs\":%" PRIu64 ",\"allocationCount\":%" PRIu64 ",\"allocationBytes\":%" PRIu64 ",\"organCloneCalls\":%" PRIu64 "}",
    run->elapsed_ns, run->allocation_count, run->allocation_bytes, run->organ_clone_calls
  );
}

int main(int argc, char **argv) {
  uint64_t iterations = 10000;
  uint64_t warmup = 1000;
  uint64_t repetitions = 7;
  for (int index = 1; index + 1 < argc; index += 2) {
    uint64_t parsed = 0;
    if (strcmp(argv[index], "--iterations") == 0 && parse_u64(argv[index + 1], &parsed)) iterations = parsed;
    else if (strcmp(argv[index], "--warmup") == 0 && parse_u64(argv[index + 1], &parsed)) warmup = parsed;
    else if (strcmp(argv[index], "--repetitions") == 0 && parse_u64(argv[index + 1], &parsed)) repetitions = parsed;
    else { fprintf(stderr, "invalid benchmark argument\n"); return 64; }
  }
  if (iterations == 0 || repetitions == 0) { fprintf(stderr, "iterations and repetitions must be positive\n"); return 64; }

  const double input = 9007199254740991.0;
  const char *paths[] = { "primitive", "native-organ", "provider" };
  RclDomainOrganRegistry registry;
  char registration_error[512];
  rcl_domain_organ_registry_init(&registry);
  if (!rcl_domain_register_admitted_candidates_v01(&registry, registration_error, sizeof(registration_error))) {
    fprintf(stderr, "%s\n", registration_error);
    return 70;
  }
  volatile double sink = 0;
  PathRun warmup_run;
  for (size_t path_index = 0; path_index < 3; path_index++) {
    if (!run_path(paths[path_index], &registry, input, warmup, &sink, &warmup_run)) {
      fprintf(stderr, "warmup failed for %s\n", paths[path_index]);
      rcl_domain_organ_registry_free(&registry);
      return 71;
    }
  }

  uint64_t rss_before = rss_bytes();
  printf("{\"format\":\"rcl.rbc13-execution-benchmark-sample.v0.1\",\"iterations\":%" PRIu64 ",\"warmup\":%" PRIu64 ",\"repetitions\":%" PRIu64 ",\"input\":%.17g,\"rssBeforeBytes\":%" PRIu64 ",\"paths\":{", iterations, warmup, repetitions, input, rss_before);
  for (size_t path_index = 0; path_index < 3; path_index++) {
    if (path_index) putchar(',');
    printf("\"%s\":{\"runs\":[", paths[path_index]);
    for (uint64_t repetition = 0; repetition < repetitions; repetition++) {
      if (repetition) putchar(',');
      PathRun run;
      if (!run_path(paths[path_index], &registry, input, iterations, &sink, &run)) {
        fprintf(stderr, "measured run failed for %s\n", paths[path_index]);
        rcl_domain_organ_registry_free(&registry);
        return 72;
      }
      print_run(&run);
    }
    printf("]}");
  }
  uint64_t rss_after = rss_bytes();
  printf("},\"rssAfterBytes\":%" PRIu64 ",\"sink\":%.17g}\n", rss_after, sink);
  rcl_domain_organ_registry_free(&registry);
  return 0;
}

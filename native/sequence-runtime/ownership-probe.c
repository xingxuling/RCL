#define _POSIX_C_SOURCE 200809L
/* Source-allocation balance probe for the actual embedded VM implementation.
 * Runtime-library allocations are outside this probe's accounting boundary. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef _WIN32
#include <windows.h>
#include <bcrypt.h>
#else
#include <openssl/sha.h>
#endif

#define TRACK_CAPACITY (1u << 20)
typedef struct { void *pointer; size_t bytes; unsigned char state; } TrackedAllocation;
static TrackedAllocation tracked[TRACK_CAPACITY];
static size_t live_count, live_bytes, peak_count, peak_bytes, allocation_count;

static size_t allocation_slot(void *pointer, int inserting) {
  size_t index = (((uintptr_t)pointer >> 4) ^ ((uintptr_t)pointer >> 23)) & (TRACK_CAPACITY - 1);
  for (size_t count = 0; count < TRACK_CAPACITY; count++, index = (index + 1) & (TRACK_CAPACITY - 1)) {
    TrackedAllocation *entry = &tracked[index];
    if (entry->state == 1 && entry->pointer == pointer) return index;
    if (!entry->state) return inserting ? index : SIZE_MAX;
  }
  return SIZE_MAX;
}

static void record_allocation(void *pointer, size_t bytes) {
  if (!pointer) return;
  size_t index = allocation_slot(pointer, 1);
  if (index == SIZE_MAX || tracked[index].state == 1 || live_count >= TRACK_CAPACITY - 1) { fputs("allocation tracker capacity/identity failure\n", stderr); abort(); }
  tracked[index] = (TrackedAllocation){ pointer, bytes, 1 };
  live_count++; allocation_count++; live_bytes += bytes;
  if (live_count > peak_count) peak_count = live_count;
  if (live_bytes > peak_bytes) peak_bytes = live_bytes;
}

static void forget_allocation(size_t index) {
  if (index == SIZE_MAX || tracked[index].state != 1) { fputs("untracked or duplicate source free\n", stderr); abort(); }
  live_count--; live_bytes -= tracked[index].bytes; tracked[index].state = 0;
  /* Reinsert the rest of this probe cluster, keeping the table proportional to
     live allocations instead of accumulating freed-address tombstones. */
  for (size_t next = (index + 1) & (TRACK_CAPACITY - 1); tracked[next].state; next = (next + 1) & (TRACK_CAPACITY - 1)) {
    TrackedAllocation saved = tracked[next]; tracked[next].state = 0;
    tracked[allocation_slot(saved.pointer, 1)] = saved;
  }
}

static void *tracked_malloc(size_t bytes) { void *pointer = malloc(bytes); record_allocation(pointer, bytes); return pointer; }
static char *tracked_strdup(const char *text) { char *pointer = strdup(text); record_allocation(pointer, pointer ? strlen(text) + 1 : 0); return pointer; }
static void *tracked_calloc(size_t count, size_t bytes) {
  if (bytes && count > SIZE_MAX / bytes) return NULL;
  void *pointer = calloc(count, bytes); record_allocation(pointer, count * bytes); return pointer;
}
static void tracked_free_at(void *pointer, const char *file, int line) {
  if (!pointer) return;
  size_t index = allocation_slot(pointer, 0);
  if (index == SIZE_MAX) { fprintf(stderr, "untracked source free at %s:%d pointer=%p live=%zu bytes=%zu\n", file, line, pointer, live_count, live_bytes); exit(87); }
  forget_allocation(index); free(pointer);
}
static void *tracked_realloc(void *pointer, size_t bytes) {
  if (!bytes) { tracked_free_at(pointer, __FILE__, __LINE__); return NULL; }
  size_t previous = pointer ? allocation_slot(pointer, 0) : SIZE_MAX;
  if (pointer && previous == SIZE_MAX) { fputs("untracked source realloc\n", stderr); abort(); }
  void *grown = realloc(pointer, bytes);
  if (grown) { if (previous != SIZE_MAX) forget_allocation(previous); record_allocation(grown, bytes); }
  return grown;
}

#define malloc tracked_malloc
#define calloc tracked_calloc
#define realloc tracked_realloc
#define strdup tracked_strdup
#define free(pointer) tracked_free_at((pointer), __FILE__, __LINE__)
#define RCLVM_EMBEDDED_ONLY
#include "../rclvm.c"
#undef malloc
#undef calloc
#undef realloc
#undef strdup
#undef free

int main(int argc, char **argv) {
  if (argc < 2 || argc > 4) return 2;
  char *rounds_end = NULL;
  long rounds = argc >= 3 ? strtol(argv[2], &rounds_end, 10) : 20;
  int expect_error = argc == 4 && strcmp(argv[3], "--expect-error") == 0;
  if (rounds < 1 || rounds > 1000 || (argc >= 3 && (!*argv[2] || *rounds_end)) || (argc == 4 && !expect_error)) return 2;
  char error[1024] = {0};
  RclVmInstance *instance = rclvm_instance_create();
  if (!instance || !rclvm_instance_load_file(instance, argv[1], error, sizeof(error))) {
    fprintf(stderr, "probe load failed: %s\n", error); rclvm_instance_destroy(instance); return 1;
  }
  int verified = 1;
  size_t steady_count = 0, steady_bytes = 0;
  for (long round = 0; round < rounds; round++) {
    char *json = NULL;
    int ok = rclvm_instance_run(instance, 1, &json, error, sizeof(error));
    if (ok == expect_error || !json) verified = 0;
    rclvm_free_string(json);
    if (!round) { steady_count = live_count; steady_bytes = live_bytes; }
    else if (steady_count != live_count || steady_bytes != live_bytes) verified = 0;
  }
  rclvm_instance_destroy(instance);
  verified = verified && live_count == 0 && live_bytes == 0;
  printf("{\"ok\":%s,\"rounds\":%ld,\"expectedError\":%s,\"sourceAllocations\":%zu,\"liveAllocations\":%zu,\"liveBytes\":%zu,\"peakAllocations\":%zu,\"peakBytes\":%zu}\n",
    verified ? "true" : "false", rounds, expect_error ? "true" : "false", allocation_count, live_count, live_bytes, peak_count, peak_bytes);
  return verified ? 0 : 1;
}

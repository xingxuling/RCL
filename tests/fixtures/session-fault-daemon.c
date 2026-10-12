#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "rclvm.h"

/* Negative-test transport: the real VM commits first, then this peer damages
 * one reply. It deliberately supplies no writer-lock proof. */
static int damage(char *json, const char *mode) {
  const char *field = !strcmp(mode, "root") ? "\"stateRoot\":\""
    : !strcmp(mode, "source") ? "\"sourceRoot\":\""
    : !strcmp(mode, "rule") ? "\"rule\":\""
    : !strcmp(mode, "before") ? "\"beforeRoot\":\""
    : !strcmp(mode, "after") ? "\"afterRoot\":\""
    : !strcmp(mode, "shape") ? "\"history\""
    : NULL;
  if (!field) return !strcmp(mode, "projection");
  char *value = strstr(json, field);
  if (!value) return 0;
  if (!strcmp(mode, "shape")) value[7] = 'i';
  else { value += strlen(field); *value = *value == '0' ? '1' : '0'; }
  return 1;
}

int main(int argc, char **argv) {
  if (argc < 2) return 2;
  const char *mode = getenv("RCL_SESSION_FAULT");
  const int initial_fault = getenv("RCL_SESSION_FAULT_INITIAL") != NULL;
  RclVmInstance *vm = rclvm_instance_create();
  char error[512] = {0}, line[4096];
  if (!vm || !rclvm_instance_load_file(vm, argv[1], error, sizeof(error))) return 3;
  puts("{\"status\":\"ready\"}"); fflush(stdout);
  int damaged = 0;
  while (fgets(line, sizeof(line), stdin)) {
    if (!strncmp(line, "QUIT", 4)) break;
    char *json = NULL;
    int ok;
    if (!strncmp(line, "INIT", 4)) {
      ok = rclvm_instance_session_initialize(vm, &json, error, sizeof(error));
    } else {
      int realize; char rule[256], wire[32];
      if (sscanf(line, "STEP %d %255s %31s", &realize, rule, wire) != 3
          || strcmp(wire, "5243493100000000")) return 4;
      ok = rclvm_instance_session_step(vm, rule,
        mode && !strcmp(mode, "projection") ? 1 : realize,
        NULL, 0, &json, error, sizeof(error));
    }
    if (!ok || !json) return 5;
    size_t length = strlen(json);
    while (length && (json[length - 1] == '\n' || json[length - 1] == '\r')) json[--length] = 0;
    if (mode && !damaged && (initial_fault || !strncmp(line, "STEP", 4))) {
      if (!damage(json, mode)) return 6;
      damaged = 1;
    }
    printf("{\"result\":%s}\n", json); fflush(stdout);
    rclvm_free_string(json);
  }
  rclvm_instance_destroy(vm);
  return 0;
}

#include "rcl_domain_organ.h"

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const RclDomainValueV1 *field(const RclDomainValueV1 *record, const char *name) {
  if (!record || record->kind != RCL_DOMAIN_VALUE_RECORD || !name) return NULL;
  for (size_t index = 0; index < record->as.record.count; index++) {
    const RclDomainFieldV1 *entry = &record->as.record.fields[index];
    if (entry->name && entry->value && strcmp(entry->name, name) == 0) return entry->value;
  }
  return NULL;
}

static int integer_field(const RclDomainValueV1 *record, const char *name, int *output) {
  const RclDomainValueV1 *value = field(record, name);
  if (!value || value->kind != RCL_DOMAIN_VALUE_NUMBER || !isfinite(value->as.number)) return 0;
  double integer = value->as.number;
  if (integer < 0 || integer > 2147483647 || floor(integer) != integer) return 0;
  *output = (int)integer;
  return 1;
}

static int set_field(RclDomainValueV1 *record, size_t index, const char *name, RclDomainValueV1 *value) {
  int ok = rcl_domain_value_record_set(record, index, name, value);
  rcl_domain_value_free(value);
  return ok;
}

static int graph_traversal(
  void *userdata,
  const char *domain,
  const char *operation,
  const RclDomainValueV1 *args,
  size_t argc,
  RclDomainValueV1 *result,
  RclDomainOrganErrorV1 *error
) {
  (void)userdata;
  (void)domain;
  (void)operation;
  if (argc != 1 || !args || args[0].kind != RCL_DOMAIN_VALUE_RECORD) {
    rcl_domain_organ_error_set(error, "RCL_GRAPH_MALFORMED", "RCL_GRAPH_MALFORMED: graph input must be one record");
    return 0;
  }

  const RclDomainValueV1 *input = &args[0];
  const RclDomainValueV1 *edges = field(input, "edges");
  int node_count = 0;
  int start = 0;
  int target = 0;
  int budget = 0;
  if (!integer_field(input, "nodeCount", &node_count)
      || !integer_field(input, "start", &start)
      || !integer_field(input, "target", &target)
      || !integer_field(input, "budget", &budget)
      || !edges || edges->kind != RCL_DOMAIN_VALUE_SEQUENCE
      || node_count > 32 || budget > 65536) {
    rcl_domain_organ_error_set(error, "RCL_GRAPH_MALFORMED", "RCL_GRAPH_MALFORMED: graph scalar or matrix shape is invalid");
    return 0;
  }
  if (node_count == 0) {
    rcl_domain_organ_error_set(error, "RCL_GRAPH_EMPTY", "RCL_GRAPH_EMPTY: graph has no nodes");
    return 0;
  }
  if (start >= node_count || target >= node_count) {
    rcl_domain_organ_error_set(error, "RCL_GRAPH_INVALID_NODE", "RCL_GRAPH_INVALID_NODE: start or target is outside the graph");
    return 0;
  }
  if (edges->as.sequence.count != (size_t)node_count) {
    rcl_domain_organ_error_set(error, "RCL_GRAPH_MALFORMED", "RCL_GRAPH_MALFORMED: adjacency matrix row count is invalid");
    return 0;
  }
  for (int row = 0; row < node_count; row++) {
    const RclDomainValueV1 *line = &edges->as.sequence.items[row];
    if (line->kind != RCL_DOMAIN_VALUE_SEQUENCE || line->as.sequence.count != (size_t)node_count) {
      rcl_domain_organ_error_set(error, "RCL_GRAPH_MALFORMED", "RCL_GRAPH_MALFORMED: adjacency matrix column count is invalid");
      return 0;
    }
    for (int column = 0; column < node_count; column++) {
      const RclDomainValueV1 *entry = &line->as.sequence.items[column];
      if (entry->kind != RCL_DOMAIN_VALUE_NUMBER || !isfinite(entry->as.number)
          || (entry->as.number != 0 && entry->as.number != 1)) {
        rcl_domain_organ_error_set(error, "RCL_GRAPH_MALFORMED", "RCL_GRAPH_MALFORMED: adjacency matrix values must be 0 or 1");
        return 0;
      }
    }
  }

  int *visited = (int *)calloc((size_t)node_count, sizeof(int));
  int *queue = (int *)calloc((size_t)node_count, sizeof(int));
  int *order = (int *)calloc((size_t)node_count, sizeof(int));
  if (!visited || !queue || !order) {
    free(visited); free(queue); free(order);
    rcl_domain_organ_error_set(error, "RCL_GRAPH_OOM", "RCL_GRAPH_OOM: traversal buffers could not be allocated");
    return 0;
  }

  int head = 0;
  int tail = 1;
  int steps = 0;
  int reachable = 0;
  int termination = 3;
  int visited_count = 1;
  visited[start] = 1;
  queue[0] = start;
  order[0] = start;
  while (head < tail) {
    int current = queue[head];
    if (current == target) {
      reachable = 1;
      termination = 1;
      break;
    }
    if (steps >= budget) {
      termination = 2;
      break;
    }
    steps += 1;
    for (int neighbor = 0; neighbor < node_count; neighbor++) {
      const RclDomainValueV1 *line = &edges->as.sequence.items[current];
      const RclDomainValueV1 *entry = &line->as.sequence.items[neighbor];
      if (entry->as.number == 1 && !visited[neighbor]) {
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
        order[visited_count++] = neighbor;
      }
    }
    head += 1;
  }

  int ok = rcl_domain_value_make_record(result, "GraphTraversalResult", 8, "GraphTraversal");
  RclDomainValueV1 value;
  rcl_domain_value_init(&value);
  if (ok && !rcl_domain_value_set_truth(&value, reachable, "Truth")) ok = 0;
  if (ok && !set_field(result, 0, "reachable", &value)) ok = 0;
  rcl_domain_value_init(&value);
  if (ok && !rcl_domain_value_make_sequence(&value, (size_t)visited_count, "Sequence")) ok = 0;
  if (ok) for (int index = 0; index < visited_count; index++) {
    RclDomainValueV1 item;
    rcl_domain_value_init(&item);
    if (!rcl_domain_value_set_number(&item, order[index], "Number")
        || !rcl_domain_value_sequence_set(&value, (size_t)index, &item)) ok = 0;
    rcl_domain_value_free(&item);
  }
  if (ok && !set_field(result, 1, "visitedOrder", &value)) ok = 0;
  rcl_domain_value_init(&value);
  if (ok && !rcl_domain_value_make_sequence(&value, (size_t)visited_count, "Sequence")) ok = 0;
  if (ok) for (int index = 0; index < visited_count; index++) {
    RclDomainValueV1 item;
    rcl_domain_value_init(&item);
    if (!rcl_domain_value_set_number(&item, order[index], "Number")
        || !rcl_domain_value_sequence_set(&value, (size_t)index, &item)) ok = 0;
    rcl_domain_value_free(&item);
  }
  if (ok && !set_field(result, 2, "visitedSet", &value)) ok = 0;
  rcl_domain_value_init(&value);
  if (ok && !rcl_domain_value_set_number(&value, steps, "Number")) ok = 0;
  if (ok && !set_field(result, 3, "steps", &value)) ok = 0;
  rcl_domain_value_init(&value);
  if (ok && !rcl_domain_value_set_number(&value, start, "Number")) ok = 0;
  if (ok && !set_field(result, 4, "start", &value)) ok = 0;
  rcl_domain_value_init(&value);
  if (ok && !rcl_domain_value_set_number(&value, target, "Number")) ok = 0;
  if (ok && !set_field(result, 5, "target", &value)) ok = 0;
  rcl_domain_value_init(&value);
  if (ok && !rcl_domain_value_set_number(&value, budget, "Number")) ok = 0;
  if (ok && !set_field(result, 6, "budget", &value)) ok = 0;
  rcl_domain_value_init(&value);
  if (ok && !rcl_domain_value_set_text(&value, termination == 1 ? "target-found" : termination == 2 ? "budget-exhausted" : "exhausted", "Text")) ok = 0;
  if (ok && !set_field(result, 7, "termination", &value)) ok = 0;
  rcl_domain_value_free(&value);
  free(visited); free(queue); free(order);
  if (!ok) {
    rcl_domain_value_free(result);
    rcl_domain_organ_error_set(error, "RCL_GRAPH_RESULT_BUILD", "RCL_GRAPH_RESULT_BUILD: result record could not be built");
    return 0;
  }
  return 1;
}

int rbc13_register_graph_traversal_organ(RclDomainOrganRegistry *registry, char *error, size_t error_capacity) {
  RclDomainOrganV1 organ = {
    RCL_DOMAIN_ORGAN_ABI_V1,
    "wasm-vm",
    "graph-traversal",
    "graph-traversal::bounded-reachability",
    "rbc13-native-c-graph-body",
    "experimental:rbc13-native-c-graph-body",
    RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE,
    1,
    graph_traversal,
    NULL,
  };
  return rcl_domain_organ_register(registry, &organ, error, error_capacity);
}

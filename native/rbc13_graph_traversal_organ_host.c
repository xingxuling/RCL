#include "rcl_domain_organ.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int rbc13_register_graph_traversal_organ(RclDomainOrganRegistry *registry, char *error, size_t error_capacity);

typedef struct {
  const char *id;
  int node_count;
  const int *matrix;
  int start;
  int target;
  int budget;
} GraphCase;

static const int POSITIVE_MATRIX[] = { 0,1,0,0, 0,0,1,0, 0,0,0,1, 0,0,0,0 };
static const int CYCLE_MATRIX[] = { 0,1,0, 1,0,0, 0,0,0 };
static const int DISCONNECTED_MATRIX[] = { 0,1,0,0, 0,0,0,0, 0,0,0,1, 0,0,0,0 };
static const int BUDGET_MATRIX[] = { 0,1,0,0, 0,0,1,0, 0,0,0,1, 0,0,0,0 };
static const int INVALID_MATRIX[] = { 0,1, 0,0 };
static const int MALFORMED_MATRIX[] = { 0,2, 0,0 };

static int select_case(const char *id, GraphCase *output) {
  if (!id || !output) return 0;
  if (strcmp(id, "positive-chain") == 0) *output = (GraphCase){ id, 4, POSITIVE_MATRIX, 0, 3, 8 };
  else if (strcmp(id, "cycle") == 0) *output = (GraphCase){ id, 3, CYCLE_MATRIX, 0, 2, 4 };
  else if (strcmp(id, "disconnected") == 0) *output = (GraphCase){ id, 4, DISCONNECTED_MATRIX, 0, 3, 8 };
  else if (strcmp(id, "empty") == 0) *output = (GraphCase){ id, 0, NULL, 0, 0, 0 };
  else if (strcmp(id, "budget-exhaustion") == 0) *output = (GraphCase){ id, 4, BUDGET_MATRIX, 0, 3, 1 };
  else if (strcmp(id, "invalid-node") == 0) *output = (GraphCase){ id, 2, INVALID_MATRIX, 2, 1, 3 };
  else if (strcmp(id, "malformed-graph") == 0) *output = (GraphCase){ id, 2, MALFORMED_MATRIX, 0, 1, 3 };
  else return 0;
  return 1;
}

static int set_field(RclDomainValueV1 *record, size_t index, const char *name, RclDomainValueV1 *value) {
  int ok = rcl_domain_value_record_set(record, index, name, value);
  rcl_domain_value_free(value);
  return ok;
}

static int make_input(const GraphCase *graph, RclDomainValueV1 *input) {
  RclDomainValueV1 value;
  rcl_domain_value_init(&value);
  if (!rcl_domain_value_make_record(input, "GraphTraversalInput", 5, "GraphTraversal")) return 0;
  if (!rcl_domain_value_set_number(&value, graph->node_count, "Number") || !set_field(input, 0, "nodeCount", &value)) return 0;
  rcl_domain_value_init(&value);
  if (!rcl_domain_value_make_sequence(&value, (size_t)graph->node_count, "Sequence")) return 0;
  for (int row = 0; row < graph->node_count; row++) {
    RclDomainValueV1 line;
    rcl_domain_value_init(&line);
    if (!rcl_domain_value_make_sequence(&line, (size_t)graph->node_count, "Sequence")) return 0;
    for (int column = 0; column < graph->node_count; column++) {
      RclDomainValueV1 entry;
      rcl_domain_value_init(&entry);
      if (!rcl_domain_value_set_number(&entry, graph->matrix[row * graph->node_count + column], "Number")
          || !rcl_domain_value_sequence_set(&line, (size_t)column, &entry)) return 0;
      rcl_domain_value_free(&entry);
    }
    if (!rcl_domain_value_sequence_set(&value, (size_t)row, &line)) return 0;
    rcl_domain_value_free(&line);
  }
  if (!set_field(input, 1, "edges", &value)) return 0;
  rcl_domain_value_init(&value);
  if (!rcl_domain_value_set_number(&value, graph->start, "Number") || !set_field(input, 2, "start", &value)) return 0;
  rcl_domain_value_init(&value);
  if (!rcl_domain_value_set_number(&value, graph->target, "Number") || !set_field(input, 3, "target", &value)) return 0;
  rcl_domain_value_init(&value);
  if (!rcl_domain_value_set_number(&value, graph->budget, "Number") || !set_field(input, 4, "budget", &value)) return 0;
  return 1;
}

static void json_string(const char *value) {
  putchar('"');
  for (const unsigned char *cursor = (const unsigned char *)(value ? value : ""); *cursor; cursor++) {
    if (*cursor == '\\') fputs("\\\\", stdout);
    else if (*cursor == '"') fputs("\\\"", stdout);
    else if (*cursor == '\n') fputs("\\n", stdout);
    else if (*cursor == '\r') fputs("\\r", stdout);
    else if (*cursor == '\t') fputs("\\t", stdout);
    else if (*cursor < 0x20) printf("\\u%04x", *cursor);
    else putchar((int)*cursor);
  }
  putchar('"');
}

static void print_value(const RclDomainValueV1 *value) {
  if (!value) { fputs("null", stdout); return; }
  switch (value->kind) {
    case RCL_DOMAIN_VALUE_NULL: fputs("null", stdout); break;
    case RCL_DOMAIN_VALUE_NUMBER: printf("%.17g", value->as.number); break;
    case RCL_DOMAIN_VALUE_TRUTH: fputs(value->as.truth ? "true" : "false", stdout); break;
    case RCL_DOMAIN_VALUE_TEXT: json_string(value->as.text.data); break;
    case RCL_DOMAIN_VALUE_SEQUENCE:
      putchar('[');
      for (size_t index = 0; index < value->as.sequence.count; index++) {
        if (index) putchar(',');
        print_value(&value->as.sequence.items[index]);
      }
      putchar(']');
      break;
    case RCL_DOMAIN_VALUE_RECORD:
      putchar('{');
      for (size_t index = 0; index < value->as.record.count; index++) {
        if (index) putchar(',');
        json_string(value->as.record.fields[index].name);
        putchar(':');
        print_value(value->as.record.fields[index].value);
      }
      putchar('}');
      break;
    default: fputs("null", stdout); break;
  }
}

static void print_error_details(const GraphCase *graph, const char *code) {
  if (strcmp(code, "RCL_GRAPH_EMPTY") == 0) printf("{\"nodeCount\":%d}", graph->node_count);
  else if (strcmp(code, "RCL_GRAPH_INVALID_NODE") == 0) printf("{\"nodeCount\":%d,\"start\":%d,\"target\":%d}", graph->node_count, graph->start, graph->target);
  else if (strcmp(code, "RCL_GRAPH_MALFORMED") == 0) fputs("{\"reason\":\"matrix-value\"}", stdout);
  else fputs("{}", stdout);
}

int main(int argc, char **argv) {
  if (argc != 2) return 64;
  GraphCase graph;
  if (!select_case(argv[1], &graph)) return 65;
  RclDomainValueV1 input, result;
  rcl_domain_value_init(&input);
  rcl_domain_value_init(&result);
  if (!make_input(&graph, &input)) return 66;

  RclDomainOrganRegistry registry;
  rcl_domain_organ_registry_init(&registry);
  char registration_error[512] = {0};
  if (!rbc13_register_graph_traversal_organ(&registry, registration_error, sizeof(registration_error))) return 67;
  RclDomainOrganErrorV1 error;
  rcl_domain_organ_error_clear(&error);
  int ok = rcl_domain_organ_invoke(&registry, "wasm-vm", "graph-traversal", RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE, &input, 1, &result, &error);
  if (ok) {
    fputs("{\"status\":\"ok\",\"result\":", stdout);
    print_value(&result);
    fputs(",\"evidenceTier\":\"native-candidate\"}\n", stdout);
  } else {
    fputs("{\"status\":\"error\",\"error\":{\"class\":\"RCL_GRAPH_INPUT_ERROR\",\"code\":", stdout);
    json_string(error.code);
    fputs(",\"message\":", stdout);
    json_string(error.message);
    fputs(",\"details\":", stdout);
    print_error_details(&graph, error.code);
    fputs("},\"evidenceTier\":\"native-candidate\"}\n", stdout);
  }
  rcl_domain_value_free(&result);
  rcl_domain_value_free(&input);
  rcl_domain_organ_registry_free(&registry);
  return ok ? 0 : 0;
}


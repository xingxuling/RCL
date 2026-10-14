/* General resident RCL compiler ABI. Reuse the pinned one-shot compiler's
 * provider, output-state contract, bytecode validation and atomic writer. */
#define main rcl_sequence_one_shot_compiler_main
#include "../rclc.c"
#undef main
#include <ctype.h>

static int safe_name(const char *name) {
  size_t n = strlen(name);
  if (!n || n > 240 || strstr(name, "..")) return 0;
  for (size_t i = 0; i < n; i++) {
    unsigned char c = (unsigned char)name[i];
    if (!(isalnum(c) || c == '.' || c == '_' || c == '-')) return 0;
  }
  return 1;
}

static int binary_file(const char *file, uint8_t **bytes, size_t *length) {
  FILE *f = fopen(file, "rb"); if (!f) return 0;
  if (fseek(f, 0, SEEK_END)) { fclose(f); return 0; }
  long n = ftell(f);
  if (n < 0 || n > 16 * 1024 * 1024 || fseek(f, 0, SEEK_SET)) { fclose(f); return 0; }
  *bytes = (uint8_t *)malloc(n ? (size_t)n : 1);
  if (!*bytes) { fclose(f); return 0; }
  *length = fread(*bytes, 1, (size_t)n, f);
  int ok = *length == (size_t)n && !ferror(f); fclose(f);
  if (!ok) { free(*bytes); *bytes = NULL; } return ok;
}

static void reply_error(const char *code, const char *message, const char *token,
  unsigned long request, unsigned long instance) {
  fputs("{\"status\":\"error\",\"code\":", stdout); print_json_string(stdout, code);
  fputs(",\"message\":", stdout); print_json_string(stdout, message);
  fputs(",\"token\":", stdout); print_json_string(stdout, token);
  fprintf(stdout, ",\"pid\":%lu,\"request\":%lu,\"instance\":%lu}\n", process_id(), request, instance);
  fflush(stdout);
}

int main(int argc, char **argv) {
  if (argc != 3 || strlen(argv[1]) > 3000 || !safe_name(argv[2])) {
    fprintf(stderr, "Usage: rclcd <owned-directory> <context-token>\n"); return 2;
  }
  const char *directory = argv[1], *token = argv[2];
  RclVmInstance *vm = NULL; CompilerInput input = {0};
  uint8_t *loaded_bytes = NULL; size_t loaded_length = 0;
  unsigned long request = 0, instance = 0;
  fputs("{\"status\":\"ready\",\"protocol\":\"RCL_COMPILER_ABI_FILES_V1\",\"token\":", stdout);
  print_json_string(stdout, token); fprintf(stdout, ",\"pid\":%lu}\n", process_id()); fflush(stdout);
  char line[4096];
  while (fgets(line, sizeof(line), stdin)) {
    request++;
    if (!strchr(line, '\n') && !feof(stdin)) {
      int c; while ((c = getchar()) != '\n' && c != EOF) {}
      reply_error("RCLC_PROTOCOL_LIMIT", "Command frame too long", token, request, instance); continue;
    }
    line[strcspn(line, "\r\n")] = '\0';
    if (!strcmp(line, "QUIT")) break;
    char *parts[4] = {line, NULL, NULL, NULL}; size_t part_count = 1;
    for (char *c = line; *c; c++) if (*c == '\t') {
      *c = '\0'; if (part_count < 4) parts[part_count] = c + 1; part_count++;
    }
    if (part_count != 4 || strcmp(parts[0], "COMPILE") || !safe_name(parts[1])
      || !safe_name(parts[2]) || !safe_name(parts[3])) {
      reply_error("RCLC_PROTOCOL_SCOPE", "Only three flat owned file names are accepted", token, request, instance); continue;
    }
    char compiler[4096], source[4096], output[4096], error[1024] = {0};
    snprintf(compiler, sizeof(compiler), "%s/%s", directory, parts[1]);
    snprintf(source, sizeof(source), "%s/%s", directory, parts[2]);
    snprintf(output, sizeof(output), "%s/%s", directory, parts[3]);
    remove(output);
    uint8_t *candidate = NULL; size_t candidate_length = 0;
    if (!binary_file(compiler, &candidate, &candidate_length)) {
      reply_error("RCLC_COMPILER_IO", "Unable to read compiler artifact", token, request, instance); continue;
    }
    if (!vm || candidate_length != loaded_length || memcmp(candidate, loaded_bytes, candidate_length)) {
      rclvm_instance_destroy(vm); vm = rclvm_instance_create();
      free(loaded_bytes); loaded_bytes = NULL; loaded_length = 0;
      if (!vm || !rclvm_instance_load_file(vm, compiler, error, sizeof(error))) {
        rclvm_instance_destroy(vm); vm = NULL; free(candidate);
        reply_error("RCLC_COMPILER_LOAD", error, token, request, instance); continue;
      }
      loaded_bytes = candidate; loaded_length = candidate_length; candidate = NULL; instance++;
    }
    free(candidate); free(input.source); memset(&input, 0, sizeof(input));
    if (!read_source_file(source, &input, error, sizeof(error))) {
      reply_error("RCLC_SOURCE_IO", error, token, request, instance); continue;
    }
    RclVmProviderV1 provider = {RCLVM_PROVIDER_ABI_V1, "compiler_input", compiler_input_invoke, &input};
    int ok = rclvm_instance_register_provider(vm, &provider, error, sizeof(error));
    if (ok) ok = rclvm_instance_run(vm, 1, NULL, error, sizeof(error));
    const char *output_state = NULL; char *declared = NULL; uint8_t *bytes = NULL; size_t length = 0;
    if (ok) ok = get_output_bytes(vm, &output_state, &declared, &bytes, &length, error, sizeof(error));
    if (ok) ok = rclvm_validate_bytecode(bytes, length, error, sizeof(error));
    if (ok) ok = write_output_file_atomic(output, bytes, length, error, sizeof(error));
    if (ok) {
      fputs("{\"status\":\"ok\",\"token\":", stdout); print_json_string(stdout, token);
      fprintf(stdout, ",\"pid\":%lu,\"request\":%lu,\"instance\":%lu,\"outputState\":", process_id(), request, instance);
      print_json_string(stdout, output_state);
      fprintf(stdout, ",\"bytes\":%zu,\"executedInstructions\":%" PRIu64 ",\"instructionBudget\":%" PRIu64 ",\"peakStackDepth\":%zu,\"peakCallFrames\":%zu,\"output\":", length,
        rclvm_instance_get_executed_instruction_count(vm), (uint64_t)RCLVM_MAX_EXECUTED_INSTRUCTIONS,
        rclvm_instance_get_peak_stack_depth(vm), rclvm_instance_get_peak_call_frame_depth(vm));
      print_json_string(stdout, output); fputs("}\n", stdout); fflush(stdout);
    } else reply_error("RCLC_COMPILER_FAILURE", error, token, request, instance);
    rclvm_free_bytes(bytes); rclvm_free_string(declared);
  }
  rclvm_instance_destroy(vm); free(input.source); free(loaded_bytes); return 0;
}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = path.join(ROOT, 'native', 'rclvm.c');

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0 || source.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`RCL_STATE_ROOT_V2_MATERIALIZE_ANCHOR:${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

export function materializeSemanticStateRootV2Candidate(sourceText = fs.readFileSync(SOURCE, 'utf8')) {
  let source = sourceText;
  source = replaceOnce(source,
`static void value_json_sb(StringBuilder *sb, const Value *value);`,
`static int semantic_state_root_v2_enabled(void);
static void semantic_f64_json_sb(StringBuilder *sb, double value);
static void semantic_number_json_sb(StringBuilder *sb, double value);
static void semantic_integer_json_sb(StringBuilder *sb, int64_t value);
static void semantic_unsigned_integer_json_sb(StringBuilder *sb, uint64_t value);
static void value_json_sb(StringBuilder *sb, const Value *value);`, 'helper-forward');
  source = replaceOnce(source,
`static void semantic_value_json_sb(StringBuilder *sb, const Value *value);`,
`static int semantic_state_root_v2_enabled(void) {
  const char *value = getenv("RCL_SEMANTIC_STATE_ROOT_ALGORITHM");
  return value && strcmp(value, "rcl.semantic-state-root.v2-candidate") == 0;
}

static void semantic_f64_json_sb(StringBuilder *sb, double value) {
  if (!isfinite(value)) { sb_append(sb, "null"); return; }
  if (value == 0.0) value = 0.0;
  uint64_t bits = 0;
  memcpy(&bits, &value, sizeof(bits));
  char hex[17];
  snprintf(hex, sizeof(hex), "%016" PRIx64, bits);
  sb_append(sb, "{\\\"$rclF64\\\":\\\"");
  sb_append(sb, hex);
  sb_append(sb, "\\\"}");
}

static void semantic_number_json_sb(StringBuilder *sb, double value) {
  if (semantic_state_root_v2_enabled()) {
    semantic_f64_json_sb(sb, value);
    return;
  }
  if (!isfinite(value)) { sb_append(sb, "null"); return; }
  if (value == 0.0) { sb_append(sb, "0"); return; }
  char number[64];
  snprintf(number, sizeof(number), "%.15g", value);
  sb_append(sb, number);
}

static void semantic_integer_json_sb(StringBuilder *sb, int64_t value) {
  if (semantic_state_root_v2_enabled()) {
    semantic_f64_json_sb(sb, (double)value);
    return;
  }
  char number[64];
  snprintf(number, sizeof(number), "%" PRId64, value);
  sb_append(sb, number);
}

static void semantic_unsigned_integer_json_sb(StringBuilder *sb, uint64_t value) {
  if (semantic_state_root_v2_enabled()) {
    semantic_f64_json_sb(sb, (double)value);
    return;
  }
  char number[64];
  snprintf(number, sizeof(number), "%" PRIu64, value);
  sb_append(sb, number);
}

static void semantic_value_json_sb(StringBuilder *sb, const Value *value);`, 'helper');

  source = replaceOnce(source,
`    case VALUE_NUMBER:
      if (!isfinite(value->number)) { sb_append(sb, "null"); break; }
      if (value->number == 0.0) { sb_append(sb, "0"); break; }
      snprintf(number, sizeof(number), "%.15g", value->number); sb_append(sb, number); break;`,
`    case VALUE_NUMBER:
      if (!isfinite(value->number)) { sb_append(sb, "null"); break; }
      if (value->number == 0.0) { sb_append(sb, "0"); break; }
      snprintf(number, sizeof(number), semantic_state_root_v2_enabled() ? "%.17g" : "%.15g", value->number); sb_append(sb, number); break;`, 'public-number-output');

  source = replaceOnce(source,
`static void semantic_value_json_sb(StringBuilder *sb, const Value *value) {
  switch (value->type) {`,
`static void semantic_value_json_sb(StringBuilder *sb, const Value *value) {
  switch (value->type) {
    case VALUE_NUMBER:
      semantic_number_json_sb(sb, value->number);
      break;`, 'semantic-number');

  for (const [needle, replacement] of [
    ['snprintf(number, sizeof(number), "%" PRId64, span->column); sb_append(sb, number);', 'semantic_integer_json_sb(sb, span->column);'],
    ['snprintf(number, sizeof(number), "%" PRId64, span->length); sb_append(sb, number);', 'semantic_integer_json_sb(sb, span->length);'],
    ['snprintf(number, sizeof(number), "%" PRId64, span->line); sb_append(sb, number);', 'semantic_integer_json_sb(sb, span->line);'],
    ['snprintf(number, sizeof(number), "%" PRId64, span->offset); sb_append(sb, number);', 'semantic_integer_json_sb(sb, span->offset);'],
    ['snprintf(number, sizeof(number), "%" PRId64, parse_state->index); sb_append(sb, number);', 'semantic_integer_json_sb(sb, parse_state->index);'],
    ['snprintf(number, sizeof(number), "%" PRId64, symbol->slot); sb_append(sb, number);', 'semantic_integer_json_sb(sb, symbol->slot);'],
    ['snprintf(number, sizeof(number), "%" PRId64, semantic->slot); sb_append(sb, number);', 'semantic_integer_json_sb(sb, semantic->slot);'],
    ['snprintf(number, sizeof(number), "%" PRId64, ir->slot); sb_append(sb, number);', 'semantic_integer_json_sb(sb, ir->slot);'],
  ]) source = source.replaceAll(needle, replacement);
  for (const newline of ['\n', '\r\n']) {
    source = source.replaceAll(
      'snprintf(number, sizeof(number), "%" PRIu64, value->typed_ref->object_id);' + newline + '      sb_append(sb, number);',
      'semantic_unsigned_integer_json_sb(sb, value->typed_ref->object_id);',
    );
  }
  source = source.replace(
    'if (strcmp(ast->literal_kind, "Number") == 0) { double n = strtod(ast->literal_text, NULL); snprintf(number, sizeof(number), "%.15g", n); sb_append(sb, number); }',
    'if (strcmp(ast->literal_kind, "Number") == 0) { double n = strtod(ast->literal_text, NULL); semantic_number_json_sb(sb, n); }',
  );
  source = replaceOnce(source,
`  fputs(",\\\"stateRootAlgorithm\\\":\\\"rcl.semantic-state-root.v1\\\"", out);`,
`  fputs(",\\\"stateRootAlgorithm\\\":", out);
  print_json_string(out, semantic_state_root_v2_enabled()
    ? "rcl.semantic-state-root.v2-candidate"
    : "rcl.semantic-state-root.v1");`, 'algorithm-output');

  return source;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = process.argv[2];
  if (!output) throw new Error('usage: materialize-semantic-state-root-v2-vm-candidate.mjs <output.c>');
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, materializeSemanticStateRootV2Candidate(), 'utf8');
  process.stdout.write(`${output}\n`);
}

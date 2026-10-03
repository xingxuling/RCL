/* Canonical typed JSON encoding for rcl.semantic-state-root.v2.
 * This consumes only the VM's normalized semantic JSON, never executes input.
 * Included after StringBuilder, json escaping and UTF-8 helpers in rclvm.c.
 */
#ifndef RCL_SEMANTIC_STATE_V2_H
#define RCL_SEMANTIC_STATE_V2_H

typedef struct {
  const char *cursor;
  const char *error;
} RootV2Parser;

typedef struct {
  char *key;
  size_t key_length;
  char *value;
} RootV2Field;

static int root_v2_node(RootV2Parser *parser, StringBuilder *out, unsigned depth);

static int root_v2_hex4(RootV2Parser *parser, uint32_t *value) {
  *value = 0;
  for (unsigned i = 0; i < 4; i++) {
    unsigned char c = (unsigned char)*parser->cursor;
    unsigned digit;
    if (c >= '0' && c <= '9') digit = c - '0';
    else if (c >= 'a' && c <= 'f') digit = c - 'a' + 10;
    else if (c >= 'A' && c <= 'F') digit = c - 'A' + 10;
    else { parser->error = "Invalid Unicode escape"; return 0; }
    parser->cursor++;
    *value = (*value << 4) | digit;
  }
  return 1;
}

static void root_v2_utf8(StringBuilder *out, uint32_t value) {
  if (value < 0x80) sb_append_char(out, (char)value);
  else if (value < 0x800) {
    sb_append_char(out, (char)(0xc0 | (value >> 6)));
    sb_append_char(out, (char)(0x80 | (value & 63)));
  } else if (value < 0x10000) {
    sb_append_char(out, (char)(0xe0 | (value >> 12)));
    sb_append_char(out, (char)(0x80 | ((value >> 6) & 63)));
    sb_append_char(out, (char)(0x80 | (value & 63)));
  } else {
    sb_append_char(out, (char)(0xf0 | (value >> 18)));
    sb_append_char(out, (char)(0x80 | ((value >> 12) & 63)));
    sb_append_char(out, (char)(0x80 | ((value >> 6) & 63)));
    sb_append_char(out, (char)(0x80 | (value & 63)));
  }
}

static int root_v2_string(RootV2Parser *parser, StringBuilder *decoded) {
  if (*parser->cursor++ != '"') { parser->error = "Expected JSON string"; return 0; }
  while (*parser->cursor && *parser->cursor != '"') {
    unsigned char c = (unsigned char)*parser->cursor++;
    if (c < 32) { parser->error = "Unescaped control character"; return 0; }
    if (c != '\\') { sb_append_char(decoded, (char)c); continue; }
    char escaped = *parser->cursor++;
    switch (escaped) {
      case '"': case '\\': case '/': sb_append_char(decoded, escaped); break;
      case 'b': sb_append_char(decoded, '\b'); break;
      case 'f': sb_append_char(decoded, '\f'); break;
      case 'n': sb_append_char(decoded, '\n'); break;
      case 'r': sb_append_char(decoded, '\r'); break;
      case 't': sb_append_char(decoded, '\t'); break;
      case 'u': {
        uint32_t cp;
        if (!root_v2_hex4(parser, &cp)) return 0;
        if (cp >= 0xd800 && cp <= 0xdbff) {
          if (parser->cursor[0] != '\\' || parser->cursor[1] != 'u') { parser->error = "Unpaired surrogate"; return 0; }
          parser->cursor += 2;
          uint32_t low;
          if (!root_v2_hex4(parser, &low)) return 0;
          if (low < 0xdc00 || low > 0xdfff) { parser->error = "Unpaired surrogate"; return 0; }
          cp = 0x10000 + ((cp - 0xd800) << 10) + (low - 0xdc00);
        } else if (cp >= 0xdc00 && cp <= 0xdfff) { parser->error = "Unpaired surrogate"; return 0; }
        root_v2_utf8(decoded, cp);
        break;
      }
      default: parser->error = "Invalid JSON escape"; return 0;
    }
  }
  if (*parser->cursor != '"') { parser->error = "Unterminated JSON string"; return 0; }
  parser->cursor++;
  for (size_t offset = 0; offset < decoded->length;) {
    uint32_t cp;
    int valid = 1;
    size_t width = utf8_decode_at(decoded->data, decoded->length, offset, &cp, &valid);
    if (!valid || !width || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) {
      parser->error = "Unicode scalar text required"; return 0;
    }
    offset += width;
  }
  return 1;
}

static void root_v2_quote(StringBuilder *out, const char *value, size_t length) {
  sb_append_char(out, '"');
  for (size_t i = 0; i < length; i++) {
    unsigned char c = (unsigned char)value[i];
    switch (c) {
      case '"': sb_append(out, "\\\""); break;
      case '\\': sb_append(out, "\\\\"); break;
      case '\b': sb_append(out, "\\b"); break;
      case '\f': sb_append(out, "\\f"); break;
      case '\n': sb_append(out, "\\n"); break;
      case '\r': sb_append(out, "\\r"); break;
      case '\t': sb_append(out, "\\t"); break;
      default:
        if (c < 32) {
          char escaped[7];
          snprintf(escaped, sizeof(escaped), "\\u%04x", c);
          sb_append(out, escaped);
        } else sb_append_char(out, (char)c);
    }
  }
  sb_append_char(out, '"');
}

static int root_v2_compare_fields(const void *left, const void *right) {
  const RootV2Field *a = (const RootV2Field *)left;
  const RootV2Field *b = (const RootV2Field *)right;
  size_t size = a->key_length < b->key_length ? a->key_length : b->key_length;
  int order = memcmp(a->key, b->key, size);
  if (order) return order;
  return (a->key_length > b->key_length) - (a->key_length < b->key_length);
}

static int root_v2_record(RootV2Parser *parser, StringBuilder *out, unsigned depth) {
  RootV2Field *fields = NULL;
  size_t count = 0;
  int ok = 0;
  parser->cursor++;
  while (*parser->cursor != '}') {
    StringBuilder key, value;
    sb_init(&key); sb_init(&value);
    if (!root_v2_string(parser, &key) || *parser->cursor != ':') {
      if (!parser->error) parser->error = "Expected record separator";
      free(key.data); free(value.data); goto cleanup;
    }
    parser->cursor++;
    if (!root_v2_node(parser, &value, depth + 1)) { free(key.data); free(value.data); goto cleanup; }
    RootV2Field *next = (RootV2Field *)realloc(fields, sizeof(*fields) * (count + 1));
    if (!next) { free(key.data); free(value.data); parser->error = "Out of memory"; goto cleanup; }
    fields = next;
    fields[count++] = (RootV2Field){ key.data, key.length, value.data };
    if (*parser->cursor == '}') break;
    if (*parser->cursor != ',') { parser->error = "Expected record delimiter"; goto cleanup; }
    parser->cursor++;
  }
  parser->cursor++;
  if (count) qsort(fields, count, sizeof(*fields), root_v2_compare_fields);
  sb_append(out, "[\"record\",[");
  for (size_t i = 0; i < count; i++) {
    if (i && root_v2_compare_fields(&fields[i - 1], &fields[i]) == 0) { parser->error = "Duplicate semantic field"; goto cleanup; }
    if (i) sb_append_char(out, ',');
    sb_append_char(out, '[');
    root_v2_quote(out, fields[i].key, fields[i].key_length);
    sb_append_char(out, ',');
    sb_append(out, fields[i].value);
    sb_append_char(out, ']');
  }
  sb_append(out, "]]");
  ok = 1;
cleanup:
  for (size_t i = 0; i < count; i++) { free(fields[i].key); free(fields[i].value); }
  free(fields);
  return ok;
}

static int root_v2_node(RootV2Parser *parser, StringBuilder *out, unsigned depth) {
  if (depth > 256) { parser->error = "Semantic nesting exceeds 256"; return 0; }
  switch (*parser->cursor) {
    case '{': return root_v2_record(parser, out, depth);
    case '[':
      parser->cursor++;
      sb_append(out, "[\"sequence\",[");
      for (size_t count = 0; *parser->cursor != ']'; count++) {
        if (count) sb_append_char(out, ',');
        if (!root_v2_node(parser, out, depth + 1)) return 0;
        if (*parser->cursor == ']') break;
        if (*parser->cursor != ',') { parser->error = "Expected sequence delimiter"; return 0; }
        parser->cursor++;
      }
      parser->cursor++;
      sb_append(out, "]]");
      return 1;
    case '"': {
      StringBuilder text;
      sb_init(&text);
      int ok = root_v2_string(parser, &text);
      if (ok) { sb_append(out, "[\"text\","); root_v2_quote(out, text.data, text.length); sb_append_char(out, ']'); }
      free(text.data);
      return ok;
    }
    case 'n':
      if (strncmp(parser->cursor, "null", 4) == 0) { parser->cursor += 4; sb_append(out, "[\"null\"]"); return 1; }
      break;
    case 't':
      if (strncmp(parser->cursor, "true", 4) == 0) { parser->cursor += 4; sb_append(out, "[\"truth\",true]"); return 1; }
      break;
    case 'f':
      if (strncmp(parser->cursor, "false", 5) == 0) { parser->cursor += 5; sb_append(out, "[\"truth\",false]"); return 1; }
      break;
    default: {
      char *end;
      double number = strtod(parser->cursor, &end);
      if (end == parser->cursor || !isfinite(number)) break;
      parser->cursor = end;
      if (number == 0.0) number = 0.0;
      uint64_t bits;
      memcpy(&bits, &number, sizeof(bits));
      char encoded[64];
      snprintf(encoded, sizeof(encoded), "[\"number\",\"%016" PRIx64 "\"]", bits);
      sb_append(out, encoded);
      return 1;
    }
  }
  parser->error = "Invalid or nonfinite semantic JSON value";
  return 0;
}

static int root_v2_canonical_json(const char *json, StringBuilder *out, const char **error) {
  RootV2Parser parser = { json, NULL };
  int ok = root_v2_node(&parser, out, 0);
  if (ok && *parser.cursor) { parser.error = "Trailing semantic data"; ok = 0; }
  if (error) *error = parser.error;
  return ok;
}
#endif

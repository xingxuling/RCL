#define _POSIX_C_SOURCE 200809L
#include <ctype.h>
#include <errno.h>
#include <inttypes.h>
#include <math.h>
#ifdef _WIN32
#include <windows.h>
#include <bcrypt.h>
#define RCL_SHA256_DIGEST_LENGTH 32
#else
#include <openssl/sha.h>
#define RCL_SHA256_DIGEST_LENGTH SHA256_DIGEST_LENGTH
#endif
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "rclvm.h"

#define RCL_VM_VERSION "0.6.0-alpha.1"
#define INITIAL_STACK_CAPACITY 4096
#define MAX_STATE 2048
#define MAX_WARRANTS 1024
#define MAX_TX_CHANGES 512
#define MAX_RECORDS 128
#define MAX_WITNESSES 128
#define MAX_NEEDS 128
#define MAX_INSTRUCTIONS 1000000
#define MAX_BYTECODE_BYTES (256u * 1024u * 1024u)
#define INITIAL_CALL_FRAME_CAPACITY 2048
#define MAX_PROVIDERS 64
#define MAX_PROVIDER_RESPONSE (16 * 1024 * 1024)
#define MAX_TYPED_HEAP_OBJECTS 4096

/* Must remain aligned with src/bytecode.mjs. */
enum {
  OP_NOP = 0,
  OP_PUSH_NUMBER = 1,
  OP_PUSH_BOOL = 2,
  OP_PUSH_STRING = 3,
  OP_LOAD_STATE = 4,
  OP_STORE_STATE = 5,
  OP_ADD = 6,
  OP_SUB = 7,
  OP_MUL = 8,
  OP_DIV = 9,
  OP_EQ = 10,
  OP_NEQ = 11,
  OP_LT = 12,
  OP_LTE = 13,
  OP_GT = 14,
  OP_GTE = 15,
  OP_AND = 16,
  OP_OR = 17,
  OP_NOT = 18,
  OP_NEGATE = 19,
  OP_JUMP = 20,
  OP_JUMP_IF_FALSE = 21,
  OP_GRANT_WARRANT = 22,
  OP_BEGIN_TX = 23,
  OP_CHECK_WARRANT = 24,
  OP_STAGE_STORE = 25,
  OP_SET_PROJECTED_VIEW = 26,
  OP_CHECK_PRESERVE = 27,
  OP_RECORD_WITNESS = 28,
  OP_COMMIT_TX = 29,
  OP_CALL_BUILTIN = 30,
  OP_HALT = 31,
  OP_LOAD_LOCAL = 32,
  OP_CALL = 33,
  OP_RETURN = 34,
  OP_CALL_PROVIDER = 35,
  OP_MAKE_TYPED_RECORD = 36,
  OP_MAKE_TYPED_UNION = 37,
  OP_GET_TYPED_FIELD = 38,
  OP_IS_UNION_VARIANT = 39,
  OP_GET_UNION_PAYLOAD = 40,
  OP_MAKE_TYPED_REF = 41,
  OP_DEREF_TYPED_REF = 42,
  OP_GET_TYPED_REF_ID = 43,
  OP_MOD = 44,
};

enum {
  BUILTIN_CONTAINS = 1,
  BUILTIN_STARTS_WITH = 2,
  BUILTIN_ENDS_WITH = 3,
  BUILTIN_LENGTH = 4,
  BUILTIN_LOWER_TEXT = 5,
  BUILTIN_UPPER_TEXT = 6,
  BUILTIN_TEXT = 7,
  BUILTIN_TRIM = 8,
  BUILTIN_SPLIT_BEFORE = 9,
  BUILTIN_SPLIT_AFTER = 10,
  BUILTIN_NUMBER_FROM_TEXT = 11,
  BUILTIN_EMPTY_SEQUENCE = 12,
  BUILTIN_SEQUENCE_APPEND = 13,
  BUILTIN_SEQUENCE_GET = 14,
  BUILTIN_CHAR_AT = 15,
  BUILTIN_SLICE_TEXT = 16,
  BUILTIN_IS_WHITESPACE = 17,
  BUILTIN_IS_DIGIT = 18,
  BUILTIN_IS_IDENTIFIER_START = 19,
  BUILTIN_IS_IDENTIFIER_PART = 20,
  BUILTIN_MAKE_SPAN = 21,
  BUILTIN_MAKE_TOKEN = 22,
  BUILTIN_TOKEN_KIND = 23,
  BUILTIN_TOKEN_TEXT = 24,
  BUILTIN_TOKEN_SPAN = 25,
  BUILTIN_SPAN_OFFSET = 26,
  BUILTIN_SPAN_LINE = 27,
  BUILTIN_SPAN_COLUMN = 28,
  BUILTIN_SPAN_LENGTH = 29,
  BUILTIN_FACET_AST = 30,
  BUILTIN_AST_KIND = 31,
  BUILTIN_AST_PATH = 32,
  BUILTIN_AST_VALUE_TYPE = 33,
  BUILTIN_AST_LITERAL_KIND = 34,
  BUILTIN_AST_LITERAL_TEXT = 35,
  BUILTIN_AST_SPAN = 36,
  BUILTIN_MAKE_PARSE_STATE = 37,
  BUILTIN_PARSE_INDEX = 38,
  BUILTIN_PARSE_NODES = 39,
  BUILTIN_EXPECT_TOKEN = 40,
  BUILTIN_MAKE_SYMBOL = 41,
  BUILTIN_SYMBOL_PATH = 42,
  BUILTIN_SYMBOL_TYPE = 43,
  BUILTIN_SYMBOL_SLOT = 44,
  BUILTIN_SYMBOL_SPAN = 45,
  BUILTIN_SEMANTIC_ASSERT = 46,
  BUILTIN_MAKE_SEMANTIC_FACET = 47,
  BUILTIN_SEMANTIC_PATH = 48,
  BUILTIN_SEMANTIC_TYPE = 49,
  BUILTIN_SEMANTIC_LITERAL_KIND = 50,
  BUILTIN_SEMANTIC_LITERAL_TEXT = 51,
  BUILTIN_SEMANTIC_SLOT = 52,
  BUILTIN_SEMANTIC_SPAN = 53,
  BUILTIN_MAKE_IR_STORE = 54,
  BUILTIN_IR_OP = 55,
  BUILTIN_IR_PATH = 56,
  BUILTIN_IR_TYPE = 57,
  BUILTIN_IR_LITERAL_KIND = 58,
  BUILTIN_IR_LITERAL_TEXT = 59,
  BUILTIN_IR_SLOT = 60,
  BUILTIN_IR_SPAN = 61,
  BUILTIN_SEQUENCE_CONCAT = 62,
  BUILTIN_BYTES_U8 = 63,
  BUILTIN_BYTES_U16LE = 64,
  BUILTIN_BYTES_U32LE = 65,
  BUILTIN_BYTES_I32LE = 66,
  BUILTIN_BYTES_F64LE = 67,
  BUILTIN_UTF8_BYTES = 68,
  BUILTIN_HEX_BYTES = 69,
  BUILTIN_SHA256_TEXT = 70,
};

typedef enum {
  VALUE_NULL = 0, VALUE_NUMBER = 1, VALUE_BOOL = 2, VALUE_STRING = 3,
  VALUE_SEQUENCE = 4, VALUE_SPAN = 5, VALUE_TOKEN = 6, VALUE_AST = 7, VALUE_PARSE_STATE = 8,
  VALUE_SYMBOL = 9, VALUE_SEMANTIC = 10, VALUE_IR = 11, VALUE_TYPED_RECORD = 12, VALUE_TYPED_UNION = 13, VALUE_TYPED_REF = 14
} ValueType;

typedef struct Value Value;
typedef struct Sequence Sequence;
typedef struct Span Span;
typedef struct Token Token;
typedef struct AstNode AstNode;
typedef struct ParseState ParseState;
typedef struct SymbolValue SymbolValue;
typedef struct SemanticNode SemanticNode;
typedef struct IrNode IrNode;
typedef struct TypedRecord TypedRecord;
typedef struct TypedUnion TypedUnion;
typedef struct TypedRef TypedRef;

struct Span { int64_t offset, line, column, length; };
struct Sequence {
  size_t ref_count;
  size_t count;
  Value *items;
  Sequence *prefix;
  Value *tail;
};
struct Token { char *token_type; char *text; Span span; };
struct AstNode { char *path; char *value_type; char *literal_kind; char *literal_text; Span span; };
struct ParseState { int64_t index; Sequence *nodes; };
struct SymbolValue { char *path; char *value_type; int64_t slot; Span span; };
struct SemanticNode { char *path; char *value_type; char *literal_kind; char *literal_text; int64_t slot; Span span; };
struct IrNode { char *op; char *path; char *value_type; char *literal_kind; char *literal_text; int64_t slot; Span span; };
struct TypedRecord { uint64_t object_id; char *type_name; char **field_names; Value *field_values; size_t field_count; };
struct TypedUnion { uint64_t object_id; char *type_name; char *variant; Value *payload; size_t payload_count; };
struct TypedRef { uint64_t object_id; char *type_name; char *target_kind; };

struct Value {
  ValueType type;
  double number;
  int boolean;
  char *string;
  Sequence *sequence;
  Span *span;
  Token *token;
  AstNode *ast;
  ParseState *parse_state;
  SymbolValue *symbol;
  SemanticNode *semantic;
  IrNode *ir;
  TypedRecord *typed_record;
  TypedUnion *typed_union;
  TypedRef *typed_ref;
};

typedef struct {
  uint64_t object_id;
  Value value;
  int marked;
} TypedHeapEntry;

typedef struct {
  char *key;
  Value value;
} StateEntry;

typedef struct {
  StateEntry entries[MAX_STATE];
  size_t count;
} State;

typedef struct {
  char *subject;
  char *capability;
  char *target;
} Warrant;

typedef struct {
  char *capability;
  char *target;
} Need;

typedef struct {
  char *target;
  Value before;
  Value after;
} Change;

typedef struct {
  int active;
  int mode; /* 0 foresee, 1 realize */
  int rule_kind; /* 0 emergence, 1 resonance */
  int projected_view;
  char *rule;
  char *actor;
  char before_root[65];
  Change changes[MAX_TX_CHANGES];
  size_t change_count;
  char *witnesses[MAX_WITNESSES];
  size_t witness_count;
  Need needs[MAX_NEEDS];
  size_t need_count;
} Transaction;

typedef struct {
  int mode;
  int rule_kind;
  char *rule;
  char *actor;
  char before_root[65];
  char after_root[65];
  Change changes[MAX_TX_CHANGES];
  size_t change_count;
  char *witnesses[MAX_WITNESSES];
  size_t witness_count;
  Need needs[MAX_NEEDS];
  size_t need_count;
  State *projected_state;
} Record;

typedef struct {
  uint8_t op;
  uint8_t flags;
  int32_t a;
  int32_t b;
  int32_t c;
} Instruction;

typedef struct {
  uint16_t major;
  uint16_t minor;
  uint32_t flags;
  uint32_t program_name_index;
  uint32_t source_root_index;
  char **strings;
  uint32_t string_count;
  double *numbers;
  uint32_t number_count;
  Instruction *instructions;
  uint32_t instruction_count;
} Program;

typedef struct {
  const char *code;
  char message[512];
} VmError;

typedef struct {
  uint32_t return_pc;
  size_t base;
  int argc;
} CallFrame;

typedef struct {
  char *provider_id;
  RclVmProviderInvokeFn invoke;
  void *userdata;
} ProviderRegistration;

typedef struct {
  Program program;
  State state;
  Warrant warrants[MAX_WARRANTS];
  size_t warrant_count;
  Value *stack;
  size_t stack_count;
  size_t stack_capacity;
  size_t peak_stack_count;
  Transaction tx;
  Record projections[MAX_RECORDS];
  size_t projection_count;
  Record history[MAX_RECORDS];
  size_t history_count;
  uint64_t executed_instructions;
  CallFrame *frames;
  size_t frame_count;
  size_t frame_capacity;
  size_t peak_frame_count;
  VmError error;
  ProviderRegistration providers[MAX_PROVIDERS];
  size_t provider_count;
  uint64_t next_typed_object_id;
  uint64_t typed_heap_allocated;
  uint64_t typed_ref_allocated;
  uint64_t typed_heap_mark_count;
  TypedHeapEntry typed_heap_objects[MAX_TYPED_HEAP_OBJECTS];
  size_t typed_heap_count;
} VM;

typedef struct {
  char *data;
  size_t length;
  size_t capacity;
} StringBuilder;

typedef struct {
  size_t ref_count;
  size_t byte_length;
  size_t character_count;
  size_t *character_offsets;
  char data[];
} SharedString;

static size_t utf8_decode_at(const char *text, size_t byte_length, size_t offset, uint32_t *codepoint, int *valid);

static void sb_init(StringBuilder *sb) {
  sb->capacity = 256;
  sb->length = 0;
  sb->data = (char *)malloc(sb->capacity);
  if (!sb->data) { fprintf(stderr, "out of memory\n"); exit(2); }
  sb->data[0] = '\0';
}

static void sb_reserve(StringBuilder *sb, size_t additional) {
  if (sb->length + additional + 1 <= sb->capacity) return;
  while (sb->length + additional + 1 > sb->capacity) sb->capacity *= 2;
  char *next = (char *)realloc(sb->data, sb->capacity);
  if (!next) { fprintf(stderr, "out of memory\n"); exit(2); }
  sb->data = next;
}

static void sb_append_n(StringBuilder *sb, const char *text, size_t length) {
  sb_reserve(sb, length);
  memcpy(sb->data + sb->length, text, length);
  sb->length += length;
  sb->data[sb->length] = '\0';
}

static void sb_append(StringBuilder *sb, const char *text) { sb_append_n(sb, text, strlen(text)); }
static void sb_append_char(StringBuilder *sb, char c) { sb_reserve(sb, 1); sb->data[sb->length++] = c; sb->data[sb->length] = '\0'; }

static char *xstrdup(const char *s) {
  if (!s) return NULL;
  char *copy = strdup(s);
  if (!copy) { fprintf(stderr, "out of memory\n"); exit(2); }
  return copy;
}

static SharedString *shared_string_header(const char *value) {
  return (SharedString *)((char *)value - offsetof(SharedString, data));
}

static char *shared_string_allocate(size_t length) {
  if (length > SIZE_MAX - sizeof(SharedString) - 1) { fprintf(stderr, "out of memory\n"); exit(2); }
  SharedString *shared = (SharedString *)malloc(sizeof(SharedString) + length + 1);
  if (!shared) { fprintf(stderr, "out of memory\n"); exit(2); }
  shared->ref_count = 1;
  shared->byte_length = length;
  shared->character_count = SIZE_MAX;
  shared->character_offsets = NULL;
  shared->data[length] = '\0';
  return shared->data;
}

static char *shared_string_create_n(const char *source, size_t length) {
  char *data = shared_string_allocate(length);
  if (length) memcpy(data, source, length);
  return data;
}

static char *shared_string_create(const char *source) {
  const char *text = source ? source : "";
  return shared_string_create_n(text, strlen(text));
}

static char *shared_string_join(const char *left, size_t left_length, const char *right, size_t right_length) {
  if (left_length > SIZE_MAX - right_length) { fprintf(stderr, "out of memory\n"); exit(2); }
  size_t length = left_length + right_length;
  char *joined = shared_string_allocate(length);
  if (left_length) memcpy(joined, left, left_length);
  if (right_length) memcpy(joined + left_length, right, right_length);
  joined[length] = '\0';
  return joined;
}

static char *shared_string_retain(char *value) {
  if (!value) return NULL;
  SharedString *shared = shared_string_header(value);
  if (shared->ref_count == SIZE_MAX) { fprintf(stderr, "string reference overflow\n"); exit(2); }
  shared->ref_count++;
  return value;
}

static void shared_string_release(char *value) {
  if (!value) return;
  SharedString *shared = shared_string_header(value);
  if (shared->ref_count == 0) { fprintf(stderr, "invalid string reference\n"); abort(); }
  if (--shared->ref_count == 0) { free(shared->character_offsets); free(shared); }
}

static Value value_null(void) { Value v; memset(&v, 0, sizeof(v)); v.type = VALUE_NULL; return v; }
static Value value_number(double n) { Value v = value_null(); v.type = VALUE_NUMBER; v.number = n; return v; }
static Value value_bool(int b) { Value v = value_null(); v.type = VALUE_BOOL; v.boolean = !!b; return v; }
static Value value_string(const char *s) { Value v = value_null(); v.type = VALUE_STRING; v.string = shared_string_create(s); return v; }
static Value value_string_n(const char *s, size_t length) { Value v = value_null(); v.type = VALUE_STRING; v.string = shared_string_create_n(s, length); return v; }
static Value value_string_retain(const char *s) { Value v = value_null(); v.type = VALUE_STRING; v.string = shared_string_retain((char *)s); return v; }
static Value value_string_join(const char *left, size_t left_length, const char *right, size_t right_length) { Value v = value_null(); v.type = VALUE_STRING; v.string = shared_string_join(left, left_length, right, right_length); return v; }
static Value value_span(int64_t offset, int64_t line, int64_t column, int64_t length) {
  Value v = value_null(); v.type = VALUE_SPAN; v.span = (Span *)malloc(sizeof(Span));
  if (!v.span) { fprintf(stderr, "out of memory\n"); exit(2); }
  v.span->offset = offset; v.span->line = line; v.span->column = column; v.span->length = length; return v;
}
static Value value_token(const char *token_type, const char *text, const Span *span) {
  Value v = value_null(); v.type = VALUE_TOKEN; v.token = (Token *)calloc(1, sizeof(Token));
  if (!v.token) { fprintf(stderr, "out of memory\n"); exit(2); }
  v.token->token_type = xstrdup(token_type); v.token->text = xstrdup(text); v.token->span = *span; return v;
}
static Value value_ast(const char *path, const char *value_type, const char *literal_kind, const char *literal_text, const Span *span) {
  Value v = value_null(); v.type = VALUE_AST; v.ast = (AstNode *)calloc(1, sizeof(AstNode));
  if (!v.ast) { fprintf(stderr, "out of memory\n"); exit(2); }
  v.ast->path = xstrdup(path); v.ast->value_type = xstrdup(value_type); v.ast->literal_kind = xstrdup(literal_kind); v.ast->literal_text = xstrdup(literal_text); v.ast->span = *span; return v;
}

static void value_free(Value *value);
static Value value_clone(const Value *value);
static void sequence_free(Sequence *sequence);

static Sequence *sequence_create(void) {
  Sequence *sequence = (Sequence *)calloc(1, sizeof(Sequence));
  if (!sequence) { fprintf(stderr, "out of memory\n"); exit(2); }
  sequence->ref_count = 1;
  return sequence;
}

static Sequence *sequence_clone(const Sequence *source) {
  if (!source) return sequence_create();
  Sequence *sequence = (Sequence *)source;
  if (sequence->ref_count == SIZE_MAX) { fprintf(stderr, "sequence reference overflow\n"); exit(2); }
  sequence->ref_count++;
  return sequence;
}

static void sequence_materialize(Sequence *sequence) {
  if (!sequence || !sequence->tail) return;

  size_t tail_count = 0;
  Sequence *base = sequence;
  while (base->tail) {
    if (tail_count == SIZE_MAX) { fprintf(stderr, "sequence is too large\n"); exit(2); }
    tail_count++;
    base = base->prefix;
  }
  if (tail_count > SIZE_MAX / sizeof(Sequence *)) { fprintf(stderr, "out of memory\n"); exit(2); }
  Sequence **tails = (Sequence **)malloc(tail_count * sizeof(Sequence *));
  Value *items = (Value *)calloc(sequence->count ? sequence->count : 1, sizeof(Value));
  if (!tails || !items) { free(tails); free(items); fprintf(stderr, "out of memory\n"); exit(2); }

  Sequence *cursor = sequence;
  for (size_t i = 0; i < tail_count; i++) {
    tails[i] = cursor;
    cursor = cursor->prefix;
  }
  size_t output = 0;
  for (size_t i = 0; i < base->count; i++) items[output++] = value_clone(&base->items[i]);
  for (size_t i = tail_count; i > 0; i--) items[output++] = value_clone(tails[i - 1]->tail);
  free(tails);
  if (output != sequence->count) { fprintf(stderr, "invalid persistent sequence\n"); abort(); }

  Sequence *prefix = sequence->prefix;
  Value *tail = sequence->tail;
  sequence->items = items;
  sequence->prefix = NULL;
  sequence->tail = NULL;
  value_free(tail);
  free(tail);
  sequence_free(prefix);
}

static const Value *sequence_item(const Sequence *sequence, size_t index) {
  Sequence *materialized = (Sequence *)sequence;
  sequence_materialize(materialized);
  return &materialized->items[index];
}

static Value value_sequence_empty(void) {
  Value v = value_null(); v.type = VALUE_SEQUENCE; v.sequence = sequence_create();
  return v;
}

static Value value_sequence_append(const Sequence *source, const Value *item) {
  Value v = value_null(); v.type = VALUE_SEQUENCE; v.sequence = sequence_create();
  v.sequence->count = (source ? source->count : 0) + 1;
  v.sequence->prefix = sequence_clone(source);
  v.sequence->tail = (Value *)malloc(sizeof(Value));
  if (!v.sequence->tail) { fprintf(stderr, "out of memory\n"); exit(2); }
  *v.sequence->tail = value_clone(item);
  return v;
}

static Value value_parse_state(int64_t index, const Sequence *nodes) {
  Value v = value_null(); v.type = VALUE_PARSE_STATE; v.parse_state = (ParseState *)calloc(1, sizeof(ParseState));
  if (!v.parse_state) { fprintf(stderr, "out of memory\n"); exit(2); }
  v.parse_state->index = index; v.parse_state->nodes = sequence_clone(nodes); return v;
}

static Value value_symbol(const char *path, const char *value_type, int64_t slot, const Span *span) {
  Value v = value_null(); v.type = VALUE_SYMBOL; v.symbol = (SymbolValue *)calloc(1, sizeof(SymbolValue));
  if (!v.symbol) { fprintf(stderr, "out of memory\n"); exit(2); }
  v.symbol->path = xstrdup(path); v.symbol->value_type = xstrdup(value_type); v.symbol->slot = slot; v.symbol->span = *span; return v;
}

static Value value_semantic(const char *path, const char *value_type, const char *literal_kind, const char *literal_text, int64_t slot, const Span *span) {
  Value v = value_null(); v.type = VALUE_SEMANTIC; v.semantic = (SemanticNode *)calloc(1, sizeof(SemanticNode));
  if (!v.semantic) { fprintf(stderr, "out of memory\n"); exit(2); }
  v.semantic->path = xstrdup(path); v.semantic->value_type = xstrdup(value_type); v.semantic->literal_kind = xstrdup(literal_kind); v.semantic->literal_text = xstrdup(literal_text); v.semantic->slot = slot; v.semantic->span = *span; return v;
}

static Value value_ir(const char *op, const char *path, const char *value_type, const char *literal_kind, const char *literal_text, int64_t slot, const Span *span) {
  Value v = value_null(); v.type = VALUE_IR; v.ir = (IrNode *)calloc(1, sizeof(IrNode));
  if (!v.ir) { fprintf(stderr, "out of memory\n"); exit(2); }
  v.ir->op = xstrdup(op); v.ir->path = xstrdup(path); v.ir->value_type = xstrdup(value_type); v.ir->literal_kind = xstrdup(literal_kind); v.ir->literal_text = xstrdup(literal_text); v.ir->slot = slot; v.ir->span = *span; return v;
}

static Value value_typed_record_with_id(uint64_t object_id, const char *type_name, char **field_names, const Value *field_values, size_t field_count) {
  Value v = value_null(); v.type = VALUE_TYPED_RECORD; v.typed_record = (TypedRecord *)calloc(1, sizeof(TypedRecord));
  if (!v.typed_record) { fprintf(stderr, "out of memory\n"); exit(2); }
  v.typed_record->object_id = object_id;
  v.typed_record->type_name = xstrdup(type_name);
  v.typed_record->field_count = field_count;
  if (field_count) {
    v.typed_record->field_names = (char **)calloc(field_count, sizeof(char *));
    v.typed_record->field_values = (Value *)calloc(field_count, sizeof(Value));
    if (!v.typed_record->field_names || !v.typed_record->field_values) { fprintf(stderr, "out of memory\n"); exit(2); }
    for (size_t i = 0; i < field_count; i++) {
      v.typed_record->field_names[i] = xstrdup(field_names[i]);
      v.typed_record->field_values[i] = value_clone(&field_values[i]);
    }
  }
  return v;
}


static Value value_typed_union_with_id(uint64_t object_id, const char *type_name, const char *variant, const Value *payload, size_t payload_count) {
  Value v = value_null(); v.type = VALUE_TYPED_UNION; v.typed_union = (TypedUnion *)calloc(1, sizeof(TypedUnion));
  if (!v.typed_union) { fprintf(stderr, "out of memory\n"); exit(2); }
  v.typed_union->object_id = object_id;
  v.typed_union->type_name = xstrdup(type_name);
  v.typed_union->variant = xstrdup(variant);
  v.typed_union->payload_count = payload_count;
  if (payload_count) {
    v.typed_union->payload = (Value *)calloc(payload_count, sizeof(Value));
    if (!v.typed_union->payload) { fprintf(stderr, "out of memory\n"); exit(2); }
    for (size_t i = 0; i < payload_count; i++) v.typed_union->payload[i] = value_clone(&payload[i]);
  }
  return v;
}


static Value value_typed_ref(uint64_t object_id, const char *type_name, const char *target_kind) {
  Value v = value_null(); v.type = VALUE_TYPED_REF; v.typed_ref = (TypedRef *)calloc(1, sizeof(TypedRef));
  if (!v.typed_ref) { fprintf(stderr, "out of memory\n"); exit(2); }
  v.typed_ref->object_id = object_id;
  v.typed_ref->type_name = xstrdup(type_name ? type_name : "Unknown");
  v.typed_ref->target_kind = xstrdup(target_kind ? target_kind : "Unknown");
  return v;
}

static const char *typed_value_kind(const Value *value) {
  if (!value) return "Unknown";
  if (value->type == VALUE_TYPED_RECORD) return "Record";
  if (value->type == VALUE_TYPED_UNION) return "Union";
  return "Unknown";
}

static uint64_t typed_value_object_id(const Value *value) {
  if (!value) return 0;
  if (value->type == VALUE_TYPED_RECORD && value->typed_record) return value->typed_record->object_id;
  if (value->type == VALUE_TYPED_UNION && value->typed_union) return value->typed_union->object_id;
  return 0;
}

static const char *typed_value_type_name(const Value *value) {
  if (!value) return "Unknown";
  if (value->type == VALUE_TYPED_RECORD && value->typed_record) return value->typed_record->type_name;
  if (value->type == VALUE_TYPED_UNION && value->typed_union) return value->typed_union->type_name;
  return "Unknown";
}

static int typed_record_field_index(const TypedRecord *record, const char *field_name) {
  if (!record || !field_name) return -1;
  for (size_t i = 0; i < record->field_count; i++) if (strcmp(record->field_names[i], field_name) == 0) return (int)i;
  return -1;
}

static void sequence_free(Sequence *sequence) {
  while (sequence) {
    if (sequence->ref_count == 0) { fprintf(stderr, "invalid sequence reference\n"); abort(); }
    if (--sequence->ref_count > 0) return;
    Sequence *prefix = sequence->prefix;
    if (sequence->items) {
      for (size_t i = 0; i < sequence->count; i++) value_free(&sequence->items[i]);
      free(sequence->items);
    }
    if (sequence->tail) { value_free(sequence->tail); free(sequence->tail); }
    free(sequence);
    sequence = prefix;
  }
}

static void value_free(Value *value) {
  if (!value) return;
  switch (value->type) {
    case VALUE_STRING: shared_string_release(value->string); break;
    case VALUE_SEQUENCE: sequence_free(value->sequence); break;
    case VALUE_SPAN: free(value->span); break;
    case VALUE_TOKEN:
      if (value->token) { free(value->token->token_type); free(value->token->text); free(value->token); }
      break;
    case VALUE_AST:
      if (value->ast) { free(value->ast->path); free(value->ast->value_type); free(value->ast->literal_kind); free(value->ast->literal_text); free(value->ast); }
      break;
    case VALUE_PARSE_STATE:
      if (value->parse_state) { sequence_free(value->parse_state->nodes); free(value->parse_state); }
      break;
    case VALUE_SYMBOL:
      if (value->symbol) { free(value->symbol->path); free(value->symbol->value_type); free(value->symbol); }
      break;
    case VALUE_SEMANTIC:
      if (value->semantic) { free(value->semantic->path); free(value->semantic->value_type); free(value->semantic->literal_kind); free(value->semantic->literal_text); free(value->semantic); }
      break;
    case VALUE_IR:
      if (value->ir) { free(value->ir->op); free(value->ir->path); free(value->ir->value_type); free(value->ir->literal_kind); free(value->ir->literal_text); free(value->ir); }
      break;
    case VALUE_TYPED_RECORD:
      if (value->typed_record) {
        free(value->typed_record->type_name);
        for (size_t i = 0; i < value->typed_record->field_count; i++) { free(value->typed_record->field_names[i]); value_free(&value->typed_record->field_values[i]); }
        free(value->typed_record->field_names); free(value->typed_record->field_values); free(value->typed_record);
      }
      break;
    case VALUE_TYPED_UNION:
      if (value->typed_union) {
        free(value->typed_union->type_name); free(value->typed_union->variant);
        for (size_t i = 0; i < value->typed_union->payload_count; i++) value_free(&value->typed_union->payload[i]);
        free(value->typed_union->payload); free(value->typed_union);
      }
      break;
    case VALUE_TYPED_REF:
      if (value->typed_ref) { free(value->typed_ref->type_name); free(value->typed_ref->target_kind); free(value->typed_ref); }
      break;
    default: break;
  }
  *value = value_null();
}

static Value value_clone(const Value *value) {
  if (!value) return value_null();
  switch (value->type) {
    case VALUE_NUMBER: return value_number(value->number);
    case VALUE_BOOL: return value_bool(value->boolean);
    case VALUE_STRING: { Value v = value_null(); v.type = VALUE_STRING; v.string = shared_string_retain(value->string); return v; }
    case VALUE_SEQUENCE: { Value v = value_null(); v.type = VALUE_SEQUENCE; v.sequence = sequence_clone(value->sequence); return v; }
    case VALUE_SPAN: return value_span(value->span->offset, value->span->line, value->span->column, value->span->length);
    case VALUE_TOKEN: return value_token(value->token->token_type, value->token->text, &value->token->span);
    case VALUE_AST: return value_ast(value->ast->path, value->ast->value_type, value->ast->literal_kind, value->ast->literal_text, &value->ast->span);
    case VALUE_PARSE_STATE: return value_parse_state(value->parse_state->index, value->parse_state->nodes);
    case VALUE_SYMBOL: return value_symbol(value->symbol->path, value->symbol->value_type, value->symbol->slot, &value->symbol->span);
    case VALUE_SEMANTIC: return value_semantic(value->semantic->path, value->semantic->value_type, value->semantic->literal_kind, value->semantic->literal_text, value->semantic->slot, &value->semantic->span);
    case VALUE_IR: return value_ir(value->ir->op, value->ir->path, value->ir->value_type, value->ir->literal_kind, value->ir->literal_text, value->ir->slot, &value->ir->span);
    case VALUE_TYPED_RECORD: return value_typed_record_with_id(value->typed_record->object_id, value->typed_record->type_name, value->typed_record->field_names, value->typed_record->field_values, value->typed_record->field_count);
    case VALUE_TYPED_UNION: return value_typed_union_with_id(value->typed_union->object_id, value->typed_union->type_name, value->typed_union->variant, value->typed_union->payload, value->typed_union->payload_count);
    case VALUE_TYPED_REF: return value_typed_ref(value->typed_ref->object_id, value->typed_ref->type_name, value->typed_ref->target_kind);
    default: return value_null();
  }
}

static int value_truthy(const Value *value) {
  switch (value->type) {
    case VALUE_BOOL: return value->boolean;
    case VALUE_NUMBER: return value->number != 0.0 && !isnan(value->number);
    case VALUE_STRING: return value->string && value->string[0] != '\0';
    case VALUE_SEQUENCE: return value->sequence && value->sequence->count > 0;
    case VALUE_SPAN: case VALUE_TOKEN: case VALUE_AST: case VALUE_PARSE_STATE: case VALUE_SYMBOL: case VALUE_SEMANTIC: case VALUE_IR: case VALUE_TYPED_RECORD: case VALUE_TYPED_UNION: case VALUE_TYPED_REF: return 1;
    default: return 0;
  }
}

static void vm_fail(VM *vm, const char *code, const char *message) {
  if (vm->error.code) return;
  vm->error.code = code;
  snprintf(vm->error.message, sizeof(vm->error.message), "%s", message);
}

static TypedHeapEntry *typed_heap_find(VM *vm, uint64_t object_id) {
  for (size_t i = 0; i < vm->typed_heap_count; i++) if (vm->typed_heap_objects[i].object_id == object_id) return &vm->typed_heap_objects[i];
  return NULL;
}

static void typed_heap_clear(VM *vm) {
  for (size_t i = 0; i < vm->typed_heap_count; i++) value_free(&vm->typed_heap_objects[i].value);
  vm->typed_heap_count = 0;
  vm->typed_heap_mark_count = 0;
  vm->typed_ref_allocated = 0;
}

static int typed_heap_register(VM *vm, const Value *value) {
  uint64_t object_id = typed_value_object_id(value);
  if (!object_id) return 1;
  if (typed_heap_find(vm, object_id)) return 1;
  if (vm->typed_heap_count >= MAX_TYPED_HEAP_OBJECTS) { vm_fail(vm, "RCL_NATIVE_TYPED_HEAP_FULL", "Native typed heap object registry is full"); return 0; }
  TypedHeapEntry *entry = &vm->typed_heap_objects[vm->typed_heap_count++];
  entry->object_id = object_id;
  entry->value = value_clone(value);
  entry->marked = 0;
  return 1;
}

static Value typed_heap_make_ref(VM *vm, const Value *target) {
  if (target->type == VALUE_TYPED_REF) return value_clone(target);
  if (target->type != VALUE_TYPED_RECORD && target->type != VALUE_TYPED_UNION) {
    vm_fail(vm, "RCL_NATIVE_TYPED_REF_TARGET", "typed_ref requires a typed record or typed union target");
    return value_null();
  }
  if (!typed_heap_register(vm, target)) return value_null();
  vm->typed_ref_allocated++;
  return value_typed_ref(typed_value_object_id(target), typed_value_type_name(target), typed_value_kind(target));
}

static Value typed_heap_deref(VM *vm, const Value *ref) {
  if (ref->type != VALUE_TYPED_REF) {
    vm_fail(vm, "RCL_NATIVE_TYPED_DEREF_TARGET", "typed_deref requires a typed reference");
    return value_null();
  }
  TypedHeapEntry *entry = typed_heap_find(vm, ref->typed_ref->object_id);
  if (!entry) {
    vm_fail(vm, "RCL_NATIVE_TYPED_DEREF_MISSING", "typed reference target is not registered in the native typed heap");
    return value_null();
  }
  return value_clone(&entry->value);
}

static void typed_heap_mark_value(VM *vm, const Value *value);

static void typed_heap_mark_object_id(VM *vm, uint64_t object_id) {
  if (!object_id) return;
  TypedHeapEntry *entry = typed_heap_find(vm, object_id);
  if (!entry || entry->marked) return;
  entry->marked = 1;
  vm->typed_heap_mark_count++;
  typed_heap_mark_value(vm, &entry->value);
}

static void typed_heap_mark_value(VM *vm, const Value *value) {
  if (!value) return;
  switch (value->type) {
    case VALUE_SEQUENCE:
      if (value->sequence) {
        sequence_materialize(value->sequence);
        for (size_t i = 0; i < value->sequence->count; i++) typed_heap_mark_value(vm, &value->sequence->items[i]);
      }
      break;
    case VALUE_TYPED_RECORD:
      typed_heap_mark_object_id(vm, value->typed_record->object_id);
      for (size_t i = 0; i < value->typed_record->field_count; i++) typed_heap_mark_value(vm, &value->typed_record->field_values[i]);
      break;
    case VALUE_TYPED_UNION:
      typed_heap_mark_object_id(vm, value->typed_union->object_id);
      for (size_t i = 0; i < value->typed_union->payload_count; i++) typed_heap_mark_value(vm, &value->typed_union->payload[i]);
      break;
    case VALUE_TYPED_REF:
      typed_heap_mark_object_id(vm, value->typed_ref->object_id);
      break;
    default:
      break;
  }
}

static void typed_heap_mark_from_roots(VM *vm) {
  for (size_t i = 0; i < vm->typed_heap_count; i++) vm->typed_heap_objects[i].marked = 0;
  vm->typed_heap_mark_count = 0;
  for (size_t i = 0; i < vm->state.count; i++) typed_heap_mark_value(vm, &vm->state.entries[i].value);
}

static StateEntry *state_find(State *state, const char *key) {
  for (size_t i = 0; i < state->count; i++) if (strcmp(state->entries[i].key, key) == 0) return &state->entries[i];
  return NULL;
}

static const StateEntry *state_find_const(const State *state, const char *key) {
  for (size_t i = 0; i < state->count; i++) if (strcmp(state->entries[i].key, key) == 0) return &state->entries[i];
  return NULL;
}

static int state_set(State *state, const char *key, const Value *value) {
  StateEntry *entry = state_find(state, key);
  if (!entry) {
    if (state->count >= MAX_STATE) return 0;
    entry = &state->entries[state->count++];
    entry->key = xstrdup(key);
    entry->value = value_null();
  }
  value_free(&entry->value);
  entry->value = value_clone(value);
  return 1;
}

static Value state_get(const State *state, const char *key) {
  const StateEntry *entry = state_find_const(state, key);
  return entry ? value_clone(&entry->value) : value_null();
}

static void state_free(State *state) {
  for (size_t i = 0; i < state->count; i++) {
    free(state->entries[i].key);
    value_free(&state->entries[i].value);
  }
  state->count = 0;
}

static int state_clone_into(State *target, const State *source) {
  memset(target, 0, sizeof(*target));
  for (size_t i = 0; i < source->count; i++) if (!state_set(target, source->entries[i].key, &source->entries[i].value)) return 0;
  return 1;
}

static Change *tx_find_change(Transaction *tx, const char *target) {
  for (size_t i = 0; i < tx->change_count; i++) if (strcmp(tx->changes[i].target, target) == 0) return &tx->changes[i];
  return NULL;
}

static Value vm_load_state(VM *vm, const char *path) {
  if (vm->tx.active && vm->tx.projected_view) {
    Change *change = tx_find_change(&vm->tx, path);
    if (change) return value_clone(&change->after);
  }
  const StateEntry *entry = state_find_const(&vm->state, path);
  if (!entry) {
    char message[512];
    snprintf(message, sizeof(message), "Facet '%s' does not exist", path);
    vm_fail(vm, "RCL_STATE_MISSING", message);
    return value_null();
  }
  return value_clone(&entry->value);
}

static int stack_reserve(VM *vm, size_t required) {
  if (required <= vm->stack_capacity) return 1;
  if (required > RCLVM_MAX_VALUE_STACK) {
    vm_fail(vm, "RCL_NATIVE_STACK_LIMIT", "Native VM Value stack hard limit exceeded (131072)");
    return 0;
  }
  size_t capacity = vm->stack_capacity ? vm->stack_capacity : INITIAL_STACK_CAPACITY;
  while (capacity < required) {
    capacity = capacity > RCLVM_MAX_VALUE_STACK / 2 ? RCLVM_MAX_VALUE_STACK : capacity * 2;
  }
  if (capacity > SIZE_MAX / sizeof(Value)) {
    vm_fail(vm, "RCL_NATIVE_OOM", "Native VM Value stack allocation is too large");
    return 0;
  }
  Value *stack = (Value *)realloc(vm->stack, capacity * sizeof(Value));
  if (!stack) {
    vm_fail(vm, "RCL_NATIVE_OOM", "Unable to grow native VM Value stack");
    return 0;
  }
  vm->stack = stack;
  vm->stack_capacity = capacity;
  return 1;
}

static int frame_reserve(VM *vm, size_t required) {
  if (required <= vm->frame_capacity) return 1;
  if (required > RCLVM_MAX_CALL_FRAMES) {
    vm_fail(vm, "RCL_NATIVE_CALL_DEPTH", "Native VM CallFrame hard limit exceeded (32768)");
    return 0;
  }
  size_t capacity = vm->frame_capacity ? vm->frame_capacity : INITIAL_CALL_FRAME_CAPACITY;
  while (capacity < required) {
    capacity = capacity > RCLVM_MAX_CALL_FRAMES / 2 ? RCLVM_MAX_CALL_FRAMES : capacity * 2;
  }
  if (capacity > SIZE_MAX / sizeof(CallFrame)) {
    vm_fail(vm, "RCL_NATIVE_OOM", "Native VM CallFrame allocation is too large");
    return 0;
  }
  CallFrame *frames = (CallFrame *)realloc(vm->frames, capacity * sizeof(CallFrame));
  if (!frames) {
    vm_fail(vm, "RCL_NATIVE_OOM", "Unable to grow native VM CallFrame stack");
    return 0;
  }
  vm->frames = frames;
  vm->frame_capacity = capacity;
  return 1;
}

static int stack_push(VM *vm, Value value) {
  if (!stack_reserve(vm, vm->stack_count + 1)) { value_free(&value); return 0; }
  vm->stack[vm->stack_count++] = value;
  if (vm->stack_count > vm->peak_stack_count) vm->peak_stack_count = vm->stack_count;
  return 1;
}

static Value stack_pop(VM *vm) {
  if (vm->stack_count == 0) { vm_fail(vm, "RCL_NATIVE_STACK_UNDERFLOW", "Native VM stack underflow"); return value_null(); }
  return vm->stack[--vm->stack_count];
}

static int scope_matches(const char *granted, const char *required) {
  if (strcmp(granted, "*") == 0 || strcmp(granted, required) == 0) return 1;
  size_t length = strlen(granted);
  return strncmp(required, granted, length) == 0 && required[length] == '.';
}

static int has_warrant(VM *vm, const char *subject, const char *capability, const char *target) {
  for (size_t i = 0; i < vm->warrant_count; i++) {
    Warrant *warrant = &vm->warrants[i];
    if (strcmp(warrant->subject, subject) == 0 && strcmp(warrant->capability, capability) == 0 && scope_matches(warrant->target, target)) return 1;
  }
  return 0;
}

static void json_escape_sb(StringBuilder *sb, const char *text) {
  sb_append_char(sb, '"');
  const unsigned char *p = (const unsigned char *)(text ? text : "");
  for (; *p; p++) {
    switch (*p) {
      case '"': sb_append(sb, "\\\""); break;
      case '\\': sb_append(sb, "\\\\"); break;
      case '\b': sb_append(sb, "\\b"); break;
      case '\f': sb_append(sb, "\\f"); break;
      case '\n': sb_append(sb, "\\n"); break;
      case '\r': sb_append(sb, "\\r"); break;
      case '\t': sb_append(sb, "\\t"); break;
      default:
        if (*p < 0x20) {
          char escaped[7];
          snprintf(escaped, sizeof(escaped), "\\u%04x", *p);
          sb_append(sb, escaped);
        } else sb_append_char(sb, (char)*p);
    }
  }
  sb_append_char(sb, '"');
}

static void value_json_sb(StringBuilder *sb, const Value *value);

static void span_json_sb(StringBuilder *sb, const Span *span) {
  char number[64];
  sb_append(sb, "{\"kind\":\"Span\",\"offset\":"); snprintf(number, sizeof(number), "%" PRId64, span->offset); sb_append(sb, number);
  sb_append(sb, ",\"line\":"); snprintf(number, sizeof(number), "%" PRId64, span->line); sb_append(sb, number);
  sb_append(sb, ",\"column\":"); snprintf(number, sizeof(number), "%" PRId64, span->column); sb_append(sb, number);
  sb_append(sb, ",\"length\":"); snprintf(number, sizeof(number), "%" PRId64, span->length); sb_append(sb, number); sb_append_char(sb, '}');
}

static void sequence_json_sb(StringBuilder *sb, const Sequence *sequence) {
  sb_append_char(sb, '[');
  sequence_materialize((Sequence *)sequence);
  for (size_t i = 0; sequence && i < sequence->count; i++) { if (i) sb_append_char(sb, ','); value_json_sb(sb, &sequence->items[i]); }
  sb_append_char(sb, ']');
}

static void value_json_sb(StringBuilder *sb, const Value *value) {
  char number[64];
  switch (value->type) {
    case VALUE_NUMBER:
      if (!isfinite(value->number)) { sb_append(sb, "null"); break; }
      if (value->number == 0.0) { sb_append(sb, "0"); break; }
      snprintf(number, sizeof(number), "%.15g", value->number); sb_append(sb, number); break;
    case VALUE_BOOL: sb_append(sb, value->boolean ? "true" : "false"); break;
    case VALUE_STRING: json_escape_sb(sb, value->string); break;
    case VALUE_SEQUENCE: sequence_json_sb(sb, value->sequence); break;
    case VALUE_SPAN: span_json_sb(sb, value->span); break;
    case VALUE_TOKEN:
      sb_append(sb, "{\"kind\":\"Token\",\"tokenType\":"); json_escape_sb(sb, value->token->token_type);
      sb_append(sb, ",\"text\":"); json_escape_sb(sb, value->token->text); sb_append(sb, ",\"span\":"); span_json_sb(sb, &value->token->span); sb_append_char(sb, '}'); break;
    case VALUE_AST: {
      sb_append(sb, "{\"kind\":\"FacetDecl\",\"path\":"); json_escape_sb(sb, value->ast->path);
      sb_append(sb, ",\"valueType\":"); json_escape_sb(sb, value->ast->value_type);
      sb_append(sb, ",\"value\":{\"kind\":\"LiteralExpr\",\"value\":");
      if (strcmp(value->ast->literal_kind, "Number") == 0) { double n = strtod(value->ast->literal_text, NULL); snprintf(number, sizeof(number), "%.15g", n); sb_append(sb, number); }
      else if (strcmp(value->ast->literal_kind, "Truth") == 0) sb_append(sb, strcmp(value->ast->literal_text, "true") == 0 ? "true" : "false");
      else json_escape_sb(sb, value->ast->literal_text);
      sb_append(sb, ",\"valueType\":"); json_escape_sb(sb, value->ast->literal_kind); sb_append(sb, "},\"span\":"); span_json_sb(sb, &value->ast->span); sb_append_char(sb, '}'); break;
    }
    case VALUE_PARSE_STATE:
      sb_append(sb, "{\"kind\":\"ParseState\",\"index\":"); snprintf(number, sizeof(number), "%" PRId64, value->parse_state->index); sb_append(sb, number);
      sb_append(sb, ",\"nodes\":"); sequence_json_sb(sb, value->parse_state->nodes); sb_append_char(sb, '}'); break;
    case VALUE_SYMBOL:
      sb_append(sb, "{\"kind\":\"Symbol\",\"path\":"); json_escape_sb(sb, value->symbol->path);
      sb_append(sb, ",\"valueType\":"); json_escape_sb(sb, value->symbol->value_type);
      sb_append(sb, ",\"slot\":"); snprintf(number, sizeof(number), "%" PRId64, value->symbol->slot); sb_append(sb, number);
      sb_append(sb, ",\"span\":"); span_json_sb(sb, &value->symbol->span); sb_append_char(sb, '}'); break;
    case VALUE_SEMANTIC:
      sb_append(sb, "{\"kind\":\"SemanticFacet\",\"path\":"); json_escape_sb(sb, value->semantic->path);
      sb_append(sb, ",\"valueType\":"); json_escape_sb(sb, value->semantic->value_type);
      sb_append(sb, ",\"literalKind\":"); json_escape_sb(sb, value->semantic->literal_kind);
      sb_append(sb, ",\"literalText\":"); json_escape_sb(sb, value->semantic->literal_text);
      sb_append(sb, ",\"slot\":"); snprintf(number, sizeof(number), "%" PRId64, value->semantic->slot); sb_append(sb, number);
      sb_append(sb, ",\"span\":"); span_json_sb(sb, &value->semantic->span); sb_append_char(sb, '}'); break;
    case VALUE_IR:
      sb_append(sb, "{\"kind\":\"IRStore\",\"op\":"); json_escape_sb(sb, value->ir->op);
      sb_append(sb, ",\"path\":"); json_escape_sb(sb, value->ir->path);
      sb_append(sb, ",\"valueType\":"); json_escape_sb(sb, value->ir->value_type);
      sb_append(sb, ",\"literalKind\":"); json_escape_sb(sb, value->ir->literal_kind);
      sb_append(sb, ",\"literalText\":"); json_escape_sb(sb, value->ir->literal_text);
      sb_append(sb, ",\"slot\":"); snprintf(number, sizeof(number), "%" PRId64, value->ir->slot); sb_append(sb, number);
      sb_append(sb, ",\"span\":"); span_json_sb(sb, &value->ir->span); sb_append_char(sb, '}'); break;
    case VALUE_TYPED_RECORD:
      sb_append(sb, "{\"__rclKind\":\"Record\",\"__rclType\":"); json_escape_sb(sb, value->typed_record->type_name);
      sb_append(sb, ",\"__rclObjectId\":"); snprintf(number, sizeof(number), "%" PRIu64 "", value->typed_record->object_id); sb_append(sb, number);
      sb_append(sb, ",\"__rclFieldOffsets\":{");
      for (size_t i = 0; i < value->typed_record->field_count; i++) {
        if (i) sb_append_char(sb, ',');
        json_escape_sb(sb, value->typed_record->field_names[i]);
        sb_append_char(sb, ':');
        snprintf(number, sizeof(number), "%zu", i);
        sb_append(sb, number);
      }
      sb_append_char(sb, '}');
      for (size_t i = 0; i < value->typed_record->field_count; i++) {
        sb_append_char(sb, ','); json_escape_sb(sb, value->typed_record->field_names[i]); sb_append_char(sb, ':'); value_json_sb(sb, &value->typed_record->field_values[i]);
      }
      sb_append_char(sb, '}'); break;
    case VALUE_TYPED_UNION:
      sb_append(sb, "{\"__rclKind\":\"Union\",\"__rclType\":"); json_escape_sb(sb, value->typed_union->type_name);
      sb_append(sb, ",\"__rclObjectId\":"); snprintf(number, sizeof(number), "%" PRIu64, value->typed_union->object_id); sb_append(sb, number);
      sb_append(sb, ",\"__rclPayloadOffsets\":{");
      for (size_t i = 0; i < value->typed_union->payload_count; i++) { if (i) sb_append_char(sb, ','); snprintf(number, sizeof(number), "\"%zu\":%zu", i, i); sb_append(sb, number); }
      sb_append_char(sb, '}');
      sb_append(sb, ",\"variant\":"); json_escape_sb(sb, value->typed_union->variant);
      sb_append(sb, ",\"payload\":"); sb_append_char(sb, '[');
      for (size_t i = 0; i < value->typed_union->payload_count; i++) { if (i) sb_append_char(sb, ','); value_json_sb(sb, &value->typed_union->payload[i]); }
      sb_append(sb, "]}"); break;
    case VALUE_TYPED_REF:
      sb_append(sb, "{\"__rclKind\":\"Ref\",\"__rclRefObjectId\":"); snprintf(number, sizeof(number), "%" PRIu64, value->typed_ref->object_id); sb_append(sb, number);
      sb_append(sb, ",\"__rclRefType\":"); json_escape_sb(sb, value->typed_ref->type_name);
      sb_append(sb, ",\"__rclRefKind\":"); json_escape_sb(sb, value->typed_ref->target_kind);
      sb_append_char(sb, '}'); break;
    default: sb_append(sb, "null"); break;
  }
}

typedef struct {
  const char *name;
  size_t index;
} SemanticFieldRef;

static int compare_semantic_field_refs(const void *left, const void *right) {
  const SemanticFieldRef *a = (const SemanticFieldRef *)left;
  const SemanticFieldRef *b = (const SemanticFieldRef *)right;
  return strcmp(a->name, b->name);
}

static void semantic_value_json_sb(StringBuilder *sb, const Value *value);

static void semantic_span_json_sb(StringBuilder *sb, const Span *span) {
  char number[64];
  sb_append(sb, "{\"column\":"); snprintf(number, sizeof(number), "%" PRId64, span->column); sb_append(sb, number);
  sb_append(sb, ",\"kind\":\"Span\",\"length\":"); snprintf(number, sizeof(number), "%" PRId64, span->length); sb_append(sb, number);
  sb_append(sb, ",\"line\":"); snprintf(number, sizeof(number), "%" PRId64, span->line); sb_append(sb, number);
  sb_append(sb, ",\"offset\":"); snprintf(number, sizeof(number), "%" PRId64, span->offset); sb_append(sb, number); sb_append_char(sb, '}');
}

static void semantic_sequence_json_sb(StringBuilder *sb, const Sequence *sequence) {
  sb_append_char(sb, '[');
  sequence_materialize((Sequence *)sequence);
  for (size_t i = 0; sequence && i < sequence->count; i++) { if (i) sb_append_char(sb, ','); semantic_value_json_sb(sb, &sequence->items[i]); }
  sb_append_char(sb, ']');
}

static void semantic_literal_expr_json_sb(StringBuilder *sb, const AstNode *ast) {
  char number[64];
  sb_append(sb, "{\"kind\":\"LiteralExpr\",\"value\":");
  if (strcmp(ast->literal_kind, "Number") == 0) { double n = strtod(ast->literal_text, NULL); snprintf(number, sizeof(number), "%.15g", n); sb_append(sb, number); }
  else if (strcmp(ast->literal_kind, "Truth") == 0) sb_append(sb, strcmp(ast->literal_text, "true") == 0 ? "true" : "false");
  else json_escape_sb(sb, ast->literal_text);
  sb_append(sb, ",\"valueType\":"); json_escape_sb(sb, ast->literal_kind); sb_append_char(sb, '}');
}

static void semantic_token_json_sb(StringBuilder *sb, const Token *token) {
  sb_append(sb, "{\"kind\":\"Token\",\"span\":"); semantic_span_json_sb(sb, &token->span);
  sb_append(sb, ",\"text\":"); json_escape_sb(sb, token->text); sb_append(sb, ",\"tokenType\":"); json_escape_sb(sb, token->token_type); sb_append_char(sb, '}');
}

static void semantic_ast_json_sb(StringBuilder *sb, const AstNode *ast) {
  sb_append(sb, "{\"kind\":\"FacetDecl\",\"path\":"); json_escape_sb(sb, ast->path);
  sb_append(sb, ",\"span\":"); semantic_span_json_sb(sb, &ast->span);
  sb_append(sb, ",\"value\":"); semantic_literal_expr_json_sb(sb, ast);
  sb_append(sb, ",\"valueType\":"); json_escape_sb(sb, ast->value_type); sb_append_char(sb, '}');
}

static void semantic_parse_state_json_sb(StringBuilder *sb, const ParseState *parse_state) {
  char number[64];
  sb_append(sb, "{\"index\":"); snprintf(number, sizeof(number), "%" PRId64, parse_state->index); sb_append(sb, number);
  sb_append(sb, ",\"kind\":\"ParseState\",\"nodes\":"); semantic_sequence_json_sb(sb, parse_state->nodes); sb_append_char(sb, '}');
}

static void semantic_symbol_json_sb(StringBuilder *sb, const SymbolValue *symbol) {
  char number[64];
  sb_append(sb, "{\"kind\":\"Symbol\",\"path\":"); json_escape_sb(sb, symbol->path);
  sb_append(sb, ",\"slot\":"); snprintf(number, sizeof(number), "%" PRId64, symbol->slot); sb_append(sb, number);
  sb_append(sb, ",\"span\":"); semantic_span_json_sb(sb, &symbol->span);
  sb_append(sb, ",\"valueType\":"); json_escape_sb(sb, symbol->value_type); sb_append_char(sb, '}');
}

static void semantic_facet_json_sb(StringBuilder *sb, const SemanticNode *semantic) {
  char number[64];
  sb_append(sb, "{\"kind\":\"SemanticFacet\",\"literalKind\":"); json_escape_sb(sb, semantic->literal_kind);
  sb_append(sb, ",\"literalText\":"); json_escape_sb(sb, semantic->literal_text);
  sb_append(sb, ",\"path\":"); json_escape_sb(sb, semantic->path);
  sb_append(sb, ",\"slot\":"); snprintf(number, sizeof(number), "%" PRId64, semantic->slot); sb_append(sb, number);
  sb_append(sb, ",\"span\":"); semantic_span_json_sb(sb, &semantic->span);
  sb_append(sb, ",\"valueType\":"); json_escape_sb(sb, semantic->value_type); sb_append_char(sb, '}');
}

static void semantic_ir_json_sb(StringBuilder *sb, const IrNode *ir) {
  char number[64];
  sb_append(sb, "{\"kind\":\"IRStore\",\"literalKind\":"); json_escape_sb(sb, ir->literal_kind);
  sb_append(sb, ",\"literalText\":"); json_escape_sb(sb, ir->literal_text);
  sb_append(sb, ",\"op\":"); json_escape_sb(sb, ir->op);
  sb_append(sb, ",\"path\":"); json_escape_sb(sb, ir->path);
  sb_append(sb, ",\"slot\":"); snprintf(number, sizeof(number), "%" PRId64, ir->slot); sb_append(sb, number);
  sb_append(sb, ",\"span\":"); semantic_span_json_sb(sb, &ir->span);
  sb_append(sb, ",\"valueType\":"); json_escape_sb(sb, ir->value_type); sb_append_char(sb, '}');
}

static void semantic_typed_record_json_sb(StringBuilder *sb, const TypedRecord *record) {
  SemanticFieldRef *fields = (SemanticFieldRef *)malloc(sizeof(SemanticFieldRef) * (record->field_count ? record->field_count : 1));
  if (!fields) { fprintf(stderr, "out of memory\n"); exit(2); }
  for (size_t i = 0; i < record->field_count; i++) fields[i] = (SemanticFieldRef){ record->field_names[i], i };
  qsort(fields, record->field_count, sizeof(SemanticFieldRef), compare_semantic_field_refs);
  sb_append_char(sb, '{');
  for (size_t i = 0; i < record->field_count; i++) {
    if (i) sb_append_char(sb, ',');
    json_escape_sb(sb, fields[i].name);
    sb_append_char(sb, ':');
    semantic_value_json_sb(sb, &record->field_values[fields[i].index]);
  }
  sb_append_char(sb, '}');
  free(fields);
}

static void semantic_value_json_sb(StringBuilder *sb, const Value *value) {
  switch (value->type) {
    case VALUE_SPAN:
      semantic_span_json_sb(sb, value->span);
      break;
    case VALUE_TOKEN:
      semantic_token_json_sb(sb, value->token);
      break;
    case VALUE_AST:
      semantic_ast_json_sb(sb, value->ast);
      break;
    case VALUE_PARSE_STATE:
      semantic_parse_state_json_sb(sb, value->parse_state);
      break;
    case VALUE_SYMBOL:
      semantic_symbol_json_sb(sb, value->symbol);
      break;
    case VALUE_SEMANTIC:
      semantic_facet_json_sb(sb, value->semantic);
      break;
    case VALUE_IR:
      semantic_ir_json_sb(sb, value->ir);
      break;
    case VALUE_SEQUENCE:
      semantic_sequence_json_sb(sb, value->sequence);
      break;
    case VALUE_TYPED_RECORD:
      semantic_typed_record_json_sb(sb, value->typed_record);
      break;
    case VALUE_TYPED_UNION:
      sb_append(sb, "{\"payload\":[");
      for (size_t i = 0; i < value->typed_union->payload_count; i++) {
        if (i) sb_append_char(sb, ',');
        semantic_value_json_sb(sb, &value->typed_union->payload[i]);
      }
      sb_append(sb, "],\"variant\":");
      json_escape_sb(sb, value->typed_union->variant);
      sb_append_char(sb, '}');
      break;
    case VALUE_TYPED_REF: {
      char number[64];
      sb_append(sb, "{\"__rclRefKind\":");
      json_escape_sb(sb, value->typed_ref->target_kind);
      sb_append(sb, ",\"__rclRefObjectId\":");
      snprintf(number, sizeof(number), "%" PRIu64, value->typed_ref->object_id);
      sb_append(sb, number);
      sb_append(sb, ",\"__rclRefType\":");
      json_escape_sb(sb, value->typed_ref->type_name);
      sb_append_char(sb, '}');
      break;
    }
    default:
      value_json_sb(sb, value);
      break;
  }
}

static int compare_entry_ptrs(const void *left, const void *right) {
  const StateEntry *const *a = (const StateEntry *const *)left;
  const StateEntry *const *b = (const StateEntry *const *)right;
  return strcmp((*a)->key, (*b)->key);
}

static void state_json_sb(StringBuilder *sb, const State *state) {
  StateEntry **sorted = NULL;
  if (state->count) {
    sorted = (StateEntry **)malloc(sizeof(StateEntry *) * state->count);
    if (!sorted) { fprintf(stderr, "out of memory\n"); exit(2); }
    for (size_t i = 0; i < state->count; i++) sorted[i] = (StateEntry *)&state->entries[i];
    qsort(sorted, state->count, sizeof(StateEntry *), compare_entry_ptrs);
  }
  sb_append_char(sb, '{');
  for (size_t i = 0; i < state->count; i++) {
    if (i) sb_append_char(sb, ',');
    json_escape_sb(sb, sorted[i]->key);
    sb_append_char(sb, ':');
    value_json_sb(sb, &sorted[i]->value);
  }
  sb_append_char(sb, '}');
  free(sorted);
}

static void semantic_state_json_sb(StringBuilder *sb, const State *state) {
  StateEntry **sorted = NULL;
  if (state->count) {
    sorted = (StateEntry **)malloc(sizeof(StateEntry *) * state->count);
    if (!sorted) { fprintf(stderr, "out of memory\n"); exit(2); }
    for (size_t i = 0; i < state->count; i++) sorted[i] = (StateEntry *)&state->entries[i];
    qsort(sorted, state->count, sizeof(StateEntry *), compare_entry_ptrs);
  }
  sb_append_char(sb, '{');
  for (size_t i = 0; i < state->count; i++) {
    if (i) sb_append_char(sb, ',');
    json_escape_sb(sb, sorted[i]->key);
    sb_append_char(sb, ':');
    semantic_value_json_sb(sb, &sorted[i]->value);
  }
  sb_append_char(sb, '}');
  free(sorted);
}

static int rcl_sha256(const unsigned char *data, size_t length, unsigned char digest[RCL_SHA256_DIGEST_LENGTH]) {
#ifdef _WIN32
  BCRYPT_ALG_HANDLE algorithm = NULL;
  BCRYPT_HASH_HANDLE hash = NULL;
  DWORD bytes_written = 0;
  DWORD object_length = 0;
  unsigned char *hash_object = NULL;
  int ok = 0;

  if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, NULL, 0) != 0) goto cleanup;
  if (BCryptGetProperty(algorithm, BCRYPT_OBJECT_LENGTH, (PUCHAR)&object_length, sizeof(object_length), &bytes_written, 0) != 0) goto cleanup;
  hash_object = (unsigned char *)malloc(object_length);
  if (!hash_object) goto cleanup;
  if (BCryptCreateHash(algorithm, &hash, hash_object, object_length, NULL, 0, 0) != 0) goto cleanup;
  for (size_t offset = 0; offset < length;) {
    size_t remaining = length - offset;
    ULONG chunk = remaining > 0xffffffffu ? 0xffffffffu : (ULONG)remaining;
    if (BCryptHashData(hash, (PUCHAR)(data + offset), chunk, 0) != 0) goto cleanup;
    offset += chunk;
  }
  if (BCryptFinishHash(hash, digest, RCL_SHA256_DIGEST_LENGTH, 0) != 0) goto cleanup;
  ok = 1;

cleanup:
  if (hash) BCryptDestroyHash(hash);
  if (algorithm) BCryptCloseAlgorithmProvider(algorithm, 0);
  free(hash_object);
  return ok;
#else
  SHA256(data, length, digest);
  return 1;
#endif
}

static void state_root(const State *state, char output[65]) {
  StringBuilder sb;
  sb_init(&sb);
  semantic_state_json_sb(&sb, state);
  unsigned char digest[RCL_SHA256_DIGEST_LENGTH];
  if (!rcl_sha256((const unsigned char *)sb.data, sb.length, digest)) {
    fprintf(stderr, "{\"status\":\"error\",\"code\":\"RCL_NATIVE_SHA256\",\"message\":\"SHA256 calculation failed\"}\n");
    exit(2);
  }
  for (int i = 0; i < RCL_SHA256_DIGEST_LENGTH; i++) snprintf(output + i * 2, 3, "%02x", digest[i]);
  output[64] = '\0';
  free(sb.data);
}

static int read_exact(FILE *file, void *target, size_t length) { return fread(target, 1, length, file) == length; }

static uint16_t read_u16_le(FILE *file, int *ok) {
  unsigned char bytes[2];
  if (!read_exact(file, bytes, 2)) { *ok = 0; return 0; }
  return (uint16_t)(bytes[0] | ((uint16_t)bytes[1] << 8));
}

static uint32_t read_u32_le(FILE *file, int *ok) {
  unsigned char bytes[4];
  if (!read_exact(file, bytes, 4)) { *ok = 0; return 0; }
  return (uint32_t)bytes[0] | ((uint32_t)bytes[1] << 8) | ((uint32_t)bytes[2] << 16) | ((uint32_t)bytes[3] << 24);
}

static int32_t read_i32_le(FILE *file, int *ok) { return (int32_t)read_u32_le(file, ok); }

static double read_f64_le(FILE *file, int *ok) {
  unsigned char bytes[8];
  if (!read_exact(file, bytes, 8)) { *ok = 0; return 0; }
  uint64_t bits = 0;
  for (int i = 0; i < 8; i++) bits |= ((uint64_t)bytes[i]) << (8 * i);
  double value;
  memcpy(&value, &bits, sizeof(value));
  return value;
}

static uint16_t memory_u16_le(const uint8_t *bytes, size_t length, size_t offset, int *ok) {
  if (offset > length || length - offset < 2) { *ok = 0; return 0; }
  return (uint16_t)(bytes[offset] | ((uint16_t)bytes[offset + 1] << 8));
}

static uint32_t memory_u32_le(const uint8_t *bytes, size_t length, size_t offset, int *ok) {
  if (offset > length || length - offset < 4) { *ok = 0; return 0; }
  return (uint32_t)bytes[offset]
    | ((uint32_t)bytes[offset + 1] << 8)
    | ((uint32_t)bytes[offset + 2] << 16)
    | ((uint32_t)bytes[offset + 3] << 24);
}

static int32_t memory_i32_le(const uint8_t *bytes, size_t length, size_t offset, int *ok) {
  return (int32_t)memory_u32_le(bytes, length, offset, ok);
}

static int validation_fail(VmError *error, const char *code, const char *message) {
  error->code = code;
  snprintf(error->message, sizeof(error->message), "%s", message);
  return 0;
}

static int pool_index_valid(int32_t index, uint32_t count) {
  return index >= 0 && (uint32_t)index < count;
}

static int validate_bytecode_bytes(const uint8_t *bytes, size_t length, VmError *error) {
  memset(error, 0, sizeof(*error));
  if (!bytes || length < 36) return validation_fail(error, "RCL_NATIVE_TRUNCATED", "RBC is shorter than its 36-byte header");
  if (length > MAX_BYTECODE_BYTES) return validation_fail(error, "RCL_NATIVE_BYTECODE_LIMIT", "RBC exceeds the 256 MiB byte limit");
  if (memcmp(bytes, "RCLB", 4) != 0) return validation_fail(error, "RCL_NATIVE_BAD_MAGIC", "Invalid RCL bytecode magic");

  int ok = 1;
  uint16_t major = memory_u16_le(bytes, length, 4, &ok);
  uint16_t minor = memory_u16_le(bytes, length, 6, &ok);
  uint32_t program_name_index = memory_u32_le(bytes, length, 12, &ok);
  uint32_t source_root_index = memory_u32_le(bytes, length, 16, &ok);
  uint32_t string_count = memory_u32_le(bytes, length, 20, &ok);
  uint32_t number_count = memory_u32_le(bytes, length, 24, &ok);
  uint32_t instruction_count = memory_u32_le(bytes, length, 28, &ok);
  uint32_t reserved = memory_u32_le(bytes, length, 32, &ok);
  if (!ok) return validation_fail(error, "RCL_NATIVE_TRUNCATED", "RBC header is truncated");
  if (major != 1 || minor < 1 || minor > 2) {
    char message[128];
    snprintf(message, sizeof(message), "Unsupported RBC version %u.%u; native VM supports 1.1 and 1.2", major, minor);
    return validation_fail(error, "RCL_NATIVE_BYTECODE_VERSION", message);
  }
  if (reserved != 0) return validation_fail(error, "RCL_NATIVE_BAD_HEADER", "RBC reserved header field must be zero");
  if (string_count > 100000 || number_count > 100000 || instruction_count > MAX_INSTRUCTIONS) {
    return validation_fail(error, "RCL_NATIVE_BAD_HEADER", "RBC pool or instruction count exceeds native limits");
  }
  if (program_name_index >= string_count || source_root_index >= string_count) {
    return validation_fail(error, "RCL_NATIVE_POOL_RANGE", "RBC program or source-root string index is out of range");
  }

  size_t offset = 36;
  for (uint32_t i = 0; i < string_count; i++) {
    uint32_t string_length = memory_u32_le(bytes, length, offset, &ok);
    if (!ok) return validation_fail(error, "RCL_NATIVE_TRUNCATED", "RBC string length is truncated");
    offset += 4;
    if (string_length > 16u * 1024u * 1024u) return validation_fail(error, "RCL_NATIVE_STRING_LIMIT", "RBC string exceeds the 16 MiB limit");
    if (offset > length || length - offset < string_length) return validation_fail(error, "RCL_NATIVE_TRUNCATED", "RBC string data is truncated");
    offset += string_length;
  }
  if (number_count > (length - offset) / 8) return validation_fail(error, "RCL_NATIVE_TRUNCATED", "RBC number pool is truncated");
  offset += (size_t)number_count * 8;
  if (instruction_count > (length - offset) / 16) return validation_fail(error, "RCL_NATIVE_TRUNCATED", "RBC instruction stream is truncated");
  size_t instruction_offset = offset;
  offset += (size_t)instruction_count * 16;
  if (offset != length) return validation_fail(error, "RCL_NATIVE_LENGTH_MISMATCH", "RBC declared sections do not consume the complete file");

  for (uint32_t i = 0; i < instruction_count; i++) {
    size_t at = instruction_offset + (size_t)i * 16;
    uint8_t op = bytes[at];
    uint8_t instruction_flags = bytes[at + 1];
    int32_t a = memory_i32_le(bytes, length, at + 4, &ok);
    int32_t b = memory_i32_le(bytes, length, at + 8, &ok);
    int32_t c = memory_i32_le(bytes, length, at + 12, &ok);
    if (!ok) return validation_fail(error, "RCL_NATIVE_TRUNCATED", "RBC instruction operand is truncated");
    if (op > OP_MOD) return validation_fail(error, "RCL_NATIVE_OPCODE_UNKNOWN", "RBC contains an unknown opcode");
    if (minor == 1 && (op == OP_MOD || (op == OP_CALL_PROVIDER && (instruction_flags & 1)))) {
      return validation_fail(error, "RCL_NATIVE_BYTECODE_FEATURE_VERSION", "RBC 1.2 feature is encoded under a 1.1 header");
    }
    if (op == OP_CALL_PROVIDER && (instruction_flags & ~1u)) return validation_fail(error, "RCL_NATIVE_BYTECODE_FLAGS", "CALL_PROVIDER contains unknown flags");

    int valid = 1;
    switch (op) {
      case OP_PUSH_NUMBER: valid = pool_index_valid(a, number_count); break;
      case OP_PUSH_STRING: case OP_LOAD_STATE: case OP_STORE_STATE: case OP_STAGE_STORE:
      case OP_RECORD_WITNESS: case OP_GET_TYPED_FIELD: case OP_IS_UNION_VARIANT:
        valid = pool_index_valid(a, string_count); break;
      case OP_GRANT_WARRANT: case OP_CHECK_WARRANT:
        valid = pool_index_valid(a, string_count) && pool_index_valid(b, string_count) && pool_index_valid(c, string_count); break;
      case OP_BEGIN_TX:
        valid = pool_index_valid(b, string_count) && pool_index_valid(c, string_count); break;
      case OP_CALL_PROVIDER:
        valid = (instruction_flags & 1) || (pool_index_valid(a, string_count) && pool_index_valid(b, string_count) && pool_index_valid(c, string_count)); break;
      case OP_MAKE_TYPED_RECORD: case OP_MAKE_TYPED_UNION:
        valid = pool_index_valid(a, string_count) && pool_index_valid(b, string_count) && c >= 0; break;
      case OP_JUMP: case OP_JUMP_IF_FALSE:
        valid = a >= 0 && (uint32_t)a < instruction_count; break;
      case OP_CALL:
        valid = a >= 0 && (uint32_t)a < instruction_count && b >= 0; break;
      case OP_CALL_BUILTIN:
        valid = a >= BUILTIN_CONTAINS && a <= BUILTIN_SHA256_TEXT && b >= 0 && b <= 16; break;
      case OP_PUSH_BOOL:
        valid = a == 0 || a == 1; break;
      default: break;
    }
    if (!valid) {
      char message[160];
      snprintf(message, sizeof(message), "RBC instruction %u has an invalid operand", i);
      return validation_fail(error, "RCL_NATIVE_INSTRUCTION_INVALID", message);
    }
  }
  return 1;
}

int rclvm_validate_bytecode(const uint8_t *bytes, size_t length, char *error, size_t error_capacity) {
  VmError validation_error;
  int valid = validate_bytecode_bytes(bytes, length, &validation_error);
  if (!valid && error && error_capacity) snprintf(error, error_capacity, "%s: %s", validation_error.code, validation_error.message);
  return valid;
}

static int validate_bytecode_file(const char *path, VmError *error) {
  FILE *file = fopen(path, "rb");
  if (!file) { error->code = "RCL_NATIVE_OPEN_FAILED"; snprintf(error->message, sizeof(error->message), "Cannot open bytecode '%s': %s", path, strerror(errno)); return 0; }
  if (fseek(file, 0, SEEK_END) != 0) { fclose(file); return validation_fail(error, "RCL_NATIVE_OPEN_FAILED", "Cannot seek RBC file"); }
  long file_length = ftell(file);
  if (file_length < 0 || (unsigned long)file_length > MAX_BYTECODE_BYTES || fseek(file, 0, SEEK_SET) != 0) {
    fclose(file);
    return validation_fail(error, "RCL_NATIVE_BYTECODE_LIMIT", "RBC file size is invalid or exceeds 256 MiB");
  }
  size_t length = (size_t)file_length;
  uint8_t *bytes = (uint8_t *)malloc(length ? length : 1);
  if (!bytes) { fclose(file); return validation_fail(error, "RCL_NATIVE_OOM", "Unable to allocate RBC validation buffer"); }
  size_t read = fread(bytes, 1, length, file);
  int read_ok = read == length && !ferror(file);
  fclose(file);
  if (!read_ok) { free(bytes); return validation_fail(error, "RCL_NATIVE_TRUNCATED", "Cannot read complete RBC file"); }
  int valid = validate_bytecode_bytes(bytes, length, error);
  free(bytes);
  return valid;
}

static int load_program(const char *path, Program *program, VmError *error) {
  memset(program, 0, sizeof(*program));
  if (!validate_bytecode_file(path, error)) return 0;
  FILE *file = fopen(path, "rb");
  if (!file) { error->code = "RCL_NATIVE_OPEN_FAILED"; snprintf(error->message, sizeof(error->message), "Cannot open bytecode '%s': %s", path, strerror(errno)); return 0; }
  char magic[4];
  int ok = 1;
  if (!read_exact(file, magic, 4) || memcmp(magic, "RCLB", 4) != 0) { error->code = "RCL_NATIVE_BAD_MAGIC"; snprintf(error->message, sizeof(error->message), "Invalid RCL bytecode magic"); fclose(file); return 0; }
  program->major = read_u16_le(file, &ok);
  program->minor = read_u16_le(file, &ok);
  program->flags = read_u32_le(file, &ok);
  program->program_name_index = read_u32_le(file, &ok);
  program->source_root_index = read_u32_le(file, &ok);
  program->string_count = read_u32_le(file, &ok);
  program->number_count = read_u32_le(file, &ok);
  program->instruction_count = read_u32_le(file, &ok);
  (void)read_u32_le(file, &ok);
  if (!ok || program->major != 1 || program->minor < 1 || program->minor > 2 || program->string_count > 100000 || program->number_count > 100000 || program->instruction_count > MAX_INSTRUCTIONS) {
    error->code = "RCL_NATIVE_BAD_HEADER"; snprintf(error->message, sizeof(error->message), "Unsupported or corrupt RCL bytecode header"); fclose(file); return 0;
  }
  program->strings = (char **)calloc(program->string_count ? program->string_count : 1, sizeof(char *));
  program->numbers = (double *)calloc(program->number_count ? program->number_count : 1, sizeof(double));
  program->instructions = (Instruction *)calloc(program->instruction_count ? program->instruction_count : 1, sizeof(Instruction));
  if (!program->strings || !program->numbers || !program->instructions) { error->code = "RCL_NATIVE_OOM"; snprintf(error->message, sizeof(error->message), "Out of memory while loading bytecode"); fclose(file); return 0; }
  for (uint32_t i = 0; i < program->string_count; i++) {
    uint32_t length = read_u32_le(file, &ok);
    if (!ok || length > 16 * 1024 * 1024) { ok = 0; break; }
    char *text = (char *)malloc((size_t)length + 1);
    if (!text || !read_exact(file, text, length)) { free(text); ok = 0; break; }
    text[length] = '\0';
    program->strings[i] = shared_string_create(text);
    free(text);
  }
  for (uint32_t i = 0; ok && i < program->number_count; i++) program->numbers[i] = read_f64_le(file, &ok);
  for (uint32_t i = 0; ok && i < program->instruction_count; i++) {
    unsigned char prefix[4];
    if (!read_exact(file, prefix, 4)) { ok = 0; break; }
    program->instructions[i].op = prefix[0];
    program->instructions[i].flags = prefix[1];
    program->instructions[i].a = read_i32_le(file, &ok);
    program->instructions[i].b = read_i32_le(file, &ok);
    program->instructions[i].c = read_i32_le(file, &ok);
  }
  fclose(file);
  if (!ok || program->program_name_index >= program->string_count || program->source_root_index >= program->string_count) {
    error->code = "RCL_NATIVE_TRUNCATED"; snprintf(error->message, sizeof(error->message), "RCL bytecode is truncated or contains invalid pool references"); return 0;
  }
  return 1;
}

static void free_program(Program *program) {
  for (uint32_t i = 0; i < program->string_count; i++) shared_string_release(program->strings[i]);
  free(program->strings);
  free(program->numbers);
  free(program->instructions);
  memset(program, 0, sizeof(*program));
}

static const char *pool_string(VM *vm, int32_t index) {
  if (index < 0 || (uint32_t)index >= vm->program.string_count) { vm_fail(vm, "RCL_NATIVE_POOL_RANGE", "String pool index out of range"); return ""; }
  return vm->program.strings[index];
}

static double pool_number(VM *vm, int32_t index) {
  if (index < 0 || (uint32_t)index >= vm->program.number_count) { vm_fail(vm, "RCL_NATIVE_POOL_RANGE", "Number pool index out of range"); return 0; }
  return vm->program.numbers[index];
}

static char **split_field_names(VM *vm, const char *text, size_t expected_count) {
  char **fields = (char **)calloc(expected_count ? expected_count : 1, sizeof(char *));
  if (!fields) { fprintf(stderr, "out of memory\n"); exit(2); }
  if (expected_count == 0) return fields;
  size_t index = 0;
  const char *cursor = text ? text : "";
  while (index < expected_count) {
    const char *end = strchr(cursor, '\n');
    size_t length = end ? (size_t)(end - cursor) : strlen(cursor);
    fields[index] = (char *)calloc(length + 1, sizeof(char));
    if (!fields[index]) { fprintf(stderr, "out of memory\n"); exit(2); }
    memcpy(fields[index], cursor, length);
    fields[index][length] = '\0';
    index++;
    if (!end) {
      cursor += length;
      break;
    }
    cursor = end + 1;
  }
  if (index != expected_count || (cursor && cursor[0] != '\0')) {
    for (size_t i = 0; i < expected_count; i++) free(fields[i]);
    free(fields);
    vm_fail(vm, "RCL_NATIVE_TYPED_FIELD_LAYOUT", "Typed record field layout does not match opcode arity");
    return NULL;
  }
  return fields;
}

static void free_string_array(char **items, size_t count) {
  if (!items) return;
  for (size_t i = 0; i < count; i++) free(items[i]);
  free(items);
}

static char *value_to_text(const Value *value) {
  char buffer[96];
  switch (value->type) {
    case VALUE_STRING: return xstrdup(value->string);
    case VALUE_NUMBER: snprintf(buffer, sizeof(buffer), "%.15g", value->number); return xstrdup(buffer);
    case VALUE_BOOL: return xstrdup(value->boolean ? "true" : "false");
    default: { StringBuilder sb; sb_init(&sb); value_json_sb(&sb, value); return sb.data; }
  }
}

static int span_equal(const Span *a, const Span *b) { return a->offset == b->offset && a->line == b->line && a->column == b->column && a->length == b->length; }

static int values_equal(const Value *left, const Value *right) {
  if (left->type != right->type) return 0;
  switch (left->type) {
    case VALUE_NUMBER: return left->number == right->number;
    case VALUE_BOOL: return left->boolean == right->boolean;
    case VALUE_STRING: return strcmp(left->string, right->string) == 0;
    case VALUE_SPAN: return span_equal(left->span, right->span);
    case VALUE_TOKEN: return strcmp(left->token->token_type, right->token->token_type) == 0 && strcmp(left->token->text, right->token->text) == 0 && span_equal(&left->token->span, &right->token->span);
    case VALUE_AST: return strcmp(left->ast->path, right->ast->path) == 0 && strcmp(left->ast->value_type, right->ast->value_type) == 0 && strcmp(left->ast->literal_kind, right->ast->literal_kind) == 0 && strcmp(left->ast->literal_text, right->ast->literal_text) == 0 && span_equal(&left->ast->span, &right->ast->span);
    case VALUE_SEQUENCE:
      if (left->sequence->count != right->sequence->count) return 0;
      sequence_materialize(left->sequence);
      sequence_materialize(right->sequence);
      for (size_t i = 0; i < left->sequence->count; i++) if (!values_equal(&left->sequence->items[i], &right->sequence->items[i])) return 0;
      return 1;
    case VALUE_PARSE_STATE: {
      Value a = value_null(), b = value_null(); a.type = VALUE_SEQUENCE; a.sequence = left->parse_state->nodes; b.type = VALUE_SEQUENCE; b.sequence = right->parse_state->nodes;
      return left->parse_state->index == right->parse_state->index && values_equal(&a, &b);
    }
    case VALUE_SYMBOL: return strcmp(left->symbol->path, right->symbol->path) == 0 && strcmp(left->symbol->value_type, right->symbol->value_type) == 0 && left->symbol->slot == right->symbol->slot && span_equal(&left->symbol->span, &right->symbol->span);
    case VALUE_SEMANTIC: return strcmp(left->semantic->path, right->semantic->path) == 0 && strcmp(left->semantic->value_type, right->semantic->value_type) == 0 && strcmp(left->semantic->literal_kind, right->semantic->literal_kind) == 0 && strcmp(left->semantic->literal_text, right->semantic->literal_text) == 0 && left->semantic->slot == right->semantic->slot && span_equal(&left->semantic->span, &right->semantic->span);
    case VALUE_IR: return strcmp(left->ir->op, right->ir->op) == 0 && strcmp(left->ir->path, right->ir->path) == 0 && strcmp(left->ir->value_type, right->ir->value_type) == 0 && strcmp(left->ir->literal_kind, right->ir->literal_kind) == 0 && strcmp(left->ir->literal_text, right->ir->literal_text) == 0 && left->ir->slot == right->ir->slot && span_equal(&left->ir->span, &right->ir->span);
    case VALUE_TYPED_RECORD:
      if (strcmp(left->typed_record->type_name, right->typed_record->type_name) != 0 || left->typed_record->field_count != right->typed_record->field_count) return 0;
      for (size_t i = 0; i < left->typed_record->field_count; i++) {
        if (strcmp(left->typed_record->field_names[i], right->typed_record->field_names[i]) != 0) return 0;
        if (!values_equal(&left->typed_record->field_values[i], &right->typed_record->field_values[i])) return 0;
      }
      return 1;
    case VALUE_TYPED_UNION:
      if (strcmp(left->typed_union->type_name, right->typed_union->type_name) != 0 || strcmp(left->typed_union->variant, right->typed_union->variant) != 0 || left->typed_union->payload_count != right->typed_union->payload_count) return 0;
      for (size_t i = 0; i < left->typed_union->payload_count; i++) if (!values_equal(&left->typed_union->payload[i], &right->typed_union->payload[i])) return 0;
      return 1;
    case VALUE_TYPED_REF:
      return left->typed_ref->object_id == right->typed_ref->object_id && strcmp(left->typed_ref->type_name, right->typed_ref->type_name) == 0 && strcmp(left->typed_ref->target_kind, right->typed_ref->target_kind) == 0;
    default: return 1;
  }
}

static int compare_values(VM *vm, const Value *left, const Value *right, int *comparison) {
  if (left->type == VALUE_NUMBER && right->type == VALUE_NUMBER) {
    *comparison = left->number < right->number ? -1 : left->number > right->number ? 1 : 0;
    return 1;
  }
  if (left->type == VALUE_STRING && right->type == VALUE_STRING) { *comparison = strcmp(left->string, right->string); return 1; }
  vm_fail(vm, "RCL_NATIVE_COMPARE_TYPE", "Comparison requires matching Number or Text values");
  return 0;
}

static char *ascii_case(const char *source, int upper) {
  char *result = xstrdup(source);
  for (char *p = result; *p; p++) *p = (char)(upper ? toupper((unsigned char)*p) : tolower((unsigned char)*p));
  return result;
}

static char *trim_copy(const char *source) {
  const char *start = source;
  while (*start && isspace((unsigned char)*start)) start++;
  const char *end = source + strlen(source);
  while (end > start && isspace((unsigned char)end[-1])) end--;
  size_t length = (size_t)(end - start);
  char *result = (char *)malloc(length + 1);
  if (!result) { fprintf(stderr, "out of memory\n"); exit(2); }
  memcpy(result, start, length); result[length] = '\0';
  return result;
}

static size_t utf8_decode_at(const char *text, size_t byte_length, size_t offset, uint32_t *codepoint, int *valid) {
  const unsigned char *bytes = (const unsigned char *)text;
  *valid = 1;
  if (offset >= byte_length) { *codepoint = 0; return 0; }
  unsigned char first = bytes[offset];
  if (first < 0x80) { *codepoint = first; return 1; }
  size_t width;
  uint32_t value;
  uint32_t minimum;
  if (first >= 0xC2 && first <= 0xDF) { width = 2; value = first & 0x1F; minimum = 0x80; }
  else if (first >= 0xE0 && first <= 0xEF) { width = 3; value = first & 0x0F; minimum = 0x800; }
  else if (first >= 0xF0 && first <= 0xF4) { width = 4; value = first & 0x07; minimum = 0x10000; }
  else { *codepoint = first; *valid = 0; return 1; }
  if (width > byte_length - offset) { *codepoint = first; *valid = 0; return 1; }
  for (size_t i = 1; i < width; i++) {
    unsigned char continuation = bytes[offset + i];
    if ((continuation & 0xC0) != 0x80) { *codepoint = first; *valid = 0; return 1; }
    value = (value << 6) | (continuation & 0x3F);
  }
  if (value < minimum || value > 0x10FFFF || (value >= 0xD800 && value <= 0xDFFF)) {
    *codepoint = first; *valid = 0; return 1;
  }
  *codepoint = value;
  return width;
}

static void shared_string_ensure_character_index(SharedString *shared) {
  if (shared->character_count != SIZE_MAX) return;
  size_t length = shared->byte_length;
  size_t offset = 0;
  while (offset < length && (unsigned char)shared->data[offset] < 0x80) offset++;
  if (offset == length) {
    shared->character_count = length;
    return;
  }

  size_t count = offset;
  while (offset < length) {
    uint32_t codepoint;
    int valid;
    size_t width = (unsigned char)shared->data[offset] < 0x80
      ? 1
      : utf8_decode_at(shared->data, length, offset, &codepoint, &valid);
    offset += width ? width : 1;
    count++;
  }
  shared->character_count = count;
  if (count == length) return;

  shared->character_offsets = (size_t *)malloc((count + 1) * sizeof(size_t));
  if (!shared->character_offsets) { fprintf(stderr, "out of memory\n"); exit(2); }
  offset = 0;
  for (size_t index = 0; index < count; index++) {
    shared->character_offsets[index] = offset;
    uint32_t codepoint;
    int valid;
    size_t width = (unsigned char)shared->data[offset] < 0x80
      ? 1
      : utf8_decode_at(shared->data, length, offset, &codepoint, &valid);
    offset += width ? width : 1;
  }
  shared->character_offsets[count] = length;
}

static size_t utf8_length(const char *text) {
  SharedString *shared = shared_string_header(text);
  shared_string_ensure_character_index(shared);
  return shared->character_count;
}

static size_t utf8_byte_offset(const char *text, size_t character_index) {
  SharedString *shared = shared_string_header(text);
  shared_string_ensure_character_index(shared);
  if (character_index > shared->character_count) character_index = shared->character_count;
  return shared->character_offsets ? shared->character_offsets[character_index] : character_index;
}

static Value value_byte_sequence(const unsigned char *bytes, size_t length) {
  Value result = value_null();
  result.type = VALUE_SEQUENCE;
  result.sequence = sequence_create();
  if (length == 0) return result;
  result.sequence->items = (Value *)calloc(length, sizeof(Value));
  if (!result.sequence->items) { free(result.sequence); return value_null(); }
  result.sequence->count = length;
  for (size_t i = 0; i < length; i++) result.sequence->items[i] = value_number((double)bytes[i]);
  return result;
}

static int number_is_integer_in_range(double value, double minimum, double maximum) {
  return isfinite(value) && floor(value) == value && value >= minimum && value <= maximum;
}

static int hex_nibble(char ch) {
  if (ch >= '0' && ch <= '9') return ch - '0';
  if (ch >= 'a' && ch <= 'f') return ch - 'a' + 10;
  if (ch >= 'A' && ch <= 'F') return ch - 'A' + 10;
  return -1;
}

static int execute_builtin(VM *vm, int builtin, int argc) {
  if (argc < 0 || argc > 16 || vm->stack_count < (size_t)argc) { vm_fail(vm, "RCL_NATIVE_BUILTIN_ARITY", "Invalid builtin arity"); return 0; }
  Value args[16];
  for (int i = argc - 1; i >= 0; i--) args[i] = stack_pop(vm);
  Value result = value_null();
  if (vm->error.code) goto done;

  switch (builtin) {
    case BUILTIN_CONTAINS:
    case BUILTIN_STARTS_WITH:
    case BUILTIN_ENDS_WITH: {
      if (argc != 2 || args[0].type != VALUE_STRING || args[1].type != VALUE_STRING) { vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "Text predicate expects two Text values"); break; }
      const char *left = args[0].string, *right = args[1].string;
      size_t left_length = shared_string_header(left)->byte_length;
      size_t right_length = shared_string_header(right)->byte_length;
      int matched = 0;
      if (builtin == BUILTIN_CONTAINS) matched = strstr(left, right) != NULL;
      else if (builtin == BUILTIN_STARTS_WITH) matched = left_length >= right_length && memcmp(left, right, right_length) == 0;
      else matched = left_length >= right_length && memcmp(left + left_length - right_length, right, right_length) == 0;
      result = value_bool(matched);
      break;
    }
    case BUILTIN_LENGTH:
      if (argc != 1 || (args[0].type != VALUE_STRING && args[0].type != VALUE_SEQUENCE)) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "length expects Text or Sequence");
      else result = value_number(args[0].type == VALUE_STRING ? (double)utf8_length(args[0].string) : (double)args[0].sequence->count);
      break;
    case BUILTIN_LOWER_TEXT:
    case BUILTIN_UPPER_TEXT:
      if (argc != 1 || args[0].type != VALUE_STRING) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "text case conversion expects Text");
      else { char *text = ascii_case(args[0].string, builtin == BUILTIN_UPPER_TEXT); result = value_string(text); free(text); }
      break;
    case BUILTIN_TEXT:
      if (argc != 1) vm_fail(vm, "RCL_NATIVE_BUILTIN_ARITY", "text expects one value");
      else { char *text = value_to_text(&args[0]); result = value_string(text); free(text); }
      break;
    case BUILTIN_TRIM:
      if (argc != 1 || args[0].type != VALUE_STRING) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "trim expects Text");
      else { char *text = trim_copy(args[0].string); result = value_string(text); free(text); }
      break;
    case BUILTIN_SPLIT_BEFORE:
    case BUILTIN_SPLIT_AFTER: {
      if (argc != 2 || args[0].type != VALUE_STRING || args[1].type != VALUE_STRING) { vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "split operation expects two Text values"); break; }
      char *position = strstr(args[0].string, args[1].string);
      if (!position) result = builtin == BUILTIN_SPLIT_BEFORE ? value_clone(&args[0]) : value_string("");
      else if (builtin == BUILTIN_SPLIT_BEFORE) {
        size_t length = (size_t)(position - args[0].string);
        result = value_string_n(args[0].string, length);
      } else {
        size_t marker_length = shared_string_header(args[1].string)->byte_length;
        size_t source_length = shared_string_header(args[0].string)->byte_length;
        size_t start = (size_t)(position - args[0].string) + marker_length;
        result = value_string_n(args[0].string + start, source_length - start);
      }
      break;
    }
    case BUILTIN_NUMBER_FROM_TEXT: {
      if (argc != 1 || args[0].type != VALUE_STRING) { vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "number_from_text expects Text"); break; }
      char *trimmed = trim_copy(args[0].string), *end = NULL;
      errno = 0;
      double number = strtod(trimmed, &end);
      while (end && *end && isspace((unsigned char)*end)) end++;
      if (errno || !end || *end != '\0' || !isfinite(number)) vm_fail(vm, "RCL_TEXT_NUMBER_INVALID", "number_from_text could not parse a finite Number");
      else result = value_number(number);
      free(trimmed);
      break;
    }
    case BUILTIN_EMPTY_SEQUENCE:
      if (argc != 0) vm_fail(vm, "RCL_NATIVE_BUILTIN_ARITY", "empty_sequence expects no arguments");
      else result = value_sequence_empty();
      break;
    case BUILTIN_SEQUENCE_APPEND:
      if (argc != 2 || args[0].type != VALUE_SEQUENCE) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "sequence_append expects Sequence and value");
      else result = value_sequence_append(args[0].sequence, &args[1]);
      break;
    case BUILTIN_SEQUENCE_GET: {
      if (argc != 2 || args[0].type != VALUE_SEQUENCE || args[1].type != VALUE_NUMBER || floor(args[1].number) != args[1].number) { vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "sequence_get expects Sequence and integer index"); break; }
      int64_t index = (int64_t)args[1].number;
      if (index < 0 || (size_t)index >= args[0].sequence->count) vm_fail(vm, "RCL_SEQUENCE_RANGE", "sequence_get index out of range");
      else result = value_clone(sequence_item(args[0].sequence, (size_t)index));
      break;
    }
    case BUILTIN_CHAR_AT: {
      if (argc != 2 || args[0].type != VALUE_STRING || args[1].type != VALUE_NUMBER || floor(args[1].number) != args[1].number) { vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "char_at expects Text and integer index"); break; }
      int64_t index = (int64_t)args[1].number; size_t character_count = utf8_length(args[0].string);
      if (index < 0 || (size_t)index >= character_count) result = value_string("");
      else {
        size_t byte_length = shared_string_header(args[0].string)->byte_length;
        size_t start = utf8_byte_offset(args[0].string, (size_t)index);
        uint32_t codepoint;
        int valid;
        size_t width = utf8_decode_at(args[0].string, byte_length, start, &codepoint, &valid);
        (void)codepoint;
        (void)valid;
        result = value_string_n(args[0].string + start, width);
      }
      break;
    }
    case BUILTIN_SLICE_TEXT: {
      if (argc != 3 || args[0].type != VALUE_STRING || args[1].type != VALUE_NUMBER || args[2].type != VALUE_NUMBER || floor(args[1].number) != args[1].number || floor(args[2].number) != args[2].number) { vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "slice_text expects Text and integer start/length"); break; }
      int64_t start = (int64_t)args[1].number, count = (int64_t)args[2].number; size_t total = utf8_length(args[0].string);
      if (start < 0 || count < 0) { vm_fail(vm, "RCL_TEXT_SLICE", "slice_text expects non-negative start/length"); break; }
      if ((size_t)start > total) start = (int64_t)total;
      size_t available = total - (size_t)start; size_t take = (size_t)count < available ? (size_t)count : available;
      size_t byte_start = utf8_byte_offset(args[0].string, (size_t)start);
      size_t byte_end = utf8_byte_offset(args[0].string, (size_t)start + take);
      size_t byte_take = byte_end - byte_start;
      result = value_string_n(args[0].string + byte_start, byte_take); break;
    }
    case BUILTIN_IS_WHITESPACE:
    case BUILTIN_IS_DIGIT:
    case BUILTIN_IS_IDENTIFIER_START:
    case BUILTIN_IS_IDENTIFIER_PART: {
      if (argc != 1 || args[0].type != VALUE_STRING) { vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "character predicate expects Text"); break; }
      size_t byte_length = shared_string_header(args[0].string)->byte_length;
      uint32_t codepoint = 0;
      int utf8_valid = 0;
      size_t width = utf8_decode_at(args[0].string, byte_length, 0, &codepoint, &utf8_valid);
      unsigned char ch = codepoint < 0x80 ? (unsigned char)codepoint : 0;
      int matched = 0;
      if (builtin == BUILTIN_IS_WHITESPACE) matched = ch && isspace(ch);
      else if (builtin == BUILTIN_IS_DIGIT) matched = ch && isdigit(ch);
      else if (builtin == BUILTIN_IS_IDENTIFIER_START) matched = width && ((ch && (isalpha(ch) || ch == '_')) || (utf8_valid && codepoint >= 0x80));
      else matched = width && ((ch && (isalnum(ch) || ch == '_')) || (utf8_valid && codepoint >= 0x80));
      result = value_bool(matched); break;
    }
    case BUILTIN_MAKE_SPAN:
      if (argc != 4 || args[0].type != VALUE_NUMBER || args[1].type != VALUE_NUMBER || args[2].type != VALUE_NUMBER || args[3].type != VALUE_NUMBER) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "make_span expects four Numbers");
      else if (args[0].number < 0 || args[1].number < 1 || args[2].number < 1 || args[3].number < 0 || floor(args[0].number) != args[0].number || floor(args[1].number) != args[1].number || floor(args[2].number) != args[2].number || floor(args[3].number) != args[3].number) vm_fail(vm, "RCL_SPAN_RANGE", "Invalid Span coordinates");
      else result = value_span((int64_t)args[0].number, (int64_t)args[1].number, (int64_t)args[2].number, (int64_t)args[3].number);
      break;
    case BUILTIN_MAKE_TOKEN:
      if (argc != 3 || args[0].type != VALUE_STRING || args[1].type != VALUE_STRING || args[2].type != VALUE_SPAN) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "make_token expects kind Text, lexeme Text and Span");
      else result = value_token(args[0].string, args[1].string, args[2].span);
      break;
    case BUILTIN_EXPECT_TOKEN:
      if (argc != 3 || args[0].type != VALUE_TOKEN || args[1].type != VALUE_STRING || args[2].type != VALUE_STRING) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "expect_token expects Token, kind Text and text Text");
      else if (strcmp(args[0].token->token_type, args[1].string) != 0 || (args[2].string[0] && strcmp(args[0].token->text, args[2].string) != 0)) vm_fail(vm, "RCL_PARSE_EXPECTATION", "Token does not match parser expectation");
      else result = value_clone(&args[0]);
      break;
    case BUILTIN_TOKEN_KIND:
    case BUILTIN_TOKEN_TEXT:
    case BUILTIN_TOKEN_SPAN:
      if (argc != 1 || args[0].type != VALUE_TOKEN) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "token accessor expects Token");
      else if (builtin == BUILTIN_TOKEN_KIND) result = value_string(args[0].token->token_type);
      else if (builtin == BUILTIN_TOKEN_TEXT) result = value_string(args[0].token->text);
      else result = value_span(args[0].token->span.offset, args[0].token->span.line, args[0].token->span.column, args[0].token->span.length);
      break;
    case BUILTIN_SPAN_OFFSET:
    case BUILTIN_SPAN_LINE:
    case BUILTIN_SPAN_COLUMN:
    case BUILTIN_SPAN_LENGTH:
      if (argc != 1 || args[0].type != VALUE_SPAN) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "span accessor expects Span");
      else if (builtin == BUILTIN_SPAN_OFFSET) result = value_number((double)args[0].span->offset);
      else if (builtin == BUILTIN_SPAN_LINE) result = value_number((double)args[0].span->line);
      else if (builtin == BUILTIN_SPAN_COLUMN) result = value_number((double)args[0].span->column);
      else result = value_number((double)args[0].span->length);
      break;
    case BUILTIN_FACET_AST:
      if (argc != 5 || args[0].type != VALUE_STRING || args[1].type != VALUE_STRING || args[2].type != VALUE_STRING || args[3].type != VALUE_STRING || args[4].type != VALUE_SPAN) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "facet_ast expects four Text values and Span");
      else if (strcmp(args[2].string, "Number") != 0 && strcmp(args[2].string, "Truth") != 0 && strcmp(args[2].string, "Text") != 0) vm_fail(vm, "RCL_AST_LITERAL_KIND", "facet_ast literal kind must be Number, Truth or Text");
      else result = value_ast(args[0].string, args[1].string, args[2].string, args[3].string, args[4].span);
      break;
    case BUILTIN_AST_KIND:
    case BUILTIN_AST_PATH:
    case BUILTIN_AST_VALUE_TYPE:
    case BUILTIN_AST_LITERAL_KIND:
    case BUILTIN_AST_LITERAL_TEXT:
    case BUILTIN_AST_SPAN:
      if (argc != 1 || args[0].type != VALUE_AST) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "AST accessor expects AstNode");
      else if (builtin == BUILTIN_AST_KIND) result = value_string("FacetDecl");
      else if (builtin == BUILTIN_AST_PATH) result = value_string(args[0].ast->path);
      else if (builtin == BUILTIN_AST_VALUE_TYPE) result = value_string(args[0].ast->value_type);
      else if (builtin == BUILTIN_AST_LITERAL_KIND) result = value_string(args[0].ast->literal_kind);
      else if (builtin == BUILTIN_AST_LITERAL_TEXT) result = value_string(args[0].ast->literal_text);
      else result = value_span(args[0].ast->span.offset, args[0].ast->span.line, args[0].ast->span.column, args[0].ast->span.length);
      break;
    case BUILTIN_MAKE_PARSE_STATE:
      if (argc != 2 || args[0].type != VALUE_NUMBER || floor(args[0].number) != args[0].number || args[1].type != VALUE_SEQUENCE) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "make_parse_state expects integer index and Sequence");
      else result = value_parse_state((int64_t)args[0].number, args[1].sequence);
      break;
    case BUILTIN_PARSE_INDEX:
    case BUILTIN_PARSE_NODES:
      if (argc != 1 || args[0].type != VALUE_PARSE_STATE) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "parse accessor expects ParseState");
      else if (builtin == BUILTIN_PARSE_INDEX) result = value_number((double)args[0].parse_state->index);
      else { result.type = VALUE_SEQUENCE; result.sequence = sequence_clone(args[0].parse_state->nodes); }
      break;
    case BUILTIN_MAKE_SYMBOL:
      if (argc != 4 || args[0].type != VALUE_STRING || args[1].type != VALUE_STRING || args[2].type != VALUE_NUMBER || floor(args[2].number) != args[2].number || args[3].type != VALUE_SPAN) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "make_symbol expects path Text, type Text, integer slot and Span");
      else result = value_symbol(args[0].string, args[1].string, (int64_t)args[2].number, args[3].span);
      break;
    case BUILTIN_SYMBOL_PATH:
    case BUILTIN_SYMBOL_TYPE:
    case BUILTIN_SYMBOL_SLOT:
    case BUILTIN_SYMBOL_SPAN:
      if (argc != 1 || args[0].type != VALUE_SYMBOL) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "symbol accessor expects Symbol");
      else if (builtin == BUILTIN_SYMBOL_PATH) result = value_string(args[0].symbol->path);
      else if (builtin == BUILTIN_SYMBOL_TYPE) result = value_string(args[0].symbol->value_type);
      else if (builtin == BUILTIN_SYMBOL_SLOT) result = value_number((double)args[0].symbol->slot);
      else result = value_span(args[0].symbol->span.offset, args[0].symbol->span.line, args[0].symbol->span.column, args[0].symbol->span.length);
      break;
    case BUILTIN_SEMANTIC_ASSERT:
      if (argc != 4 || args[0].type != VALUE_BOOL || args[1].type != VALUE_STRING || args[2].type != VALUE_STRING || args[3].type != VALUE_SPAN) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "semantic_assert expects Truth, code Text, detail Text and Span");
      else if (!args[0].boolean) {
        char detail[512]; snprintf(detail, sizeof(detail), "%s at %" PRId64 ":%" PRId64, args[2].string, args[3].span->line, args[3].span->column);
        if (strcmp(args[1].string, "RCL_SEMANTIC_DUPLICATE") == 0) vm_fail(vm, "RCL_SEMANTIC_DUPLICATE", detail);
        else if (strcmp(args[1].string, "RCL_SEMANTIC_TYPE_MISMATCH") == 0) vm_fail(vm, "RCL_SEMANTIC_TYPE_MISMATCH", detail);
        else if (strcmp(args[1].string, "RCL_MODULE_HEADER_REQUIRED") == 0) vm_fail(vm, "RCL_MODULE_HEADER_REQUIRED", detail);
        else if (strcmp(args[1].string, "RCL_MODULE_MISSING") == 0) vm_fail(vm, "RCL_MODULE_MISSING", detail);
        else if (strcmp(args[1].string, "RCL_MODULE_NOT_IMPORTED") == 0) vm_fail(vm, "RCL_MODULE_NOT_IMPORTED", detail);
        else if (strcmp(args[1].string, "RCL_MODULE_SYMBOL_MISSING") == 0) vm_fail(vm, "RCL_MODULE_SYMBOL_MISSING", detail);
        else if (strcmp(args[1].string, "RCL_MODULE_TYPE_MISMATCH") == 0) vm_fail(vm, "RCL_MODULE_TYPE_MISMATCH", detail);
        else vm_fail(vm, "RCL_SEMANTIC_ASSERT", detail);
      } else result = value_bool(1);
      break;
    case BUILTIN_MAKE_SEMANTIC_FACET:
      if (argc != 6 || args[0].type != VALUE_STRING || args[1].type != VALUE_STRING || args[2].type != VALUE_STRING || args[3].type != VALUE_STRING || args[4].type != VALUE_NUMBER || floor(args[4].number) != args[4].number || args[5].type != VALUE_SPAN) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "make_semantic_facet expects Text fields, integer slot and Span");
      else result = value_semantic(args[0].string, args[1].string, args[2].string, args[3].string, (int64_t)args[4].number, args[5].span);
      break;
    case BUILTIN_SEMANTIC_PATH:
    case BUILTIN_SEMANTIC_TYPE:
    case BUILTIN_SEMANTIC_LITERAL_KIND:
    case BUILTIN_SEMANTIC_LITERAL_TEXT:
    case BUILTIN_SEMANTIC_SLOT:
    case BUILTIN_SEMANTIC_SPAN:
      if (argc != 1 || args[0].type != VALUE_SEMANTIC) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "semantic accessor expects SemanticNode");
      else if (builtin == BUILTIN_SEMANTIC_PATH) result = value_string(args[0].semantic->path);
      else if (builtin == BUILTIN_SEMANTIC_TYPE) result = value_string(args[0].semantic->value_type);
      else if (builtin == BUILTIN_SEMANTIC_LITERAL_KIND) result = value_string(args[0].semantic->literal_kind);
      else if (builtin == BUILTIN_SEMANTIC_LITERAL_TEXT) result = value_string(args[0].semantic->literal_text);
      else if (builtin == BUILTIN_SEMANTIC_SLOT) result = value_number((double)args[0].semantic->slot);
      else result = value_span(args[0].semantic->span.offset, args[0].semantic->span.line, args[0].semantic->span.column, args[0].semantic->span.length);
      break;
    case BUILTIN_MAKE_IR_STORE:
      if (argc != 7 || args[0].type != VALUE_STRING || args[1].type != VALUE_STRING || args[2].type != VALUE_STRING || args[3].type != VALUE_STRING || args[4].type != VALUE_STRING || args[5].type != VALUE_NUMBER || floor(args[5].number) != args[5].number || args[6].type != VALUE_SPAN) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "make_ir_store expects Text fields, integer slot and Span");
      else result = value_ir(args[0].string, args[1].string, args[2].string, args[3].string, args[4].string, (int64_t)args[5].number, args[6].span);
      break;
    case BUILTIN_IR_OP:
    case BUILTIN_IR_PATH:
    case BUILTIN_IR_TYPE:
    case BUILTIN_IR_LITERAL_KIND:
    case BUILTIN_IR_LITERAL_TEXT:
    case BUILTIN_IR_SLOT:
    case BUILTIN_IR_SPAN:
      if (argc != 1 || args[0].type != VALUE_IR) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "IR accessor expects IrNode");
      else if (builtin == BUILTIN_IR_OP) result = value_string(args[0].ir->op);
      else if (builtin == BUILTIN_IR_PATH) result = value_string(args[0].ir->path);
      else if (builtin == BUILTIN_IR_TYPE) result = value_string(args[0].ir->value_type);
      else if (builtin == BUILTIN_IR_LITERAL_KIND) result = value_string(args[0].ir->literal_kind);
      else if (builtin == BUILTIN_IR_LITERAL_TEXT) result = value_string(args[0].ir->literal_text);
      else if (builtin == BUILTIN_IR_SLOT) result = value_number((double)args[0].ir->slot);
      else result = value_span(args[0].ir->span.offset, args[0].ir->span.line, args[0].ir->span.column, args[0].ir->span.length);
      break;
    case BUILTIN_SEQUENCE_CONCAT:
      if (argc != 2 || args[0].type != VALUE_SEQUENCE || args[1].type != VALUE_SEQUENCE) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "sequence_concat expects two Sequences");
      else {
        result.type = VALUE_SEQUENCE;
        result.sequence = sequence_create();
        sequence_materialize(args[0].sequence);
        sequence_materialize(args[1].sequence);
        if (args[0].sequence->count > SIZE_MAX - args[1].sequence->count) { sequence_free(result.sequence); result = value_null(); vm_fail(vm, "RCL_NATIVE_OOM", "Concatenated Sequence is too large"); break; }
        size_t count = args[0].sequence->count + args[1].sequence->count;
        if (count > 0) {
          result.sequence->items = (Value *)calloc(count, sizeof(Value));
          if (!result.sequence->items) { sequence_free(result.sequence); result = value_null(); vm_fail(vm, "RCL_NATIVE_OOM", "Unable to allocate concatenated Sequence items"); break; }
        }
        result.sequence->count = count;
        size_t out = 0;
        for (size_t i = 0; i < args[0].sequence->count; i++) result.sequence->items[out++] = value_clone(&args[0].sequence->items[i]);
        for (size_t i = 0; i < args[1].sequence->count; i++) result.sequence->items[out++] = value_clone(&args[1].sequence->items[i]);
      }
      break;
    case BUILTIN_BYTES_U8:
    case BUILTIN_BYTES_U16LE:
    case BUILTIN_BYTES_U32LE:
    case BUILTIN_BYTES_I32LE:
    case BUILTIN_BYTES_F64LE: {
      if (argc != 1 || args[0].type != VALUE_NUMBER || !isfinite(args[0].number)) { vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "byte encoder expects one finite Number"); break; }
      unsigned char bytes[8] = {0}; size_t length = 0;
      if (builtin == BUILTIN_BYTES_U8) {
        if (!number_is_integer_in_range(args[0].number, 0, 255)) { vm_fail(vm, "RCL_BYTE_ENCODING_RANGE", "bytes_u8 expects 0..255"); break; }
        bytes[0] = (unsigned char)args[0].number; length = 1;
      } else if (builtin == BUILTIN_BYTES_U16LE) {
        if (!number_is_integer_in_range(args[0].number, 0, 65535)) { vm_fail(vm, "RCL_BYTE_ENCODING_RANGE", "bytes_u16le expects 0..65535"); break; }
        uint16_t value = (uint16_t)args[0].number; memcpy(bytes, &value, 2); length = 2;
      } else if (builtin == BUILTIN_BYTES_U32LE) {
        if (!number_is_integer_in_range(args[0].number, 0, 4294967295.0)) { vm_fail(vm, "RCL_BYTE_ENCODING_RANGE", "bytes_u32le expects unsigned 32-bit integer"); break; }
        uint32_t value = (uint32_t)args[0].number; memcpy(bytes, &value, 4); length = 4;
      } else if (builtin == BUILTIN_BYTES_I32LE) {
        if (!number_is_integer_in_range(args[0].number, -2147483648.0, 2147483647.0)) { vm_fail(vm, "RCL_BYTE_ENCODING_RANGE", "bytes_i32le expects signed 32-bit integer"); break; }
        int32_t value = (int32_t)args[0].number; memcpy(bytes, &value, 4); length = 4;
      } else {
        double value = args[0].number; memcpy(bytes, &value, 8); length = 8;
      }
#if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
      for (size_t i = 0; i < length / 2; i++) { unsigned char temp = bytes[i]; bytes[i] = bytes[length - 1 - i]; bytes[length - 1 - i] = temp; }
#endif
      result = value_byte_sequence(bytes, length);
      if (result.type != VALUE_SEQUENCE) vm_fail(vm, "RCL_NATIVE_OOM", "Unable to allocate encoded bytes");
      break;
    }
    case BUILTIN_UTF8_BYTES:
      if (argc != 1 || args[0].type != VALUE_STRING) vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "utf8_bytes expects Text");
      else {
        const unsigned char *bytes = (const unsigned char *)args[0].string;
        result = value_byte_sequence(bytes, strlen(args[0].string));
        if (result.type != VALUE_SEQUENCE) vm_fail(vm, "RCL_NATIVE_OOM", "Unable to allocate UTF-8 bytes");
      }
      break;
    case BUILTIN_HEX_BYTES: {
      if (argc != 1 || args[0].type != VALUE_STRING) { vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "hex_bytes expects Text"); break; }
      size_t hex_length = strlen(args[0].string);
      if (hex_length % 2 != 0) { vm_fail(vm, "RCL_HEX_BYTES_INVALID", "hex_bytes expects even-length hexadecimal Text"); break; }
      size_t byte_length = hex_length / 2;
      unsigned char *bytes = (unsigned char *)calloc(byte_length ? byte_length : 1, sizeof(unsigned char));
      if (!bytes) { fprintf(stderr, "out of memory\n"); exit(2); }
      int valid = 1;
      for (size_t i = 0; i < byte_length; i++) {
        int high = hex_nibble(args[0].string[i * 2]);
        int low = hex_nibble(args[0].string[i * 2 + 1]);
        if (high < 0 || low < 0) { valid = 0; break; }
        bytes[i] = (unsigned char)((high << 4) | low);
      }
      if (!valid) vm_fail(vm, "RCL_HEX_BYTES_INVALID", "hex_bytes expects hexadecimal Text");
      else {
        result = value_byte_sequence(bytes, byte_length);
        if (result.type != VALUE_SEQUENCE) vm_fail(vm, "RCL_NATIVE_OOM", "Unable to allocate hex bytes");
      }
      free(bytes);
      break;
    }
    case BUILTIN_SHA256_TEXT: {
      if (argc != 1 || args[0].type != VALUE_STRING) { vm_fail(vm, "RCL_NATIVE_BUILTIN_TYPE", "sha256_text expects Text"); break; }
      unsigned char digest[RCL_SHA256_DIGEST_LENGTH];
      if (!rcl_sha256((const unsigned char *)args[0].string, strlen(args[0].string), digest)) {
        vm_fail(vm, "RCL_NATIVE_SHA256", "SHA256 calculation failed");
        break;
      }
      char hex[65];
      for (int i = 0; i < RCL_SHA256_DIGEST_LENGTH; i++) snprintf(hex + i * 2, 3, "%02x", digest[i]);
      hex[64] = '\0';
      result = value_string(hex);
      break;
    }
    default: vm_fail(vm, "RCL_NATIVE_BUILTIN_UNKNOWN", "Unknown native builtin"); break;
  }

done:
  for (int i = 0; i < argc; i++) value_free(&args[i]);
  if (!vm->error.code) return stack_push(vm, result);
  value_free(&result);
  return 0;
}

static void transaction_reset(Transaction *tx) {
  if (tx->rule) free(tx->rule);
  if (tx->actor) free(tx->actor);
  for (size_t i = 0; i < tx->change_count; i++) {
    free(tx->changes[i].target);
    value_free(&tx->changes[i].before);
    value_free(&tx->changes[i].after);
  }
  for (size_t i = 0; i < tx->witness_count; i++) free(tx->witnesses[i]);
  for (size_t i = 0; i < tx->need_count; i++) { free(tx->needs[i].capability); free(tx->needs[i].target); }
  memset(tx, 0, sizeof(*tx));
}

static int record_copy_from_tx(Record *record, const Transaction *tx, const char *after_root, const State *projected_state) {
  memset(record, 0, sizeof(*record));
  record->mode = tx->mode; record->rule_kind = tx->rule_kind;
  record->rule = xstrdup(tx->rule); record->actor = xstrdup(tx->actor);
  memcpy(record->before_root, tx->before_root, 65); memcpy(record->after_root, after_root, 65);
  record->change_count = tx->change_count;
  for (size_t i = 0; i < tx->change_count; i++) {
    record->changes[i].target = xstrdup(tx->changes[i].target);
    record->changes[i].before = value_clone(&tx->changes[i].before);
    record->changes[i].after = value_clone(&tx->changes[i].after);
  }
  record->witness_count = tx->witness_count;
  for (size_t i = 0; i < tx->witness_count; i++) record->witnesses[i] = xstrdup(tx->witnesses[i]);
  record->need_count = tx->need_count;
  for (size_t i = 0; i < tx->need_count; i++) { record->needs[i].capability = xstrdup(tx->needs[i].capability); record->needs[i].target = xstrdup(tx->needs[i].target); }
  if (projected_state) {
    record->projected_state = (State *)calloc(1, sizeof(State));
    if (!record->projected_state || !state_clone_into(record->projected_state, projected_state)) return 0;
  }
  return 1;
}

static void record_free(Record *record) {
  free(record->rule); free(record->actor);
  for (size_t i = 0; i < record->change_count; i++) { free(record->changes[i].target); value_free(&record->changes[i].before); value_free(&record->changes[i].after); }
  for (size_t i = 0; i < record->witness_count; i++) free(record->witnesses[i]);
  for (size_t i = 0; i < record->need_count; i++) { free(record->needs[i].capability); free(record->needs[i].target); }
  if (record->projected_state) { state_free(record->projected_state); free(record->projected_state); }
  memset(record, 0, sizeof(*record));
}

static ProviderRegistration *find_provider(VM *vm, const char *provider_id) {
  for (size_t i = 0; i < vm->provider_count; i++) {
    if (strcmp(vm->providers[i].provider_id, provider_id) == 0) return &vm->providers[i];
  }
  return NULL;
}

static int call_continuation_returns(const VM *vm, uint32_t pc) {
  for (uint32_t hops = 0; hops < vm->program.instruction_count && pc < vm->program.instruction_count; hops++) {
    const Instruction *instruction = &vm->program.instructions[pc];
    if (instruction->op == OP_RETURN) return 1;
    if (instruction->op == OP_NOP) { pc++; continue; }
    if (instruction->op != OP_JUMP || instruction->a < 0 || (uint32_t)instruction->a >= vm->program.instruction_count) return 0;
    pc = (uint32_t)instruction->a;
  }
  return 0;
}

static int execute_program(VM *vm) {
  uint32_t pc = 0;
  while (pc < vm->program.instruction_count && !vm->error.code) {
    if (++vm->executed_instructions > RCLVM_MAX_EXECUTED_INSTRUCTIONS) { vm_fail(vm, "RCL_NATIVE_BUDGET_EXCEEDED", "Native VM instruction budget exceeded (300000000)"); break; }
    Instruction instruction = vm->program.instructions[pc++];
    Value left, right, value, result;
    int comparison;
    switch (instruction.op) {
      case OP_NOP: break;
      case OP_PUSH_NUMBER: stack_push(vm, value_number(pool_number(vm, instruction.a))); break;
      case OP_PUSH_BOOL: stack_push(vm, value_bool(instruction.a)); break;
      case OP_PUSH_STRING: stack_push(vm, value_string_retain(pool_string(vm, instruction.a))); break;
      case OP_LOAD_STATE: stack_push(vm, vm_load_state(vm, pool_string(vm, instruction.a))); break;
      case OP_STORE_STATE:
        value = stack_pop(vm);
        if (!vm->error.code && !state_set(&vm->state, pool_string(vm, instruction.a), &value)) vm_fail(vm, "RCL_NATIVE_STATE_LIMIT", "Native VM state capacity exceeded");
        value_free(&value);
        break;
      case OP_ADD:
        right = stack_pop(vm); left = stack_pop(vm);
        if (left.type == VALUE_NUMBER && right.type == VALUE_NUMBER) result = value_number(left.number + right.number);
        else if (left.type == VALUE_STRING || right.type == VALUE_STRING) {
          char *left_owned = NULL, *right_owned = NULL;
          const char *left_text = left.type == VALUE_STRING ? left.string : (left_owned = value_to_text(&left));
          const char *right_text = right.type == VALUE_STRING ? right.string : (right_owned = value_to_text(&right));
          size_t left_length = left.type == VALUE_STRING ? shared_string_header(left.string)->byte_length : strlen(left_text);
          size_t right_length = right.type == VALUE_STRING ? shared_string_header(right.string)->byte_length : strlen(right_text);
          result = value_string_join(left_text, left_length, right_text, right_length);
          free(left_owned);
          free(right_owned);
        } else { vm_fail(vm, "RCL_NATIVE_ADD_TYPE", "ADD expects Number or Text values"); result = value_null(); }
        value_free(&left); value_free(&right); if (!vm->error.code) stack_push(vm, result); else value_free(&result); break;
      case OP_SUB: case OP_MUL: case OP_DIV: case OP_MOD:
        right = stack_pop(vm); left = stack_pop(vm);
        if (left.type != VALUE_NUMBER || right.type != VALUE_NUMBER) { vm_fail(vm, "RCL_NATIVE_ARITHMETIC_TYPE", "Arithmetic expects Number values"); result = value_null(); }
        else if ((instruction.op == OP_DIV || instruction.op == OP_MOD) && right.number == 0) {
          vm_fail(vm, instruction.op == OP_DIV ? "RCL_NATIVE_DIVIDE_ZERO" : "RCL_NATIVE_MODULO_ZERO", instruction.op == OP_DIV ? "Division by zero" : "Modulo by zero");
          result = value_null();
        } else {
          result = value_number(
            instruction.op == OP_SUB ? left.number - right.number
              : instruction.op == OP_MUL ? left.number * right.number
                : instruction.op == OP_DIV ? left.number / right.number
                  : fmod(left.number, right.number)
          );
        }
        value_free(&left); value_free(&right); if (!vm->error.code) stack_push(vm, result); else value_free(&result); break;
      case OP_EQ: case OP_NEQ:
        right = stack_pop(vm); left = stack_pop(vm); comparison = values_equal(&left, &right); if (instruction.op == OP_NEQ) comparison = !comparison;
        value_free(&left); value_free(&right); stack_push(vm, value_bool(comparison)); break;
      case OP_LT: case OP_LTE: case OP_GT: case OP_GTE:
        right = stack_pop(vm); left = stack_pop(vm);
        if (compare_values(vm, &left, &right, &comparison)) {
          int truth = instruction.op == OP_LT ? comparison < 0 : instruction.op == OP_LTE ? comparison <= 0 : instruction.op == OP_GT ? comparison > 0 : comparison >= 0;
          stack_push(vm, value_bool(truth));
        }
        value_free(&left); value_free(&right); break;
      case OP_AND: case OP_OR:
        right = stack_pop(vm); left = stack_pop(vm);
        comparison = instruction.op == OP_AND ? value_truthy(&left) && value_truthy(&right) : value_truthy(&left) || value_truthy(&right);
        value_free(&left); value_free(&right); stack_push(vm, value_bool(comparison)); break;
      case OP_NOT:
        value = stack_pop(vm); comparison = !value_truthy(&value); value_free(&value); stack_push(vm, value_bool(comparison)); break;
      case OP_NEGATE:
        value = stack_pop(vm); if (value.type != VALUE_NUMBER) vm_fail(vm, "RCL_NATIVE_NEGATE_TYPE", "NEGATE expects Number"); else stack_push(vm, value_number(-value.number)); value_free(&value); break;
      case OP_JUMP:
        if (instruction.a < 0 || (uint32_t)instruction.a >= vm->program.instruction_count) vm_fail(vm, "RCL_NATIVE_JUMP_RANGE", "Jump target out of range"); else pc = (uint32_t)instruction.a;
        break;
      case OP_JUMP_IF_FALSE:
        value = stack_pop(vm); comparison = value_truthy(&value); value_free(&value);
        if (!comparison) { if (instruction.a < 0 || (uint32_t)instruction.a >= vm->program.instruction_count) vm_fail(vm, "RCL_NATIVE_JUMP_RANGE", "Jump target out of range"); else pc = (uint32_t)instruction.a; }
        break;
      case OP_GRANT_WARRANT:
        if (vm->warrant_count >= MAX_WARRANTS) { vm_fail(vm, "RCL_NATIVE_WARRANT_LIMIT", "Native VM warrant capacity exceeded"); break; }
        vm->warrants[vm->warrant_count++] = (Warrant){ xstrdup(pool_string(vm, instruction.a)), xstrdup(pool_string(vm, instruction.b)), xstrdup(pool_string(vm, instruction.c)) };
        break;
      case OP_BEGIN_TX:
        if (vm->tx.active) { vm_fail(vm, "RCL_NATIVE_TX_NESTED", "Nested native transactions are not supported"); break; }
        transaction_reset(&vm->tx); vm->tx.active = 1; vm->tx.mode = instruction.a; vm->tx.rule_kind = instruction.flags ? 1 : 0;
        vm->tx.rule = xstrdup(pool_string(vm, instruction.b)); vm->tx.actor = xstrdup(pool_string(vm, instruction.c)); state_root(&vm->state, vm->tx.before_root);
        break;
      case OP_CHECK_WARRANT: {
        const char *subject = pool_string(vm, instruction.a), *capability = pool_string(vm, instruction.b), *target = pool_string(vm, instruction.c);
        if (!has_warrant(vm, subject, capability, target)) { char message[384]; snprintf(message, sizeof(message), "Authority denied: %s lacks %s on %s", subject, capability, target); vm_fail(vm, "RCL_AUTHORITY_DENIED", message); break; }
        if (vm->tx.need_count >= MAX_NEEDS) { vm_fail(vm, "RCL_NATIVE_NEED_LIMIT", "Native transaction need capacity exceeded"); break; }
        vm->tx.needs[vm->tx.need_count++] = (Need){ xstrdup(capability), xstrdup(target) };
        break;
      }
      case OP_STAGE_STORE: {
        if (!vm->tx.active) { vm_fail(vm, "RCL_NATIVE_TX_REQUIRED", "STAGE_STORE requires active transaction"); break; }
        const char *target = pool_string(vm, instruction.a); value = stack_pop(vm); Change *change = tx_find_change(&vm->tx, target);
        if (!change) {
          if (vm->tx.change_count >= MAX_TX_CHANGES) { value_free(&value); vm_fail(vm, "RCL_NATIVE_CHANGE_LIMIT", "Native transaction change capacity exceeded"); break; }
          change = &vm->tx.changes[vm->tx.change_count++]; change->target = xstrdup(target); change->before = state_get(&vm->state, target); change->after = value_null();
        }
        value_free(&change->after); change->after = value_clone(&value); value_free(&value); break;
      }
      case OP_SET_PROJECTED_VIEW:
        if (!vm->tx.active) vm_fail(vm, "RCL_NATIVE_TX_REQUIRED", "SET_PROJECTED_VIEW requires active transaction"); else vm->tx.projected_view = instruction.a ? 1 : 0;
        break;
      case OP_CHECK_PRESERVE:
        value = stack_pop(vm); comparison = value_truthy(&value); value_free(&value);
        if (!comparison) vm_fail(vm, "RCL_REALITY_BOUND_BROKEN", "A preserve clause rejected the projected reality");
        break;
      case OP_RECORD_WITNESS:
        if (!vm->tx.active) { vm_fail(vm, "RCL_NATIVE_TX_REQUIRED", "RECORD_WITNESS requires active transaction"); break; }
        if (vm->tx.witness_count >= MAX_WITNESSES) { vm_fail(vm, "RCL_NATIVE_WITNESS_LIMIT", "Native transaction witness capacity exceeded"); break; }
        vm->tx.witnesses[vm->tx.witness_count++] = xstrdup(pool_string(vm, instruction.a));
        break;
      case OP_COMMIT_TX: {
        if (!vm->tx.active) { vm_fail(vm, "RCL_NATIVE_TX_REQUIRED", "COMMIT_TX requires active transaction"); break; }
        State projected; if (!state_clone_into(&projected, &vm->state)) { vm_fail(vm, "RCL_NATIVE_STATE_LIMIT", "Cannot clone projected state"); break; }
        for (size_t i = 0; i < vm->tx.change_count; i++) if (!state_set(&projected, vm->tx.changes[i].target, &vm->tx.changes[i].after)) { vm_fail(vm, "RCL_NATIVE_STATE_LIMIT", "Cannot apply projected state"); break; }
        if (vm->error.code) { state_free(&projected); break; }
        char after_root[65]; state_root(&projected, after_root);
        if (vm->tx.mode == 0) {
          if (vm->projection_count >= MAX_RECORDS || !record_copy_from_tx(&vm->projections[vm->projection_count++], &vm->tx, after_root, &projected)) vm_fail(vm, "RCL_NATIVE_RECORD_LIMIT", "Cannot record projection");
        } else {
          if (vm->history_count >= MAX_RECORDS || !record_copy_from_tx(&vm->history[vm->history_count++], &vm->tx, after_root, NULL)) vm_fail(vm, "RCL_NATIVE_RECORD_LIMIT", "Cannot record transition");
          if (!vm->error.code) { state_free(&vm->state); vm->state = projected; memset(&projected, 0, sizeof(projected)); }
        }
        state_free(&projected); transaction_reset(&vm->tx); break;
      }
      case OP_CALL_BUILTIN: execute_builtin(vm, instruction.a, instruction.b); break;
      case OP_CALL_PROVIDER: {
        Value provider_id_value = value_null();
        Value capability_value = value_null();
        Value request_value = value_null();
        const char *provider_id;
        const char *capability;
        const char *request_json;
        if (instruction.flags & 1) {
          request_value = stack_pop(vm);
          capability_value = stack_pop(vm);
          provider_id_value = stack_pop(vm);
          if (vm->error.code) {
            value_free(&provider_id_value); value_free(&capability_value); value_free(&request_value);
            break;
          }
          if (provider_id_value.type != VALUE_STRING || capability_value.type != VALUE_STRING || request_value.type != VALUE_STRING) {
            value_free(&provider_id_value); value_free(&capability_value); value_free(&request_value);
            vm_fail(vm, "RCL_NATIVE_PROVIDER_ARGUMENT_TYPE", "provider_call expects Text provider id, capability and request JSON");
            break;
          }
          provider_id = provider_id_value.string;
          capability = capability_value.string;
          request_json = request_value.string;
        } else {
          provider_id = pool_string(vm, instruction.a);
          capability = pool_string(vm, instruction.b);
          request_json = pool_string(vm, instruction.c);
        }
        ProviderRegistration *provider = find_provider(vm, provider_id);
        if (!provider || !provider->invoke) {
          char message[384];
          snprintf(message, sizeof(message), "Provider '%s' is not registered for capability '%s'", provider_id, capability);
          value_free(&provider_id_value); value_free(&capability_value); value_free(&request_value);
          vm_fail(vm, "RCL_NATIVE_PROVIDER_MISSING", message);
          break;
        }
        char *response = (char *)calloc(MAX_PROVIDER_RESPONSE, 1);
        if (!response) {
          value_free(&provider_id_value); value_free(&capability_value); value_free(&request_value);
          vm_fail(vm, "RCL_NATIVE_OOM", "Unable to allocate native provider response buffer");
          break;
        }
        char provider_error[512]; provider_error[0] = '\0';
        int provider_ok = provider->invoke(provider->userdata, capability, request_json, response, MAX_PROVIDER_RESPONSE, provider_error, sizeof(provider_error));
        response[MAX_PROVIDER_RESPONSE - 1] = '\0';
        value_free(&provider_id_value); value_free(&capability_value); value_free(&request_value);
        if (!provider_ok) {
          vm_fail(vm, "RCL_NATIVE_PROVIDER_FAILURE", provider_error[0] ? provider_error : "Native provider invocation failed");
          free(response);
          break;
        }
        stack_push(vm, value_string(response));
        free(response);
        break;
      }
      case OP_MAKE_TYPED_RECORD: {
        if (instruction.c < 0 || vm->stack_count < (size_t)instruction.c) { vm_fail(vm, "RCL_NATIVE_TYPED_RECORD_STACK", "Typed record constructor stack underflow"); break; }
        size_t field_count = (size_t)instruction.c;
        char **field_names = split_field_names(vm, pool_string(vm, instruction.b), field_count);
        if (vm->error.code) { free_string_array(field_names, field_count); break; }
        Value *field_values = (Value *)calloc(field_count ? field_count : 1, sizeof(Value));
        if (!field_values) { fprintf(stderr, "out of memory\n"); exit(2); }
        for (size_t i = field_count; i > 0; i--) field_values[i - 1] = stack_pop(vm);
        if (vm->error.code) {
          for (size_t i = 0; i < field_count; i++) value_free(&field_values[i]);
          free(field_values); free_string_array(field_names, field_count); break;
        }
        uint64_t object_id = vm->next_typed_object_id++;
        vm->typed_heap_allocated++;
        Value record_value = value_typed_record_with_id(object_id, pool_string(vm, instruction.a), field_names, field_values, field_count);
        typed_heap_register(vm, &record_value);
        for (size_t i = 0; i < field_count; i++) value_free(&field_values[i]);
        free(field_values); free_string_array(field_names, field_count);
        stack_push(vm, record_value);
        break;
      }
      case OP_MAKE_TYPED_UNION: {
        if (instruction.c < 0 || vm->stack_count < (size_t)instruction.c) { vm_fail(vm, "RCL_NATIVE_TYPED_UNION_STACK", "Typed union constructor stack underflow"); break; }
        size_t payload_count = (size_t)instruction.c;
        Value *payload = (Value *)calloc(payload_count ? payload_count : 1, sizeof(Value));
        if (!payload) { fprintf(stderr, "out of memory\n"); exit(2); }
        for (size_t i = payload_count; i > 0; i--) payload[i - 1] = stack_pop(vm);
        if (vm->error.code) {
          for (size_t i = 0; i < payload_count; i++) value_free(&payload[i]);
          free(payload); break;
        }
        uint64_t object_id = vm->next_typed_object_id++;
        vm->typed_heap_allocated++;
        Value union_value = value_typed_union_with_id(object_id, pool_string(vm, instruction.a), pool_string(vm, instruction.b), payload, payload_count);
        typed_heap_register(vm, &union_value);
        for (size_t i = 0; i < payload_count; i++) value_free(&payload[i]);
        free(payload);
        stack_push(vm, union_value);
        break;
      }
      case OP_GET_TYPED_FIELD: {
        Value record = stack_pop(vm);
        if (record.type != VALUE_TYPED_RECORD) { value_free(&record); vm_fail(vm, "RCL_NATIVE_FIELD_ACCESS_TARGET", "Typed field access requires a typed record"); break; }
        const char *field_name = pool_string(vm, instruction.a);
        int index = typed_record_field_index(record.typed_record, field_name);
        if (index < 0) { value_free(&record); vm_fail(vm, "RCL_NATIVE_FIELD_ACCESS_MISSING", "Typed record field is missing"); break; }
        Value field_value = value_clone(&record.typed_record->field_values[index]);
        value_free(&record);
        stack_push(vm, field_value);
        break;
      }
      case OP_IS_UNION_VARIANT: {
        Value value = stack_pop(vm);
        int matched = value.type == VALUE_TYPED_UNION && strcmp(value.typed_union->variant, pool_string(vm, instruction.a)) == 0;
        value_free(&value);
        stack_push(vm, value_bool(matched));
        break;
      }
      case OP_GET_UNION_PAYLOAD: {
        Value value = stack_pop(vm);
        if (value.type != VALUE_TYPED_UNION) { value_free(&value); vm_fail(vm, "RCL_NATIVE_UNION_PAYLOAD_TARGET", "Union payload access requires a typed union"); break; }
        if (instruction.a < 0 || (size_t)instruction.a >= value.typed_union->payload_count) { value_free(&value); vm_fail(vm, "RCL_NATIVE_UNION_PAYLOAD_RANGE", "Union payload index out of range"); break; }
        Value payload_value = value_clone(&value.typed_union->payload[(size_t)instruction.a]);
        value_free(&value);
        stack_push(vm, payload_value);
        break;
      }
      case OP_MAKE_TYPED_REF: {
        Value target = stack_pop(vm);
        if (vm->error.code) { value_free(&target); break; }
        Value ref = typed_heap_make_ref(vm, &target);
        value_free(&target);
        if (vm->error.code) { value_free(&ref); break; }
        stack_push(vm, ref);
        break;
      }
      case OP_DEREF_TYPED_REF: {
        Value ref = stack_pop(vm);
        if (vm->error.code) { value_free(&ref); break; }
        Value target = typed_heap_deref(vm, &ref);
        value_free(&ref);
        if (vm->error.code) { value_free(&target); break; }
        stack_push(vm, target);
        break;
      }
      case OP_GET_TYPED_REF_ID: {
        Value ref = stack_pop(vm);
        if (ref.type != VALUE_TYPED_REF) { value_free(&ref); vm_fail(vm, "RCL_NATIVE_TYPED_REF_ID_TARGET", "typed_ref_id requires a typed reference"); break; }
        double object_id = (double)ref.typed_ref->object_id;
        value_free(&ref);
        stack_push(vm, value_number(object_id));
        break;
      }
      case OP_LOAD_LOCAL: {
        if (vm->frame_count == 0) { vm_fail(vm, "RCL_NATIVE_LOCAL_SCOPE", "LOAD_LOCAL outside a reckoning call"); break; }
        CallFrame *frame = &vm->frames[vm->frame_count - 1];
        if (instruction.a < 0 || instruction.a >= frame->argc || frame->base + (size_t)instruction.a >= vm->stack_count) { vm_fail(vm, "RCL_NATIVE_LOCAL_RANGE", "Local parameter index out of range"); break; }
        stack_push(vm, value_clone(&vm->stack[frame->base + (size_t)instruction.a]));
        break;
      }
      case OP_CALL: {
        if (instruction.a < 0 || (uint32_t)instruction.a >= vm->program.instruction_count) { vm_fail(vm, "RCL_NATIVE_CALL_RANGE", "Call target out of range"); break; }
        if (instruction.b < 0 || vm->stack_count < (size_t)instruction.b) { vm_fail(vm, "RCL_NATIVE_CALL_ARITY", "Call argument stack underflow"); break; }
        if (vm->frame_count > 0 && call_continuation_returns(vm, pc)) {
          CallFrame *frame = &vm->frames[vm->frame_count - 1];
          size_t argc = (size_t)instruction.b;
          size_t argument_start = vm->stack_count - argc;
          if (argument_start < frame->base) { vm_fail(vm, "RCL_NATIVE_CALL_ARITY", "Tail call arguments overlap the caller frame"); break; }
          for (size_t i = frame->base; i < argument_start; i++) value_free(&vm->stack[i]);
          memmove(&vm->stack[frame->base], &vm->stack[argument_start], argc * sizeof(Value));
          vm->stack_count = frame->base + argc;
          frame->argc = instruction.b;
          pc = (uint32_t)instruction.a;
          break;
        }
        if (!frame_reserve(vm, vm->frame_count + 1)) break;
        CallFrame *frame = &vm->frames[vm->frame_count++];
        frame->return_pc = pc; frame->argc = instruction.b; frame->base = vm->stack_count - (size_t)instruction.b;
        if (vm->frame_count > vm->peak_frame_count) vm->peak_frame_count = vm->frame_count;
        pc = (uint32_t)instruction.a;
        break;
      }
      case OP_RETURN: {
        if (vm->frame_count == 0) { vm_fail(vm, "RCL_NATIVE_RETURN_SCOPE", "RETURN outside a reckoning call"); break; }
        Value return_value = stack_pop(vm);
        if (vm->error.code) { value_free(&return_value); break; }
        CallFrame frame = vm->frames[--vm->frame_count];
        while (vm->stack_count > frame.base) { Value discarded = stack_pop(vm); value_free(&discarded); }
        stack_push(vm, return_value);
        pc = frame.return_pc;
        break;
      }
      case OP_HALT: return vm->error.code == NULL;
      default: vm_fail(vm, "RCL_NATIVE_OPCODE_UNKNOWN", "Unknown native opcode"); break;
    }
  }
  return vm->error.code == NULL;
}

static void print_value_json(FILE *out, const Value *value) {
  StringBuilder sb; sb_init(&sb); value_json_sb(&sb, value); fputs(sb.data, out); free(sb.data);
}

static void print_state_json(FILE *out, const State *state) {
  StringBuilder sb; sb_init(&sb); state_json_sb(&sb, state); fputs(sb.data, out); free(sb.data);
}

static void print_json_string(FILE *out, const char *text) {
  StringBuilder sb; sb_init(&sb); json_escape_sb(&sb, text); fputs(sb.data, out); free(sb.data);
}

static void print_changes(FILE *out, const Record *record) {
  fputc('[', out);
  for (size_t i = 0; i < record->change_count; i++) {
    if (i) fputc(',', out);
    fputs("{\"target\":", out); print_json_string(out, record->changes[i].target);
    fputs(",\"before\":", out); print_value_json(out, &record->changes[i].before);
    fputs(",\"after\":", out); print_value_json(out, &record->changes[i].after);
    fputs(",\"source\":\"alter\"}", out);
  }
  fputc(']', out);
}

static void print_authority(FILE *out, VM *vm, const Record *record) {
  fputs("{\"needs\":[", out);
  for (size_t i = 0; i < record->need_count; i++) {
    if (i) fputc(',', out);
    fputs("{\"capability\":", out); print_json_string(out, record->needs[i].capability);
    fputs(",\"target\":", out); print_json_string(out, record->needs[i].target); fputc('}', out);
  }
  fputs("],\"activeWarrants\":[", out);
  int first = 1;
  for (size_t i = 0; i < vm->warrant_count; i++) {
    if (strcmp(vm->warrants[i].subject, record->actor) != 0) continue;
    if (!first) fputc(',', out);
    first = 0;
    fputs("{\"subject\":", out); print_json_string(out, vm->warrants[i].subject);
    fputs(",\"capability\":", out); print_json_string(out, vm->warrants[i].capability);
    fputs(",\"target\":", out); print_json_string(out, vm->warrants[i].target); fputc('}', out);
  }
  fputs("]}", out);
}

static void print_witnesses(FILE *out, const Record *record) {
  fputc('[', out);
  for (size_t i = 0; i < record->witness_count; i++) { if (i) fputc(',', out); print_json_string(out, record->witnesses[i]); }
  fputc(']', out);
}

static void print_record(FILE *out, VM *vm, const Record *record) {
  int projection = record->mode == 0;
  fputs("{\"kind\":", out); print_json_string(out, projection ? "Projection" : "Transition");
  fputs(",\"rule\":", out); print_json_string(out, record->rule);
  fputs(",\"ruleKind\":", out); print_json_string(out, record->rule_kind ? "Resonance" : "Emergence");
  fputs(",\"mode\":", out); print_json_string(out, projection ? "foresee" : "realize");
  fputs(",\"status\":", out); print_json_string(out, projection ? "projected" : "realized");
  fputs(",\"actor\":", out); print_json_string(out, record->actor);
  fputs(",\"from\":null,\"into\":null,\"beforeRoot\":", out); print_json_string(out, record->before_root);
  fputs(",\"afterRoot\":", out); print_json_string(out, record->after_root);
  fputs(",\"changes\":", out); print_changes(out, record);
  fputs(",\"authority\":", out); print_authority(out, vm, record);
  fputs(",\"witnesses\":", out); print_witnesses(out, record);
  fputs(",\"hostCalls\":[]", out);
  if (record->projected_state) { fputs(",\"projectedState\":", out); print_state_json(out, record->projected_state); }
  fputc('}', out);
}

static void print_success(VM *vm, FILE *out) {
  const char *program = vm->program.strings[vm->program.program_name_index];
  const char *source_root = vm->program.strings[vm->program.source_root_index];
  char semantic_state_root[65];
  state_root(&vm->state, semantic_state_root);
  fprintf(out, "{\"vm\":\"rcl-native-vm/%s\",\"bytecodeVersion\":\"%u.%u\",\"program\":", RCL_VM_VERSION, vm->program.major, vm->program.minor);
  print_json_string(out, program);
  fputs(",\"sourceRoot\":", out); print_json_string(out, source_root);
  fputs(",\"stateRootAlgorithm\":\"rcl.semantic-state-root.v1\"", out);
  fputs(",\"stateRoot\":", out); print_json_string(out, semantic_state_root);
  typed_heap_mark_from_roots(vm);
  fputs(",\"status\":\"ok\",\"typedHeap\":{\"allocated\":", out); fprintf(out, "%" PRIu64, vm->typed_heap_allocated);
  fputs(",\"registered\":", out); fprintf(out, "%zu", vm->typed_heap_count);
  fputs(",\"references\":", out); fprintf(out, "%" PRIu64, vm->typed_ref_allocated);
  fputs(",\"marked\":", out); fprintf(out, "%" PRIu64, vm->typed_heap_mark_count);
  fputs(",\"nextObjectId\":", out); fprintf(out, "%" PRIu64, vm->next_typed_object_id); fputs("},\"state\":", out); print_state_json(out, &vm->state);
  fputs(",\"projections\":[", out);
  for (size_t i = 0; i < vm->projection_count; i++) { if (i) fputc(',', out); print_record(out, vm, &vm->projections[i]); }
  fputs("],\"history\":[", out);
  for (size_t i = 0; i < vm->history_count; i++) { if (i) fputc(',', out); print_record(out, vm, &vm->history[i]); }
  fprintf(
    out,
    "],\"metrics\":{\"instructions\":%" PRIu64 ",\"stateEntries\":%zu,\"warrants\":%zu,\"peakStackDepth\":%zu,\"peakCallFrames\":%zu,\"stackCapacity\":%zu,\"callFrameCapacity\":%zu}}\n",
    vm->executed_instructions,
    vm->state.count,
    vm->warrant_count,
    vm->peak_stack_count,
    vm->peak_frame_count,
    vm->stack_capacity,
    vm->frame_capacity
  );
}

static void print_error(VmError *error, FILE *out) {
  fputs("{\"status\":\"error\",\"code\":", out); print_json_string(out, error->code ? error->code : "RCL_NATIVE_FAILURE");
  fputs(",\"message\":", out); print_json_string(out, error->message[0] ? error->message : "Native VM failure"); fputs("}\n", out);
}

static void vm_free(VM *vm) {
  for (size_t i = 0; i < vm->stack_count; i++) value_free(&vm->stack[i]);
  free(vm->stack);
  vm->stack = NULL;
  vm->stack_count = 0;
  vm->stack_capacity = 0;
  free(vm->frames);
  vm->frames = NULL;
  vm->frame_count = 0;
  vm->frame_capacity = 0;
  state_free(&vm->state);
  for (size_t i = 0; i < vm->warrant_count; i++) { free(vm->warrants[i].subject); free(vm->warrants[i].capability); free(vm->warrants[i].target); }
  transaction_reset(&vm->tx);
  for (size_t i = 0; i < vm->projection_count; i++) record_free(&vm->projections[i]);
  for (size_t i = 0; i < vm->history_count; i++) record_free(&vm->history[i]);
  typed_heap_clear(vm);
  free_program(&vm->program);
}

struct RclVmInstance { VM vm; int loaded; };

static void vm_clear_transient(VM *vm, int clear_state) {
  for (size_t i = 0; i < vm->stack_count; i++) value_free(&vm->stack[i]);
  vm->stack_count = 0;
  for (size_t i = 0; i < vm->warrant_count; i++) { free(vm->warrants[i].subject); free(vm->warrants[i].capability); free(vm->warrants[i].target); }
  vm->warrant_count = 0;
  transaction_reset(&vm->tx);
  for (size_t i = 0; i < vm->projection_count; i++) record_free(&vm->projections[i]);
  vm->projection_count = 0;
  for (size_t i = 0; i < vm->history_count; i++) record_free(&vm->history[i]);
  vm->history_count = 0;
  vm->frame_count = 0;
  vm->executed_instructions = 0;
  vm->peak_stack_count = 0;
  vm->peak_frame_count = 0;
  memset(&vm->error, 0, sizeof(vm->error));
  if (clear_state) {
    state_free(&vm->state);
    typed_heap_clear(vm);
    vm->next_typed_object_id = 1;
    vm->typed_heap_allocated = 0;
    vm->typed_ref_allocated = 0;
    vm->typed_heap_mark_count = 0;
    vm->typed_heap_count = 0;
  }
  if (vm->next_typed_object_id == 0) vm->next_typed_object_id = 1;
}

static char *capture_vm_output(VM *vm, int success) {
  FILE *file = tmpfile();
  if (!file) return NULL;
  if (success) print_success(vm, file); else print_error(&vm->error, file);
  if (fflush(file) != 0 || fseek(file, 0, SEEK_END) != 0) { fclose(file); return NULL; }
  long length = ftell(file);
  if (length < 0 || fseek(file, 0, SEEK_SET) != 0) { fclose(file); return NULL; }
  char *text = (char *)malloc((size_t)length + 1);
  if (!text) { fclose(file); return NULL; }
  size_t read = fread(text, 1, (size_t)length, file);
  text[read] = '\0';
  fclose(file);
  return text;
}

const char *rclvm_version(void) { return RCL_VM_VERSION; }

RclVmInstance *rclvm_instance_create(void) {
  RclVmInstance *instance = (RclVmInstance *)calloc(1, sizeof(RclVmInstance));
  if (instance) instance->vm.next_typed_object_id = 1;
  return instance;
}

void rclvm_instance_destroy(RclVmInstance *instance) {
  if (!instance) return;
  vm_free(&instance->vm);
  for (size_t i = 0; i < instance->vm.provider_count; i++) free(instance->vm.providers[i].provider_id);
  free(instance);
}

int rclvm_instance_load_file(RclVmInstance *instance, const char *path, char *error, size_t error_capacity) {
  if (!instance || !path) return 0;
  if (instance->loaded) {
    vm_free(&instance->vm);
    ProviderRegistration saved[MAX_PROVIDERS]; size_t saved_count = instance->vm.provider_count;
    memcpy(saved, instance->vm.providers, sizeof(saved));
    memset(&instance->vm, 0, sizeof(instance->vm));
    instance->vm.next_typed_object_id = 1;
    memcpy(instance->vm.providers, saved, sizeof(saved)); instance->vm.provider_count = saved_count;
  }
  if (!load_program(path, &instance->vm.program, &instance->vm.error)) {
    if (error && error_capacity) snprintf(error, error_capacity, "%s: %s", instance->vm.error.code ? instance->vm.error.code : "RCL_NATIVE_LOAD", instance->vm.error.message);
    return 0;
  }
  if (instance->vm.next_typed_object_id == 0) instance->vm.next_typed_object_id = 1;
  instance->loaded = 1;
  return 1;
}

int rclvm_instance_register_provider(RclVmInstance *instance, const RclVmProviderV1 *provider, char *error, size_t error_capacity) {
  if (!instance || !provider || !provider->provider_id || !provider->invoke || provider->abi_version != RCLVM_PROVIDER_ABI_V1) {
    if (error && error_capacity) snprintf(error, error_capacity, "Invalid provider registration or ABI version");
    return 0;
  }
  ProviderRegistration *existing = find_provider(&instance->vm, provider->provider_id);
  if (existing) { existing->invoke = provider->invoke; existing->userdata = provider->userdata; return 1; }
  if (instance->vm.provider_count >= MAX_PROVIDERS) {
    if (error && error_capacity) snprintf(error, error_capacity, "Provider registry capacity exceeded");
    return 0;
  }
  ProviderRegistration *slot = &instance->vm.providers[instance->vm.provider_count++];
  slot->provider_id = xstrdup(provider->provider_id); slot->invoke = provider->invoke; slot->userdata = provider->userdata;
  return 1;
}

int rclvm_instance_run(RclVmInstance *instance, int reset_state, char **result_json, char *error, size_t error_capacity) {
  if (!instance || !instance->loaded) {
    if (error && error_capacity) snprintf(error, error_capacity, "No RBC program loaded");
    return 0;
  }
  vm_clear_transient(&instance->vm, reset_state != 0);
  int ok = execute_program(&instance->vm);
  if (result_json) *result_json = capture_vm_output(&instance->vm, ok);
  if (!ok && error && error_capacity) snprintf(error, error_capacity, "%s: %s", instance->vm.error.code ? instance->vm.error.code : "RCL_NATIVE_FAILURE", instance->vm.error.message);
  return ok;
}

int rclvm_instance_reset(RclVmInstance *instance, int clear_state) {
  if (!instance) return 0;
  vm_clear_transient(&instance->vm, clear_state != 0);
  return 1;
}

int rclvm_instance_get_state_text(
  RclVmInstance *instance,
  const char *path,
  char **text,
  size_t *text_length,
  char *error,
  size_t error_capacity
) {
  if (text) *text = NULL;
  if (text_length) *text_length = 0;
  if (!instance || !path || !text) {
    if (error && error_capacity) snprintf(error, error_capacity, "RCL_STATE_ABI_ARGUMENT: instance, path and text output are required");
    return 0;
  }
  const StateEntry *entry = state_find_const(&instance->vm.state, path);
  if (!entry) {
    if (error && error_capacity) snprintf(error, error_capacity, "RCL_STATE_MISSING: Facet '%s' does not exist", path);
    return 0;
  }
  if (entry->value.type != VALUE_STRING) {
    if (error && error_capacity) snprintf(error, error_capacity, "RCL_STATE_TYPE_MISMATCH: Facet '%s' is not Text", path);
    return 0;
  }
  size_t length = strlen(entry->value.string);
  char *copy = (char *)malloc(length + 1);
  if (!copy) {
    if (error && error_capacity) snprintf(error, error_capacity, "RCL_NATIVE_OOM: Unable to copy Text state '%s'", path);
    return 0;
  }
  memcpy(copy, entry->value.string, length + 1);
  *text = copy;
  if (text_length) *text_length = length;
  return 1;
}

int rclvm_instance_get_state_bytes(
  RclVmInstance *instance,
  const char *path,
  uint8_t **bytes,
  size_t *byte_length,
  char *error,
  size_t error_capacity
) {
  if (bytes) *bytes = NULL;
  if (byte_length) *byte_length = 0;
  if (!instance || !path || !bytes) {
    if (error && error_capacity) snprintf(error, error_capacity, "RCL_STATE_ABI_ARGUMENT: instance, path and bytes output are required");
    return 0;
  }
  const StateEntry *entry = state_find_const(&instance->vm.state, path);
  if (!entry) {
    if (error && error_capacity) snprintf(error, error_capacity, "RCL_STATE_MISSING: Facet '%s' does not exist", path);
    return 0;
  }
  if (entry->value.type != VALUE_SEQUENCE || !entry->value.sequence) {
    if (error && error_capacity) snprintf(error, error_capacity, "RCL_STATE_TYPE_MISMATCH: Facet '%s' is not Sequence", path);
    return 0;
  }
  sequence_materialize(entry->value.sequence);
  size_t length = entry->value.sequence->count;
  uint8_t *copy = (uint8_t *)malloc(length ? length : 1);
  if (!copy) {
    if (error && error_capacity) snprintf(error, error_capacity, "RCL_NATIVE_OOM: Unable to copy byte Sequence state '%s'", path);
    return 0;
  }
  for (size_t i = 0; i < length; i++) {
    const Value *item = &entry->value.sequence->items[i];
    if (item->type != VALUE_NUMBER || !isfinite(item->number) || floor(item->number) != item->number || item->number < 0 || item->number > 255) {
      free(copy);
      if (error && error_capacity) snprintf(error, error_capacity, "RCL_STATE_BYTES_INVALID: Facet '%s' item %zu is not an integer byte", path, i);
      return 0;
    }
    copy[i] = (uint8_t)item->number;
  }
  *bytes = copy;
  if (byte_length) *byte_length = length;
  return 1;
}

size_t rclvm_instance_get_peak_stack_depth(const RclVmInstance *instance) {
  return instance ? instance->vm.peak_stack_count : 0;
}

size_t rclvm_instance_get_peak_call_frame_depth(const RclVmInstance *instance) {
  return instance ? instance->vm.peak_frame_count : 0;
}

uint64_t rclvm_instance_get_executed_instruction_count(const RclVmInstance *instance) {
  return instance ? instance->vm.executed_instructions : 0;
}

void rclvm_free_string(char *value) { free(value); }
void rclvm_free_bytes(uint8_t *value) { free(value); }

#ifndef RCLVM_EMBEDDED_ONLY
int main(int argc, char **argv) {
  if (argc != 2) { fprintf(stderr, "Usage: rclvm <program.rbc>\n"); return 2; }
  RclVmInstance *instance = rclvm_instance_create();
  if (!instance) { fprintf(stderr, "Out of memory\n"); return 2; }
  char error[512]; error[0] = '\0';
  if (!rclvm_instance_load_file(instance, argv[1], error, sizeof(error))) {
    fprintf(stderr, "{\"status\":\"error\",\"code\":\"RCL_NATIVE_LOAD\",\"message\":\"%s\"}\n", error);
    rclvm_instance_destroy(instance); return 1;
  }
  char *json = NULL;
  int ok = rclvm_instance_run(instance, 1, &json, error, sizeof(error));
  FILE *out = ok ? stdout : stderr;
  if (json) { fputs(json, out); rclvm_free_string(json); }
  else fprintf(out, "{\"status\":\"error\",\"code\":\"RCL_NATIVE_OUTPUT\",\"message\":\"%s\"}\n", error);
  rclvm_instance_destroy(instance);
  return ok ? 0 : 1;
}
#endif

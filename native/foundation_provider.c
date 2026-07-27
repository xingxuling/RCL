#define _POSIX_C_SOURCE 200809L
#include <ctype.h>
#ifdef _WIN32
#include <windows.h>
#include <bcrypt.h>
#define FOUNDATION_SHA256_LENGTH 32
#else
#include <openssl/sha.h>
#define FOUNDATION_SHA256_LENGTH SHA256_DIGEST_LENGTH
#endif
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "rclvm.h"

#define FOUNDATION_BATCH_A_PROVIDER_ID "rcl.foundation.batch-a"
#define FOUNDATION_META_BATCH_B_PROVIDER_ID "rcl.foundation.meta-batch-b"
#define FOUNDATION_BATCH_C_PROVIDER_ID "rcl.foundation.batch-c"
#define FOUNDATION_RESULT_FORMAT "taowind.rcl-foundation-runtime-result.v0.1"
#define FOUNDATION_HOST_FORMAT "taowind.rcl-foundation-native-host.v0.1"
#define MAX_JSON_TOKENS 4096

typedef enum {
  JSON_UNDEFINED = 0,
  JSON_OBJECT,
  JSON_ARRAY,
  JSON_STRING,
  JSON_PRIMITIVE
} JsonType;

typedef struct {
  JsonType type;
  int start;
  int end;
  int size;
  int parent;
} JsonToken;

typedef struct {
  unsigned int position;
  unsigned int next_token;
  int container;
} JsonParser;

typedef struct {
  const char *capability;
  const char *domain;
  const char *previous_domain;
  const char *create_action;
  const char *inspect_action;
  int confidence_percent;
  int parameter_kind;
} FoundationCapability;

typedef struct {
  const char *provider_id;
  const FoundationCapability *capabilities;
  size_t capability_count;
  const char *order_message;
  size_t call_count;
  size_t cache_hits;
  char last_after_root[65];
} FoundationProviderState;

enum {
  FOUNDATION_PARAMETERS_NONE = 0,
  FOUNDATION_PARAMETERS_META_SPACETIME,
  FOUNDATION_PARAMETERS_META_ACCELERATION,
  FOUNDATION_PARAMETERS_META_COMPRESSION,
  FOUNDATION_PARAMETERS_PHYSICAL,
  FOUNDATION_PARAMETERS_EMBODIMENT
};

static const FoundationCapability FOUNDATION_BATCH_A_CAPABILITIES[] = {
  {
    "quantitative.evaluate",
    "quantitative",
    NULL,
    "measure-create-candidate",
    "measure-observed-state",
    96,
    FOUNDATION_PARAMETERS_NONE
  },
  {
    "knowledge.resolve",
    "knowledge",
    "quantitative",
    "justify-create-candidate",
    "justify-observed-state",
    94,
    FOUNDATION_PARAMETERS_NONE
  },
  {
    "perception.observe",
    "perception",
    "knowledge",
    "observe-create-affordances",
    "observe-existing-affordances",
    92,
    FOUNDATION_PARAMETERS_NONE
  },
  {
    "natural-language.interpret",
    "natural-language-reality",
    "perception",
    "interpret-create-intent",
    "interpret-observation-intent",
    91,
    FOUNDATION_PARAMETERS_NONE
  },
  {
    "understanding.model",
    "understanding-reality",
    "natural-language-reality",
    "model-created-reality",
    "model-observed-reality",
    90,
    FOUNDATION_PARAMETERS_NONE
  },
  {
    "creative.generate",
    "creative-reality",
    "understanding-reality",
    "generate-authorized-candidate",
    "generate-observation-candidate",
    89,
    FOUNDATION_PARAMETERS_NONE
  }
};

static const FoundationCapability FOUNDATION_META_BATCH_B_CAPABILITIES[] = {
  {
    "meta.spacetime.sequence",
    "meta-spacetime",
    NULL,
    "schedule-causal-transition",
    "inspect-causal-timeline",
    97,
    FOUNDATION_PARAMETERS_META_SPACETIME
  },
  {
    "meta.acceleration.bound",
    "meta-acceleration",
    "meta-spacetime",
    "accelerate-with-fidelity-budget",
    "measure-safe-acceleration",
    95,
    FOUNDATION_PARAMETERS_META_ACCELERATION
  },
  {
    "meta.compression.restore",
    "meta-compression",
    "meta-acceleration",
    "compress-with-restore-contract",
    "verify-lossless-restore",
    98,
    FOUNDATION_PARAMETERS_META_COMPRESSION
  }
};

static const FoundationCapability FOUNDATION_BATCH_C_CAPABILITIES[] = {
  {
    "physical.simulate-step",
    "physical",
    NULL,
    "simulate-constrained-step",
    "inspect-physical-state",
    95,
    FOUNDATION_PARAMETERS_PHYSICAL
  },
  {
    "embodiment.integrate",
    "embodiment",
    "physical",
    "integrate-embodied-state",
    "inspect-embodied-state",
    93,
    FOUNDATION_PARAMETERS_EMBODIMENT
  }
};

static JsonToken *json_allocate_token(JsonParser *parser, JsonToken *tokens, size_t capacity) {
  if (parser->next_token >= capacity) return NULL;
  JsonToken *token = &tokens[parser->next_token++];
  token->type = JSON_UNDEFINED;
  token->start = -1;
  token->end = -1;
  token->size = 0;
  token->parent = -1;
  return token;
}

static int json_parse_string(
  JsonParser *parser,
  const char *json,
  size_t length,
  JsonToken *tokens,
  size_t capacity
) {
  unsigned int start = parser->position + 1;
  for (parser->position++; parser->position < length; parser->position++) {
    unsigned char ch = (unsigned char)json[parser->position];
    if (ch == '"') {
      JsonToken *token = json_allocate_token(parser, tokens, capacity);
      if (!token) return -2;
      token->type = JSON_STRING;
      token->start = (int)start;
      token->end = (int)parser->position;
      token->parent = parser->container;
      if (parser->container >= 0) tokens[parser->container].size++;
      return 0;
    }
    if (ch == '\\') {
      parser->position++;
      if (parser->position >= length) return -1;
      ch = (unsigned char)json[parser->position];
      if (ch == 'u') {
        for (int index = 0; index < 4; index++) {
          parser->position++;
          if (parser->position >= length || !isxdigit((unsigned char)json[parser->position])) return -1;
        }
      } else if (!strchr("\"/\\bfnrt", ch)) {
        return -1;
      }
    } else if (ch < 0x20) {
      return -1;
    }
  }
  return -1;
}

static int json_parse_primitive(
  JsonParser *parser,
  const char *json,
  size_t length,
  JsonToken *tokens,
  size_t capacity
) {
  unsigned int start = parser->position;
  for (; parser->position < length; parser->position++) {
    unsigned char ch = (unsigned char)json[parser->position];
    if (ch == ',' || ch == ']' || ch == '}' || isspace(ch)) break;
    if (ch < 0x20 || ch == ':' || ch == '[' || ch == '{' || ch == '"') return -1;
  }
  if (parser->position == start) return -1;
  JsonToken *token = json_allocate_token(parser, tokens, capacity);
  if (!token) return -2;
  token->type = JSON_PRIMITIVE;
  token->start = (int)start;
  token->end = (int)parser->position;
  token->parent = parser->container;
  if (parser->container >= 0) tokens[parser->container].size++;
  if (parser->position > 0) parser->position--;
  return 0;
}

static int json_parse(const char *json, size_t length, JsonToken *tokens, size_t capacity) {
  JsonParser parser = {0, 0, -1};
  for (; parser.position < length; parser.position++) {
    unsigned char ch = (unsigned char)json[parser.position];
    if (isspace(ch) || ch == ':' || ch == ',') continue;
    if (ch == '{' || ch == '[') {
      JsonToken *token = json_allocate_token(&parser, tokens, capacity);
      if (!token) return -2;
      int token_index = (int)parser.next_token - 1;
      token->type = ch == '{' ? JSON_OBJECT : JSON_ARRAY;
      token->start = (int)parser.position;
      token->parent = parser.container;
      if (parser.container >= 0) tokens[parser.container].size++;
      parser.container = token_index;
      continue;
    }
    if (ch == '}' || ch == ']') {
      JsonType expected = ch == '}' ? JSON_OBJECT : JSON_ARRAY;
      if (parser.container < 0 || tokens[parser.container].type != expected) return -1;
      tokens[parser.container].end = (int)parser.position + 1;
      parser.container = tokens[parser.container].parent;
      continue;
    }
    if (ch == '"') {
      int result = json_parse_string(&parser, json, length, tokens, capacity);
      if (result != 0) return result;
      continue;
    }
    int result = json_parse_primitive(&parser, json, length, tokens, capacity);
    if (result != 0) return result;
  }
  if (parser.container != -1 || parser.next_token == 0 || tokens[0].end != (int)length) return -1;
  return (int)parser.next_token;
}

static int json_token_equals(const char *json, const JsonToken *token, const char *value) {
  size_t length = strlen(value);
  return token && token->type == JSON_STRING
    && token->end - token->start == (int)length
    && strncmp(json + token->start, value, length) == 0;
}

static int json_primitive_equals(const char *json, const JsonToken *token, const char *value) {
  size_t length = strlen(value);
  return token && token->type == JSON_PRIMITIVE
    && token->end - token->start == (int)length
    && strncmp(json + token->start, value, length) == 0;
}

static int json_object_get(
  const char *json,
  const JsonToken *tokens,
  int token_count,
  int object_index,
  const char *key
) {
  if (object_index < 0 || object_index >= token_count || tokens[object_index].type != JSON_OBJECT) return -1;
  for (int index = object_index + 1; index + 1 < token_count; index++) {
    if (tokens[index].parent != object_index || !json_token_equals(json, &tokens[index], key)) continue;
    if (tokens[index + 1].parent != object_index) return -1;
    return index + 1;
  }
  return -1;
}

static int json_array_first(const JsonToken *tokens, int token_count, int array_index) {
  if (array_index < 0 || array_index >= token_count || tokens[array_index].type != JSON_ARRAY) return -1;
  for (int index = array_index + 1; index < token_count; index++) {
    if (tokens[index].parent == array_index) return index;
  }
  return -1;
}

static int json_copy_string(
  const char *json,
  const JsonToken *token,
  char *output,
  size_t output_capacity
) {
  if (!token || token->type != JSON_STRING || output_capacity == 0) return 0;
  size_t length = (size_t)(token->end - token->start);
  if (length >= output_capacity) return 0;
  memcpy(output, json + token->start, length);
  output[length] = '\0';
  return 1;
}

static int foundation_sha256(
  const unsigned char *data,
  size_t length,
  unsigned char digest[FOUNDATION_SHA256_LENGTH]
) {
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
  if (BCryptFinishHash(hash, digest, FOUNDATION_SHA256_LENGTH, 0) != 0) goto cleanup;
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

static int foundation_sha256_hex(const char *value, size_t length, char output[65]) {
  unsigned char digest[FOUNDATION_SHA256_LENGTH];
  if (!foundation_sha256((const unsigned char *)value, length, digest)) return 0;
  for (int index = 0; index < FOUNDATION_SHA256_LENGTH; index++) {
    snprintf(output + index * 2, 3, "%02x", digest[index]);
  }
  output[64] = '\0';
  return 1;
}

static const FoundationCapability *find_capability(
  const FoundationProviderState *provider_state,
  const char *capability,
  size_t *index_out
) {
  if (!provider_state) return NULL;
  for (size_t index = 0; index < provider_state->capability_count; index++) {
    if (strcmp(capability, provider_state->capabilities[index].capability) == 0) {
      if (index_out) *index_out = index;
      return &provider_state->capabilities[index];
    }
  }
  return NULL;
}

static int is_create_speech_act(const char *speech_act) {
  return strcmp(speech_act, "create") == 0
    || strcmp(speech_act, "generate") == 0
    || strcmp(speech_act, "build") == 0;
}

static int is_sha256_hex(const char *value) {
  if (!value || strlen(value) != 64) return 0;
  for (size_t index = 0; index < 64; index++) {
    if (!isxdigit((unsigned char)value[index]) || isupper((unsigned char)value[index])) return 0;
  }
  return 1;
}

static int provider_fail(
  char *error,
  size_t error_capacity,
  const char *code,
  const char *message
) {
  if (error && error_capacity) snprintf(error, error_capacity, "%s: %s", code, message);
  return 0;
}

static int json_read_integer(
  const char *json,
  const JsonToken *token,
  long long minimum,
  long long maximum,
  long long *value_out
) {
  if (!token || token->type != JSON_PRIMITIVE || !value_out) return 0;
  size_t length = (size_t)(token->end - token->start);
  if (length == 0 || length >= 32) return 0;
  char buffer[32];
  memcpy(buffer, json + token->start, length);
  buffer[length] = '\0';
  char *end = NULL;
  long long value = strtoll(buffer, &end, 10);
  if (!end || *end != '\0' || value < minimum || value > maximum) return 0;
  *value_out = value;
  return 1;
}

static int json_read_number(
  const char *json,
  const JsonToken *token,
  double minimum,
  double maximum,
  double *value_out
) {
  if (!token || token->type != JSON_PRIMITIVE || !value_out) return 0;
  size_t length = (size_t)(token->end - token->start);
  if (length == 0 || length >= 64) return 0;
  char buffer[64];
  memcpy(buffer, json + token->start, length);
  buffer[length] = '\0';
  char *end = NULL;
  double value = strtod(buffer, &end);
  if (
    !end
    || *end != '\0'
    || value != value
    || value < minimum
    || value > maximum
  ) {
    return 0;
  }
  *value_out = value;
  return 1;
}

static int hex_nibble(unsigned char value) {
  if (value >= '0' && value <= '9') return value - '0';
  if (value >= 'a' && value <= 'f') return value - 'a' + 10;
  return -1;
}

static int compress_and_restore_root(
  const char source_root[65],
  char restored_root[65]
) {
  unsigned char packed[32];
  for (size_t index = 0; index < sizeof(packed); index++) {
    int high = hex_nibble((unsigned char)source_root[index * 2]);
    int low = hex_nibble((unsigned char)source_root[index * 2 + 1]);
    if (high < 0 || low < 0) return 0;
    packed[index] = (unsigned char)((high << 4) | low);
  }
  for (size_t index = 0; index < sizeof(packed); index++) {
    snprintf(restored_root + index * 2, 3, "%02x", packed[index]);
  }
  restored_root[64] = '\0';
  return strcmp(source_root, restored_root) == 0;
}

static int build_parameters_fragment(
  const FoundationCapability *capability,
  const char *request_json,
  const JsonToken *tokens,
  int token_count,
  int input_index,
  int create_mode,
  const char causal_parent[65],
  char *output,
  size_t output_capacity,
  char *error,
  size_t error_capacity
) {
  if (!capability || !output || output_capacity == 0) {
    return provider_fail(
      error,
      error_capacity,
      "RCL_FOUNDATION_PARAMETER_INVALID",
      "Cannot construct Foundation semantic parameters"
    );
  }
  output[0] = '\0';
  if (capability->parameter_kind == FOUNDATION_PARAMETERS_NONE) return 1;

  int length = -1;
  if (capability->parameter_kind == FOUNDATION_PARAMETERS_PHYSICAL) {
    int physical_index = json_object_get(
      request_json,
      tokens,
      token_count,
      input_index,
      "physical"
    );
    int tick_index = physical_index >= 0
      ? json_object_get(request_json, tokens, token_count, physical_index, "tick")
      : -1;
    int dt_index = physical_index >= 0
      ? json_object_get(request_json, tokens, token_count, physical_index, "dtMicros")
      : -1;
    int body_count_index = physical_index >= 0
      ? json_object_get(request_json, tokens, token_count, physical_index, "bodyCount")
      : -1;
    int contact_budget_index = physical_index >= 0
      ? json_object_get(request_json, tokens, token_count, physical_index, "contactBudget")
      : -1;
    long long tick = 0;
    long long dt_micros = 0;
    long long body_count = 0;
    long long contact_budget = 0;
    if (
      physical_index < 0
      || tokens[physical_index].type != JSON_OBJECT
      || !json_read_integer(
        request_json,
        tick_index >= 0 ? &tokens[tick_index] : NULL,
        0,
        1000000000000LL,
        &tick
      )
      || !json_read_integer(
        request_json,
        dt_index >= 0 ? &tokens[dt_index] : NULL,
        1,
        1000000,
        &dt_micros
      )
      || !json_read_integer(
        request_json,
        body_count_index >= 0 ? &tokens[body_count_index] : NULL,
        1,
        1000000,
        &body_count
      )
      || !json_read_integer(
        request_json,
        contact_budget_index >= 0 ? &tokens[contact_budget_index] : NULL,
        0,
        1000000,
        &contact_budget
      )
    ) {
      return provider_fail(
        error,
        error_capacity,
        "RCL_FOUNDATION_PHYSICAL_INVALID",
        "physical requires bounded tick, dtMicros, bodyCount, and contactBudget integers"
      );
    }
    long long tick_after = create_mode ? tick + 1 : tick;
    length = snprintf(
      output,
      output_capacity,
      "\"parameters\":{\"physical\":{"
        "\"solver\":\"deterministic-semi-implicit\","
        "\"tickBefore\":%lld,"
        "\"tickAfter\":%lld,"
        "\"dtMicros\":%lld,"
        "\"bodyCount\":%lld,"
        "\"contactBudget\":%lld,"
        "\"mutationApplied\":%s"
      "}},",
      tick,
      tick_after,
      dt_micros,
      body_count,
      contact_budget,
      create_mode ? "true" : "false"
    );
  } else if (capability->parameter_kind == FOUNDATION_PARAMETERS_EMBODIMENT) {
    int embodiment_index = json_object_get(
      request_json,
      tokens,
      token_count,
      input_index,
      "embodiment"
    );
    int subject_index = embodiment_index >= 0
      ? json_object_get(request_json, tokens, token_count, embodiment_index, "subjectId")
      : -1;
    int command_index = embodiment_index >= 0
      ? json_object_get(request_json, tokens, token_count, embodiment_index, "command")
      : -1;
    const char *subject_id = NULL;
    const char *command = NULL;
    if (subject_index >= 0 && json_token_equals(request_json, &tokens[subject_index], "subject:operator")) {
      subject_id = "subject:operator";
    } else if (subject_index >= 0 && json_token_equals(request_json, &tokens[subject_index], "body:avatar")) {
      subject_id = "body:avatar";
    }
    if (command_index >= 0 && json_token_equals(request_json, &tokens[command_index], "walk")) {
      command = "walk";
    } else if (command_index >= 0 && json_token_equals(request_json, &tokens[command_index], "observe")) {
      command = "observe";
    }
    if (
      embodiment_index < 0
      || tokens[embodiment_index].type != JSON_OBJECT
      || !subject_id
      || !command
    ) {
      return provider_fail(
        error,
        error_capacity,
        "RCL_FOUNDATION_EMBODIMENT_INVALID",
        "embodiment requires a bounded subjectId and command"
      );
    }
    length = snprintf(
      output,
      output_capacity,
      "\"parameters\":{\"embodiment\":{"
        "\"subjectId\":\"%s\","
        "\"command\":\"%s\","
        "\"controlMode\":\"authority-bounded\","
        "\"physicalParentRoot\":\"%s\","
        "\"mutationApplied\":%s"
      "}},",
      subject_id,
      command,
      causal_parent,
      create_mode ? "true" : "false"
    );
  } else if (capability->parameter_kind == FOUNDATION_PARAMETERS_META_SPACETIME) {
    int timeline_index = json_object_get(
      request_json,
      tokens,
      token_count,
      input_index,
      "timeline"
    );
    int tick_index = timeline_index >= 0
      ? json_object_get(request_json, tokens, token_count, timeline_index, "tick")
      : -1;
    int event_count_index = timeline_index >= 0
      ? json_object_get(request_json, tokens, token_count, timeline_index, "eventCount")
      : -1;
    int observer_index = timeline_index >= 0
      ? json_object_get(request_json, tokens, token_count, timeline_index, "observerFrame")
      : -1;
    long long tick = 0;
    long long event_count = 0;
    const char *observer_frame = NULL;
    if (
      timeline_index < 0
      || tokens[timeline_index].type != JSON_OBJECT
      || !json_read_integer(
        request_json,
        tick_index >= 0 ? &tokens[tick_index] : NULL,
        0,
        1000000000000LL,
        &tick
      )
      || !json_read_integer(
        request_json,
        event_count_index >= 0 ? &tokens[event_count_index] : NULL,
        1,
        1000000,
        &event_count
      )
    ) {
      return provider_fail(
        error,
        error_capacity,
        "RCL_FOUNDATION_META_SPACETIME_INVALID",
        "timeline.tick and timeline.eventCount must be bounded integers"
      );
    }
    if (
      observer_index >= 0
      && json_token_equals(request_json, &tokens[observer_index], "subjective-bounded")
    ) {
      observer_frame = "subjective-bounded";
    } else if (
      observer_index >= 0
      && json_token_equals(request_json, &tokens[observer_index], "objective-bounded")
    ) {
      observer_frame = "objective-bounded";
    } else {
      return provider_fail(
        error,
        error_capacity,
        "RCL_FOUNDATION_META_SPACETIME_INVALID",
        "timeline.observerFrame must be subjective-bounded or objective-bounded"
      );
    }
    long long tick_after = create_mode ? tick + event_count : tick;
    length = snprintf(
      output,
      output_capacity,
      "\"parameters\":{\"timeline\":{"
        "\"ordering\":\"causal\","
        "\"tickBefore\":%lld,"
        "\"tickAfter\":%lld,"
        "\"eventCount\":%lld,"
        "\"observerFrame\":\"%s\","
        "\"mutationApplied\":%s"
      "}},",
      tick,
      tick_after,
      event_count,
      observer_frame,
      create_mode ? "true" : "false"
    );
  } else if (capability->parameter_kind == FOUNDATION_PARAMETERS_META_ACCELERATION) {
    int acceleration_index = json_object_get(
      request_json,
      tokens,
      token_count,
      input_index,
      "acceleration"
    );
    int factor_index = acceleration_index >= 0
      ? json_object_get(request_json, tokens, token_count, acceleration_index, "requestedFactor")
      : -1;
    int fidelity_index = acceleration_index >= 0
      ? json_object_get(request_json, tokens, token_count, acceleration_index, "fidelityFloor")
      : -1;
    long long requested_factor = 0;
    double fidelity_floor = 0.0;
    if (
      acceleration_index < 0
      || tokens[acceleration_index].type != JSON_OBJECT
      || !json_read_integer(
        request_json,
        factor_index >= 0 ? &tokens[factor_index] : NULL,
        1,
        64,
        &requested_factor
      )
      || !json_read_number(
        request_json,
        fidelity_index >= 0 ? &tokens[fidelity_index] : NULL,
        0.5,
        1.0,
        &fidelity_floor
      )
    ) {
      return provider_fail(
        error,
        error_capacity,
        "RCL_FOUNDATION_META_ACCELERATION_INVALID",
        "acceleration requires requestedFactor 1..64 and fidelityFloor 0.5..1"
      );
    }
    long long bounded_factor = requested_factor > 8 ? 8 : requested_factor;
    long long effective_factor = create_mode ? bounded_factor : 1;
    length = snprintf(
      output,
      output_capacity,
      "\"parameters\":{\"acceleration\":{"
        "\"mode\":\"bounded\","
        "\"requestedFactor\":%lld,"
        "\"effectiveFactor\":%lld,"
        "\"maximumFactor\":8,"
        "\"fidelityFloor\":%.6f,"
        "\"fidelityPreserved\":true,"
        "\"clamped\":%s,"
        "\"mutationApplied\":%s"
      "}},",
      requested_factor,
      effective_factor,
      fidelity_floor,
      requested_factor > 8 ? "true" : "false",
      create_mode ? "true" : "false"
    );
  } else if (capability->parameter_kind == FOUNDATION_PARAMETERS_META_COMPRESSION) {
    int compression_index = json_object_get(
      request_json,
      tokens,
      token_count,
      input_index,
      "compression"
    );
    int codec_index = compression_index >= 0
      ? json_object_get(request_json, tokens, token_count, compression_index, "codec")
      : -1;
    int restore_index = compression_index >= 0
      ? json_object_get(request_json, tokens, token_count, compression_index, "restoreRequired")
      : -1;
    if (
      compression_index < 0
      || tokens[compression_index].type != JSON_OBJECT
      || codec_index < 0
      || !json_token_equals(request_json, &tokens[codec_index], "content-addressed")
      || restore_index < 0
      || !json_primitive_equals(request_json, &tokens[restore_index], "true")
    ) {
      return provider_fail(
        error,
        error_capacity,
        "RCL_FOUNDATION_META_COMPRESSION_INVALID",
        "compression requires content-addressed codec and restoreRequired=true"
      );
    }
    char restored_root[65];
    if (!compress_and_restore_root(causal_parent, restored_root)) {
      return provider_fail(
        error,
        error_capacity,
        "RCL_FOUNDATION_META_COMPRESSION_RESTORE",
        "The content root could not be packed and restored losslessly"
      );
    }
    length = snprintf(
      output,
      output_capacity,
      "\"parameters\":{\"compression\":{"
        "\"codec\":\"content-addressed-root-pack-v1\","
        "\"scope\":\"content-root-representation\","
        "\"sourceTextBytes\":64,"
        "\"compressedBytes\":32,"
        "\"reversible\":true,"
        "\"restoreRequired\":true,"
        "\"sourceRoot\":\"%s\","
        "\"restoreRoot\":\"%s\","
        "\"restoreVerified\":true,"
        "\"mutationApplied\":%s"
      "}},",
      causal_parent,
      restored_root,
      create_mode ? "true" : "false"
    );
  }

  if (length < 0 || (size_t)length >= output_capacity) {
    return provider_fail(
      error,
      error_capacity,
      "RCL_FOUNDATION_RESPONSE_LIMIT",
      "Foundation semantic parameters exceeded their deterministic bound"
    );
  }
  return 1;
}

static int foundation_provider_invoke(
  void *userdata,
  const char *capability_name,
  const char *request_json,
  char *response_json,
  size_t response_capacity,
  char *error,
  size_t error_capacity
) {
  FoundationProviderState *provider_state = (FoundationProviderState *)userdata;
  size_t capability_index = 0;
  const FoundationCapability *capability = find_capability(
    provider_state,
    capability_name,
    &capability_index
  );
  if (!capability) {
    return provider_fail(
      error,
      error_capacity,
      "RCL_FOUNDATION_CAPABILITY_DENIED",
      "The requested capability is outside the registered Foundation batch"
    );
  }
  if (!provider_state || capability_index != provider_state->call_count) {
    return provider_fail(
      error,
      error_capacity,
      "RCL_FOUNDATION_CAUSAL_ORDER",
      provider_state
        ? provider_state->order_message
        : "Foundation capabilities require provider state"
    );
  }

  size_t request_length = strlen(request_json);
  JsonToken *tokens = (JsonToken *)calloc(MAX_JSON_TOKENS, sizeof(JsonToken));
  if (!tokens) return provider_fail(error, error_capacity, "RCL_FOUNDATION_OOM", "Cannot allocate JSON token storage");
  int token_count = json_parse(request_json, request_length, tokens, MAX_JSON_TOKENS);
  if (token_count < 1 || tokens[0].type != JSON_OBJECT) {
    free(tokens);
    return provider_fail(error, error_capacity, "RCL_FOUNDATION_REQUEST_INVALID", "Provider request must be one valid JSON object");
  }

  int authorized_index = json_object_get(request_json, tokens, token_count, 0, "authorized");
  if (!json_primitive_equals(request_json, authorized_index >= 0 ? &tokens[authorized_index] : NULL, "true")) {
    free(tokens);
    return provider_fail(error, error_capacity, "RCL_FOUNDATION_AUTHORITY_DENIED", "authorized=true is required");
  }
  int aif_index = json_object_get(request_json, tokens, token_count, 0, "aifDecision");
  if (aif_index < 0 || !json_token_equals(request_json, &tokens[aif_index], "stable")) {
    free(tokens);
    return provider_fail(error, error_capacity, "RCL_FOUNDATION_AIF_REJECTED", "aifDecision must be stable");
  }
  int evidence_index = json_object_get(request_json, tokens, token_count, 0, "evidence");
  int causal_index = json_object_get(request_json, tokens, token_count, 0, "causalParents");
  if (
    evidence_index < 0
    || tokens[evidence_index].type != JSON_ARRAY
    || tokens[evidence_index].size == 0
    || causal_index < 0
    || tokens[causal_index].type != JSON_ARRAY
    || tokens[causal_index].size == 0
  ) {
    free(tokens);
    return provider_fail(
      error,
      error_capacity,
      "RCL_FOUNDATION_EVIDENCE_REQUIRED",
      "Non-empty evidence and causalParents arrays are required"
    );
  }

  int input_index = json_object_get(request_json, tokens, token_count, 0, "input");
  if (input_index < 0 || tokens[input_index].type != JSON_OBJECT) {
    free(tokens);
    return provider_fail(error, error_capacity, "RCL_FOUNDATION_INPUT_REQUIRED", "input must be a JSON object");
  }
  int speech_act_index = json_object_get(request_json, tokens, token_count, input_index, "speechAct");
  char speech_act[64] = "inspect";
  if (speech_act_index >= 0 && !json_copy_string(request_json, &tokens[speech_act_index], speech_act, sizeof(speech_act))) {
    free(tokens);
    return provider_fail(error, error_capacity, "RCL_FOUNDATION_INPUT_INVALID", "speechAct must be a short Text value");
  }

  char causal_parent[65] = {0};
  if (capability->previous_domain) {
    int parent_index = json_object_get(request_json, tokens, token_count, 0, "parent");
    if (parent_index < 0 || tokens[parent_index].type != JSON_OBJECT) {
      free(tokens);
      return provider_fail(error, error_capacity, "RCL_FOUNDATION_PARENT_REQUIRED", "The previous Foundation result is required");
    }
    int format_index = json_object_get(request_json, tokens, token_count, parent_index, "format");
    int domain_index = json_object_get(request_json, tokens, token_count, parent_index, "domain");
    int state_delta_index = json_object_get(request_json, tokens, token_count, parent_index, "stateDelta");
    int after_root_index = state_delta_index >= 0
      ? json_object_get(request_json, tokens, token_count, state_delta_index, "afterRoot")
      : -1;
    if (
      format_index < 0
      || !json_token_equals(request_json, &tokens[format_index], FOUNDATION_RESULT_FORMAT)
      || domain_index < 0
      || !json_token_equals(request_json, &tokens[domain_index], capability->previous_domain)
      || after_root_index < 0
      || !json_copy_string(request_json, &tokens[after_root_index], causal_parent, sizeof(causal_parent))
      || !is_sha256_hex(causal_parent)
      || strcmp(causal_parent, provider_state->last_after_root) != 0
    ) {
      free(tokens);
      return provider_fail(
        error,
        error_capacity,
        "RCL_FOUNDATION_PARENT_INVALID",
        "The parent result format, predecessor domain, or afterRoot is invalid"
      );
    }
  } else {
    int first_parent_index = json_array_first(tokens, token_count, causal_index);
    if (
      first_parent_index < 0
      || !json_copy_string(request_json, &tokens[first_parent_index], causal_parent, sizeof(causal_parent))
      || !is_sha256_hex(causal_parent)
    ) {
      free(tokens);
      return provider_fail(
        error,
        error_capacity,
        "RCL_FOUNDATION_EVIDENCE_REQUIRED",
        "The first causal parent must be a SHA-256 root"
      );
    }
  }

  char request_root[65];
  if (!foundation_sha256_hex(request_json, request_length, request_root)) {
    free(tokens);
    return provider_fail(error, error_capacity, "RCL_FOUNDATION_SHA256", "Cannot hash the provider request");
  }
  char transition_material[512];
  int transition_length = snprintf(
    transition_material,
    sizeof(transition_material),
    "%s|%s|%s|%s|%s",
    capability->domain,
    capability->capability,
    speech_act,
    causal_parent,
    request_root
  );
  if (
    transition_length < 0
    || (size_t)transition_length >= sizeof(transition_material)
  ) {
    free(tokens);
    return provider_fail(error, error_capacity, "RCL_FOUNDATION_TRANSITION_LIMIT", "Transition material exceeded its deterministic bound");
  }
  char after_root[65];
  if (!foundation_sha256_hex(transition_material, (size_t)transition_length, after_root)) {
    free(tokens);
    return provider_fail(error, error_capacity, "RCL_FOUNDATION_SHA256", "Cannot hash the provider transition");
  }

  int create_mode = is_create_speech_act(speech_act);
  const char *selected_action = create_mode
    ? capability->create_action
    : capability->inspect_action;
  char parameters_fragment[1024];
  if (!build_parameters_fragment(
    capability,
    request_json,
    tokens,
    token_count,
    input_index,
    create_mode,
    causal_parent,
    parameters_fragment,
    sizeof(parameters_fragment),
    error,
    error_capacity
  )) {
    free(tokens);
    return 0;
  }
  double confidence = (double)capability->confidence_percent / 100.0;
  int response_length = snprintf(
    response_json,
    response_capacity,
    "{"
      "\"format\":\"" FOUNDATION_RESULT_FORMAT "\","
      "\"contractVersion\":\"0.1.0\","
      "\"domain\":\"%s\","
      "\"proposal\":{"
        "\"name\":\"%s\","
        "\"kind\":\"FoundationNativeProviderBridge\","
        "\"status\":\"proposed\","
        "\"mode\":\"bridge\","
        "\"provider\":\"%s\","
        "\"capability\":\"%s\","
        "\"selectedAction\":\"%s\","
        "%s"
        "\"changes\":[{"
          "\"path\":\"foundation.%s.result\","
          "\"operation\":\"set\","
          "\"valueRoot\":\"%s\""
        "}]"
      "},"
      "\"constraints\":["
        "{\"id\":\"authority\",\"satisfied\":true},"
        "{\"id\":\"adaptive-invariant-field\",\"satisfied\":true},"
        "{\"id\":\"evidence\",\"satisfied\":true},"
        "{\"id\":\"causal-order\",\"satisfied\":true}"
      "],"
      "\"stateDelta\":{"
        "\"beforeRoot\":\"%s\","
        "\"afterRoot\":\"%s\","
        "\"changes\":[{"
          "\"path\":\"foundation.%s.result\","
          "\"operation\":\"set\","
          "\"valueRoot\":\"%s\""
        "}]"
      "},"
      "\"evidence\":[{"
        "\"type\":\"native-provider-receipt\","
        "\"provider\":\"%s\","
        "\"capability\":\"%s\","
        "\"requestRoot\":\"%s\","
        "\"causalParent\":\"%s\""
      "}],"
      "\"confidence\":%.2f,"
      "\"authorityRequired\":[\"foundation.%s.propose\"],"
      "\"replayMetadata\":{"
        "\"deterministic\":true,"
        "\"mode\":\"bridge\","
        "\"providerAbi\":1,"
        "\"providerId\":\"%s\","
        "\"capability\":\"%s\","
        "\"requestRoot\":\"%s\","
        "\"beforeRoot\":\"%s\","
        "\"afterRoot\":\"%s\","
        "\"causalParents\":[\"%s\"],"
        "\"sequence\":%zu,"
        "\"aifDecision\":\"stable\""
      "}"
    "}",
    capability->domain,
    capability->capability,
    provider_state->provider_id,
    capability->capability,
    selected_action,
    parameters_fragment,
    capability->domain,
    after_root,
    causal_parent,
    after_root,
    capability->domain,
    after_root,
    provider_state->provider_id,
    capability->capability,
    request_root,
    causal_parent,
    confidence,
    capability->domain,
    provider_state->provider_id,
    capability->capability,
    request_root,
    causal_parent,
    after_root,
    causal_parent,
    capability_index + 1
  );
  free(tokens);
  if (response_length < 0 || (size_t)response_length >= response_capacity) {
    return provider_fail(error, error_capacity, "RCL_FOUNDATION_RESPONSE_LIMIT", "Provider response exceeded the ABI response buffer");
  }
  provider_state->call_count++;
  memcpy(provider_state->last_after_root, after_root, sizeof(provider_state->last_after_root));
  return 1;
}

static void print_host_error(const char *message) {
  fputs("{\"status\":\"error\",\"code\":\"RCL_FOUNDATION_NATIVE_HOST\",\"message\":\"", stderr);
  for (const unsigned char *cursor = (const unsigned char *)message; *cursor; cursor++) {
    if (*cursor == '"' || *cursor == '\\') {
      fputc('\\', stderr);
      fputc(*cursor, stderr);
    } else if (*cursor >= 0x20) {
      fputc(*cursor, stderr);
    }
  }
  fputs("\"}\n", stderr);
}

int main(int argc, char **argv) {
  if (argc != 2) {
    print_host_error("Usage: rclfoundation <foundation-batch.rbc>");
    return 2;
  }

  char error[512] = {0};
  char *vm_json = NULL;
  FoundationProviderState batch_a_state = {
    FOUNDATION_BATCH_A_PROVIDER_ID,
    FOUNDATION_BATCH_A_CAPABILITIES,
    sizeof(FOUNDATION_BATCH_A_CAPABILITIES)
      / sizeof(FOUNDATION_BATCH_A_CAPABILITIES[0]),
    "Foundation Batch A capabilities must execute in the declared six-domain causal order",
    0,
    0,
    {0}
  };
  FoundationProviderState meta_batch_b_state = {
    FOUNDATION_META_BATCH_B_PROVIDER_ID,
    FOUNDATION_META_BATCH_B_CAPABILITIES,
    sizeof(FOUNDATION_META_BATCH_B_CAPABILITIES)
      / sizeof(FOUNDATION_META_BATCH_B_CAPABILITIES[0]),
    "Foundation Meta Batch B capabilities must execute in spacetime, acceleration, compression order",
    0,
    0,
    {0}
  };
  FoundationProviderState batch_c_state = {
    FOUNDATION_BATCH_C_PROVIDER_ID,
    FOUNDATION_BATCH_C_CAPABILITIES,
    sizeof(FOUNDATION_BATCH_C_CAPABILITIES)
      / sizeof(FOUNDATION_BATCH_C_CAPABILITIES[0]),
    "Foundation Batch C capabilities must execute in physical then embodiment order",
    0,
    0,
    {0}
  };
  RclVmInstance *vm = rclvm_instance_create();
  if (!vm) {
    print_host_error("Cannot create RCL Native VM instance");
    return 2;
  }

  const char *disable_provider = getenv("RCL_FOUNDATION_DISABLE_PROVIDER");
  if (!disable_provider || strcmp(disable_provider, "1") != 0) {
    RclVmProviderV1 providers[] = {
      {
        RCLVM_PROVIDER_ABI_V1,
        FOUNDATION_BATCH_A_PROVIDER_ID,
        foundation_provider_invoke,
        &batch_a_state
      },
      {
        RCLVM_PROVIDER_ABI_V1,
        FOUNDATION_META_BATCH_B_PROVIDER_ID,
        foundation_provider_invoke,
        &meta_batch_b_state
      },
      {
        RCLVM_PROVIDER_ABI_V1,
        FOUNDATION_BATCH_C_PROVIDER_ID,
        foundation_provider_invoke,
        &batch_c_state
      }
    };
    for (size_t index = 0; index < sizeof(providers) / sizeof(providers[0]); index++) {
      if (!rclvm_instance_register_provider(vm, &providers[index], error, sizeof(error))) {
        print_host_error(error);
        rclvm_instance_destroy(vm);
        return 1;
      }
    }
  }

  if (!rclvm_instance_load_file(vm, argv[1], error, sizeof(error))) {
    print_host_error(error);
    rclvm_instance_destroy(vm);
    return 1;
  }
  if (!rclvm_instance_run(vm, 1, &vm_json, error, sizeof(error))) {
    if (vm_json) {
      fputs(vm_json, stderr);
      rclvm_free_string(vm_json);
    } else {
      print_host_error(error);
    }
    rclvm_instance_destroy(vm);
    return 1;
  }

  size_t active_provider_count = 0;
  if (batch_a_state.call_count > 0) active_provider_count++;
  if (meta_batch_b_state.call_count > 0) active_provider_count++;
  if (batch_c_state.call_count > 0) active_provider_count++;
  if (active_provider_count > 1) {
    print_host_error(
      "RCL_FOUNDATION_PROVIDER_SCOPE: one bytecode execution must target exactly one Foundation batch"
    );
    rclvm_free_string(vm_json);
    rclvm_instance_destroy(vm);
    return 1;
  }
  FoundationProviderState *active_provider = &batch_a_state;
  if (meta_batch_b_state.call_count > 0) active_provider = &meta_batch_b_state;
  if (batch_c_state.call_count > 0) active_provider = &batch_c_state;
  size_t vm_json_length = strlen(vm_json);
  while (vm_json_length > 0 && isspace((unsigned char)vm_json[vm_json_length - 1])) vm_json_length--;
  printf(
    "{\"format\":\"" FOUNDATION_HOST_FORMAT "\","
    "\"providerHost\":{\"providerId\":\"%s\","
    "\"providerAbi\":1,\"providerCallCount\":%zu,\"cacheHits\":%zu,\"cacheHitRate\":0},"
    "\"native\":",
    active_provider->provider_id,
    active_provider->call_count,
    active_provider->cache_hits
  );
  fwrite(vm_json, 1, vm_json_length, stdout);
  fputs("}\n", stdout);

  rclvm_free_string(vm_json);
  rclvm_instance_destroy(vm);
  return 0;
}

#ifndef RCL_DOMAIN_VALUE_H
#define RCL_DOMAIN_VALUE_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

#define RCL_DOMAIN_VALUE_ABI_V1 1u
#define RCL_DOMAIN_VALUE_MAX_DEPTH 64u
#define RCL_DOMAIN_VALUE_MAX_ITEMS 65536u
#define RCL_DOMAIN_VALUE_MAX_TEXT_BYTES (16u * 1024u * 1024u)

typedef enum {
  RCL_DOMAIN_VALUE_NULL = 0,
  RCL_DOMAIN_VALUE_NUMBER = 1,
  RCL_DOMAIN_VALUE_TRUTH = 2,
  RCL_DOMAIN_VALUE_TEXT = 3,
  RCL_DOMAIN_VALUE_SEQUENCE = 4,
  RCL_DOMAIN_VALUE_RECORD = 5
} RclDomainValueKind;

typedef struct RclDomainValueV1 RclDomainValueV1;

typedef struct {
  char *name;
  RclDomainValueV1 *value;
} RclDomainFieldV1;

struct RclDomainValueV1 {
  unsigned int abi_version;
  RclDomainValueKind kind;
  char *semantic_type;
  union {
    double number;
    int truth;
    struct {
      char *data;
      size_t length;
    } text;
    struct {
      RclDomainValueV1 *items;
      size_t count;
    } sequence;
    struct {
      char *type_name;
      RclDomainFieldV1 *fields;
      size_t count;
    } record;
  } as;
};

void rcl_domain_value_init(RclDomainValueV1 *value);
void rcl_domain_value_free(RclDomainValueV1 *value);
int rcl_domain_value_clone(RclDomainValueV1 *target, const RclDomainValueV1 *source);
int rcl_domain_value_validate(const RclDomainValueV1 *value);

int rcl_domain_value_set_null(RclDomainValueV1 *value, const char *semantic_type);
int rcl_domain_value_set_number(RclDomainValueV1 *value, double number, const char *semantic_type);
int rcl_domain_value_set_truth(RclDomainValueV1 *value, int truth, const char *semantic_type);
int rcl_domain_value_set_text(RclDomainValueV1 *value, const char *text, const char *semantic_type);
int rcl_domain_value_set_text_n(RclDomainValueV1 *value, const char *text, size_t length, const char *semantic_type);
int rcl_domain_value_make_sequence(RclDomainValueV1 *value, size_t count, const char *semantic_type);
int rcl_domain_value_sequence_set(RclDomainValueV1 *sequence, size_t index, const RclDomainValueV1 *item);
int rcl_domain_value_make_record(RclDomainValueV1 *value, const char *type_name, size_t field_count, const char *semantic_type);
int rcl_domain_value_record_set(RclDomainValueV1 *record, size_t index, const char *field_name, const RclDomainValueV1 *field_value);
int rcl_domain_value_equal(const RclDomainValueV1 *left, const RclDomainValueV1 *right);

#ifdef __cplusplus
}
#endif

#endif

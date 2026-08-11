#ifndef RCL_DOMAIN_ORGAN_H
#define RCL_DOMAIN_ORGAN_H

#include <stddef.h>
#include "rcl_domain_value.h"

#ifdef __cplusplus
extern "C" {
#endif

#define RCL_DOMAIN_ORGAN_ABI_V1 1u
#define RCL_DOMAIN_ORGAN_MAX 128u
#define RCL_DOMAIN_ERROR_CODE_MAX 128u
#define RCL_DOMAIN_ERROR_MESSAGE_MAX 512u

typedef enum {
  RCL_DOMAIN_ORGAN_QUARANTINED = 0,
  RCL_DOMAIN_ORGAN_DIFFERENTIAL_VERIFIED = 1,
  RCL_DOMAIN_ORGAN_NATIVE_CANDIDATE = 2,
  RCL_DOMAIN_ORGAN_NATIVE_VERIFIED = 3
} RclDomainOrganEvidenceTier;

typedef struct {
  char code[RCL_DOMAIN_ERROR_CODE_MAX];
  char message[RCL_DOMAIN_ERROR_MESSAGE_MAX];
} RclDomainOrganErrorV1;

void rcl_domain_organ_error_clear(RclDomainOrganErrorV1 *error);
void rcl_domain_organ_error_set(RclDomainOrganErrorV1 *error, const char *code, const char *message);

typedef int (*RclDomainOrganInvokeFn)(
  void *userdata,
  const char *domain,
  const char *operation,
  const RclDomainValueV1 *args,
  size_t argc,
  RclDomainValueV1 *result,
  RclDomainOrganErrorV1 *error
);

typedef struct {
  unsigned int abi_version;
  const char *domain;
  const char *operation;
  const char *semantic_identity;
  const char *implementation_id;
  const char *artifact_root;
  RclDomainOrganEvidenceTier evidence_tier;
  int deterministic;
  RclDomainOrganInvokeFn invoke;
  void *userdata;
} RclDomainOrganV1;

typedef struct {
  RclDomainOrganV1 entries[RCL_DOMAIN_ORGAN_MAX];
  size_t count;
} RclDomainOrganRegistry;

void rcl_domain_organ_registry_init(RclDomainOrganRegistry *registry);
void rcl_domain_organ_registry_free(RclDomainOrganRegistry *registry);
int rcl_domain_organ_register(RclDomainOrganRegistry *registry, const RclDomainOrganV1 *organ, char *error, size_t error_capacity);
const RclDomainOrganV1 *rcl_domain_organ_resolve(const RclDomainOrganRegistry *registry, const char *domain, const char *operation);
int rcl_domain_organ_invoke(
  const RclDomainOrganRegistry *registry,
  const char *domain,
  const char *operation,
  RclDomainOrganEvidenceTier required_tier,
  const RclDomainValueV1 *args,
  size_t argc,
  RclDomainValueV1 *result,
  RclDomainOrganErrorV1 *error
);

#ifdef __cplusplus
}
#endif

#endif

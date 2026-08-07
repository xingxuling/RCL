#ifndef RCL_DOMAIN_ADMITTED_ORGANS_H
#define RCL_DOMAIN_ADMITTED_ORGANS_H

#include "rcl_domain_organ.h"

#ifdef __cplusplus
extern "C" {
#endif

const RclDomainOrganV1 *rcl_domain_admitted_candidates_v01(size_t *count);

int rcl_domain_register_admitted_candidates_v01(
  RclDomainOrganRegistry *registry,
  char *error,
  size_t error_capacity
);

#ifdef __cplusplus
}
#endif

#endif

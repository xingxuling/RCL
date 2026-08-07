#ifndef RCL_DOMAIN_VM_CANDIDATE_H
#define RCL_DOMAIN_VM_CANDIDATE_H

#include "rclvm.h"
#include "rcl_domain_organ.h"

#ifdef __cplusplus
extern "C" {
#endif

#define RCLVM_DOMAIN_CANDIDATE_ABI_V1 1u

RCLVM_API int rclvm_instance_register_domain_organ(
  RclVmInstance *instance,
  const RclDomainOrganV1 *organ,
  char *error,
  size_t error_capacity
);

RCLVM_API int rclvm_instance_set_domain_minimum_tier(
  RclVmInstance *instance,
  RclDomainOrganEvidenceTier minimum_tier,
  char *error,
  size_t error_capacity
);

RCLVM_API size_t rclvm_instance_domain_organ_count(const RclVmInstance *instance);
RCLVM_API RclDomainOrganEvidenceTier rclvm_instance_domain_minimum_tier(const RclVmInstance *instance);

#ifdef __cplusplus
}
#endif

#endif

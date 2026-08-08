#ifndef RCL_CANONICAL_NUMBER_V2_H
#define RCL_CANONICAL_NUMBER_V2_H

#include <stdint.h>

#define RCL_CANONICAL_NUMBER_ENCODING_V2 "rcl.canonical-number.v2"
#define RCL_CANONICAL_NUMBER_V2_TOKEN_LENGTH 18

int rcl_canonical_number_v2_encode(double value, char output[RCL_CANONICAL_NUMBER_V2_TOKEN_LENGTH + 1]);
int rcl_canonical_number_v2_encode_bits(uint64_t raw_bits, char output[RCL_CANONICAL_NUMBER_V2_TOKEN_LENGTH + 1]);

#endif

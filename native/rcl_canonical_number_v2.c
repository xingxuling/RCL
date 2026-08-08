#include "rcl_canonical_number_v2.h"

#include <math.h>
#include <string.h>

static const uint64_t EXPONENT_MASK = UINT64_C(0x7ff0000000000000);
static const uint64_t FRACTION_MASK = UINT64_C(0x000fffffffffffff);
static const uint64_t SIGN_MASK = UINT64_C(0x8000000000000000);
static const uint64_t ZERO_MASK = UINT64_C(0x7fffffffffffffff);
static const char HEX[] = "0123456789abcdef";

int rcl_canonical_number_v2_encode_bits(uint64_t raw_bits, char output[RCL_CANONICAL_NUMBER_V2_TOKEN_LENGTH + 1]) {
  uint64_t bits = raw_bits;
  if ((bits & EXPONENT_MASK) == EXPONENT_MASK) return 0;
  if ((bits & ZERO_MASK) == 0) bits = 0;
  output[0] = '0';
  output[1] = 'x';
  for (int index = 0; index < 16; index++) {
    const int shift = (15 - index) * 4;
    output[2 + index] = HEX[(bits >> shift) & UINT64_C(0xf)];
  }
  output[RCL_CANONICAL_NUMBER_V2_TOKEN_LENGTH] = '\0';
  return 1;
}

int rcl_canonical_number_v2_encode(double value, char output[RCL_CANONICAL_NUMBER_V2_TOKEN_LENGTH + 1]) {
  uint64_t raw_bits = 0;
  if (!isfinite(value)) return 0;
  memcpy(&raw_bits, &value, sizeof(raw_bits));
  return rcl_canonical_number_v2_encode_bits(raw_bits, output);
}

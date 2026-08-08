#include "rcl_canonical_number_v2.h"

#include <ctype.h>
#include <stdio.h>
#include <stdint.h>

static int hex_value(int value) {
  if (value >= '0' && value <= '9') return value - '0';
  if (value >= 'a' && value <= 'f') return value - 'a' + 10;
  if (value >= 'A' && value <= 'F') return value - 'A' + 10;
  return -1;
}

static int parse_bits(const char *text, uint64_t *bits) {
  const char *cursor = text;
  if (cursor[0] == '0' && (cursor[1] == 'x' || cursor[1] == 'X')) cursor += 2;
  int count = 0;
  uint64_t result = 0;
  for (; count < 16 && cursor[count]; count++) {
    int nibble = hex_value((unsigned char)cursor[count]);
    if (nibble < 0) return 0;
    result = (result << 4) | (uint64_t)nibble;
  }
  if (count != 16) return 0;
  if (cursor[count] && !isspace((unsigned char)cursor[count])) return 0;
  *bits = result;
  return 1;
}

int main(void) {
  char line[128];
  char output[RCL_CANONICAL_NUMBER_V2_TOKEN_LENGTH + 1];
  int invalid_seen = 0;
  while (fgets(line, sizeof(line), stdin)) {
    uint64_t bits = 0;
    if (!parse_bits(line, &bits) || !rcl_canonical_number_v2_encode_bits(bits, output)) {
      fputs("ERROR\n", stdout);
      invalid_seen = 1;
      continue;
    }
    puts(output);
  }
  return invalid_seen ? 2 : 0;
}

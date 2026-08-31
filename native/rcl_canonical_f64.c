#include <errno.h>
#include <inttypes.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int canonical_f64_hex(const char *text, char out[17]) {
  errno = 0;
  char *end = NULL;
  double value = strtod(text, &end);
  if (!end || *end != '\0' || !isfinite(value)) return 0;
  if (value == 0.0) value = 0.0; /* normalize -0 to +0 */
  uint64_t bits = 0;
  memcpy(&bits, &value, sizeof(bits));
  snprintf(out, 17, "%016" PRIx64, bits);
  return 1;
}

int main(int argc, char **argv) {
  if (argc < 2) {
    fprintf(stderr, "usage: rcl_canonical_f64 <number>...\n");
    return 2;
  }
  for (int i = 1; i < argc; i++) {
    char hex[17];
    if (!canonical_f64_hex(argv[i], hex)) {
      fprintf(stderr, "RCL_CANONICAL_F64_INVALID:%s\n", argv[i]);
      return 1;
    }
    printf("%s\n", hex);
  }
  return 0;
}

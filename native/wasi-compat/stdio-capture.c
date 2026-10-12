#include <stdio.h>

/* WASI lacks tmpfile. The runner gives each process its own disposable /tmp.
 * This adapter supplies a seekable stream for the existing VM JSON capture. */
FILE *tmpfile(void) {
  static unsigned long next = 0;
  char name[96];
  snprintf(name, sizeof(name), "/tmp/rcl-capture-%lu.tmp", ++next);
  return fopen(name, "w+b");
}

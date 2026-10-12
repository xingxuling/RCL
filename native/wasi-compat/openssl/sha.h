#ifndef RCL_WASI_SHA_COMPAT_H
#define RCL_WASI_SHA_COMPAT_H
#include <stddef.h>
/* Only the SHA-256 call shape used by rclvm.c is adapted here. The implementation
 * is Zig's standard SHA-256, linked into the WASI artifact; no OpenSSL is claimed. */
#define SHA256_DIGEST_LENGTH 32
unsigned char *SHA256(const unsigned char *data, size_t length, unsigned char *digest);
#endif

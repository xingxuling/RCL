const std = @import("std");

export fn SHA256(data: [*]const u8, length: usize, digest: [*]u8) [*]u8 {
    var result: [32]u8 = undefined;
    std.crypto.hash.sha2.Sha256.hash(data[0..length], &result, .{});
    @memcpy(digest[0..32], &result);
    return digest;
}

# Verified content-addressed cache materialization

The existing package cache can now be independently verified and restored into a
fresh source project. The public package exports are
`verifyContentAddressedCache(cacheDir, options)` and
`materializeContentAddressedCache(cacheDir, newDirectory, options)`.

Both accept `expectedCacheRoot` and `expectedLockRoot`. Verification checks the
index's format, version, rooted metadata, exact file count, object addresses,
lengths and SHA-256 content. Duplicate content can back multiple files; portable
path aliases, conflicting file/directory paths and object paths outside the cache
are rejected. The index size limit is 16 MiB. Cached objects and source contents
are read before materialization reserves its destination.

Materialization never overwrites an existing destination. After copying admitted
bytes, it reuses `buildPackageLock` to recompile the source project and checks the
original lock root and package identity. The reconstructed lock is written only
after these checks pass. A failure after destination creation leaves a partial
directory without an acknowledged lock; no existing project is deleted or replaced.
No dependency is downloaded. The cache covers the source-project file inventory;
it does not establish native execution, remote dependency availability or a
complete runtime installation.

```text
rcl package-cache <package-directory> <cache-directory>
rcl package-cache-verify <cache-directory> --expected-cache-root <trusted-root>
rcl package-cache-materialize <cache-directory> <new-directory> --expected-cache-root <trusted-root> --expected-lock-root <trusted-lock-root>
```

The two new CLI operations reject unknown, repeated, missing and malformed flags
before writing a destination. Verification/materialization failure exits nonzero.
The original cache command now also reports failure when source locking fails.
It no longer reports a successful cache for invalid source packages or replaces a
corrupt content-addressed object. Existing equal objects are reused.

In-project caches must be under the package-lock inventory's already excluded
`.rcl-cache`, `cache` or `release*` areas; other in-project cache paths reject to
avoid recursively including cache outputs in the next package lock. External
cache directories remain supported. Directory junctions and index symlinks cannot
redirect cache writes.

Nine new behavior checks pass, including identical-content deduplication, exact
restored bytes/lock, corrupted data, recomputed hostile manifests, false lock
claims, external pins, repeated default population, existing targets, Windows
junctions and actual public CLI operations. Four relevant existing package lock,
cache and CLI/release regressions also pass. Logs are retained under
`output/module-development-20261028/package-cache.log` and
`output/module-development-20261028/package-cache-regression.log`.

Root consistency is not publisher authentication. Keep trusted roots outside the
cache. This local increment does not publish or deploy a package; GitHub Actions
were not run.

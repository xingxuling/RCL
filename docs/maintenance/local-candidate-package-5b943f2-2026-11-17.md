# Local candidate package, 5b943f2

This local npm archive was built from clean source commit `5b943f28a616a95d1a2e017b6912e55523193d96` using `npm pack --ignore-scripts`. Its manifest has 3,524 entries; it is 66,699,738 bytes and SHA-256 `e66a4508a5feb49a91d9b099408abf2238cddf2f81728c68bd8fdaa5b5ba924c`. The installed `selfhost/compiler.rbc` has SHA-256 `65a258d9521a4ed2d77d16a8505b4cc55fdcf8f4d04d9633c1859965e47b3c91`.

The archive was installed offline in a separate local directory with lifecycle scripts disabled. Installed native/reference compiler smoke checks compared valid nested styling and punctuation/keyword strings byte-for-byte and rejected malformed facet syntax, quoted class identity, duplicate UI names and a missing expression parenthesis, retaining the previous output. The installed non-durable v3 candidate session example also ran and observed different state roots after the AstNode literal spelling changed from `1` to `01`.

This is a local Windows candidate, not publication, hosted CI, complete package testing, external publisher authentication, durable-v3 migration or cross-platform acceptance. V3 remains opt-in and v2 remains the default. This note was added after packaging and is not in the archive.

After packaging, the checkout's version contract verification passed with package version `2.0.0` and `RESEARCH_PREVIEW` readiness; the v2 stable and v3 candidate state-root suites also passed locally. These checks do not modify or promote the archive.

A further check ran the packaged `public CLI executes candidate journal, history and backup in separate processes` test from the independent installation: one test passed locally. The only tracked difference between the packaged source commit and the final checkout is this post-package evidence note; package code matches that commit. The result is limited to the local candidate protocol and does not establish publisher authentication or production readiness.

Three additional tests run from that independent installation passed for candidate journal replay and v2 reopen rejection, backup restoration and retry, and rejection of a self-rehashed forged state through native replay. They do not extend the authentication or production claims above.

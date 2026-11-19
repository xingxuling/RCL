# RCL development checkpoint, 2026-11-18

This checkpoint follows the earlier portable candidate. The worktree began at
`3d6e4fb` and fetched canonical main at `7c1c965660222ce2f7abe4630fd6df8ddcb4ae4a`.
DWAC selected deep development for compiler admission and whole artifact mode
for the installed acceptance checkpoint.

The general and session compiler entries reject missing directive targets,
duplicate rule names, and duplicate core declarations. Tests cover exact UTF-16
locations after supplementary text, scopes that resolve forwards, and
preservation of existing output on failure. Unsupported session facets and
rule calls now carry real source spans. BMP facet and policy budget key
ordering matches the reference compiler, including shared prefixes, mixed
scripts, and repeated budget entries.

Durable backup verification now validates the same journal buffer it replays
under the native writer lock. The controls include a change after preflight
that preserves the journal's size and semantic roots. Failed native launches
release staging files, and the selected reply-verification profile is captured
at startup. Strict v3 validation recognizes ordinary typed records whose
fields resemble AST nodes. The v3 profile remains opt-in.

`selfhost/compiler.rbc` is 432,511 bytes at SHA-256
`a8667500b26ab20cb70e037e8d647dd1e7bc9a7e338e6279158d6caab2ffb66f`.
Windows, Linux WSL2 and Node WASI each reproduced C0 = C1 = C2 at 111,187,131
native instructions per generation. The 300,000,000 instruction budget leaves
188,812,869 of headroom. The example audit covered 233 sources, with 195
byte-identical admitted results, 38 reference exclusions and zero native
failures. It used 122 distinct native compilation jobs.

The local package is pinned to `3fd01fabc4199e7032d8ce10677ba0a4443b0d8e`.
It is at `output/selfhost/candidate-3fd01fa/taowind-rcl-reality-forge-2.0.0-portable.tgz`,
with SHA-256 `b4e458cb27380a44c75fd6b8b01950c5c79f48254973a5f51084a34449b6c52d`
and 69,680,554 bytes. The normalization check retains the content hashes and
order of 3,562 entries. A fresh offline install passed the SDK, CLI, MCP and
explicit v3 history and backup replay controls. The Linux filesystem control
ran the package compiler and VM without runtime permission changes.

The numerical audit reproduced differences between reference and native
`number_from_text` for finite subnormals, values rounding to zero, Unicode
whitespace, unsigned binary and octal integers, signed hexadecimal, and C
hexadecimal floats. This package precedes a numerical correction. The
vendored Ryu formatter is available for evaluation against native
`text(Number)`. Frozen GPU evidence and native source build manifests have
separate ownership and require separate validation for any changed binaries.

The checkpoint is a local 2.0.0 research preview. The established default v2
state-root contract and historical K400 records are retained. TD-017, TD-019,
TD-020 and TD-021 remain open. The source and artifact evidence is local.

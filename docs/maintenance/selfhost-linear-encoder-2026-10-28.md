# Linear accumulation for compiler byte streams

The existing native sequence-concat builtin materializes and copies both operands.
The RCL encoder previously concatenated the entire accumulated byte stream for
each string, number and instruction record. Output construction therefore copied
growing prefixes repeatedly. The compiler now appends record bytes through its
existing persistent sequence helper; final assembly still uses the existing RBC
header and pool owners. Only three accumulator calls changed.

Phase diagnostics on a 160-function source isolated output encoding: the
instruction-generation prefix took about 127 ms, while the full old compiler
took about 1529 ms. The output phase added only 176100 VM instructions, showing
that VM instruction totals alone did not describe the C sequence-copying cost.
These phase executables return a fixed sentinel RBC and are profiling probes,
not target-compiler acceptance evidence.

The direct before/after pilot retained exact target bytes and changed observed
time from 1303 ms to 177 ms. Two alternative pilot changes (global concatenation
and bucketed builtin lookup) did not demonstrate sufficient useful improvement
and were not adopted. The seven distinct complete-compiler sources that previously
timed out at 60 seconds now all compile in about 2.11–2.25 seconds with byte parity.
For the native complete-compiler source, the earlier explicit 300-second diagnostic
completed in 113431 ms on artifact 3bc04ad5; the new candidate completed in 2142 ms.
These are bounded local observations, not portable percentile guarantees.

The final artifact reaches C0=C1=C2, 349965 bytes, SHA-256
`0b14797d50c41d672dfd797dd7b81b8b145375cf2c5d452bd62758bddedb85d6`.
All 156 affected compiler/UI/session/tooling checks pass. The complete 233-source
collector run at the unchanged 60000-ms target budget now has 193 exact matches,
40 unsupported and zero failures, with 120 actual native attempts and 73 reused
alias results. The unsupported set is 38 reference compile rejections and two
explicit rule-host-call exclusions. It is not a 233-source language-support claim.

Earlier failure/budget reports remain intact and source-bound. No native C binary,
language version, frozen K400 evidence or research-preview status was changed.
No hosted Actions ran. The full collector and existing affected checks supply
the relevant integration coverage for this three-call change.

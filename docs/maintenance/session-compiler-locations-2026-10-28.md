# Native session facet diagnostic locations

The RCL-authored session compiler now uses the facet declaration line and UTF-16
column already retained by its parser when rejecting unsupported session facet
types. This preserves native diagnostic codes and valid target bytecode, while
removing the synthetic 1:1 location for this particular policy check.

Six direct native rejection cases moved from FAIL to PASS. They cover top-level
facets, owned inputs, supplementary text before a declaration, LF and CRLF; each
retains a pre-existing output artifact. Nine scoped session compiler tests pass in
total, including bootstrap target parity and native daemon execution for accepted
programs. The session compiler continues to use its documented JavaScript-built
compiler artifact; no independent session-compiler self-hosting claim is added.

The public session compilation API still performs its reference preflight first,
so these checks directly exercise the RCL-authored compiler entry rather than
claiming a new public CLI diagnostic path. TD-019 remains ACTIVE for other
synthetic native diagnostic sites. No hosted Actions ran or version changed.

# Verify workflow

Required gates:

```text
rcl version --json
rcl doctor
rcl check <source.rcl>
```

A valid verification report includes:

- package version;
- canonical repository and branch;
- compiler boundary;
- doctor pass/warn/fail counts;
- source path and hash;
- diagnostics and exit code;
- selected adapter ID.

Warnings must remain warnings. A successful `check` is not evidence that `run`, native execution, Provider calls or external writes are authorized.

# K01 direct evidence snapshot

Current measured result for `compiler-runtime::self-hosting`:

```text
EXPRESS      PASS
COMPILE      PASS
LOWER        PASS
EXECUTE      PASS
CORRECT      PASS
ROBUST       PASS
PERFORMANCE  PASS
AI_GENERATE  UNVERIFIED
EVIDENCE     PASS

OVERALL      BLOCKED (8/9)
```

Evidence source:

```text
examples/universal-stress/k01-direct-evidence-2026-08-07.json
```

The native compiler reached a byte-identical C0 → C1 → C2 fixed point. Nine representative fixtures matched the JS bootstrap RBC byte-for-byte, eight negative controls were rejected, and the production self-host toolchain returned 4/4 PASS after the native compiler was built.

K01 is a compiler self-hosting test. It does not require the whole RCL runtime to be authored in RCL. The remaining blocker is an independent reproducible AI compiler-evolution/repair trial contract.

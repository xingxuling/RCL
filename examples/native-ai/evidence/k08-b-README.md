# K08-B General MLP evidence

Verdict: **RCL_NATIVE_GENERAL_MLP_AI_N2_VERIFIED_LOCAL_AI_GENERATE_UNVERIFIED**

- Pipeline: `.rcl -> native rclc/compiler.rbc -> RBC -> native rclvm`
- XOR: accuracy=1, loss=0.0157034488743931
- Majority-3: accuracy=1, loss=0.0111015956287353
- Exact checkpoint resume parity: true
- Deterministic native replays: true
- AI_GENERATE: UNVERIFIED

The JavaScript implementation is a differential oracle only and does not supply native parameters.

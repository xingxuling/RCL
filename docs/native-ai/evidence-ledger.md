# K08 Native AI Evidence Ledger

## K08-A frozen baseline

- Scope: fixed 2-2-1 XOR MLP.
- Path: Pure RCL source -> native self-hosted compiler -> RBC -> native VM.
- Status before this campaign: AI-N1; every K233 gate except independent `AI_GENERATE` passed.
- Historical authority: `examples/native-ai/evidence/k08-a-evidence.json`.

## K08-B General MLP

| Evidence | Result |
|---|---:|
| Profile | `AI-N2-TWO-DENSE-LAYER-GENERAL-MLP` |
| RBC bytes / instructions | `24,499 / 1,432` |
| Native VM instructions | `109,205,579` |
| Native semantic state root | `890691f699db1d1166b3b3aa3f5744976a0c93acd3bac96f4331a8878149571e` |
| Deterministic replays | `3 / 3` |
| XOR architecture / parameters | `2-2-1 / 9` |
| XOR accuracy / loss | `1.0 / 0.0157034488743931` |
| Majority architecture / parameters | `3-3-1 / 16` |
| Majority accuracy / loss | `1.0 / 0.0111015956287353` |
| Maximum parameter drift | `< 5.4e-15` |
| Direct 32 vs resumed 16+16 | exact rooted parity |
| Median local native runtime | `1,369.6863 ms` |
| Native / JS oracle runtime ratio | `118.300x` |
| Serialized XOR checkpoint | `302 bytes` |
| Report root | `1335a812fd5162511f32fae054d945c5deaf2bd63026aec8495a6a21611de9b2` |

The first pre-evidence probe found equal instructions/constants/functions but a different RBC `programRoot` when Majority initialization used long decimal literals. The contract was explicitly refrozen after normalizing only those initialization literals to the 12-decimal portability envelope already used by K08-A. Thresholds were unchanged. The accepted evidence run then restored byte-identical compiler parity.

## Independent AI_GENERATE authority

- Contract: `examples/native-ai/k233-ai-generation-contract.v0.1.json`.
- Generator: three separate ephemeral Codex CLI sessions.
- Isolation: fresh temporary directory, ignored user config/rules, effective read-only filesystem, JSON Schema edit response.
- Trials: activation derivative, target binding and output-weight gradient routing.
- Result: `3/3` model edits restored canonical source bytes and passed native compilation, native execution, three deterministic replays and differential comparison.
- Unique generator sessions: `3`.
- Local receipt report root: `82cf5c5e906ab6bd15e9e3c30a50475304f79f4c90a35696995804d9996f6482`.
- GitHub Actions run / focused job: `32780097954 / 97600047380`.
- Source commit: `4686184d6790ec08b213a0176279f646a0919beb`.
- GitHub authority root: `bb42598a6d656aab0d19da52491e820c24145aeb0233d3299abca6b171ea6b82`.
- Current authority: `PASS_GITHUB_HOSTED_REPLAY_BOUND`.

Rejected generator candidates are retained in the contract audit: the local Qwen manifest had a missing model blob, and TinyLlama produced semantically incorrect structured edits. Neither was counted.

## Reproduction

```text
npm run build:native
npm run evidence:k08-native-ai:general-mlp
npm run verify:k233-ai-generate
node --test --test-concurrency=1 tests/k08-general-mlp.test.mjs tests/k233-ai-generation-receipt.test.mjs
```

`npm run evidence:k233-ai-generate` invokes new independent model sessions and is intentionally not part of ordinary CI. CI replays the frozen saved candidates instead.

## Evidence boundary

The ledger proves the bounded General MLP AI-N2 stack and the independently replayed K233 repair evidence. It does not prove Tensor Genome, general Autodiff, AdamW, Transformer, language-model training, accelerator lowering, distributed training, competitive performance or K400 completion.

## K08-C Tensor / CPU Engine candidate

Status: `ENGINE_E1_CANDIDATE_GITHUB_REPLAY_BOUND`. Authority remains candidate-only and separate from K233.

| Evidence | Result |
|---|---:|
| Canonical identity | typed `tensor::Tensor`, no data field |
| Storage boundary | separate `tensor::CpuDenseStorage` + `storageIdentity` |
| RCL scalar operations | add/sub/mul/div, broadcast, reshape, transpose, slice, MatMul, sum/mean/max, exp/log/sqrt, softmax |
| Optimized backend | Rust f64 CPU Dense organ through `RclVmProviderV1` |
| Optimized kernels | elementwise, reduction, blocked MatMul, Softmax, LayerNorm, RMSNorm |
| 24-cubed exact differential drift | `0` |
| 24-cubed end-to-end median | scalar `180.608 ms`; provider `29.635 ms`; `6.094x` |
| 192-cubed kernel median | scalar `7.229 ms`; optimized `2.362 ms`; `3.061x` |
| Replays | `7` scalar roots / `7` provider storage identities, one unique value each |
| Evidence report root | `890180d14c8585875d7122c0b38369ab8f8a01b592d6af80f127ebae070b3271` |
| GitHub run / source commit | `32804405376 / e5c3124bb759e5d5c2ec8bbf3e668aabc6a0b080` |
| GitHub Ubuntu / Windows jobs | `97671555187 / 97671555356`, both success |

Positive, negative, boundary and differential coverage includes valid kernels, invalid shape/broadcast/MatMul, dtype/device mismatch, divide-by-zero/log/sqrt domains, storage mismatch, unsupported layout/storage, rank/input/element caps, native self-host/JS compiler byte parity and native VM provider execution.

The evidence intentionally does not relabel the former `118.300x` General MLP Native/JS ratio. The MLP still uses scalar recursive operations and has not been lowered to the new backend. A floating generated-matrix probe also exposed scientific-notation number canonicalization drift between the native state root and the JS verifier; the accepted performance corpus uses integer values and records that unresolved evidence gap rather than disabling strict state-root verification.

The GitHub-hosted replay receipt is `examples/native-ai/evidence/tensor-cpu-v0.1/github-replay.json`. It binds the exact implementation commit, Ubuntu portable test, Windows native Provider test and Windows performance-evidence step; it grants no K400 promotion.

Reproduction:

```text
npm run test:k08-tensor
npm run evidence:k08-tensor-cpu
```

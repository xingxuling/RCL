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

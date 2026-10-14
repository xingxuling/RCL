# Complete compiler execution in Android and resident C ABI instances

RCL's complete native-core compiler now has independently admitted Android
(`K099`), HTTP server (`K119`) and embedded-runtime (`K299`) profiles. All three execute the existing
UTF-16 source-column compiler variant, preserve twenty byte-identical
`C0 -> C20` generations, compile ten sealed native programs, and replay three
unchanged repairs obtained from fresh independent contexts. Aggregate coverage
is updated only after the complete collector verifies every profile.

The language/package build identity remains `2.0.0`; these results do not establish
a formal language release or whole-runtime self-hosting.

## Actual capabilities

`createResidentSequenceCompiler()` is exported from `src/index.mjs`. It creates
one native compiler process containing a caller-owned `RclVmInstance`. The RCL
compiler artifact executes inside that instance; the wrapper transports inputs
and verifies replies. Byte-identical compiler generations reuse the instance.
A changed or corrupt compiler artifact triggers native loading, rather than
silently retaining an earlier compiler. The protocol accepts three flat file
names inside an owned temporary directory and serializes requests with explicit
backpressure. Malformed source, corrupt compiler, scope rejection, recovery,
wire/PID binding and clean exit are verified.

```js
import { createResidentSequenceCompiler } from '@taowind/rcl-reality-forge';

const compiler = await createResidentSequenceCompiler();
try {
  const result = await compiler.compile(
    'selfhost/variants/utf16-columns/compiler.rbc',
    'selfhost/variants/utf16-columns/compiler.rcl',
    'compiler-next.rbc',
  );
  console.log(result.compilerTrace.metrics.executedInstructions);
} finally {
  await compiler.dispose();
}
```

`createResidentCompilerHttpTarget()` adds a separate authenticated loopback HTTP
worker. Each compile request supplies its actual compiler generation and source;
the resident native compiler owns compilation. Native VM processes own program
execution. Two complete generations, exact byte/native state parity, rejected
unauthorized requests, backpressure and recovery pass its focused test. This is
an additional callable capability, with **no K119 credit** from this two-generation
test. The subsequent full frozen HTTP campaign passes twenty generations, ten
sealed programs and three unchanged fresh repairs, admitting **K119**. Public
hosting, distributed execution and a security sandbox are unclaimed.

## Frozen compiler and runtime artifacts

| Artifact | SHA-256 |
| --- | --- |
| UTF-16 column compiler source | `b3cb7816a2d447888c8620f7513a70db1564ed79afd11afc14b6f6bc29e63e82` |
| Compiler C0 / C1 through C20 | `55b32b42ca5ad13ec08e421511da3bc8d6af640f5fcf0268d5879c02a7c4ba48` |
| Resident compiler `rclcd.exe` | `4df4ec8673769cc878626192a1ebc8322cfcdd9a7cfa94b8b1f85d28fc3c618f` |
| Android native VM | `38a5591e0574b4987caa791136194ebea4bcb3451427ad970eeec1fb913d6a07` |
| Android native compiler | `b24fd9928477ab6a3ed579bd9cfca2db353d746476060bff7cd76d8a165f7033` |

Every fixed-point generation executes `101897504` RCL VM instructions under the
unchanged `300000000` instruction budget. Compilation P95 must remain below
50000 ms; sealed program execution P95 below 5000 ms.

## Independent admissions

| Profile | Contract root | Runtime report root | Index root | Compile / execute P95 |
| --- | --- | --- | --- | --- |
| Android | `1456553e4b379f4a23f52c8917928b68604c48b940a8c3a7217fd8fcc6c878ac` | `bc5505b0731028ea39b95723eafb4c3d32b8bd3dac3df8205b0805ae188ec0d2` | `056d4e8655a4fd9980f33baa78307d42c155cc2ca29e24c3a4ffdaa441ff436d` | 6885.7315 / 797.9123 ms |
| Embedded C ABI | `cb29bfcae89f39f4bad9d47c39dbbe93718275839eeedd30ee45162bbb2927aa` | `8ffdf101a10ab73c95589284b96f465e2e4688ff4d53cf2a6e07772e159c214c` | `29e9ad89de89a056edda4d9a7b6dddad4e699c87e07361fabbd5611fee3bd15d` | 4687.2203 / 45.6203 ms |
| HTTP server | `9af8f179672b01dbe71e1d47fdd78df44afe4ce9da8bae7828c8a9c852b842a4` | `acca0963808240f3465561255a76d066510cb905d66f5358bd345e46347e36ac` | `d84e2ca51866cd3e96c7b50a0217704c6fbec0e8472efbb885e1e056c24131ff` | 4306.6654 / 190.0921 ms |

Android acquisition uses actual API35 x86_64 native processes on the dedicated
read-only `emulator-5556`. ADB transfers, on-device binary/input/output hashes,
native PID frames and command ranges are captured and independently verified.
Host compilation/execution fallback, physical device execution, mobile UI and
visual pixels are unclaimed by this profile.

The embedded profile verifies one actual compiler process and C ABI instance
across all twenty generations. Sealed programs run through native `RUN_RESET`
instances. Following malformed-source and corrupt-compiler rejection, a healthy
full self-compilation succeeds; two further executions reuse one VM instance
with identical semantic results. Every native instance has a clean observed exit.

The frozen candidate files and exact input manifests precede the independent
contexts. Each context may read only its named candidate; it cannot inspect the
canonical source, evaluator, sealed programs, repository history or memory,
execute programs, write files, or delegate. Nine actual proposal-only contexts
supplied the three profiles' nine repairs after their respective contracts were
frozen. Codex owns evaluation and admission.
These are context boundaries; **OS-level isolation is not claimed**.

## Local verification and evidence limits

The runtime/admission checks pass 26 tests, with zero failures or skips. They
include actual resident self-compilation and rehashed forgeries involving native
PID, command/transfer identity, instance reuse, wire replies, native state,
recovery, clean exit, missing generations and missing gates. The additional
HTTP capability test passes one actual native integration check. HTTP admission
adds thirteen checks for native/worker PID and wire binding, returned artifact
substitution, request denial, recovery, missing generations and clean exits.
Together these are **40 passing checks**, with zero failures or skips.

The source-only relocation also builds a fresh native compiler and passes two
actual resident/HTTP integration checks. Raw executable hashes differ in parsed
PE COFF/debug timestamps and the CodeView PDB GUID; every other byte is compared
and identical. This does not establish raw-byte reproducibility. Original binary
hash bindings and acquisition build metadata remain intact and are restored
before captured admissions are replayed. Successful source test logs are retained
explicitly across verification-record repairs, without attributing them to a new
execution.

Run `npm run test:selfhost-runtime`.
The Android admission tests inspect captured target receipts; this command does
not freshly reacquire Android or establish another device's support.

The local DWAC four-mode selector chose `DEEP_DEVELOPMENT` for the full-compiler
target bottleneck. Its decision is candidate planning evidence, not admission
or execution authority. GitHub Actions are not used.

The subsequent [cold-handler compiler continuation](K400_COLD_SELFHOST_2026-10-14.md)
adds the public per-call API and a separate K139 profile, bringing current
coverage to 371/400. The 370-cell measurements in this document retain their
original acquisition scope.

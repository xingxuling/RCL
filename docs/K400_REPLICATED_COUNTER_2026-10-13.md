# RCL replicated-counter protocol

K400 advances from 246 to **261 PASS / 0 BLOCKED / 139 UNTESTED**,
`RESEARCH_PREVIEW`, U3, `INCOMPLETE`. The package identity remains frozen at
`2.0.0`. Matrix root:
`a052d35eb6ff7ed923670a756f8307b3bfaa7b4b21b8b5a7e7dc8f88f525d6e3`.
The complete runtime receipt root is
`a16037c494043420f3170db62da92ea7a71d5d80dc64e1eb2e0f9dcd844d79f3`.

The active objective remains the complete 400-cell K400 campaign. This new
program adds source-owned replicated-state semantics and actual HTTP packet
replay to the existing execution contexts. Acquisition is recorded separately
from admission; a partial checkpoint does not add matrix credit.

## Program and execution ownership

`examples/distributed/replicated-counter.rcl` defines a bounded three-member
grow-counter, component-wise join, known-member admission, partition/recovery
delivery, and source-declared foresee/realize transitions. It uses ordinary RCL
Number/Truth/Sequence operations and warrants; no task-specific VM opcode is
added. The join follows the vector-counter design in the
[original CRDT research report, section 3.1.2](https://dsf.berkeley.edu/cs286/papers/crdt-tr2011.pdf).
The verified representation fixes three known cooperative members and limits
each component to nonnegative safe integers. It does not provide Byzantine
member validation, cryptographic identity, arbitrary-size arithmetic or a
cross-host deployment guarantee.

The independent oracle accumulates observed snapshots and computes each
coordinate across that set, separately from the RCL recursive delivery code.
Inputs cover reordered/repeated/stale delivery, unrepaired partitions, recovery,
empty counters, disabled authority, invalid amounts and invalid repetition
budgets. Nonnegative component growth, idempotence, commutativity and associativity
are checked against independent expected results; self-reported law fields alone
do not grant credit.

`runReplicatedCounterNetwork()` creates three actual loopback HTTP endpoints and
three target instances. Each endpoint obtains its local snapshot by executing
RCL. Received packets invoke an on-target RCL program that owns member checks,
conditional warrants, monotone merge and the resulting vector. The host owns
HTTP transport, packet scheduling, fault injection and storage of returned
vectors; it does not compute the merge.

The frozen packet sequence exercises two connected peers, a rejected packet
across the partition, recovery through the third peer, stale and duplicate
snapshots, an unknown sender, source-declared authority denial and HTTP transport
denial. The partition is an application-level transport fault, not a physical
network outage. Every executed packet retains source/artifact hashes, complete
typed state, changes, witnesses and before/after roots. Receiver vectors are
reconstructed from those actual returned values; observed sender payloads and
rejection responses remain in the receipt.

## Evidence discipline

The first draft exposed an ineffective membership mutant: connection filtering
masked the wrong known-member predicate in the logical model. Admission rejected
that draft. Full connectivity was corrected to deliver broadcasts to the source
membership gate, matching the actual packet path. Draft contracts and responses
were archived without matrix credit; source/cases were frozen again before
three new isolated proposal-only contexts generated the accepted repairs.

The final contract freezes ten input cases, twenty rounds per environment,
compile/execute p95 budgets of 5000/2000 ms, and three effective mutations. The
independently returned membership repair uses `sender <= 2` rather than the
canonical `sender < 3`; it is applied unchanged and must pass every frozen case
in each environment. This establishes the declared input domain, not unrestricted
whole-language equivalence.

Each declared environment must also run its own three HTTP nodes with actual
on-target compilation/execution. The verifier checks exact compiler byte parity,
packet order, declared transport outcomes, source-owned admission, state
continuity, stale/duplicate stability and convergence. Existing backend reset,
recovery, rejection, rollback and native-controller transcript gates remain
mandatory. Checkpoints bind all implementation/proposal bytes and receive no
admission until the complete report verifies.

The actual archived DWAC four-mode router selected `DEEP_DEVELOPMENT`, source
SHA256 `feec830b66b404c243f3bb4c3d2c66706429c670a0f4c396dee6246d5363ee44`.
Laya's priority result abstained at confidence `0.4709`; it granted no write,
execution or admission authority. Root retained all implementation and acceptance.

## Completed acquisition

All fifteen contexts pass: Windows, WASI, Linux WSL2, Android x86_64 emulator,
authenticated local server, embedded C ABI, two-worker replica runtime, cold
serverless handlers, SQLite, worker-thread dataflow, native simulation and
automation controllers, actual Chromium, actual AMD FP64 OpenCL and the frozen
RNCS candidate branch runtime.

The batch records 300 baseline compile/execute cycles, 150 pre-sealed input
cases, 45 effective mutation/independent-repair trials, and 150 additional sealed
runs for the returned noncanonical membership repair. The network proof creates
45 actual HTTP nodes and records 180 real requests, including partition,
membership, source-authority and transport rejection. Its RCL-produced initial
snapshots and packet results remain in the complete source-bound receipt.

Every backend's measured p95 stays under the frozen 5000/2000 ms limits. Actual
compilation ranges from 277.4 to 1736.0 ms; execution ranges from 4.0 to 1061.5 ms.
These are declared local workload measurements, not a performance-parity claim.
Thirty-four focused admission, actual-network and matrix/maturity checks pass,
including rehashed packet/source/root tampering, missing HTTP execution,
duplicate endpoints, stale-state drift, denied-member/source authority bypass and
omitted sealed repair cases. RNCS receives deliberate host execution credit;
the other profiles retain source-owned native/bytecode semantics.

New distinct cells are K010, K030, K050, K070, K090, K110, K130, K150, K170,
K250, K290, K310, K350, K370 and K390. The five remaining distributed-family
coordinates stay UNTESTED. The complete K400 goal remains active with 139 open
cells; this batch does not establish a whole-language release.

Tracked tree `811f6da282f04e14154590dceb599913c3c52c8f` was exported to a fresh
directory. It independently rebuilds all previous and new source-bound
admissions to the same 261-cell matrix root and passes all 34 checks, including
another actual three-node HTTP run. Only this documentation records the result
afterward; bound implementation and receipt bytes are unchanged.

## Run

```text
node scripts/run-replicated-counter-network.mjs windows
node scripts/run-replicated-counter-network.mjs gpu
node scripts/run-k400-crdt.mjs --verify
npm run evidence:k400
```

The public asynchronous network API accepts a source and optional target factory.
It defaults to the included Windows native target. The development runner selects
the existing explicit native/context/browser/GPU/RNCS adapters. Their established
setup requirements and bounded platform claims still apply. The browser requires
the configured Playwright module and installed Chromium; GPU requires the AMD
FP64 OpenCL device; Linux/Android require the configured WSL distribution and
connected x86_64 Android emulator. No new GitHub Actions run is requested.

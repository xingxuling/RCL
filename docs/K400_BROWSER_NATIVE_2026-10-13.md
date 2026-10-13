# Native RCL compiler and VM in a real browser

The full development goal is **all 400 K400 cells**, with all nine non-compensatory gates, no duplicate credit, no task-specific native shortcuts and no opaque delegation. The earlier >=200 milestone is a checkpoint. Package/native identity remains 2.0.0 with promotion frozen. Current authoritative totals are in `CURRENT-STATUS.md`.

Verified checkpoint: **216 PASS / 184 UNTESTED**, U3, INCOMPLETE. All twelve actual browser acquisitions pass, adding fourteen unique coordinates. Consolidated report root: `644b437444dd2d06a93ff74d851031529f4deade860d0b7696cf000d0ab9d72c`. The full 400-cell goal remains active.

## Implemented browser runtime

`createPortableBrowserTarget` launches an isolated headless Chromium process and runs two actual WebAssembly modules inside its browser window:

- The unchanged `native/rclc.c` host adapter and C VM, built to `native/wasi-compiler/rclc.wasm`, execute the RCL-authored compiler artifact. Source compilation happens in the browser.
- The existing `native/wasi/rclvm.wasm` executes the compiled program in the browser. Node transports input/output and independently verifies semantic-state-root v2; it executes neither the program nor a Node-WASI fallback.

The source/hash-bound WASI adapter uses ephemeral in-memory `/work` and `/tmp` directories. The compiler's temporary output is flushed and renamed within that actual directory map. It proves no disk durability. Each compile/run creates a new WASI instance; explicit page reload checks reset behavior in the same browser process. Native rejection diagnostics survive stdout/stderr capture without requiring a final newline.

Compilation and execution traces bind input source, bytecode, both WASM modules, the RCL compiler artifact, request nonce, browser PID/version, page token and instance sequence. Compiler traces include native instruction counts and the actual file-rename syscall. Execution traces include native file-read/write syscalls. Missing files and rejected artifacts leave the target usable.

## Reuse and ownership

The WASI syscall adapter is the unmodified JavaScript distribution of [`@bjorn3/browser_wasi_shim` 0.4.2](https://github.com/bjorn3/browser_wasi_shim), vendored with its licenses and npm SHA-512 integrity record under `src/vendor/browser-wasi-shim/`. RCL adds a bounded virtual-directory rename adapter around the upstream API. This is filesystem/stdio interoperability; RCL compiler and VM semantics remain in the RCL artifact and unchanged native C implementation. No provider computes the whole program in JavaScript.

The browser controller uses the existing Playwright library interface and an installed Chrome/Edge or bundled Chromium. The original user browser profile is not used. The captured browser and driver executable/source hashes remain distinct from RCL source hashes. This is local headless execution, with no public deployment, native mobile interface, hardened OS isolation or entire program-family claim.

DWAC capability discovery confirmed the seven canonical organs and native four-mode selection. The connected generic Federation also exposed execution workflow tools, so only discovery was used under the planning skill. The local source-hashed four-mode router selected `DEEP_DEVELOPMENT` for the browser execution bottleneck. Laya abstained on development priority at confidence 0.2484. These are advisory records; they grant no writes or K400 admission.

## Frozen campaign

Twelve profiles reuse the native learning, agent, workflow, logical-event, governance/reactive, mixed-paradigm, relation, simulation/scientific, algorithm/CLI, media, expression-compiler and game programs. Contracts freeze source, definition files, C2/WASM compiler artifacts, twenty rounds, ten independent input oracles and three effective mutations before three new proposal-only contexts.

Original independent responses are retained unchanged in `examples/universal-stress/browser-native/independent-batch.json`. Each returned edit is applied without normalization. Noncanonical spellings replay all ten sealed inputs in addition to the baseline; agreement over that domain does not prove unrestricted semantic equivalence. Requested tool isolation is declared with `osIsolationClaimed: false`.

The twelve profiles cover fifteen coordinates. Browser reactive K078 already has a complete bounded UI profile, so its native program evidence supplements the existing coordinate. This campaign can add at most **fourteen distinct cells**. No coordinate is credited before its complete runtime receipt passes admission. The frozen p95 ceilings are 5,000 ms compilation and 2,000 ms execution, not competitive or hard real-time guarantees.

## Local reproduction

Install `playwright-core`, or set `RCL_PLAYWRIGHT_MODULE` to an existing module directory. `RCL_BROWSER_EXECUTABLE` optionally selects the actual browser binary. The bundled browser driver used during acquisition is recorded in each receipt; no download is silently required by the runtime.

```text
node scripts/run-browser-native.mjs examples/universal-stress/new-families/compiler.rcl
node scripts/run-k400-browser.mjs --verify
node scripts/run-k400-browser.mjs
node --test tests/portable-browser-target.test.mjs tests/k400-browser-admission.test.mjs
npm run evidence:k400
```

`--verify` rechecks cached acquisitions; the command without it performs the actual full campaign. The public API is asynchronous for both compilation and execution. Rebuilding the new compiler module uses `node scripts/build-native-wasi-compiler.mjs` with the existing Zig toolchain; old native/WASI artifacts and their manifests are not rewritten.

The six focused admission tests and the actual browser recovery/reset check pass. Twenty canonical rounds per profile give 240 browser compilation/execution rounds; all 120 pre-sealed inputs and 36 unchanged independent repairs are verified. Noncanonical repairs additionally replay all sealed inputs. The separate actual browser C2 → C3 fixed-point experiment produced the same 297,797-byte compiler artifact in about 185 seconds; it grants no self-hosting cell before a separate complete contract, independent generation and performance acceptance. The device probe found AMD gfx1152 with advertised FP64; it grants no GPU execution credit.

A fresh directory exported from staged tracked tree `01b3ad97c516eb0bf2372cb39335c6dbc56f1653` admits all historical and browser receipts and reconstructs the identical 216-cell report root. The 34 focused browser, maturity and matrix checks pass; the final directory separately rechecks the 27 maturity/matrix checks against its rebuilt 216-cell input. The prior 202 profiles are preserved, with only the existing K078 coordinate receiving supplemental native evidence. These are fresh-directory receipt replays and actual browser controls, not a second full acquisition. Full repository regression and new hosted CI were not run.

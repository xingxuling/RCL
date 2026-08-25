# Native Single-Snapshot RBC Load Reality Audit v0.1

## Stress finding

During the final clean Android gate for RCL Aether Runtime v0.7, one of 25 device tests failed while repeatedly loading the same pinned self-host compiler RBC. The native loader reported `RCL_NATIVE_TRUNCATED` from its parse phase even though its immediately preceding validation phase had accepted the file. The asset was not rewritten by the test. The isolated stress test then passed 10/10 runs and the complete device suite passed 5/5 reruns, establishing an intermittent loader-boundary failure rather than durable asset drift.

Source inspection found that `rclvm_instance_load_file` consumed two independent snapshots of the same path: `validate_bytecode_file` opened, read, validated and closed the file; `load_program` then reopened and reparsed it using many granular reads. A path replacement or second-pass short read could therefore invalidate the result after validation.

This is a general native VM file-loading defect. Product-side retries or normalization would hide evidence loss, so the fix belongs in RCL's native runtime.

## Candidate contract

- open the RBC path exactly once per load;
- read a bounded byte snapshot completely, retrying partial reads until EOF or a real error;
- validate and construct the `Program` from that same immutable snapshot;
- reject an invalid snapshot before execution and preserve existing validation codes;
- free the snapshot after program construction;
- keep RBC format, VM semantics and the public embedded ABI unchanged.

## Cost and boundaries

- the loader temporarily retains the RBC snapshot while allocating the decoded program, bounded by the existing 256 MiB RBC limit;
- it removes the prior second file read, but this change is not a performance-promotion claim;
- it does not prove arbitrary filesystem, device or multi-target robustness;
- it does not promote K042, K085, K100 or any other K400 cell.


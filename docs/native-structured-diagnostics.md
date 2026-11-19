# Structured native semantic diagnostics

The native VM adds an optional `diagnostic` to semantic assertion failures. The existing outer `status`, VM `code` and textual `message` remain available. The diagnostic has format `rcl.semantic-diagnostic.v1`, the original assertion `code`, and a `span` with `offset`, `line`, `column` and `length`.

For the general/session RCL source compiler's token-backed spans, offset is zero-based UTF-16 code units, line and column are one-based, and length counts raw source code units. Quotes, escape spelling and multiline string contents are included in string-token lengths. EOF has length zero. A path diagnostic can refer to its first identifier token rather than the whole qualified path. Generic user-created `make_span` values retain the caller's fields; the VM does not infer their coordinate unit or authenticate the source.

`runNativeCompiler` preserves `RCLC_COMPILER_FAILURE` and exposes the VM error under `error.payload.cause`; `error.diagnostic` provides the optional semantic diagnostic directly. `runNativeBytecode` likewise exposes `error.diagnostic`. Ordinary load/runtime failures have no invented semantic span. Reference `semantic_assert` puts the same object in `error.details.diagnostic`.

C embedders may call `rclvm_instance_get_last_error_json(instance)` after a failed VM execution/load. It returns an owned JSON snapshot or NULL when no VM error is recorded; free a non-NULL result with `rclvm_free_string`. The getter does not execute the program. Reset and successful execution clear the previous VM error. Host/API preflight errors that do not enter the VM are not a new VM diagnostic. This additive API does not change provider ABI structures or state-root algorithms.

The compiler host fetches the error snapshot only on failure; successful compilation still avoids serializing the compiler's large state. WASI compilation uses a disposable `/tmp` preopen for the existing seekable JSON capture adapter, with cleanup after completion.

This is a token-backed diagnostic increment. Synthetic fallback spans and uncovered semantic contexts remain; TD-019 is still active.


Public CLI `native`, `bytecode`, `native-run` and reference `run` failures with an available semantic diagnostic now emit a JSON error on stderr with `ok: false`, `status: error`, the existing outer `code`/`message`, and `diagnostic`. Exit status remains 1 and a failed bytecode compilation retains its previous output. Other CLI error handling is unchanged. MCP native-execution failures retain their existing JSON-RPC error code/message and expose the optional semantic code and diagnostic in `error.data`; ordinary errors retain their previous data shape. These are error-reporting additions, not evidence of successful native execution or source authenticity.

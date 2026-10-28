# Native typed UI control admission

The self-hosted RCL compiler resolves input/change value parameters after the
complete input node is parsed. Checkbox/switch values use Truth, sliders Number,
and other controls Text, including omitted annotations and late input_kind
properties. The native compiler now checks control properties/bindings, option
lists, slider grids, form lengths, required declarations, date/radio initial
values and UI expression operand types through its existing semantic owner.

The committed artifact reproduces itself twice: C0=C1=C2, 336769 bytes. Ninety-nine
checks pass against that final artifact. Twenty-seven new checks include all ten
input kinds with inferred/explicit types, exact reference-bytecode parity for six
fixtures, and rejection without replacing existing output. Both typed-UI failures
in the original full example collector were reproduced against the prior compiler.

This is bounded local compiler evidence. Initial UI state declaration validation,
derived declarations and complete diagnostic-location parity remain follow-up
work. It does not change research-preview status, frozen language versions, K400
admission, publisher authentication or hardware acceptance. No hosted Actions ran.

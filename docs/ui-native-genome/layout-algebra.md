# Native UI Layout Algebra v0.1

The canonical layout model describes relationships rather than CSS or Android classes.

Each node declares:

- composition mode: `vertical`, `horizontal`, `overlay` or `grid`;
- width/height intent: `fill`, `intrinsic` or non-negative `fixed` size;
- non-negative gap and padding;
- alignment: start, center, end or stretch;
- distribution: start, center, end, space-between, space-around or space-evenly;
- overflow: visible, clip or scroll;
- positive grid column count.

Invalid modes, sizes, alignments, distributions, overflow values and column counts fail at compilation. The default is a vertical, fill-width, intrinsic-height container.

Web maps these relations to CSS display/flex/grid/positioning properties. Android maps them to `LinearLayout`, `FrameLayout` or `GridLayout` plus native layout parameters. Those mappings are providers and are not part of the algebra.

The current algebra does not yet model minimum/maximum/preferred constraints, intrinsic measurement negotiation, layout priority or conflicts. Those remain required before general-purpose layout parity can be claimed.


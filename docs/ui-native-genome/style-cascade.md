# Native UI Style and Cascade v0.1

## Resolution order

For each node, style resolution applies:

1. inherited canonical properties from the parent;
2. active theme declarations;
3. matching style rules ordered by priority, specificity and source order;
4. node-local style properties.

Selector specificity is `role = 1`, `class = 10`, `node = 100`. Higher priority/specificity/later source order wins because matching declarations are applied in ascending order.

Inherited properties currently include foreground, font family, font size, text alignment and language. A declaration may explicitly opt into inheritance. The style allowlist currently covers foreground, background, font family, font size, text alignment, corner radius and language.

Content values such as `value`, `label`, `placeholder` and `accessibility_label` are deliberately excluded from `resolvedStyle`; this prevents content/style semantic drift.

This is a bounded RCL cascade, not CSS conformance. Pseudo-classes, combinators, media queries, custom properties, CSS value parsing and browser cascade origins are not claimed.


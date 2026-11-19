# Native UI Backend Lowering

## Shared input contract

Both providers accept only `rcl.native-ui.program.v0.1` and carry its exact semantic root into their lowering report. Target JSON may configure titles, package identifiers and SDK bounds, but supplying Web `document/styles` or Android `screen` morphology is rejected.

Event admission applies route ownership and ancestor visibility. A routed modal participates while its route is active and its visibility binding is true. A navigation change preserves the destination's own visibility binding.

## Web provider

The Web provider emits semantic HTML elements, stable `data-rcl-node` identities, CSS derived from canonical layout/resolved style, and a browser runtime for canonical expression, event and projection behavior. DOM click maps to `activate`; input/change/focus/blur/submit map to their canonical event counterparts. Canonical route targets receive `data-rcl-route`; the runtime hides inactive targets and commits route changes atomically with local state. Available-width profiles emit media queries and a resize projection that records the active canonical profile.

The Counter evidence executes real programmatic DOM clicks in headless Chrome and reads the resulting semantic trace from the page. Device-adaptation evidence observes computed layout in Chrome `151.0.7922.173`: 320 px selects compact/vertical and 840 px selects expanded/horizontal.

## Android provider

The Android provider emits native Java Views and a Gradle Android project. Canonical vertical/horizontal/overlay/grid layouts map to native layout containers. `activate` maps to a click listener; input/change maps through `TextWatcher`; canonical restore declarations map to Android saved-instance state. Route targets are retained as native View fields and switched with `View.VISIBLE`/`View.GONE`; a proposed route is committed only with the event's proposed local state. Available-width profiles use `Configuration.screenWidthDp` to select the canonical profile and update `LinearLayout` orientation.

The emitted device-adaptation APK is a real offline Gradle 8.10.2 build artifact produced with Android Studio JBR 21. Generated Java structure, profile selection and host semantic equivalence are verified, but installation, configuration changes and interaction on an Android device are not. The provider currently embeds the compiled UI manifest and generated runtime rather than running the RCL native VM inside the APK.

## Compatibility

Existing K02/K03 companion-spec paths remain intact when no native UI declaration exists. They keep their `lowered-execution` classification. The new route is `native-semantic-candidate`; it does not retroactively promote legacy evidence.

## Native VM event delegation

The portable native event runtime lowers UI-local state changes to ordinary RCL. The native authority check runs before the source-declared visibility, modal, disabled, read-only, form and typed input checks. The checks use pre-event state. A denial carries the original handler span and leaves the last committed state, revision and success ledger intact. Scoped forms read only their declared container. The loopback API returns the native denial code.

The delegate accepts finite Number, Truth and Unicode scalar Text without NUL. Navigation, device adaptation and events that invoke a Reality transaction remain outside this delegate's supported slice.

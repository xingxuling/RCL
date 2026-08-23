# Native UI Backend Lowering

## Shared input contract

Both providers accept only `rcl.native-ui.program.v0.1` and carry its exact semantic root into their lowering report. Target JSON may configure titles, package identifiers and SDK bounds, but supplying Web `document/styles` or Android `screen` morphology is rejected.

## Web provider

The Web provider emits semantic HTML elements, stable `data-rcl-node` identities, CSS derived from canonical layout/resolved style, and a browser runtime for canonical expression, event and projection behavior. DOM click maps to `activate`; input/change/focus/blur/submit map to their canonical event counterparts.

The Counter evidence executes real programmatic DOM clicks in headless Chrome and reads the resulting semantic trace from the page.

## Android provider

The Android provider emits native Java Views and a Gradle Android project. Canonical vertical/horizontal/overlay/grid layouts map to native layout containers. `activate` maps to a click listener; input/change maps through `TextWatcher`; canonical restore declarations map to Android saved-instance state.

The emitted APK is a real Gradle build artifact. The provider currently embeds the compiled UI manifest and generated runtime rather than running the RCL native VM inside the APK.

## Compatibility

Existing K02/K03 companion-spec paths remain intact when no native UI declaration exists. They keep their `lowered-execution` classification. The new route is `native-semantic-candidate`; it does not retroactively promote legacy evidence.


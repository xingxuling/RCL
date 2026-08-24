# RCL — 5-Minute Getting Started

This guide is for programmers who want to understand RCL by running something first and reading architecture later.

## 1. Clone and install

Requirements: Node.js 22+ and npm.

```bash
git clone https://github.com/xingxuling/RCL.git
cd RCL
npm install
```

## 2. Run the smallest real RCL program

```bash
npm run demo
```

The script runs [`examples/hello-reality.rcl`](examples/hello-reality.rcl). The source declares:

```rcl
reality FirstLight {
  facet world.greeting : Text = "unformed"

  subject founder {
    facet awareness : Number = 0
    warrant world.write on world
  }

  emergence hello {
    cause founder
    when world.greeting == "unformed"
    needs world.write on world
    alter world.greeting <- "Hello, reality."
    alter founder.awareness <- founder.awareness + 1
    preserve founder.awareness >= 0
    witness "rcl:first-light"
  }

  foresee hello
  realize hello
}
```

What to look for conceptually:

```text
initial state
→ subject + warrant
→ candidate transition
→ guard + authority check
→ proposed mutation
→ invariant check
→ witness/evidence
→ committed result
```

The important point is not the greeting. It is that the state transition is explicit and governed.

## 3. Run the same program through the native path

Build the native toolchain first:

```bash
npm run build:native
```

Then run:

```bash
npm run demo:native
```

This exercises the repository's native VM/compiler path rather than only the JavaScript reference runtime.

## 4. See bytecode compilation + native execution

```bash
npm run demo:bytecode
```

This command compiles the same source to an `.rbc` artifact and then executes it with the native path.

## 5. Look at a Web application state model

Open:

[`examples/universal-stress/k02-complete-web-app.rcl`](examples/universal-stress/k02-complete-web-app.rcl)

It shows a more familiar application shape:

```rcl
facet app.todo_count : Number = 0
facet app.todo_input : Text = ""

subject user {
  warrant app.write on app
}

emergence addTodo {
  cause user
  when app.todo_input != ""
  needs app.write on app
  alter app.todo_count <- app.todo_count + 1
  alter app.todo_input <- ""
  preserve app.todo_count >= 0
  witness "rcl:k02:add-todo"
}
```

The model is then deliberately lowered into a Web execution substrate rather than pretending the browser itself is native RCL semantics.

## 6. See Native UI syntax

Open:

[`examples/native-ui/counter.rcl`](examples/native-ui/counter.rcl)

The UI layer includes state, derived values, bindings, layout, events, lifecycle, style and accessibility metadata. Related examples:

- [`examples/native-ui/navigation.rcl`](examples/native-ui/navigation.rcl) — in-app routing;
- [`examples/native-ui/device-adaptation.rcl`](examples/native-ui/device-adaptation.rcl) — width-profile adaptive layout;
- [`examples/universal-stress/k03-native-android-app.rcl`](examples/universal-stress/k03-native-android-app.rcl) — Android vertical slice.

## 7. Verify the self-hosted compiler

```bash
npm run build:selfhost-compiler
npm run verify:selfhost-fixedpoint
npm run verify:selfhost-examples
```

The fixed-point campaign checks the native-core compiler path around the repository's `C0 == C1 == C2` evidence boundary.

## 8. Where to go next

If you want to understand the language as a programmer, use this order:

```text
hello-reality.rcl
→ k02-complete-web-app.rcl
→ native-ui/counter.rcl
→ navigation.rcl
→ device-adaptation.rcl
→ k03-native-android-app.rcl
→ selfhost/compiler-core.rcl
→ CURRENT-STATUS.md
```

If you want the research methodology after that, read the Universal Program Stress and Frontier documents under `docs/`.

## Evidence boundary

This quick start intentionally does not upgrade any repository claims. In particular:

- native-core self-hosting is distinct from whole-language runtime self-hosting;
- generated Android artifacts are distinct from verified real-device execution;
- provider/lowered execution is distinct from native language semantics;
- Frontier sandbox evidence is not evidence of new physical laws.

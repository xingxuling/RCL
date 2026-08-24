# RCL — 5 分钟上手

这份指南给第一次接触 RCL 的程序员：**先跑起来，再读架构。**

## 1. 克隆并安装

要求：Node.js 22+、npm。

```bash
git clone https://github.com/xingxuling/RCL.git
cd RCL
npm install
```

## 2. 跑最小的真实 RCL 程序

```bash
npm run demo
```

这个脚本会运行 [`examples/hello-reality.rcl`](examples/hello-reality.rcl)：

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

先不要纠结所有关键字，先把它理解成：

```text
初始状态
→ 主体 + warrant
→ 候选状态变化
→ 条件与权限检查
→ proposed mutation
→ invariant 检查
→ witness / evidence
→ commit
```

重点不是打印一句 Hello，而是：**状态变化、谁能改、什么时候能改、什么条件必须保持、怎么留下证据，都被显式写进程序。**

## 3. 用 Native Path 跑同一份程序

先构建 Native toolchain：

```bash
npm run build:native
```

然后：

```bash
npm run demo:native
```

这一步会走仓库里的 Native VM / Compiler 路径，而不只是 JavaScript Reference Runtime。

## 4. 看 Bytecode → Native Execution

```bash
npm run demo:bytecode
```

这个命令会把同一份源码编译为 `.rbc`，随后交给 Native Path 执行。

## 5. 看一个更像普通 Web 应用的状态模型

打开：

[`examples/universal-stress/k02-complete-web-app.rcl`](examples/universal-stress/k02-complete-web-app.rcl)

其中已经是很熟悉的应用结构：

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

然后 RCL 会把自己拥有的状态/权限语义 Lower 到 Web 执行环境，而不是把浏览器实现本身冒充成 RCL 原生语义。

## 6. 看 Native UI

打开：

[`examples/native-ui/counter.rcl`](examples/native-ui/counter.rcl)

这里可以直接看到：

- state / derived value；
- binding；
- layout；
- event；
- lifecycle；
- style；
- accessibility metadata。

继续看：

- [`examples/native-ui/navigation.rcl`](examples/native-ui/navigation.rcl) — 应用内路由；
- [`examples/native-ui/device-adaptation.rcl`](examples/native-ui/device-adaptation.rcl) — width-profile 自适应布局；
- [`examples/universal-stress/k03-native-android-app.rcl`](examples/universal-stress/k03-native-android-app.rcl) — Android 垂直切片。

## 7. 验证 Self-host Compiler

```bash
npm run build:selfhost-compiler
npm run verify:selfhost-fixedpoint
npm run verify:selfhost-examples
```

这套验证对应当前仓库 `C0 == C1 == C2` 的 Native-Core Self-Hosting 证据边界。

## 8. 推荐阅读顺序

如果你是程序员，建议：

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

等这些看懂后，再进入 `docs/` 里的 Universal Program Stress、Frontier、Evidence / Governance 文档，会容易很多。

## 证据边界

这份 Quick Start 不提升任何仓库 claim：

- Native-Core Self-Hosting ≠ Whole-Language Runtime Self-Hosting；
- Android Artifact / APK Build ≠ 已验证真机执行；
- Provider / Lowered Execution ≠ Native Language Semantics；
- Frontier Sandbox Evidence ≠ 新自然规律证据。

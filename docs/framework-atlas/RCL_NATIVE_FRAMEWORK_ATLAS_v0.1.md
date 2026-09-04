# RCL Native Framework Atlas v0.1

**状态**：`INVENTORY_CANDIDATE_ONLY`

**目的**：把 RCL 真正拥有的原生语义框架，与 lowering、调度、打包、Forge 和 Provider 层分开，并为每个框架提供方便记忆的英文名和中文名。

## 一句话结构判断

RCL 不是只有一个 UI 框架，也不只是调度语言。当前仓库已经包含一组分层的原生语义框架；上一份 application-framework catalog 只是应用开发子集，不能作为整个 RCL 的框架地图。

```text
RCL Native Meaning
├─ Core Language        RCL Core / 核心语
├─ Native Runtime       RCL Engine / 原生引擎
├─ Reality Transactions  RCL Reality / 实境核
├─ Typed Data & Memory   RCL Typeforge / 型构工坊
├─ Native UI             RCL Weave / 织界
├─ Trace & Replay        RCL Trace / 迹流
└─ Knowledge & Simulation RCL Atlas / 知域

        ↓ lowering / composition / boundary

RCL Launchpad / 启界
RCL Shipyard / 交付坞
RCL Forge / 领域工坊
RCL Gate / 能力门
Web / Android / React / Three.js / Database / GPU / RNCS / IDE
```

## Native 的判定标准

这里的 `Native` 不表示实现必须使用 RCL、C、Rust 或某一种语言，而表示：

1. RCL 拥有源级语义；
2. RCL 有对应的 IR、canonical root 或运行时契约；
3. 能通过 reference/native/runtime path 执行或验证；
4. 有明确的负例、边界和 evidence contract；
5. 下游语言只负责 lowering 或专业执行，不拥有同一份 canonical semantic。

因此，RCL 可以把语义 Lower 到 Web、Android、SQL、GPU 或 RNCS，同时仍然保持 RCL-native ownership。

## 原生框架清单

| Technical ID | 正式英文名 | 方便记的英文名 | 正式中文名 | 方便记的中文名 | 当前阶段 |
| --- | --- | --- | --- | --- | --- |
| `rcl.core.language.v0.1` | RCL Core Language Framework | RCL Core | RCL 核心语言框架 | 核心语 | bounded native core verified |
| `rcl.core.runtime.v0.1` | RCL Native Runtime Framework | RCL Engine | RCL 原生运行时框架 | 原生引擎 | bounded native runtime verified |
| `rcl.reality.transaction.v0.1` | RCL Governed Reality Framework | RCL Reality | RCL 受治理实境框架 | 实境核 | semantic candidate |
| `rcl.data.typed.v0.1` | RCL Typed Data and Memory Framework | RCL Typeforge | RCL 类型数据与内存框架 | 型构工坊 | typed runtime candidate |
| `rcl.ui.native-app.v0.1` | RCL Weave Application Framework | RCL Weave | RCL 织界应用框架 | 织界 | current application framework candidate |
| `rcl.dev.trace.v0.1` | RCL Trace and Replay Framework | RCL Trace | RCL 追踪与回放框架 | 迹流 | tooling semantic candidate |
| `rcl.knowledge.simulation.v0.1` | RCL Knowledge and Simulation Framework | RCL Atlas | RCL 知识与模拟框架 | 知域 | domain semantic candidate |

新增的 technical ID 是 Atlas 提议 ID；`rcl.ui.native-app.v0.1` 是当前已有候选 ID。名称本身不构成 promotion，也不替代现有版本/格式契约。

## 先看“我要写什么”，再选框架

大多数应用不会直接选择 Core 或 Engine；它们是默认底座。开发者真正选择的是 Reality、Typeforge、Weave、Atlas，以及是否加上 Launchpad、Shipyard、Forge 和 Gate。

| 要写的东西 | 推荐组合 | 作用 |
| --- | --- | --- |
| Todo、记账、设置、表单、移动端 Dashboard | Core + Engine + Typeforge + Weave + Trace | RCL 负责数据/事件/UI 语义，Weave 负责 Web/Android UI lowering |
| CRM、客户管理、商品目录、库存系统 | Core + Reality + Typeforge + Weave + Gate | 类型数据模型 + 受治理业务变更 + UI + 数据库/文件 Provider |
| 审批、订单状态、权限任务系统 | Core + Reality + Typeforge + Trace | authority、invariant、candidate transition、commit 和可回放证据 |
| 科学笔记、实验面板、知识探索器 | Core + Typeforge + Reality + Atlas + Weave | 数量、知识、实验、模拟语义，加上可交互 UI |
| Web/Android 快速 MVP、管理后台 | Core + Typeforge + Weave + Launchpad + Shipyard | 快速应用壳、证据入口、多目标构建与交付 |
| 编译器、语言工具、运行时服务 | Core + Engine + Typeforge + Trace | 编译、类型、Bytecode/VM、调试和 replay |
| 2D/3D 游戏或可视化工具 | Core + Reality + Weave + Forge + Gate | Weave 管菜单/HUD/状态；Three.js、游戏引擎或 GPU 保留为 Provider |

这些是“适合写什么”的架构组合，不是对所有场景已经完成的能力声明。当前 async/data/persistence、完整 accessibility、resource/media、复杂 3D surface 仍需要独立 GAP 和 Stress Cell 证据。

## 1. RCL Core / 核心语

**技术 ID**：`rcl.core.language.v0.1`

**拥有的语义**：词法、语法、表达式、类型、subject、rule、emergence、source-to-IR 编译和诊断。

**适合写什么**：业务规则、配置解释器、小型 CLI、编译器前端和任何需要明确表达式/规则的程序。普通应用通常间接使用它，不需要单独调用 Core API。

**事实证据**：

- [`src/lexer.mjs`](../../src/lexer.mjs)
- [`src/parser.mjs`](../../src/parser.mjs)
- [`src/type-system.mjs`](../../src/type-system.mjs)
- [`src/compiler.mjs`](../../src/compiler.mjs)
- [`CURRENT-STATUS.md`](../../CURRENT-STATUS.md)

它不是 scheduler。Scheduler 可以调用 RCL 产出的 transition 或 proposal，但不能替代 RCL 对表达式、规则、类型和状态变化的解释。

## 2. RCL Engine / 原生引擎

**技术 ID**：`rcl.core.runtime.v0.1`

**拥有的语义**：RCL expression evaluation、RBC opcode、bytecode 编译/解码、native VM 执行、semantic state root。

**适合写什么**：确定性 CLI、嵌入式 RCL 执行、可回放状态机和不希望依赖外部解释器语义的运行时服务。

**事实证据**：

- [`src/runtime.mjs`](../../src/runtime.mjs)
- [`src/bytecode.mjs`](../../src/bytecode.mjs)
- [`src/native-vm.mjs`](../../src/native-vm.mjs)
- [`src/embedded-vm.mjs`](../../src/embedded-vm.mjs)
- [`src/semantic-state-root.mjs`](../../src/semantic-state-root.mjs)

当前已验证的是 bounded native-core/runtime path，不是 whole-language runtime 完成。这个边界必须保留。

## 3. RCL Reality / 实境核

**技术 ID**：`rcl.reality.transaction.v0.1`

**拥有的语义**：state、authority、warrant、needs、effects、invariant、candidate transition、commit、witness 和 evidence。

**适合写什么**：审批流、订单/库存变更、权限任务、可审计的游戏经济和任何“谁能在什么条件下改变什么”的程序。

**事实证据**：

- [`src/effects.mjs`](../../src/effects.mjs)
- [`src/reality-store.mjs`](../../src/reality-store.mjs)
- [`src/rncs-bridge.mjs`](../../src/rncs-bridge.mjs)
- [`src/semantic-state-root.mjs`](../../src/semantic-state-root.mjs)

RNCS bridge 只是把已经由 RCL 解释出的 transition 转成下游输入，不拥有 RCL transition 的 canonical meaning。RCL Reality 不是任务调度器，而是受治理状态变化的语义框架。

## 4. RCL Typeforge / 型构工坊

**技术 ID**：`rcl.data.typed.v0.1`

**拥有的语义**：record/union、泛型类型解析、typed module、typed reference、heap identity、GC snapshot、reference ABI 和 typed layout。

**适合写什么**：CRM 客户对象、商品目录、库存、用户会话、配置格式和需要稳定数据身份的应用数据层。

**事实证据**：

- [`src/type-module-kernel.mjs`](../../src/type-module-kernel.mjs)
- [`src/typed-reference-abi.mjs`](../../src/typed-reference-abi.mjs)
- [`src/typed-heap-layout.mjs`](../../src/typed-heap-layout.mjs)
- [`src/typed-gc-snapshot.mjs`](../../src/typed-gc-snapshot.mjs)
- [`src/typed-package-kernel.mjs`](../../src/typed-package-kernel.mjs)

这里需要把 typed data semantics 与 package delivery 分开：数据类型、引用和内存布局可以是 RCL-native；数据库、文件系统和 package cache 仍然是下游实现。

## 5. RCL Weave / 织界

**技术 ID**：`rcl.ui.native-app.v0.1`

**拥有的语义**：UI state、derived values、view roles、bindings、typed local events、layout、style、lifecycle、navigation 和 width adaptation。

**适合写什么**：Todo、计数器、记账、设置、表单、管理后台、移动端 Dashboard，以及同一套语义需要投射到 Web 和 Android 的应用。

**事实证据**：

- [`src/ui/ui-schema.mjs`](../../src/ui/ui-schema.mjs)
- [`src/ui/ui-ir.mjs`](../../src/ui/ui-ir.mjs)
- [`src/ui/ui-compiler.mjs`](../../src/ui/ui-compiler.mjs)
- [`src/ui/ui-event.mjs`](../../src/ui/ui-event.mjs)
- [`src/ui/web-ui-backend.mjs`](../../src/ui/web-ui-backend.mjs)
- [`src/ui/android-ui-backend.mjs`](../../src/ui/android-ui-backend.mjs)
- [`src/application-framework.mjs`](../../src/application-framework.mjs)

Weave 不是“RCL 调度 React”。正确关系是：Weave 拥有 UI meaning，React/DOM/Android/Three.js 可以作为具体的 lowering 或 provider organ。

当前未完成的 `RCL_GAP` 包括 async/data/persistence、完整 accessibility/focus、resource/media lifecycle、复杂 virtualization/constraint layout 和完整 production target evidence。

## 6. RCL Trace / 迹流

**技术 ID**：`rcl.dev.trace.v0.1`

**拥有的语义**：RCL source map、execution trace、replay input、debug session、profiler evidence 和 state/effect trace identity。

**适合写什么**：编译器/运行时调试、难复现 Bug、性能回归、跨目标差分测试和证据优先的 QA 流程。

**事实证据**：

- [`src/debug-replay-runtime.mjs`](../../src/debug-replay-runtime.mjs)
- [`src/debug-session-runtime.mjs`](../../src/debug-session-runtime.mjs)
- [`src/profiler-debug-ui-runtime.mjs`](../../src/profiler-debug-ui-runtime.mjs)
- [`src/lsp-dap-bridge-runtime.mjs`](../../src/lsp-dap-bridge-runtime.mjs)

Trace/Replay 的语义可以属于 RCL；LSP、DAP、IDE panel 和 flamegraph 的传输实现不属于 RCL Core。

## 7. RCL Atlas / 知域

**技术 ID**：`rcl.knowledge.simulation.v0.1`

**拥有候选语义**：quantity、measurement、knowledge claim、cognition、spacetime、experiment/result 和 bounded simulation contracts。

**适合写什么**：科学笔记、实验面板、知识探索器、可解释的数量/测量应用和受边界约束的世界模拟。

**事实证据**：

- [`src/foundation.mjs`](../../src/foundation.mjs)
- [`src/quantity.mjs`](../../src/quantity.mjs)
- [`src/knowledge.mjs`](../../src/knowledge.mjs)
- [`src/cognition.mjs`](../../src/cognition.mjs)
- [`src/meta-planes.mjs`](../../src/meta-planes.mjs)
- [`src/reality-compiler-kernel.mjs`](../../src/reality-compiler-kernel.mjs)

Atlas 目前是领域语义候选，不能把特定科学 solver、模型训练器或外部现实证明自动升进 Core。

## 配套层：不是原生 Core，但很重要

| 方便记的名字 | 中文名 | 分类 | 作用 |
| --- | --- | --- | --- |
| RCL Launchpad | 启界 | Pack Candidate | 把 Weave、产品入口、证据循环组合成快速应用起点 |
| RCL Shipyard | 交付坞 | Pack Candidate | lock、cache、package、target matrix、release、verify |
| RCL Forge | 领域工坊 | Pack Candidate | App、Media、Neural 领域模板 |
| RCL Gate | 能力门 | Auxiliary Provider | 网络、文件、媒体、模型、硬件等外部能力边界 |

这些层可以显著提高开发效率和用户体验，但不应因此获得 RCL Core 的语义所有权。

具体来说：

- **Launchpad / 启界**：从一个 MVP、管理后台或 goal-to-plan 产品壳开始；
- **Shipyard / 交付坞**：把已经编译好的 Web/Android/RCLApp 目标整理成可验证交付物；
- **Forge / 领域工坊**：快速启动 Media、Neural 或其他领域原型；
- **Gate / 能力门**：当应用需要网络、数据库、文件、模型、GPU 或硬件时才接入。

## 关系链

```text
RCL Core
  → RCL Engine
  → RCL Reality / Typeforge
  → RCL Weave / Trace / Atlas
  → Launchpad / Shipyard / Forge
  → Provider / Backend / Host
```

同一 canonical semantic 只能有一个 Owner。Lowering、调度、打包和 Provider 可以提高效率，但不能反向定义 RCL 的语义。

## 当前异常点

1. `application-framework` catalog 只列出一个直接 Framework Candidate，容易让人误以为 RCL 没有 Core/Runtime/Reality/Data 框架。
2. RCL 的原生计算能力已经存在，但开发者入口主要展示 intent、authority、provider、evidence，造成“调度语言”的表面印象。
3. Native UI 的语义层存在，Component Pack、Data/Async Pack 和 Resource/Accessibility 仍不完整。
4. 部分 typed、debug、simulation 能力有真实模块，但尚未形成统一框架 ID、跨场景回归和晋升证据。

## 晋升规则

Atlas 条目不自动晋升。每个原生框架必须单独通过：

```text
source primitive
→ canonical IR / root
→ reference or native execution
→ negative controls
→ repeated K400 Stress Cells
→ differential / runtime evidence
→ human review
```

`CANDIDATE`、`BOUNDED_VERIFIED`、`PACK`、`AUXILIARY` 和 `RCL_GAP` 必须保持可区分。

## 最小验证入口

机器可读目录：

```text
node src/cli.mjs framework-atlas
```

应用框架仍可单独查看：

```text
node src/cli.mjs application-frameworks
```

本 Atlas 是结构地图，不改变当前 K400 incomplete、Native UI candidate 或 whole-language runtime 未完成等既有证据边界。

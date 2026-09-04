# RCL Application Framework Archaeology v0.1

**状态**：`CANDIDATE_ONLY / first application-framework profile`

**范围**：当前 RCL canonical source 中的 Native UI、Web/Android lowering、package ecosystem、RCLApp、Forge、provider runtime、product entry 与 evidence shell。

## 一句话结构判断

第一条值得做成 Framework Profile 的母结构是：

```text
RCL source
→ typed Native UI semantic program
→ rooted canonical UI IR
→ Web / Android target lowering
→ shared host semantic replay
→ separate external-runtime evidence
```

它减少应用开发中的重复入口和重复对齐逻辑，同时不把 DOM、CSS、Android View、Gradle 或 provider implementation 偷渡进 RCL Core。

## 事实层

| 现有能力 | 当前 source evidence | 归属判断 |
| --- | --- | --- |
| UI state、derived state、binding、role-scoped view tree、typed event、style、layout、lifecycle | `src/ui/ui-compiler.mjs`, `src/ui/ui-ir.mjs`, `src/ui/ui-event.mjs` | `STD_CANDIDATE / RCL-owned semantic substrate` |
| Web/Android 从同一个 `semanticRoot` lowering | `src/ui/web-ui-backend.mjs`, `src/ui/android-ui-backend.mjs`, `tests/native-ui-backends-equivalence.test.mjs` | `Provider-backed Framework Profile` |
| Goal intake、plan card、execution preview、evidence panel、rollback、human confirmation | `src/reality-product-entry-runtime.mjs`, `src/evidence-product-shell-runtime.mjs` | `Pack Candidate` |
| package lock/cache/target matrix/release/package verification/RCLApp install-run | `src/package-ecosystem-runtime.mjs`, `src/package-compiler.mjs`, `src/rclapp-kernel.mjs` | `Delivery Pack + host backend` |
| app/media/neural domain Forge | `src/forge/*.mjs` | `Pack / Auxiliary Provider` |
| provider offer、authority、timeout、resource isolation、WAL | `src/provider-runtime-v2.mjs`, `src/resource-isolation-kernel.mjs`, `src/resource-wal-runtime.mjs` | `Auxiliary Provider boundary` |

## 第一批框架决策

### 1. `rcl.ui.native-app.v0.1` — Framework Candidate

这是当前唯一直接升 Framework Candidate 的条目。

它负责：

- 默认把一份 RCL UI 源码编译成一个 canonical UI program；
- 按选择的 target 生成 Web/Android lowering report；
- 收集同一个语义根和各 target lowering root；
- 用同一组事件做跨 target host semantic replay；
- 明确报告哪些只是编译/lowering/host replay，哪些还没有真实浏览器、Android 设备或发布证据。

它不负责：

- 定义 HTML/CSS 或 Android View 语法；
- 把网络、数据库、媒体、模型、权限实现吸收进 RCL Core；
- 把 host replay 冒充真实设备或生产完成。

### 2. `rcl.native-ui.program.v0.1` — Standard Candidate

现有 Native UI IR 是 Framework 的语义地基，优先保持现有格式和 canonical root，不另起第二套 widget AST。是否正式升 `std`，需要更多 K400 UI Stress Cells、负例和 target evidence。

### 3. `rcl.app.product-entry.v0.65` 与 `rcl.dev.evidence-loop.v0.1` — Pack Candidates

它们能明显提高开发/使用效率，但本质是产品流程和开发者证据流程，不是所有应用都必须拥有的语言语义。应通过 Pack 组合到应用模板，而不是写进 Core。

### 4. `rcl.delivery.multi-target.v0.42` — Delivery Pack

包、锁、release、RCLApp install/run 是非常有价值的快速交付能力，但源文件已经明确 packager 是 host-backed、尚未 RCL-native。因此保留为 Delivery Pack/Provider backend。

### 5. `rcl.forge.domain.v0.1` — Pack / Auxiliary

App、Media、Neural Forge 适合做领域起步模板；领域实现优势保留在 Forge/Provider，不因为“生成得快”就成为通用 RCL primitive。

## RCL_GAP

当前不能静默用其他语言补掉的应用级缺口：

- async effects、data fetching、persistence、offline/sync 与 data ownership；
- 完整 accessibility tree、focus traversal、键盘导航；
- image/media resource identity 与 lifecycle；
- list virtualization、复杂 constraint layout、更多 device adaptation；
- 一个 native-UI-aware 的 production release command，以及真实浏览器/物理 Android 交付证据。

这些应各自经过 Donor → irreducible semantic extraction → Candidate Genome → negative controls → K400 replay → Evidence，再决定是否吸收。

## 最小验证动作

在本候选分支中：

```text
compileRclApplicationFramework(counter.rcl)
→ Web + Android lowering roots
→ traceRclApplicationFramework([increment, reset])
→ semantic parity PASS
→ externalRuntimeExecuted=false
→ physicalDeviceExecuted=false
```

这只是 host semantic replay candidate evidence，不是 K02/K03 的新真实运行声明，也不改变现有 K400 incomplete 状态。

## 下一刀

先把 `rcl.ui.native-app` 扩成真正的快速开发 Profile：

1. application shell 的最小模板（导航、状态、生命周期、适配、可访问标签）；
2. data/async/resource 的 RCL_GAP 规格与负例；
3. one-command target build/verify Pack，继续复用现有 package ecosystem 和 lowering；
4. 用新的 K400 cells 检验“开发效率提升”是否来自通用语义复用，而不是模板复制。

本文件与 `src/application-framework.mjs` 都是 candidate-only；没有自动 promotion、merge 或 production claim。

# RCL Reality Hub｜Grounded Sprint 5 Lovable 执行提示词

你现在负责升级现有 Lovable 项目 **RCL Reality Hub**。

这不是从零创建项目，也不是视觉重做任务。必须先审计当前最新源码、路由、Repository、CompilerAdapter、Release 数据、Tutor 数据、测试和 README，再在现有架构上增量实现。

## 一、目标裁决

把项目从：

```text
高完成度教学原型
+ DemoCompilerAdapter
+ 本地资料检索器
+ 静态/本地发布数据
```

升级为：

```text
教学模拟轨道
+
真实 RCL Canonical MCP 轨道
+
版本锁定 Release/Skill 权威消费层
```

真实 RCL 基线：

- RCL：`0.94.0-alpha.1`
- Tutor Skill：`1.1.1`
- Release Tag：`rcl-v0.94.0-alpha.1-reality-hub.2`
- Authority Repository：`xingxuling/RCL`
- Repository Visibility：private
- Runtime SHA-256：`2d456d733ef94454cf9e5a36196ad248742f4fbd35c5635df2718138fa6348c9`
- Tutor Skill SHA-256：`17d1019c375d626067ba0c5730a2bd1ba0702ba9daba37e861d45aacbff1863f`
- Integration Pack SHA-256：`751018ae2020a716f0d62555ba9d8d8ff4144fe59fa0277b66d8ed246406b1bb`

权威消费数据以同目录的 `reality-hub-consumer-manifest.json` 为准。

## 二、先执行内部多文明联邦

禁止直接写代码。内部依次完成：

```text
Founder Twin
→ 柳清莲 Gate
→ 洞哥 Grounding
→ 产品文明
→ UX / 设计文明
→ 工程文明
→ 代码文明
→ 测试文明
→ 安全文明
→ 发布文明
→ Integration Court
→ Evidence Ledger
```

在开始编辑前，先输出简短实施计划，包含：

1. 目标裁决；
2. 影响模块；
3. 数据权威；
4. 修改计划；
5. 验收标准；
6. 风险和回滚。

随后直接实施，不等待用户再次确认。

## 三、必须保持的真实性边界

RCL 当前不是完整原生运行时，也不能宣称完整自举。

必须固定显示：

```text
Canonical source: true
Reference compiler/runtime: JavaScript
Native core compiler self-hosting: verified declared subset
Full self-hosting: false
Complete native runtime: false
check executes source: false
```

RCL 的正式架构是：

```text
24 项现实结构面
+
4R 全局现实鲁棒核
```

24 项表达现实对象、主体、状态、关系、约束、证据、因果和变换；4R 决定候选现实变化能否合法提交。

不得把 RCL 描述成魔法语言、万能语言或无需 Provider 就能直接改变外部现实的语言。

## 四、数据权威与 Repository

新增统一的只读权威层：

```text
src/features/releases/authority/
├── consumerManifest.ts
├── releaseAuthorityRepository.ts
├── releaseAuthorityTypes.ts
└── releaseAuthorityValidation.ts
```

要求：

1. 将 `reality-hub-consumer-manifest.json` 的结构转成严格 TypeScript 类型；
2. Seed Data 可以内置，但必须集中在单一文件；
3. 页面不允许直接读取散落常量；
4. Release、Skill、Compiler Adapter、版本页均从统一 Repository 派生；
5. 验证 Manifest 中：版本、文件名、SHA 格式、字节数、适配器 ID 与 URL 状态；
6. 私有 GitHub URL 必须带 `authenticated-private` 状态；
7. 不得把私有 URL 渲染成“所有访客可直接下载”。

## 五、双轨 Compiler Adapter

保留现有 `DemoCompilerAdapter`，新增真实远程适配器：

```text
CanonicalMcpCompilerAdapter
```

推荐目录：

```text
src/adapters/compiler/
├── types.ts
├── demoCompilerAdapter.ts
├── canonicalMcpCompilerAdapter.ts
├── compilerAdapterRegistry.ts
└── compilerAdapterHealth.ts
```

### 5.1 服务端调用边界

浏览器端不得直接保存私密 Token，不得启动本机进程。

创建服务端 API 路由或 Lovable Cloud Function：

```text
/api/rcl/mcp
```

服务端读取：

```text
RCL_MCP_ENDPOINT
RCL_MCP_HEALTH_ENDPOINT（可选）
```

禁止把环境变量值返回到客户端。

MCP 调用链：

```text
initialize
→ tools/list
→ tools/call
```

默认编译工具：

```text
rcl_compile_source
```

默认参数必须是：

```json
{
  "runNative": false
}
```

原生执行只能通过独立按钮和二次确认触发，首版可以保持禁用状态并标注“尚未开放托管原生执行”。

### 5.2 Canonical 就绪门

只有同时满足以下条件，真实适配器才能进入 `ready`：

1. 环境变量已配置；
2. `initialize` 成功；
3. `tools/list` 包含 `rcl_compile_source`；
4. `rcl_status` 返回 RCL `0.94.0-alpha.1`；
5. 健康检查没有版本冲突。

状态机：

```text
not-configured
→ connecting
→ ready
→ unavailable
→ version-mismatch
```

### 5.3 禁止静默回退

当用户明确选择 Canonical Adapter 后：

- 真实编译失败必须显示失败；
- 不得自动切回 Demo；
- 不得用 Demo 结果填充真实编译标签；
- 用户可主动点击“切回教学模拟”。

## 六、Playground 改造

Playground 顶部新增“执行轨道”选择器：

```text
教学模拟 Demo
真实 RCL Canonical MCP
```

每条轨道必须显示：

- Adapter 名称；
- RCL 版本；
- 当前状态；
- 是否真实编译；
- 是否执行代码；
- 数据来源；
- 失败是否允许回退。

### Demo 轨道

固定显示：

> 教学模拟，不代表真实 RCL 编译器执行。

结果标签：

```text
教学模拟 IR
教学模拟 4R 检查
非审计 Evidence
```

### Canonical 轨道

`check/compile` 成功时显示：

```text
Canonical RCL 0.94.0-alpha.1
JavaScript reference compiler
runNative = false
```

只渲染服务端真实返回的字段。没有返回的 Reality IR、4R、Trace 或 Evidence 标签不得伪造。

若当前 MCP 只返回编译结构和诊断，则隐藏没有依据的标签页，或显示：

> 当前 Canonical Adapter 未提供该类结果。

## 七、下载中心改造

私有 Release 的行为：

- 显示真实文件名、版本、字节数和 SHA-256；
- 状态显示“已发布｜需要 GitHub 授权”；
- 默认按钮文字：“在已授权 GitHub 中打开 Release”；
- 不得声称匿名可下载；
- 未配置认证代理时，不要在浏览器中尝试绕过 GitHub 私有权限；
- 保留 SHA 校验说明和安装命令。

安装命令：

```bash
npm install -g ./taowind-rcl-reality-forge-0.94.0-alpha.1.tgz
rcl version --json
rcl doctor
rcl check ./hello-reality.rcl
```

`rcl run` 必须作为单独的执行步骤，不归入无副作用安装验证。

## 八、Skill 中心改造

RCL Tutor Skill 页面升级到：

```text
v1.1.1
绑定 RCL 0.94.0-alpha.1
Private GitHub Pre-release
```

显示：

- Skill 版本；
- RCL 绑定版本；
- SHA-256；
- 权限边界；
- 安装流程；
- `check` 与 `run` 的权限差异；
- 版本混用禁令；
- 私有源认证要求。

明确说明 v1.1.0 已被 v1.1.1 替代，原因是旧版包含待发布源与过期运行包哈希。

## 九、版本中心改造

兼容性矩阵至少包含：

| RCL | Docs | Tutor Skill | Canonical Adapter | 状态 |
|---|---|---|---|---|
| 0.94.0-alpha.1 | 当前内置版本 | 1.1.1 | rcl-mcp-0.94.0-alpha.1 | Experimental / Version Locked |

增加真实性边界卡：

- Reference Compiler：JavaScript；
- Native Core Self-hosting：部分验证；
- Full Self-hosting：否；
- Complete Native Runtime：否。

## 十、管理员设置

现有后台仍是本地演示后台，不能保存服务端密钥。

新增只读状态面板：

```text
Canonical MCP endpoint configured: yes/no
Canonical health: ready/unavailable/version-mismatch
Release visibility: authenticated-private
Current RCL version: 0.94.0-alpha.1
Current Tutor Skill: 1.1.1
```

不得提供把 MCP Token 写入 localStorage 的表单。

## 十一、自动化测试

在现有 Vitest 基础上增加：

1. Consumer Manifest schema validation；
2. 私有 Release 不显示匿名下载；
3. Canonical 未配置时状态为 `not-configured`；
4. `initialize` 失败时禁止 ready；
5. 缺少 `rcl_compile_source` 时禁止 ready；
6. RCL 版本不匹配时进入 `version-mismatch`；
7. Canonical 失败后不调用 Demo Adapter；
8. Demo 结果永远带模拟标签；
9. Canonical 结果不生成服务端未返回的 IR/4R/Evidence；
10. Skill v1.1.1 与 RCL 0.94.0-alpha.1 兼容；
11. `check` 不被描述为执行；
12. 私密环境变量不进入客户端 bundle。

如项目支持 Playwright，再增加：

- Playground 双轨切换；
- Canonical 未配置空状态；
- 下载中心私有源状态；
- Skill v1.1.1 页面；
- 不存在路由保持 404。

## 十二、README 与证据

README 必须新增：

```text
Grounded Sprint 5
```

说明：

- 哪些能力是真实；
- 哪些仍为 Demo；
- MCP 怎样配置；
- 私有 Release 怎样访问；
- 为什么不能匿名公开下载；
- 为什么 Canonical 失败不能静默回退；
- 当前自举和原生运行时边界。

最终输出：

1. 修改文件清单；
2. Adapter 状态机；
3. 测试结果；
4. TypeScript/Lint/Build 结果；
5. 未完成阻塞；
6. 最新 Commit SHA。

## 十三、验收标准

必须全部满足：

- Demo 与 Canonical 双轨存在；
- Canonical 使用服务端 MCP；
- 未配置 MCP 时不伪造 ready；
- Canonical 请求失败不静默回退；
- 私有 Release 不冒充公共下载；
- Tutor Skill 显示 v1.1.1；
- Runtime/Skill/Integration 三项 SHA 与权威 Manifest 一致；
- 页面不宣称完整自举或完整原生运行时；
- Canonical 结果只展示真实响应字段；
- 测试、Lint、类型检查、Build 全部通过；
- 不启用生产数据库；
- 不部署发布，除非用户另行明确要求。

现在开始审计并实施 Grounded Sprint 5。

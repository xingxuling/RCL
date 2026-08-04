# RCL Reality Hub Grounded Sprint 5｜验收矩阵

## 目标

确认 Reality Hub 能同时承载教学模拟与真实 Canonical MCP 编译轨道，并保持版本、权限、证据和发布来源边界。

## 状态矩阵

| 场景 | 预期状态 | 可执行操作 | 必须显示 | 禁止行为 |
|---|---|---|---|---|
| 未配置 MCP | `canonical-not-configured` | Demo；查看配置说明 | 未配置服务端端点 | 伪造连接成功 |
| MCP 初始化中 | `canonical-connecting` | 取消或等待 | Loading、超时边界 | 展示旧缓存为新结果 |
| MCP 就绪 | `canonical-ready` | Canonical check/compile | RCL 0.94.0-alpha.1、runNative=false | 隐藏 Adapter 来源 |
| MCP 工具缺失 | `canonical-unavailable` | 查看诊断、主动切回 Demo | 缺少 `rcl_compile_source` | 自动回退 Demo |
| MCP 版本冲突 | `canonical-version-mismatch` | 查看服务端/页面版本 | 双方版本 | 混用文档和语法 |
| Canonical 请求失败 | `canonical-unavailable` | 重试、主动切轨 | HTTP/MCP 错误摘要 | 用 Demo 结果填充 |
| Demo 成功 | `demo-ready` | 教学查看 | 模拟 IR/4R/Evidence 标签 | 称为真实编译 |
| 私有 Release | `private-release-auth-required` | 打开已授权 GitHub Release | SHA、文件名、认证要求 | 声称匿名下载 |

## 功能验收

### A. Authority Repository

- [ ] 所有 Release、Skill 与 Adapter 数据来自统一 Repository。
- [ ] Runtime SHA 为 `2d456d733ef94454cf9e5a36196ad248742f4fbd35c5635df2718138fa6348c9`。
- [ ] Skill SHA 为 `17d1019c375d626067ba0c5730a2bd1ba0702ba9daba37e861d45aacbff1863f`。
- [ ] Integration SHA 为 `751018ae2020a716f0d62555ba9d8d8ff4144fe59fa0277b66d8ed246406b1bb`。
- [ ] Release 标记为 `authenticated-private`。

### B. Compiler Adapter

- [ ] `DemoCompilerAdapter` 继续存在。
- [ ] `CanonicalMcpCompilerAdapter` 通过服务端路由调用。
- [ ] 客户端 bundle 不包含 MCP endpoint secret/token。
- [ ] `check/compile` 默认 `runNative=false`。
- [ ] 用户明确选择 Canonical 后，失败不静默回退。
- [ ] Canonical 响应未提供的字段不被 UI 伪造。

### C. Playground

- [ ] 有明确双轨切换器。
- [ ] 每条轨道显示版本、真实性、执行级别与来源。
- [ ] Demo 标签始终含“教学模拟”。
- [ ] Canonical 标签始终含“JavaScript reference compiler”。
- [ ] `check` 不显示为程序执行。

### D. Downloads

- [ ] 私有资源显示真实 SHA 和字节数。
- [ ] 按钮文字反映“需要 GitHub 授权”。
- [ ] 没有认证代理时不尝试匿名下载。
- [ ] 安装验证只包含 version/doctor/check。
- [ ] run 为单独授权步骤。

### E. Tutor Skill

- [ ] 当前版本为 v1.1.1。
- [ ] 精确绑定 RCL 0.94.0-alpha.1。
- [ ] 显示版本混用禁令。
- [ ] 显示私有源认证要求。
- [ ] 显示 v1.1.0 被替代原因。

### F. Truth Boundary

- [ ] 24 项现实结构面与 4R 全局现实鲁棒核表述正确。
- [ ] Full self-hosting = false。
- [ ] Complete native runtime = false。
- [ ] JavaScript reference runtime still required = true。
- [ ] Provider/外部执行器仍是现实动作必要边界。

## 自动化门禁

```text
TypeScript: pass
ESLint: 0 errors
Vitest: pass
Build: pass
Route smoke: pass
Client secret scan: pass
```

最低自动化用例：

1. Manifest 校验；
2. 私有源下载边界；
3. 未配置状态；
4. initialize 失败；
5. 工具缺失；
6. 版本不匹配；
7. 禁止静默回退；
8. Demo 真相标签；
9. Canonical 字段不伪造；
10. Skill/RCL 版本锁；
11. check/run 权限区分；
12. 环境变量不进入客户端。

## Integration Court 裁决

只有全部功能验收和自动化门禁通过，Sprint 5 才可标记：

```text
READY — Canonical Adapter Configurable
```

只有实际配置 MCP endpoint，并完成一次真实：

```text
initialize
→ tools/list
→ rcl_status
→ rcl_compile_source(runNative=false)
```

且留下服务器响应证据后，才可标记：

```text
VERIFIED — Canonical MCP Connected
```

未配置端点时不得声称 VERIFIED。

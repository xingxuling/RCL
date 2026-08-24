# Frontier Independent Process Observation v0.1

**状态**：`PASS / Phase1C separate-process preexisting-file boundary`  
**RCL 基线**：v0.94.0-alpha.1 + Frontier Phase0/0.5/1A/1B  
**日期**：2026-08-11（2026-08-24 Windows main integration 复核）

## 0. 目标裁决

Phase1B 已经把真实宿主测量送进 External Observation Contract，但 acquisition 与 RCL 研究代码仍处在同一运行体系中。Phase1C 切断这一层耦合：

```text
standalone producer process (Node built-ins only; no RCL import)
→ complete raw JSON file
→ producer exits
→ RCL starts/reads preexisting file
→ validates file root + process boundary
→ External Observation Contract
→ blind scorer
→ reveal
```

这证明的是**数据产生进程与 RCL intake 进程分离**，不是第三方独立复现、独立设备或新自然规律证据。

## 1. Standalone producer

`tools/frontier-independent-acquisition/produce-known-timing-dataset.mjs`：

- 只使用 Node built-ins；
- 不 import 任意 RCL `src/` 模块；
- 使用独立 PID；
- 完成 acquisition 后把 JSON 写入磁盘并退出；
- response 来自 `Atomics.wait` + `process.hrtime.bigint()` 的实际测量；Windows producer 使用已记录的 `timingScale=16` 跨过子 16ms 等待量化区间；
- 输出路径先解析为平台原生绝对路径，再用 `pathToFileURL` 写入，避免 Windows drive-letter 被重复拼接；
- 输出 producer PID、host fingerprint、开始/结束时间与 file root。

## 2. Intake gate

RCL 读取文件后强制检查：

- 文件格式；
- `importsRcl=false`；
- producer boundary 声明；
- producer PID 与 intake PID 不同；
- acquisition 时间有效；
- observation 数量；
- file root 未被篡改；
- 之后仍须通过 Phase1A provenance / calibration / rawDataRoot / contractRoot / blind evaluator 全部门。

## 3. 已知控制

两份文件由两个独立 producer 运行产生：

1. **interaction known control**：存在人工已知 `S×G` 额外 timing interaction；
2. **additive known control**：只保留 `S` 和 `G` 主效应，无 interaction。

成功门：

```text
interaction file → H_interaction + detected=true
additive file    → H_additive + detected=false
```

## 4. 证据边界

```text
externalRealityVerified = false
newNaturalLawVerified = false
magicVerified = false
```

Evidence class：

`separate_process_same_host_known_engineered_control`

它比 Phase1B 多证明一个**预先存在文件 + 独立进程**边界，但仍不是独立实验室、独立设备或外部科学数据集。

## 5. 下一门

Phase1D 应优先接入：

1. 独立公开科学数据文件；或
2. 另一设备/另一运行环境产生的 sensor export；
3. 之后才允许 unknown-natural-law candidate 使用同一 pipeline。

包级 public export / 统一 npm script 仍是后续技术债；本轮只把新模块加入 `src/frontier-research-index.mjs`，不把 Phase1C 与包发布整合混成同一提交。

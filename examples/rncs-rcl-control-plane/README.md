# RNCS RCL Control Plane v0.2

将 RNCS 的 11 个核心语义模块编译为单份 AOT RCL 控制平面：Core、RFE、AAF、Reality Branch、Reality Behavior、ICAR、CNP、Living Artifact、HNAC、Runtime Registry 与 Gateway。

旧 JavaScript/Python/Rust 实现继续承担生产功能；RCL 模块作为权威语义镜像、跨模块契约、AOT Bundle 与 parity 层。控制平面可通过长驻 daemon 或 `librclvm` 同进程热执行。

```bash
npm test
npm run demo
npm run benchmark
```

当前边界：尚未迁移底层数据库、网络、GPU、文件系统和设备驱动；这些应继续作为 Provider。

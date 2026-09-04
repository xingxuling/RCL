# UGIS Fighter Game — Audio Sources

本目录记录 v0.3-A 使用的第三方音效来源与许可证。

当前浏览器原型为了避免把二进制音频复制流程绑死在 GitHub Contents 文本接口上，运行时从固定 commit 的 jsDelivr GitHub CDN 镜像读取样本。后续可在资产流水线支持 binary vendoring（本地二进制入库）后，将同一文件固化进本目录而不改 Audio Runtime 接口。

## 1. Sword whooshes / 剑挥声

- 文件：`slash-1.ogg`, `slash-2.ogg`, `slash-3.ogg`
- 原作者：StarNinjas
- 原始素材：**20 Sword Sound Effects (attacks and clashes)**
- 原始来源：OpenGameArt
- 许可证：**CC0 1.0 Universal**
- GitHub 镜像：`magnusrodseth/attack-on-titan`
- 固定 commit：`15f80d905322da96879e3ab1b7a6e72c27768fd2`
- 该仓库 README 明确将 Blade whooshes 标记为 CC0。

用途：

- Light 1 / 2 / 3
- Heavy
- AI thrust / heavy
- 万风技能的剑路主体声

## 2. Metal impacts / 金属碰撞

- 文件：`metal-impact-1.ogg`, `metal-impact-2.ogg`, `metal-impact-3.ogg`
- 原作者：Kenney
- 原始素材：**Kenney RPG Audio** (`metalPot1.ogg`, `metalPot2.ogg`, `metalPot3.ogg`)
- 原始来源：Kenney
- 许可证：**CC0 1.0 Universal**
- GitHub 镜像：`Sonofg0tham/tailgate`
- 固定 commit：`99de980908146410f5bb3b0efcd6711e22b253b9`
- 该仓库 CREDITS.md 明确记录这些文件来自 Kenney RPG Audio 且为 CC0。

用途：

- Guard Impact（格挡碰撞）
- 剑击命中时的高频瞬态层

## 3. Footstep / 脚步

- 文件：`footstep-concrete-1.ogg`
- 原作者：Kenney
- 来源：Kenney CC0 Audio pack 的 concrete footstep 镜像
- 许可证：**CC0 1.0 Universal**
- GitHub 镜像：`Sonofg0tham/tailgate`
- 固定 commit：`99de980908146410f5bb3b0efcd6711e22b253b9`

用途：

- 地面移动脚步

## 4. Runtime synthesized layers / 运行时合成层

以下声音不依赖第三方采样，由 Web Audio API 在浏览器内生成：

- Dash / 瞬步风声
- 技能风压层
- 低频命中 body / thud
- 音频样本未加载完成时的 fallback transient（降级瞬态）
- Victory 三音提示

这些合成代码属于本项目源码。

## 5. License policy / 许可证策略

v0.3-A 的外部 SFX 只允许：

- CC0 / Public Domain，或
- 未来经过显式审核后加入的其他可商用许可证。

禁止把“免费下载”“可个人使用”当成可入库许可证。

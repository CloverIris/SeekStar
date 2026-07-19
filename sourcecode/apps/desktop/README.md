# SeekStar Desktop

SeekStar Desktop 是 SeekStar 的 Electron 产品外壳和主进程运行时宿主。它把设置、tab/surface 生命周期、世界生产、来源观察、持久化与地图渲染连接成一个可恢复的 MVP 闭环。

当前是否可用、哪些能力仍有缺口，以 [`CURRENT_BASELINE.zh.md`](../../docs/status/CURRENT_BASELINE.zh.md) 为准；本文只说明桌面应用边界。

## 当前闭环

1. 在设置页配置并测试 OpenAI-compatible Provider；API Key 由 Electron `safeStorage` 保护。
2. 用 Seed 创建独立世界；主进程优先恢复缓存，缺失时先生成中心 segment，再补充邻近工作集。
3. tab surface 在同一 XY 世界中浏览 L0–L3；切换尺度不等待生成，后台事件不能覆盖活动视图。
4. AI Cartographer 提出来源候选，Scout/DataService 成功观察后才生成可见的 L3 来源对象。
5. 世界内容与最后视图 checkpoint 分别持久化，重启后继续原有探索。

## 四个产品尺度

| 尺度 | 视野 | 主要内容 |
| --- | --- | --- |
| L0 | 领域视野 | 大区域、跨领域地带、宏观地标和未知边界 |
| L1 | 主题视野 | 主题邻域、分支、交叉问题和桥接主题 |
| L2 | 解释视野 | 机制、组件、比较、争议、实践路径和证据方向 |
| L3 | 来源视野 | 仅限 Scout 成功观察的网页、论文、PDF、图片或本地材料 |

这些尺度是一张共享语义地图的投影，不是四张独立列表。目标语义见 [`SEMANTIC_SCALE_CONTRACT.zh.md`](../../docs/product/SEMANTIC_SCALE_CONTRACT.zh.md)。当前 baseline 仍有固定草图、语义关系不足和 Shell 状态分裂等已知限制，不应把现有视觉结果当成最终设计。

## 进程与状态所有权

| 部分 | 拥有 | 不拥有 |
| --- | --- | --- |
| Electron main | 世界文档、segment/Scout 任务、来源状态、lease、设置和 JSON 持久化 | 活动相机、选择和渲染帧 |
| Shell renderer | 标题栏、左栏、设置、tab/surface 编排和 dock host | 探索世界生产 |
| Tab surface renderer | 活动相机、尺度、选择、焦点和纯投影消费 | 世界生成生命周期、来源真实性 |
| Preload | 经过类型约束的窄 IPC 桥 | 业务状态和密钥明文 |

同一 tab 同时只允许一个活动 surface lease。docked/detached 交接必须撤销旧 lease，并把最后视图 checkpoint 交给新 surface。

## 依赖边界

- `@seekstar/core-schema`：跨进程共享的世界、视图、投影、来源和协议类型。
- `@seekstar/ai-service`：OpenAI-compatible 调用、紧凑结构输出校验、诊断与 telemetry。
- `@seekstar/constellation-engine`：世界与视图的纯投影、交互计算和渲染适配。
- `@seekstar/scout-service` / DataService：真实来源发现、观察和快照。
- `@seekstar/storage-service`：JSON 检查与原子文件写入能力。

任何依赖都不能越过 [`PRODUCT_CONTRACT.zh.md`](../../docs/product/PRODUCT_CONTRACT.zh.md) 定义的所有权和来源边界。

## 验证

从 `sourcecode/` 运行：

```bash
npm run typecheck
npm run build
npm run smoke:modules
npm run smoke:settings
npm run smoke:electron
```

自动烟测使用隔离的 Electron `userData` 和确定性 AI/Scout adapter，不访问真实 Provider。真实 Provider 验收需要用户明确触发。

## 权威文档

- 产品为何存在：[`PHILOSOPHY.zh.md`](../../PHILOSOPHY.zh.md)
- 不可破坏的产品承诺：[`PRODUCT_CONTRACT.zh.md`](../../docs/product/PRODUCT_CONTRACT.zh.md)
- 多尺度对象、关系与过渡：[`SEMANTIC_SCALE_CONTRACT.zh.md`](../../docs/product/SEMANTIC_SCALE_CONTRACT.zh.md)
- 当前运行时：[`EXPLORATION_RUNTIME.md`](../../docs/architecture/EXPLORATION_RUNTIME.md)
- 望远镜视觉与交互：[`TELESCOPE_DESIGN_SYSTEM.zh.md`](../../docs/design/TELESCOPE_DESIGN_SYSTEM.zh.md)
- 已实现能力与已知缺口：[`CURRENT_BASELINE.zh.md`](../../docs/status/CURRENT_BASELINE.zh.md)

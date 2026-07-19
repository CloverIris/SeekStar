# SeekStar 当前 Baseline

> 核对日期：2026-07-19  
> 数据版本：`exploration-world-v2` / `seekstar-exploration-worlds-v2.json`

本文只陈述当前代码已经做到什么、自动测试证明了什么，以及仍未证明什么。目标语义见[产品契约](../product/PRODUCT_CONTRACT.zh.md)和[连续多尺度语义契约](../product/SEMANTIC_SCALE_CONTRACT.zh.md)。

## 1. 当前闭环

```text
配置 Provider → 测试连接 → 新建 Seek
→ 中心 WorldSegment → 八邻段
→ L0 领域 / L1 主题 / L2 解释 / L3 来源连续浏览
→ Scout 验证来源 → 重启恢复世界与视图
```

Provider 设置、加密密钥、tab 目录和 Seed 沿用现有存储。v1 世界数据不迁移；运行时启动时直接删除旧世界文件并创建 v2 世界。

## 2. 承诺、实现、测试与限制

| 产品承诺 | 当前实现 | 自动测试 | 已知限制 |
| --- | --- | --- | --- |
| 同一连续 XY 世界上的 L0–L3 | `WorldDocument` 与 renderer 本地 `ExplorationViewState` 分离；切层不改 XY | module smoke 注入迟到 world event 后断言 layer/XY 不变 | 真实长距离跨多个 segment 的视觉验收仍需人工执行 |
| 层级不是 1:1:1 数组映射 | 中心预算上限 4/6/8，邻段总上限 12；允许任一层零新增；AI 返回显式关系 | AI contract smoke 覆盖可变数量与多父 `refines` | 语义质量仍取决于真实模型输出，不能由结构测试保证 |
| 对象不是等大词云 | AI 提供 `importance/coverage`；Runtime 持久化 `footprint`；Renderer 派生 `visual_mass` | module/render smoke 验证单调质量与尺寸边界 | 当前形态系统仍是第一版，需要真实内容截图继续校准 |
| 当前层完整、下一层若隐若现 | `TerrainProjection.primary` + `next_layer_preview`；预览最多 80 个且不可命中 | module smoke 验证 L1→L2 与 L2→已验证 L3 | 当前只预览下一层，不显示上一层常驻轮廓 |
| 多父对象位于父区域交界 | `refines(detail, broader)` 可多父；布局以父对象质心为锚并只安置新节点 | contract smoke 保留多父关系；纯布局函数可确定性复测 | 碰撞调整是有限确定性启发式，不是全局图优化器 |
| 来源候选不伪装成事实 | L3 AI band 永远为空；Scout 成功后才创建 `source_backed` node | module/electron smoke 验证候选不可见、成功后出现 | Scout 可访问性和网页内容质量仍受外部网络影响 |
| 切层连续且性能可控 | Pixi 按对象 ID 维护 display registry；无全 stage 重建、无同步截图；460ms alpha/scale 过渡；reduced-motion 为 120ms | render smoke 静态约束并以 200+80 fixture 验证投影预算 | Node smoke 不冒充 GPU 帧率；Windows 集显 p95/p99 必须以 Electron trace 人工签收 |
| 后台事件不能拉回旧层 | world revision 与 view revision 独立；world reducer 不写 view | module/electron smoke 注入迟到事件 | Shell 右栏仍需继续收紧为 tab surface 的只读镜像 |

## 3. 数据与职责边界

- AI：标题、`orientation_summary`、`semantic_role`、`importance`、`coverage`、显式语义关系和 URL 候选。
- Runtime：稳定 ID、坐标、碰撞、`footprint`、segment 归属、来源晋升和持久化。
- Renderer：`visual_mass`、当前/幽灵投影、渐进信息密度、Pixi display 生命周期和动画。
- Scout：把候选 URL 观察为真实来源，或留下可恢复失败状态。

任何模块都不得通过 `parent_id`、数组下标、文本长度或固定网格重新建立跨尺度真相。

## 4. 发布门禁

| 命令 | 证明范围 |
| --- | --- |
| `npm run typecheck` | 全 workspace TypeScript 边界 |
| `npm run build` | schema、AI、engine、Scout、storage 与 Electron 构建 |
| `npm run smoke:modules` | v2 AI 契约、多父关系、view 稳定、投影、来源边界、持久化、旧路径缺席 |
| `npm run smoke:render` | 200 primary + 80 preview 的投影预算、注册表结构、无截图/无全舞台重建；不宣称 GPU 帧率 |
| `npm run smoke:settings` | Provider CRUD、密钥三态、原子保存与重启恢复 |
| `npm run smoke:electron` | surface lease、世界生成、L0–L3、来源晋升与重启闭环 |

Windows 集显 1600×900 的性能签收标准仍是：预热后 p95 ≤16.7ms、p99 ≤33ms，transition 无超过 50ms 的主线程长帧。只有真实 WebGL trace 达标后才能写为“已验证”。

## 5. 当前优先缺口

1. 用汽车→飞机和 FlashAttention 固定 fixture 做真实画面验收，校准 footprint、文字密度和交界区。
2. 将 Shell 右栏改为活动 surface 的只读状态镜像，消除上下文分裂。
3. 把 segment、Scout、persistence、surface 错误拆成独立用户状态，避免一个失败被误报为整个工作区故障。
4. 在 Windows 集显上采集真实 Electron WebGL trace，再决定是否需要对象池上限、文本 atlas 或进一步裁剪。

当前代码可以继续作为 MVP baseline；它不再是 1:1:1 词云实现，但视觉质量和真实硬件性能仍必须按上述限制诚实验收。

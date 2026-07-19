# @seekstar/core-schema

`@seekstar/core-schema` 定义 SeekStar 跨进程、跨 package 共享的数据契约。它只描述合法形状、枚举和 provenance 规则，不生成内容、不调度任务、不访问网络，也不持久化文件。

产品语义由 [`PRODUCT_CONTRACT.zh.md`](../../docs/product/PRODUCT_CONTRACT.zh.md) 与 [`SEMANTIC_SCALE_CONTRACT.zh.md`](../../docs/product/SEMANTIC_SCALE_CONTRACT.zh.md) 约束；schema 不能反向改变这些语义。

## 探索运行时三分模型

### `WorldDocument`

一个 tab 对应一个持久世界。它包含：

- Seed、policy/world revision；
- `segments_by_key`；
- 来源引用；
- Scout observations。

`WorldDocument` 不包含相机、selection、focus 或 browser absorption。

### `ExplorationViewState`

活动 tab surface 的即时视图：

- `camera { x, y, zoom, layer }`；
- `selected_node_ids`；
- `focused_node_id`；
- `browser_absorption`。

它由 renderer 拥有，只把最后 checkpoint 交给主进程保存。世界事件不能携带或覆盖该状态。

### `TerrainProjection`

`WorldDocument + ExplorationViewState` 的纯派生结果，供 Pixi、右栏和地图搜索消费。它不持久化，也不作为 IPC 世界事实回传。

## 世界与任务类型

- `WorldSegment`：空间生产、缓存和失败恢复单元；不是语义父节点。
- `ExplorationJobState`：segment 或 Scout 的进程内任务状态。
- `ExplorationWorldEvent`：仅包含 `segment_upsert`、`source_upsert`、`job_changed` 和 `world_error`。
- `ExplorationOpenResult`：surface lease、世界快照、view checkpoint 与当前任务。
- `ExplorationCommand`：确保工作集、重试 segment、观察或替换来源候选。

World revision、segment revision 与 view revision 是独立序列。消费者必须分别比较，不能用世界增量覆盖活动视图。

## 四个产品尺度

`ExplorationLayerId` 只包含：

| ID | 产品含义 |
| --- | --- |
| `L0` | 领域视野 |
| `L1` | 主题视野 |
| `L2` | 解释视野 |
| `L3` | 来源视野 |

Layer 是语义观察尺度，不等同于原始 zoom 数值，也不构成封闭父子树。跨尺度对象关系必须允许一对多、多对一和多对多 refinement；不得用数组下标或固定数量定义语义归属。

## 来源与 provenance

核心来源类型包括 `SourceRef`、`SourceSnapshot`、`ScoutObservation`、`SourceObservationRequest/Result` 和 content-provider 配置。

必须遵守：

- AI 生成或推断对象保留明确 `source_state`；
- fog 不是事实；
- URL candidate 不是来源；
- 只有成功观察并带有效快照的对象才能成为 source-backed L3 内容；
- 观察失败必须保留可诊断状态，不能伪装为已验证内容。

## Terrain 类型

`TerrainNode`、`TerrainRelation`、`TerrainLayer` 与 `SourceRef` 是地图消费和来源关联的共享形状。`TerrainScene` 当前仍作为 Renderer/Pixi 的兼容消费结构，但不是探索世界的持久事实来源。

`validateTerrainScene.ts` 负责边界数据检查；验证器只能拒绝或规范化非法形状，不能补造产品事实。

## 本包不负责

- AI prompt、模型调用或输出内容质量；
- segment 队列、并发和预取策略；
- 世界坐标布局、投影和渲染；
- Scout 网络观察；
- Electron IPC 注册、lease 校验或窗口交接；
- JSON 文件、设置和密钥存储。

## 本地验证

从仓库 `sourcecode/` 运行：

```bash
npm --workspace @seekstar/core-schema run typecheck
npm --workspace @seekstar/core-schema run build
```

当前 schema 与运行时的真实配合方式见 [`EXPLORATION_RUNTIME.md`](../../docs/architecture/EXPLORATION_RUNTIME.md)，实现完成度与已知限制见 [`CURRENT_BASELINE.zh.md`](../../docs/status/CURRENT_BASELINE.zh.md)。

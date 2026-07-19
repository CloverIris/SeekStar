# SeekStar Exploration Runtime

> 状态：当前实现说明  
> 核对日期：2026-07-19  
> 适用范围：`apps/desktop`、`packages/core-schema`、`packages/constellation-engine`、`packages/storage-service`

产品目标以[产品契约](../product/PRODUCT_CONTRACT.zh.md)为准；当前完成度与缺口以[当前 Baseline](../status/CURRENT_BASELINE.zh.md)为准。本文描述代码现在如何运行，不反向定义产品语义。

本文只描述当前仓库中已经运行的探索内核，不承诺尚未实现的语义地图能力。产品语意的目标定义应由独立的产品与多尺度语义契约承担；不能根据本文把当前固定数量的节点草图误认为最终设计。

## 1. 运行时边界

探索运行时采用“持久世界、即时视图、纯投影”三分模型。

| 对象 | 唯一职责 | 所有者 | 是否持久化 |
| --- | --- | --- | --- |
| `WorldDocument` | 世界内容、segment、来源和 Scout 观察 | 主进程 | 是 |
| `ExplorationViewState` | 相机、层级、选择、焦点和浏览器吸收状态 | 活动 tab renderer | 仅保存最后 checkpoint |
| `TerrainProjection` | 当前视野可消费的节点、关系、来源和 fog | renderer 纯函数 | 否 |
| `ExplorationJobState` | segment/Scout 的当前执行状态 | 主进程 | 否 |
| surface lease | 约束某个 tab 当前唯一有效的 renderer | 主进程 | 否 |

关键不变量：

1. `WorldDocument` 不包含 viewport、selection 或 browser absorption。
2. 世界事件只改变世界索引或任务状态，不能改变 renderer 的 view。
3. layer 切换是本地 view 更新，不是逐层生成请求。
4. L0、L1、L2 草图和 L3 URL 候选由同一个 `WorldSegment` 生产；L3 画布节点只能由成功的 Scout 观察创建。
5. `TerrainProjection` 不通过 IPC 回传，也不写入 JSON。

当前 schema 的事实来源是 `packages/core-schema/src/index.ts`，renderer reducer 与 projector 位于 `packages/constellation-engine/src/explorationRuntime.ts`，主进程协调器位于 `apps/desktop/src/main/explorationRuntime.ts`。

## 2. 核心数据对象

### 2.1 WorldDocument

一个 tab 对应一个世界文档：

```text
WorldDocument
  world_id
  tab_id
  seed
  policy_revision
  world_revision
  segments_by_key
  sources
  scout_observations
  created_at / updated_at
```

世界文档只保存内容事实。`policy_revision` 当前由运行时版本、探索语言和探索密度共同组成；seed 或 policy revision 不匹配时，不恢复旧世界，而是创建新世界。

### 2.2 WorldSegment

segment 是当前唯一的生成、缓存和失败重试单元，键为 `chunk_x:chunk_y`。它包含：

- segment 自身的 `revision` 和 `phase`；
- L0、L1、L2 节点；
- segment 内关系；
- 最多两个 L3 来源候选；
- 生成尝试次数、错误和更新时间。

segment 是空间分片，不应被解释为最终产品中的语义父节点。当前实现仍以固定草图和数组位置建立层级关系，这只是已知的原型限制。

### 2.3 ExplorationViewState

```text
ExplorationViewState
  camera { x, y, zoom, layer: L0 | L1 | L2 | L3 }
  selected_node_ids
  focused_node_id?
  browser_absorption
```

活动 renderer 先本地更新 view，再异步 `reportView`。因此平移、选择和层级切换不等待主进程、AI 或持久化。

### 2.4 TerrainProjection

`projectTerrain(world, view)` 当前执行以下投影：

- 以相机所在 chunk 为中心读取 3×3 范围；
- 只消费 `ready` segment；
- 只输出当前 camera layer 的节点；
- 把非 ready 的可见 segment 投影成 fog；
- 输出投影相关关系，并附带当前世界中的来源和 Scout 观察。

renderer 随后把投影适配成临时 `TerrainScene`，供现有 Pixi 和 UI 消费。这个 `TerrainScene` 是兼容消费结构，不是探索运行时的持久事实来源。

## 3. IPC 协议

preload 当前只暴露五个探索入口：

```text
exploration.open(tabId)
exploration.subscribe(leaseId, callback)
exploration.reportView(leaseId, viewRevision, view)
exploration.command(leaseId, command)
exploration.close(leaseId)
```

`open` 返回 lease、世界快照、最后 view checkpoint 和当前 jobs。订阅事件只有：

- `segment_upsert`
- `source_upsert`
- `job_changed`
- `world_error`

命令只有：

- `ensure_working_set`
- `retry_segment`
- `observe_candidate`
- `replace_candidate`

后台事件没有 viewport 字段。这是“世界内容事件不能把用户拉回旧层级”的协议级保证。

## 4. Lease 与 surface 生命周期

Shell 与 tab surface 是不同 renderer 角色：

- `ShellApp` 管理应用壳、设置和 tab/surface 编排，本身不打开探索世界。
- `TabSurfaceApp(runtimeTabId)` 才挂载 `useExplorationRuntime(tabId)` 并调用 `exploration.open`。

每个 tab 同时只允许一个有效 lease：

```text
无活动 surface
  -> open：签发 lease
  -> subscribe：允许接收世界增量
  -> detach/attach 或第二次 open：先撤销旧 lease，再签发新 lease
  -> close / WebContents destroyed：撤销 lease
```

主进程校验 lease id、发送者 WebContents 和 tab 的当前活动 lease。旧 surface 的迟到 `reportView`、command 或 close 会以 stale lease 拒绝。世界事件只发送给当前已订阅、未销毁的 lease。

## 5. Revision 规则

运行时存在三种独立 revision：

### 5.1 world_revision

世界内容发生 segment/source 变更时单调递增。所有世界事件携带 `world_revision`；renderer 丢弃小于本地世界 revision 的旧事件。

### 5.2 segment.revision

每次 `segment_upsert` 单调递增。renderer 对相同 segment key 丢弃 revision 不高于当前值的增量，避免旧生成结果覆盖新结果。

### 5.3 view_revision

每次 renderer view action 单调递增。主进程只接受大于当前 lease revision 的报告；repository 也只保存更高 revision 的 checkpoint。

`world_revision` 与 `view_revision` 不比较，也不能相互覆盖。世界事件经过 reducer 时保留当前 view，是当前层级稳定性的核心约束。

## 6. 独立状态机

这些状态机必须分别理解和展示，不能再合并成一个通用 `error`。

### 6.1 Segment

```text
absent -> queued -> generating -> ready
                         |
                         +-> queued（第一次失败后的唯一自动重试）
                         +-> failed（第二次失败，终态）

failed --retry_segment--> queued（attempts 重置）
```

首次工作集只创建中心 segment。中心进入 `ready` 或 `failed` 终态后，才创建周围八个 segment。AI 并发上限为 2；设置值只能在 1–2 内生效。

`failed` segment 保留 fog 和错误，不在同一轮无限自动重试。显式 retry 会重新获得最多两次生成尝试。

### 6.2 Source / Scout

```text
source_candidate
  -> Scout queued -> running -> converted
                             -> failed

converted -> SourceRef + source_backed L3 node
failed --observe_candidate--> queued
failed --replace_candidate(new URL)--> queued
```

候选和失败观察可以存在于世界池与恢复 UI，但不能成为 L3 主画布网页节点。只有包含有效 `source_snapshot` 的成功观察才创建 `SourceRef` 和 `source_backed` L3 node。Scout 并发上限为 2。

### 6.3 Persistence

```text
内存快照变更
  -> 500ms idle 合并
  -> 单写入链
  -> 临时 JSON 文件
  -> replace/rename 正式文件
  -> saved
  -> failed：记录 persistence 日志并发布 persistence_failed world_error
```

世界文档和 view checkpoint 写入 `seekstar-exploration-worlds-v1.json`。checkpoint 按 `view_revision` 防止旧视图覆盖新视图。进程退出时调用 `flush()`。

当前 repository 对缺失、损坏或 schema 不匹配的 JSON 会返回空快照；它不迁移旧探索格式，也不把损坏文件恢复为旧运行时数据。

### 6.4 View

```text
open checkpoint
  -> renderer 本地 view action
  -> view_revision + 1
  -> 立即重投影/渲染
  -> 异步 reportView
  -> 主进程更新调度中心并保存 checkpoint
```

layer 变化只更新 `camera.layer`，保持 x/y。平移后切回上层时，renderer 会在新坐标附近选择最近的同层锚点。世界增量不参与 view reducer 分支。

### 6.5 Job

segment 与 Scout job 都使用：

```text
queued -> running -> completed | failed
```

jobs 是进程内调度状态，不随世界文档持久化。重启后 ready segment 不重新生成；未完成的 `generating` segment 恢复为 `queued`。

### 6.6 Surface

```text
shell host
  -> docked TabSurface / detached TabSurface
  -> exploration.open
  -> lease active + subscribed
  -> surface handoff
  -> old lease revoked / new lease active
```

surface 状态只解决 renderer 所有权与交接，不等同于世界、视图或持久化状态。

## 7. 当前可靠约束

当前自动门禁明确覆盖：

- 后台 job/segment 事件不改变当前 layer 和 x/y；
- 首次只生成中心段，中心终态后扩展为 3×3；
- L3 没有 AI 伪造网页节点，只有观察成功的 source-backed tile；
- docked/detached 交接保持 layer；
- 重启恢复 ready world 和 view checkpoint，不重复生成 ready segment；
- JSON 世界池和 view checkpoint 独立恢复；
- 已删除的探索协议与独立层级运行包不得重新进入源码。

这些约束证明运行时边界可用，不证明地图语义已经达到产品目标。

## 8. 已知架构缺口

1. **Shell 右栏状态分裂。** Shell 使用不打开世界的 `useShellViewModel()`，实际地图由 docked `TabSurfaceApp` 持有；Shell 右栏可能展示空的 `New Seek · L0`，与中央活动地图不一致。需要显式 surface-to-shell 状态通道，不能让 Shell 再开第二个探索 lease。
2. **错误域被压成单一 error。** renderer reducer 把任意 `world_error` 写入一个 `state.error`；view model 又据此把 `persistenceStatus` 标成 error。因此 segment 的 AI 截断可能被误报为“本地工作区无法保存”，并产生重复提示。
3. **重试产品边界尚不清晰。** segment 有一次自动重试和显式 retry；Scout 可重新观察或替换 URL，但 UI 尚未为 AI 生成、Scout 观察、持久化失败分别提供一致的恢复语言、去重提示和停止条件。
4. **语义连续性不是当前运行时保证。** 当前每段按固定数量生成 L0/L1/L2 短标题，并按数组下标建立父子关系。跨 segment 去重、可变密度、多对多细化、摘要和语义地标都未被 schema 或门禁保证。
5. **投影仍通过临时 TerrainScene 兼容层。** 它是现有 Pixi/UI 的消费适配器，不应重新成为持久化或后台生成的双轨状态源。

后续修改必须保持前三节的不变量；修复缺口时应缩小状态耦合，而不是把 viewport 重新放进世界事件或持久世界文档。

# SeekStar 当前 Baseline

> 核对日期：2026-07-19  
> 状态判断：工程主闭环可用；连续多尺度的产品语义仍处于待重构阶段。

目标语义见[产品契约](../product/PRODUCT_CONTRACT.zh.md)与[连续多尺度语义契约](../product/SEMANTIC_SCALE_CONTRACT.zh.md)；当前运行方式见[探索运行时](../architecture/EXPLORATION_RUNTIME.md)。

## 1. Baseline 的含义

当前 baseline 只承诺以下闭环：

```text
配置 API
  -> 测试连接
  -> 新建 Seek
  -> 生成中心世界段
  -> 补齐邻近 3×3 工作集
  -> 保持 XY 浏览 L0–L3
  -> Scout 验证来源
  -> 只在 L3 显示已验证来源
  -> 关闭并重启恢复世界与视图
```

它不代表 Shell 所有入口已经完成，也不代表当前圆形关键词地图就是最终产品语意。

## 2. 已可靠落地的能力

### 设置与 Provider

- 独立 `SettingsService` 管理设置，不把落盘成功与运行时热应用结果混为一谈。
- 支持多个 OpenAI-compatible Provider 的新增、编辑、启停、切换和删除约束。
- API Key 使用 Electron `safeStorage` 加密；renderer 只读取配置状态，不读取明文或密文。
- 支持密钥 `preserve / replace / clear`，旧明文 key 可一次性迁移并原子重写。
- “测试连接”使用当前草稿，与“保存设置”分离。
- 设置页已有未保存、保存中、已保存、失败和 warning 状态。

### 探索运行时

- 一个 tab 对应一个 `WorldDocument`。
- 主进程拥有 segment 生成、Scout、来源和世界持久化。
- 活动 tab renderer 拥有相机、layer、selection、focus 和 browser absorption。
- 世界与 view 使用独立 revision；后台内容事件不能覆盖活动 view。
- 首次只排中心 segment；中心 ready 或终态 failed 后补齐八邻段。
- AI 和 Scout 并发都被限制在最多 2。
- 同一 segment 一次生产 L0、L1、L2 草图与 L3 来源候选。
- L3 候选在 Scout 成功前不会成为主画布 tile。
- JSON 世界池采用 500ms 合并保存、单写入链和临时文件替换。

### Surface 与恢复

- Shell renderer 不打开探索世界；docked/detached tab surface 才打开运行时。
- 同一 tab 只有一个活动 lease，surface 交接撤销旧 lease。
- 重启可以恢复 ready segments、layer、相机、选择 checkpoint，并避免重新生成 ready segment。

## 3. 当前发布门禁

仓库提供以下门禁：

| 命令 | 当前覆盖 |
| --- | --- |
| `npm run typecheck` | 各 workspace 的 TypeScript 边界 |
| `npm run build` | schema、AI、engine、Scout、storage、desktop 构建 |
| `npm run smoke:modules` | segment 契约、view 稳定、中心优先、投影、持久化、旧链清除 |
| `npm run smoke:settings` | Provider CRUD、并发保存、密钥三态、损坏恢复、加密不可用、热应用 warning、重启恢复 |
| `npm run smoke:electron` | 单 surface、detach/attach、3×3 世界、L0–L3、source-backed L3、设置 UI、双重启恢复 |

Electron 闭环使用隔离 userData 和确定性假 AI/Scout，因此可以验证生命周期，不依赖外网，也不会消耗真实 Provider token。

## 4. 自动门禁没有证明什么

以下能力不能因为 smoke 通过就宣称完成：

- 真实 Provider 在所有网络、配额和模型响应条件下都可用；
- AI 输出具有好的覆盖面、去重和概念层次；
- L0、L1、L2 已经形成连续的多分辨率语义场；
- 关键词标题足以表达对象的方向、价值和进入后内容；
- 横跨多个 chunk 时语义关系没有接缝；
- Shell 左侧栏、收藏、文件夹、固定、搜索等所有产品入口已经完整；
- 当前视觉样式已经形成稳定设计系统。

真实 Provider 验收仍应由用户明确触发，以避免未经确认的付费请求。

## 5. 截图确认的最高优先级缺口

### 5.1 多尺度仍像 1:1:1 词表

截图中的 L0、L1、L2 数量接近、形态重复且标题高度重复，这与当前实现一致：每个 segment 为三层各截取最多四个短标题，Runtime 再按数组位置建立父子关系。

因此当前是“同一世界段内预建三层数据”，还不是“可变密度、多对多映射的连续语义地形”。这个问题属于语义契约和设计系统，不应靠调整圆形尺寸或增加随机布局掩盖。

### 5.2 Shell 右栏与活动地图分裂

中央地图由 docked `TabSurfaceApp` 的真实 runtime 驱动；Shell 自己使用不打开世界的 `useShellViewModel()`。因此截图中央已经位于“飞机 L1”或“flashattention L2”，右栏仍可能显示 `New Seek · L0` 和零对象。

这不是数据丢失，而是两个 renderer 之间没有可靠的活动地图只读状态通道。修复时应让 tab surface 向 Shell 发布精简控制快照，不能让 Shell 再创建一个世界运行时或第二份 view。

### 5.3 错误被误映射成持久化故障

当前 reducer 把 `segment_failed` 和 `persistence_failed` 都写入同一个 `state.error`，view model 又把任何 `state.error` 映射成 `persistenceStatus = error`。

所以截图中的模型 `max_tokens`/JSON 截断会同时表现为：

- 世界生成失败；
- Trail save issue；
- “本地工作区需要处理”；
- 中央与 Shell 两处重复红色提示。

实际证据只说明 segment 生成失败，不能据此判断本地 JSON 保存失败。

### 5.4 Retry 边界需要产品化

当前真实规则是：

- segment 第一次失败后自动重试一次；
- 第二次失败进入终态 `failed`；
- 用户显式 retry 后 attempts 清零，再获得两次尝试；
- Scout 失败可重新 observe，也可替换 URL 后再排队；
- persistence 失败不会回滚内存世界，但目前没有独立恢复面。

代码边界存在，但 UI 没有把 AI 生成、Scout 观察和存储失败分开说明，错误提示也没有统一去重。这是下一轮可靠性工作的首要边界，而不是继续增加一个通用 Retry 按钮。

## 6. 下一阶段的冻结线

在语义与设计文档确定前，以下内核应保持稳定：

- `WorldDocument / ExplorationViewState / TerrainProjection` 三分；
- lease 单 surface 所有权；
- world/view revision 分离；
- L3 只接受 Scout 成功来源；
- JSON 世界池和 checkpoint 恢复；
- 设置密钥不向 renderer 暴露。

可以优先修复但不应借机重写整个仓库的事项：

1. 建立 tab surface → Shell 的精简只读状态通道，统一右栏上下文。
2. 拆分 segment、Scout、persistence、surface、view 的错误与恢复状态。
3. 明确自动 retry、人工 retry、停止条件和提示去重。
4. 用“飞机”和“FlashAttention”两组静态 fixture 定义新的多尺度语义契约与设计语法。

## 7. 产品语意保护线

后续清理历史干扰时必须保留这些产品承诺：

- SeekStar 是认知地图，不是关键词列表或聊天答案页。
- 普通 L0–L3 浏览发生在同一连续 XY 世界，不创建盒子套盒子的平行场景。
- 上下尺度切换保持空间位置，并以当前位置附近的语义锚点恢复方向。
- AI 可以生产探索地形，但不能伪装成已验证来源。
- Scout 是现实验证边界；只有观察成功的内容成为 source-backed L3 tile。
- fog、失败候选和未知区域必须诚实存在，不能用假内容填满。

当前代码仓库可以作为可靠 baseline 保留。下一阶段应先重构权威产品文档、语义尺度契约和望远镜设计体系，再决定生产代码的局部改造范围。

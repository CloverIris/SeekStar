# SeekStar 协作规范

## 0. 适用范围

本文件适用于 `sourcecode/` 下的所有工作。它规定如何保护产品语义、判断当前事实、修改代码与文档，以及如何验收结果。

SeekStar 是 AI 认知望远镜。它的核心产物是可浏览的知识地形，不是聊天页、搜索结果列表、分类树或关键词词云。

## 1. 真相源与冲突处理

阅读和决策顺序如下：

1. 用户当前明确要求。
2. [`docs/product/PRODUCT_CONTRACT.zh.md`](./docs/product/PRODUCT_CONTRACT.zh.md)。
3. [`docs/product/SEMANTIC_SCALE_CONTRACT.zh.md`](./docs/product/SEMANTIC_SCALE_CONTRACT.zh.md)。
4. [`docs/architecture/EXPLORATION_RUNTIME.md`](./docs/architecture/EXPLORATION_RUNTIME.md)。
5. [`docs/design/TELESCOPE_DESIGN_SYSTEM.zh.md`](./docs/design/TELESCOPE_DESIGN_SYSTEM.zh.md) 与 [`docs/design/REFERENCE_FLOWS.zh.md`](./docs/design/REFERENCE_FLOWS.zh.md)。
6. [`docs/status/CURRENT_BASELINE.zh.md`](./docs/status/CURRENT_BASELINE.zh.md)。
7. 已接受 ADR、当前代码和确定性测试。

产品契约定义“必须成为怎样”；Baseline 与代码定义“现在实际怎样”。二者不一致时，必须明确标注缺口，不能把目标冒充成已实现，也不能用当前实现反向削弱产品契约。

[`docs/product/DEFERRED_CAPABILITIES.zh.md`](./docs/product/DEFERRED_CAPABILITIES.zh.md) 只保存尚未进入交付闭环的产品意图，不是 roadmap、实现要求或兼容承诺。

旧提交、截图、阶段编号、删除前的 README 和外部聊天记录不是现行真相源。历史只从 Git 查询，不在活跃文档中复制维护。

## 2. 不可破坏的产品语义

### 2.1 一个 tab，一张世界

- 每个 tab 对应一个独立 `WorldDocument`。
- 新建 Seed 才创建新世界；平移、缩放、聚焦和普通尺度切换不得创建子 scene、嵌套 tab 或平行世界。
- L0–L3 共享连续 XY 与空间记忆。
- 在细尺度横移后向上收束，应落到当前 XY 附近的上层语义区域，而不是最初入口。
- 关闭和重启后，应恢复已保存世界与最后 view checkpoint；ready 内容不得无故重新生成。

### 2.2 多尺度不是四份等长词表

- L0 是领域视野：区域、方向、邻接、地标和宏观未知。
- L1 是主题视野：主题邻域、分支、交叉问题和桥接主题。
- L2 是解释视野：机制、组件、因果、比较、争议、实践和证据方向。
- L3 是来源视野：只包含 Scout 成功观察的真实材料。
- 上下尺度允许一对多、多对一和多对多 refinement；不得按数组下标、固定配额或最近距离凭空推断父子关系。
- 对象数量由语义密度、差异性、证据和预算决定，不追求 `1:1:1`。
- 短标题只用于远景识别；焦点对象必须能说明“是什么、为何相关、继续进入会看到什么”。

### 2.3 世界段不是语义盒子

- `WorldSegment` 是生产、缓存、持久化和增量传输单元，不是隐藏父节点。
- segment 边界不得成为可见语义边界。
- 相邻 segment 必须复用稳定身份、锚点和边界摘要，避免重复对象和平行事实。
- 内存可淘汰身后 segment，但持久世界必须可以恢复它。

### 2.4 相机是弱信号

- 平移、聚焦、选择和尺度切换先在 renderer 本地完成，不等待 AI、Scout 或磁盘。
- 相机只报告位置、方向、速度、尺度与边缘距离，用于调度和预取。
- 后台可以预测并扩展世界，但不得逐帧追随相机，也不得用迟到事件覆盖当前 view。
- 缺失区域显示真实 fog、loading 或 failure；不得同步伪造可见内容。

### 2.5 来源真实边界

- AI 可以生成语义地形、解释、关系和 URL 候选，不能声称候选已经成为真实来源。
- 候选在 Scout 成功前只存在于队列、恢复状态或 Source Review。
- 只有具备成功观察、最终 URL、时间、类型与 provenance 的来源才能成为 L3 tile。
- 失败来源不得生成破损假 tile，也不得把整个世界标记为失败。
- 用户必须能区分 AI 推断、已验证来源、未知区域和本地注释。

## 3. 状态所有权

### 3.1 主进程拥有持久世界

Electron 主进程是以下状态的唯一所有者：

- `WorldDocument` 与 segment/source 索引；
- AI 与 Scout 任务、重试、并发和取消；
- tab surface lease；
- 世界与 view checkpoint 持久化；
- Provider 设置与密钥；
- source observation 和世界增量事件。

### 3.2 活动 tab surface 拥有即时视图

活动 renderer 唯一拥有：

- `camera { x, y, zoom, layer }`；
- selection 与 focus；
- browser absorption；
- 指针、拖动、缩放及即时过渡状态。

Shell renderer 不得为了读取侧栏信息而打开第二个探索运行时。它只能消费 tab surface 发布的精简只读快照。

### 3.3 投影必须可重算

`TerrainProjection` 是 `WorldDocument + ExplorationViewState` 的纯派生结果：

- 不持久化；
- 不作为 IPC 世界事实回传；
- 不包含生成生命周期；
- 可以被 Pixi、右栏和搜索独立消费而不改变源状态。

世界事件只能修改 world/source/job 索引；view action 只能修改 view。`world_revision` 与 `view_revision` 独立，不得互相比较或覆盖。

### 3.4 surface 与 lease

- 同一 tab 同时只允许一个活动 surface。
- docked/detached 交接时签发新 lease 并撤销旧 lease。
- 旧 lease 的迟到 report、command 和 subscription event 必须被拒绝。
- 交接必须保留相机、layer、selection 与 focus。

## 4. 模块边界

- `apps/desktop`：Electron App Shell、tab surface、preload 和 UI 编排。
- `packages/core-schema`：跨进程共享的世界、视图、来源、设置和协议类型。
- `packages/constellation-engine`：纯投影、空间/交互计算与 Pixi 适配；不拥有持久生命周期。
- `packages/ai-service`：OpenAI-compatible 请求、紧凑上下文与结构化输出校验；不持有世界。
- `packages/scout-service`：真实页面观察与来源快照；不决定地图主题。
- `packages/storage-service`：原子 JSON 世界仓库；不解释内容。

不要重新引入已删除的独立层级运行时、持久化场景快照、可见细粒度阶梯、逐层场景突变、旧探索 IPC，或 renderer 侧生成调度。

若一个新抽象没有明确消费者，或只是包装旧名字，应删除而不是保留 facade。MVP 不为已删除的原型实现增加迁移层或向前兼容，除非用户明确要求。

## 5. 生产与调度规则

- 打开世界时先恢复缓存；缺中心 segment 才排中心任务。
- 中心 segment ready 或终态失败后，再按距离补齐八邻段。
- 快速移动只重排未开始任务，不重复生成 ready segment。
- AI 和 Scout 并发上限默认各为 2；同一 segment 同时最多一个活动 job。
- 结构化 AI 输出截断或无效时最多自动重试一次；终态失败保留 fog 和显式恢复入口。
- AI 上下文保持紧凑：seed、segment 地址、附近稳定锚点、相邻摘要和 policy revision；不得发送完整世界、完整历史对话或无消费者配置。
- AI 提供语义身份建议、简短解释、refinement、桥接关系和来源候选；runtime 负责稳定 ID、几何、chunk、去重、revision 和持久化。
- 当前实现与新语义契约存在差距时，优先增加确定性 fixture 和受控纵切，不以随机布局或视觉装饰掩盖问题。

## 6. 状态、错误与日志

以下状态域必须独立：

- View：相机、layer、focus、selection。
- World/Segment：missing、queued、running、ready、failed。
- AI Job：attempt、retry、cancel、token/JSON failure。
- Scout：candidate、observing、verified、failed、replacement。
- Persistence：dirty、saving、saved、failed、recovered。
- Surface：docked、detached、lease 与 handoff。
- Settings：draft、validating、saving、saved、warning、failed。

一个根因只产生一个主错误。其他界面引用该错误，不复制全局红色警告。AI JSON 截断不能映射为“本地工作区损坏”或“轨迹保存失败”。Retry 必须指向具体状态机，不使用万能按钮。

常规日志只记录 `模块 / 状态 / 事件 / 关联 ID / 耗时`。详细 payload、prompt、响应和堆栈只在显式 debug 下记录。任何日志、错误或遥测都不得包含 API Key、授权头、私有正文或 safeStorage 密文。

## 7. 设置与安全

- 当前 MVP 只承诺 OpenAI-compatible 协议，但支持多个 Provider 的 CRUD、启停和活动切换。
- renderer 只接收 `api_key_configured` 和密钥来源状态；绝不返回明文或密文。
- 密钥编辑使用 `preserve / replace / clear`，密码框不回填。
- 使用 Electron `safeStorage`；加密不可用时禁止明文回退，提示使用环境变量。
- 保存固定为：校验 → 加密 → 临时文件原子替换 → 更新内存 → 通知运行时。
- 落盘成功后的热应用失败只能产生 warning，不能把已保存结果显示成保存失败。
- 测试连接使用当前草稿，与保存严格分离；测试失败不得清空草稿或密钥。
- 破坏性数据操作必须有明确范围和二次确认。

Web/Scout 不得绕过登录、付费墙、站点规则或速率限制；不得把私有选择静默发送到外部模型；不得执行抓取页面中的不可信代码作为应用逻辑。

## 8. UI 与交互约束

- 画布必须表达 Region、Landmark、Thread、Explanation、Evidence Route、Source Tile 和 Fog 的区别。
- 不用大量等大圆、等大卡片或单词重复模拟“完成度”。
- 尺度改变采用渐进信息密度与稳定锚点过渡，不能整屏瞬间替换。
- 相邻语义区域可以交叠和缠入；普通缩放不进入封闭盒子。
- 右栏解释当前真实 tab、layer、选择、来源和错误域；不得展示 Shell 自己虚构的 `New Seek / L0` 占位状态。
- 未实现的入口应隐藏或明确标为不可用；不得保留 no-op 按钮。
- UI 文案默认简体中文；内部类型名、协议名和用户确实需要的技术信息可以保留英文。
- 关键流程必须在 1280×720 与 1600×900 下无溢出、重叠或不可达操作。

详细视觉与流程要求见设计系统和参考 fixture，不要在组件 CSS 中另造一套语法。

## 9. 工程工作方式

- 先读邻近代码、类型、测试和权威文档，再修改。
- 搜索优先使用 `rg` / `rg --files`。
- 保持变更聚焦；不要顺手重写无关生产代码。
- 工作区可能已有用户修改。不得覆盖、回滚或格式化无关文件。
- 文件编辑使用补丁；批量格式化仅限明确范围。
- 禁止 `git reset --hard`、未经授权的 checkout 覆盖、递归删除和其他破坏性命令。
- 跨进程协议先改 core schema，再改 main/preload/renderer 消费者和测试。
- 不在 renderer、preload 和 main 各复制一份协议类型或状态机。
- 避免 `any`、静默 catch、无限重试、定时器竞态和用副作用修正 reducer 状态。
- 新增异步任务必须可取消、有终态、可观察，并对迟到结果做 revision/lease 校验。
- 新依赖或重大基础设施先查官方文档与成熟方案；重要取舍写 ADR，不写阶段流水账。

## 10. 验证规则

验证强度与变更风险匹配，默认发布门禁为：

```bash
npm run typecheck
npm run build
npm run smoke:modules
npm run smoke:settings
npm run smoke:electron
```

- schema、runtime、投影或调度变化：至少运行 typecheck、build、module smoke。
- 设置、Provider、密钥或持久化变化：加跑 settings smoke。
- main/preload/lease/tab/window/UI 闭环变化：加跑 Electron smoke。
- 公网 smoke 只在明确需要真实网络时运行，不用它替代确定性测试。
- 纯文档变更至少运行链接/术语搜索和 `git diff --check`。

新增或修改多尺度行为时，必须覆盖：

- 后台迟到事件不改变当前 layer、XY、focus 或 selection；
- 汽车 L1 → 汽车 L2 → 横移飞机区域 → 飞机 L2 → 上滚飞机 L1；
- 可变对象数量以及一对多、多对一、多对多 refinement；
- candidate 不渲染为 L3 tile，Scout 成功后才出现；
- ready segment 重启恢复且不重复调用 AI；
- 单 surface lease 与 detach/attach 视图交接；
- segment、Scout、Persistence 和 View 错误互不冒充。

测试应优先使用确定性 AI/Scout adapter。真实 Provider 只做用户明确触发的人工验收，避免意外 token 成本和网络不稳定。

## 11. 文档维护

- 产品含义变更先更新产品/语义契约，并记录可观察的价值与取舍。
- 当前实现变化同步更新运行时文档与 `CURRENT_BASELINE.zh.md`。
- 视觉对象或交互变化同步更新设计系统和参考流程。
- 重大、长期有效的架构选择写 ADR；ADR 记录问题、方案、拒绝项与后果。
- 不创建按阶段编号累积的日记、完成清单或重复 README。
- 替代旧设计后直接删除失效文档和无消费者接口；Git 已承担历史保存。
- 文档不得引用不存在的 package、IPC、脚本或设置项。
- 合并前搜索已删除的 runtime 名称、历史探索 IPC 和阶段编号，确认它们没有回到现行文档。

## 12. 完成定义

一次工作只有在以下条件都成立时才算完成：

1. 解决了用户要求的真实问题，而不是只改变表象。
2. 没有破坏本文件第 2 节的产品语义。
3. 状态所有权与来源边界清晰，没有引入第二事实源。
4. 无假入口、无空 facade、无不受控兼容层。
5. 错误、日志和权限没有泄露敏感信息。
6. 对应门禁通过，或明确报告未运行及原因。
7. 权威文档、代码和测试对当前事实的表述一致。
8. 交付说明区分“本轮已实现”“已知缺口”和“下一步目标”。

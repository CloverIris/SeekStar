# @seekstar/ai-service

`@seekstar/ai-service` 是 SeekStar 的 OpenAI-compatible 模型调用与结构校验边界。它把紧凑的世界段或地图助手请求转换为 provider 消息，并返回经过验证、带诊断与 telemetry 的结果。

它是无状态服务，不拥有世界、相机、任务队列、来源真实性、设置文件或 UI 生命周期。

## 当前产品路径

### `generateWorldSegment`

桌面探索运行时通过 `AiCartographerService.generateWorldSegment()` 请求一个世界 segment 的紧凑草图。

输入只包含：

- Seed；
- segment key 与坐标；
- 少量附近已知锚点；
- prompt revision。

输出包含：

- L0 领域候选；
- L1 主题候选；
- L2 解释方向候选；
- 空的 L3 node band；
- 最多两个尚未验证的 URL 候选；
- diagnostics、provider/model 信息和可用的 token/耗时/成本 telemetry。

当前 baseline 校验器将 L0、L1、L2 各限制为最多四个短标题。这是已知的原型限制，不是产品语义：目标模型要求可变密度、对象方向摘要以及一对多、多对一和多对多 refinement，详见 [`SEMANTIC_SCALE_CONTRACT.zh.md`](../../docs/product/SEMANTIC_SCALE_CONTRACT.zh.md)。

AI Service 不会把 L3 候选变成来源对象。只有 Scout/DataService 成功观察后，主进程运行时才能创建 source-backed L3 tile。

### `assist`

`AiCartographerService.assist()` 接收当前地图的精简上下文，返回自然语言解释和经过白名单校验的操作建议。建议本身没有执行权限：Shell/App Framework 决定是否展示、确认和执行，运行时仍是世界变更的唯一入口。

## Provider 边界

当前只支持 OpenAI-compatible HTTP 协议。配置可以包含：

- provider id、`base_url` 与模型名；
- 环境变量密钥引用或由主进程临时注入的密钥；
- timeout、retry、附加 headers；
- 可选的输入/输出 token 单价。

Provider 层负责：

- 构建严格 JSON 请求；
- 处理 timeout、cancellation、网络或 provider 错误；
- 解析并验证输出形状；
- 返回明确的 `missing_key`、`provider_error`、`invalid_output` 或 `cancelled` 状态；
- 附加调用 telemetry。

桌面设置服务负责用 Electron `safeStorage` 保存 API Key。AI Service 不写设置文件，不把密钥传给 renderer，也不持久化调用 ledger。

## 明确不属于本包

- segment 调度、并发、重试停止条件和工作集预测；
- node id、世界坐标、footprint、chunk 归属和空间布局；
- `WorldDocument`、view checkpoint 或任务状态持久化；
- Scout 观察、URL 真实性判断和来源快照；
- 相机、layer、selection、focus 或渲染状态；
- sidebar 权限、操作审计和产品错误提示。

这些所有权不能为调用方便而下沉到 provider 层。

## 结构验证原则

- 无效或被截断的 JSON 必须显式失败，不能用部分文本填充画布。
- URL 始终只是候选，不能由标题或格式推断为真实来源。
- 推断内容和 source-backed 内容必须保留不同 provenance。
- 请求应携带完成任务所需的最小上下文，不能反复发送完整世界、完整历史或设置档案。
- `AbortSignal` 取消与 timeout 必须保持不同状态，便于上层准确恢复。

## 本地验证

从仓库 `sourcecode/` 运行：

```bash
npm --workspace @seekstar/ai-service run typecheck
npm --workspace @seekstar/ai-service run build
```

确定性测试使用本地 adapter/fixture；真实 Provider 调用需要用户明确触发。

## 权威文档

- 产品与角色边界：[`PRODUCT_CONTRACT.zh.md`](../../docs/product/PRODUCT_CONTRACT.zh.md)
- L0 领域 / L1 主题 / L2 解释 / L3 来源：[`SEMANTIC_SCALE_CONTRACT.zh.md`](../../docs/product/SEMANTIC_SCALE_CONTRACT.zh.md)
- 当前运行时所有权：[`EXPLORATION_RUNTIME.md`](../../docs/architecture/EXPLORATION_RUNTIME.md)
- 当前实现与已知限制：[`CURRENT_BASELINE.zh.md`](../../docs/status/CURRENT_BASELINE.zh.md)

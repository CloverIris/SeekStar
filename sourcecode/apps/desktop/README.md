# SeekStar Desktop

SeekStar Desktop 是连续多尺度探索产品的 Electron 外壳。当前 MVP baseline 以世界文档为核心：主进程生产、验证并持久化世界段，tab surface 只持有视图状态并消费投影。

## 当前闭环

1. 在设置页配置 OpenAI-compatible Provider，并用系统 `safeStorage` 加密 API Key。
2. 新建 Seek 后先生成中心世界段，再补齐相邻的 3×3 工作集。
3. 摄像机在 L0–L3 间连续切换；后台世界事件不能覆盖 renderer 的 layer、XY、选择或焦点。
4. AI 只提出 URL 候选；Scout 成功观察后，来源才成为 L3 tile。
5. 世界文档与最后视图 checkpoint 独立持久化，重启不会重新生成 ready segment。

## 边界

- Electron main：世界生产、任务、lease、来源验证、设置和 JSON 持久化的唯一所有者。
- Tab surface renderer：摄像机、layer、selection、focus 的唯一活动所有者。
- Constellation Engine：`WorldDocument + ExplorationViewState -> TerrainProjection` 的纯投影与交互计算。
- AI Service：OpenAI-compatible 请求及紧凑世界段结构校验，不持有会话生命周期。
- Scout/DataService：真实页面观察与来源快照，不直接生成画布事实。

可见尺度固定为 `supra_macro`、`L0`、`L1`、`L2`、`L3`。旧 L4–L11、逐层 scene mutation、Cartographer chunk/runtime 和 level-runtime 已从执行代码中删除。

## 发布门禁

从 `sourcecode/` 运行：

```bash
npm run typecheck
npm run build
npm run smoke:modules
npm run smoke:settings
npm run smoke:electron
```

`smoke:settings` 与 `smoke:electron` 使用隔离的 Electron `userData` 和确定性 AI/Scout adapter，不访问真实 Provider。

# SeekStar

SeekStar 是一台面向未知知识空间的 AI 认知望远镜：它把主题、解释关系与真实来源组织成可连续移动、可改变观察尺度的语义世界，而不是把搜索结果、聊天回答或关键词词云铺在画布上。

## 当前 baseline

当前仓库已经打通可运行闭环：

```text
配置并测试 OpenAI-compatible Provider
  → 新建 Seek
  → 生成中心世界段并补齐 3×3 工作集
  → 保持 XY 浏览 L0–L3
  → Scout 验证来源
  → 只在 L3 展示已验证来源
  → 重启恢复世界与视图
```

世界内容、生成任务、来源验证与持久化由 Electron 主进程拥有；活动 tab surface 只拥有相机、尺度、焦点和选择。世界事件与视图状态使用独立 revision，后台内容更新不得覆盖用户当前视图。

这条工程闭环已经可用，但当前 L0–L2 仍容易表现为近似等量关键词列表。下一阶段采用“共享语义地图金字塔”：可变密度、多对多 refinement、连续 XY 与渐进信息密度。该目标已经形成权威产品与设计契约，尚不能被描述为已经全部实现。详见[当前 Baseline](./docs/status/CURRENT_BASELINE.zh.md)。

## 快速启动

环境要求：Node.js `>=20.19.0`、npm `>=10.0.0`。

```bash
npm install
npm run dev
```

设置页支持 OpenAI-compatible Provider。API Key 由 Electron `safeStorage` 加密，renderer 不会读取明文。修改 main process 或 preload 后，应完整重启 Electron。

## 发布门禁

```bash
npm run typecheck
npm run build
npm run smoke:modules
npm run smoke:settings
npm run smoke:electron
```

- `smoke:modules`：确定性的世界段、视图稳定、投影、来源与持久化模块闭环。
- `smoke:settings`：Provider CRUD、密钥三态、原子保存与重启恢复。
- `smoke:electron`：隔离 `userData` 和假 AI/Scout 下的桌面完整闭环。
- `smoke:modules:public`：可选的公网来源检查；需要网络，不属于默认离线门禁。

## 权威文档

按以下顺序理解产品与代码；不要从旧提交、阶段流水账或截图反推当前契约。

产品为什么存在，先读[项目哲学](./PHILOSOPHY.zh.md)。它提供方向，不用于证明功能已经实现。

1. [产品契约](./docs/product/PRODUCT_CONTRACT.zh.md)：不可破坏的产品承诺与角色边界。
2. [连续多尺度语义契约](./docs/product/SEMANTIC_SCALE_CONTRACT.zh.md)：L0–L3、可变密度、refinement 与空间连续性。
3. [探索运行时](./docs/architecture/EXPLORATION_RUNTIME.md)：当前状态所有权、lease、事件、调度与持久化。
4. [望远镜设计系统](./docs/design/TELESCOPE_DESIGN_SYSTEM.zh.md)：对象语法、交互、错误与响应式规则。
5. [参考流程](./docs/design/REFERENCE_FLOWS.zh.md)：汽车/飞机、FlashAttention 与来源验证的验收 fixture。
6. [当前 Baseline](./docs/status/CURRENT_BASELINE.zh.md)：已实现能力、已知缺口与冻结边界。
7. [ADR 001：共享语义地图金字塔](./docs/decisions/001-shared-semantic-atlas.md)：下一轮语义模型决策及拒绝方案。
8. [AGENTS.md](./AGENTS.md)：在本仓库协作、修改与验证的执行规范。

旧原型中仍有价值但尚未进入交付闭环的方向，统一保存在[暂缓能力清单](./docs/product/DEFERRED_CAPABILITIES.zh.md)；它不是 roadmap 或当前功能承诺。

## 仓库结构

```text
sourcecode/
├─ apps/
│  └─ desktop/                 Electron + React App Shell 与 tab surface
├─ packages/
│  ├─ core-schema/             共享世界、视图、来源、设置与协议类型
│  ├─ constellation-engine/    纯投影、交互计算与 Pixi 呈现边界
│  ├─ ai-service/              OpenAI-compatible 调用与结构化输出校验
│  ├─ scout-service/           Scout/DataService 真实来源观察
│  └─ storage-service/         原子 JSON 世界仓库
├─ scripts/                    模块与 Electron smoke
├─ docs/
│  ├─ product/                 产品与多尺度语义真相源
│  ├─ architecture/            当前运行时边界
│  ├─ design/                  望远镜设计系统与参考流程
│  ├─ status/                  经核对的当前状态
│  └─ decisions/               仍有效的架构决策
├─ testdata/                   确定性测试输入
├─ AGENTS.md
└─ package.json
```

本轮文档基线不再维护阶段日记、已退出执行代码的设计或旧兼容协议。需要历史时使用 Git 历史；不要把历史实现重新写回现行文档或兼容层。

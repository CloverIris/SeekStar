# 寻星 SeekStar

> 不是搜索引擎，不是浏览器，也不是聊天框。
> SeekStar 是一个用于探索「未知的未知」的 AI 认知星图。
> 浏览器和 Chat AI 解决的是“如何回答我已经能问出的问题”。SeekStar 要解决的是“如何让我发现自己还不知道该问的问题”

SeekStar 试图回答一个问题：

**当用户还不知道该问什么时，软件应该如何帮助他们开始探索？**

传统搜索框和 Chat AI 都隐含着同一个前提：用户必须先知道自己想问什么，并且能够把问题准确表达出来。
但许多真正有价值的发现，发生在问题被命名之前。

SeekStar 的目标，是把检索行为重构为空间行为：
从「输入关键词，得到结果列表」变成「进入一片可以缩放、漫游、圈选、解释和继续扩展的认知星图」。

---

## 核心理念

### 1. 在提问之前，先抵达未知

SeekStar 不要求用户一开始就提出精确问题。

用户可以从一个词、一段文本、一个网页、一个链接、一个圈选区域、一个每日主题，甚至一个陌生字符开始。
系统会把它转化为一个可探索的语义场。

---

### 2. 搜索不是结果列表，而是方向感

传统搜索追求「命中」。
SeekStar 追求「定位」。

输入一个方向后，用户不会被直接扔进一组线性结果，而是被带到一个主题星域中：

* 上层是什么领域？
* 同层有哪些相邻主题？
* 下层有哪些具体内容？
* 边缘还有哪些尚未展开的未知？
* 哪些内容是来源支持的？
* 哪些只是 AI 推测或待验证的雾区？

---

### 3. 地图优先于聊天框

SeekStar 的中心不是聊天输入框，而是一个 2.5D 认知画布。

* XY 平面表示当前层级中的语义分布。
* Z 轴表示无限递归的认知深度。
* 缩放不是视觉特效，而是语义层级切换。
* 圈选、画笔、拖拽和镜头移动都是表达意图的方式。

---

### 4. 任意信息粒度都可以成为新的入口

SeekStar 的理想缩放链路是：

```text
领域
→ 主题
→ 来源
→ 网页 / 文档
→ 章节
→ 段落
→ 句子
→ 短语
→ 词语
→ 字符
→ Unicode / 字典
→ 新的探索 seed
```

这意味着，一个网页中的一个词，也可以重新成为一片星图的中心。

---

### 5. AI 是制图师，不是神谕

SeekStar 中的 AI Agent 不应该像传统聊天机器人那样只给出最终答案。

它更像一个认知制图师：

* 识别父级领域、子级主题和相邻概念；
* 组织来源、关系和语义层级；
* 标记不确定区域；
* 解释用户圈选的局部星域；
* 生成学习路径、摘要、翻译、对比和下一步问题；
* 把探索结果导出为结构化 Markdown。

AI 生成的内容必须和真实来源区分开。
未知区域应该被标记为「雾区」，而不是伪装成事实。

大模型的价值在于**把人类尚未意识到的未知，组织成可探索的分层结构**；但探索的主路径仍是看、移、缩放、圈选和确认来源，而不是等待一段聊天式答案。

---

### 6. SeekStar，不是 SearchStar

名字本身就是在陈述产品命题。

* **Search（搜索）** 假设你已经知道要找什么，至少知道该用什么词去命中它。
* **Seek（寻）** 假设你可能只有一个方向、一个碎片、一种「附近似乎有关」的感觉，或一片值得靠近的区域。

SeekStar 致敬人类第一次用望远镜观察星空的那一刻：重点不是立刻得到排序好的答案，而是获得一种新的观看方式——移动、放大、对照、发现意外，并带着更好的问题再次回来。

---

### 7. 存在先于认识

并非星图上的一切都该由模型「想出来」。

网页、论文 PDF、百科条目、文档和公开资料，在世界中已经存在；它们的 relevance 往往要在探索开始之后才显现。Playwright 扮演的 **Scout（探测器）** 负责观察这些外部对象，带回标题、URL、摘要、正文片段、链接和检索时间。

Scout 观察到的内容先是**候选星**，不是自动成立的事实。AI 负责组织「你还不知道该如何提问的未知」；Scout 负责把「世界上已经存在的内容」充实进地图。只有推断的星空容易变成幻觉；只有网页 tile 的堆叠又缺少方向感。SeekStar 需要制图与侦察同时存在。

---

### 8. 望远镜才是产品本体

望远镜不只是视觉隐喻，更是交互宪法：

| 望远镜动作 | SeekStar 语义 |
|-----------|---------------|
| 放大 | 进入更细语义层：领域 → 主题 → 来源 → 文档 → 段落 → 词语 |
| 拉远 | 回到宏观，看清自己站在哪片星域 |
| 水平移动 | 扫视周边，在边缘发现新的候选星 |
| 盯住一颗星 | 选中、圈选、检查、提升为来源节点 |
| 换一片天区 | 从新 seed、链接或选中词开启新的独立 tab |

三层读法对应同一次「举镜」在不同焦距下的观看方式：

* **领域层（Star Gallery）**：在宏观星泡中定位自己，看见领域、主题区、雾区和待侦察区域。
* **内容层（Tile 场）**：网页与文档以可分 tile 的方式铺在平面上，展示真实材料，而不是聊天流。
* **细节层（文本粒度）**：段落、句子、词语、字符、字典项都可点击，任意粒度都能成为新的探索入口。

输入框、侧栏、Inspector 和导出面板服务于望远镜；它们不能取代画布上的星图。

---

## 当前项目状态

SeekStar 目前处于 MVP 核心开发阶段。

当前重点已经从旧原型清理进入 P6 MVP reset：先做出真正能用的望远镜/星图主链路，再补强数据、AI 与存储实现。旧逻辑、旧缓存、旧 UI、旧 fallback、假按钮和 mock 阶段残留，凡是不服务新主线，都应删除而不是隐藏或兼容。

* Electron 桌面宿主；
* React shell 与 PixiJS 星图呈现；
* Vite 开发与构建工具；
* TypeScript 类型系统；
* 2.5D 认知画布与模块化 Level Runtime；
* Chrome-like tab session runtime；
* TerrainScene 结构化地形数据契约；
* Constellation Engine 对象池、事件与 Pixi projection；
* Playwright Scout/DataService；
* AI Service、Level Runtime 与 Storage/Cache Service 边界；
* DeepSeek OpenAI-compatible real provider 与 API Adapter 设置/测试页；
* 暗色蓝调 UI 风格；
* 基础文档与架构约束。

当前版本不再维护旧 preview / fallback 路径：

* 默认入口是 `New Seek`，打开后走 AI `default_tonight_sky` opening sky，首屏只生成 Supra Macro + L0 Star Gallery，不再要求用户先输入关键词；
* 用户可见主线是 Supra Macro、L0 Star Gallery、L1 Topic Field、L2 Source Orientation、L3 Tile Field、Deep Lens 与 Recursive Seed；
* L0-L11 12Level 只保留为内部地址词汇和迁移参考，不再作为可见 UI 楼梯；
* AI Cartographer 是 L0-L2、L3 候选队列和递归 seed 的主要地形生产者，`cartographer_primary` 是正常地图材料，但不能把 L3 未验证网页节点伪装成真实 tile；
* Playwright Scout/DataService 是现实探针和 AI 工具边界，只负责 observation / source snapshot / source candidate validation；
* L3 source candidate 只进入验证队列、状态提示和 Source review；DataService 成功后才进入 source-backed Tile Field；
* 失败 URL 候选不进入主画布，进入恢复/诊断队列并可请求 AI 替代；
* AI 输出必须经 AI Service / Level Runtime 返回结构化结果并通过 schema 校验，不再由 UI 伪造。

下一冲刺仍需完成的产品闭环：

* L3 只显示 source-backed tile surface，彻底移除 AI `webpage` 概念卡片伪 tile；
* Deep Lens paragraph / phrase / word 到 recursive seed 的稳定闭环；
* 连续望远镜模型的写回：L1/L2/L3 横向探索后拉远，应从当前位置附近的上层语义浮出；
* AI 调用降耗：L0/L1 限预取，L2/L3 按需生成，每次请求只发送当前层 module 和附近锚点；
* 真实 DeepSeek 手测闭环：opening sky → 横向扩展 → L3 验证 → tile 吸附 → Deep Lens → grain 新 seed。

---

## 技术方向

SeekStar 的目标技术结构：

```text
Electron
桌面宿主 / 窗口 / 本地状态 / 安全边界

React
渲染层 UI / 面板 / tab / 状态交互

Vite
开发服务器 / 构建工具

TypeScript
共享类型 / 数据契约 / 结构化 Agent 输出

AI Agent
认知制图 / 结构推理 / 解释与导出

Playwright
信息侦察 / 页面获取 / 外部搜索与内容观察

TerrainScene
渲染器消费的结构化认知地形数据
```

核心角色隐喻：

| 模块          | 隐喻               | 职责               |
| ----------- | ---------------- | ---------------- |
| Electron    | 天文台 Observatory  | 承载应用、窗口、权限、本地状态  |
| UI Renderer | 望远镜 Telescope    | 展示画布、面板、缩放、圈选    |
| AI Agent    | 制图师 Cartographer | 生成认知结构、解释区域、规划探索 |
| Playwright  | 探测器 Scout        | 搜索、访问、观察外部信息     |
| Local Store | 档案员 Archivist    | 保存来源、路径、注释、导出    |

---

## 项目结构

当前项目采用 monorepo 结构：

```text
SeekStar/
├─ apps/
│  └─ desktop/              # Electron + React 桌面应用
│
├─ packages/
│  └─ core-schema/          # SeekStar 共享类型与 TerrainScene 契约
│
├─ docs/
│  └─ decisions/            # 架构决策记录 ADR
│
├─ README.md
├─ AGENTS.md                # Agent 行为与系统角色约束
├─ PRD.md                   # 产品需求文档
├─ PHILOSOPHY.md            # 项目哲学（英文规范版）
├─ PHILOSOPHY.zh.md         # 项目哲学（中文版）
├─ ARCHITECTURE_AND_UI_SPEC.md
└─ UI_STYLE_GUIDE.md        # UI 风格约束，如果已创建
```

---

## 本地运行

安装依赖：

```bash
npm install
```

类型检查：

```bash
npm run typecheck
```

构建：

```bash
npm run build
```

开发运行：

```bash
npm run dev
```

在部分受限沙箱或虚拟化环境中，Electron 可能出现 native crash。
只要 `typecheck` 和 `build` 通过，优先在本机环境验证桌面窗口，不要为了沙箱运行而削弱 Electron 的安全边界。

---

## 设计原则

### 地图优先

不要把 SeekStar 做成搜索结果列表。
搜索结果可以存在，但不能成为主界面中心。

### 画布优先

主界面应该始终围绕认知画布展开。
顶部输入框只是入口之一，不是产品本体。

### 来源优先

真实内容节点必须保留来源、时间、类型和置信度。
AI 推断内容必须被标记为生成或推测。

### 语义缩放优先

缩放必须对应认知层级变化，而不是单纯放大 UI。

### 圈选优先

用户可以通过圈选和画笔表达尚未语言化的问题。
一片区域本身就是一个 prompt。

### 克制视觉

SeekStar 的视觉方向是：

> 暗色天文台、蓝色认知地图、技术冷静感、低噪声、高可读性。

避免：

* 霓虹赛博风；
* 游戏化星空；
* 普通后台 dashboard；
* 浏览器克隆；
* ChatGPT 式聊天框中心布局；
* 过度装饰性的渐变和动效。

---

## 当前核心开发目标

当前阶段不再以旧演示壳层为目标，而是固定 SeekStar 的产品骨架：

* App Electron Framework 只负责窗口、tab、设置、IPC、安全边界与 shell 承载；
* Constellation Engine 负责 12Level 语义脊柱、tab scene、对象池、事件 reducer、source terrain、Scout planning 与 Pixi projection；
* Scout/DataService 通过 Playwright 返回 observation / source snapshot；
* AI Service 负责 key、上下文、结构化输出、取消/重试、成本记录；
* Storage/Cache Service 先用 JSON adapter，未来接 SQLite/FTS/vector index；
* 默认入口是 `New Seek`，领域层即 Star Gallery / seed pool；
* 任意内容粒度都可以递归成为新的探索 seed。

---

## 后续路线

### P6 MVP Reset：望远镜主链路

目标：先开发出真正能用的 SeekStar，而不是继续维护旧原型。

* 破坏性清理旧 preview / fallback / mock / 假按钮 / debug 面板 / 旧缓存；
* AI Cartographer 成为 Supra Macro、L0、L1、L2 与递归 seed 的主地形生产者，并只为 L3 提出待验证 source candidates；
* Level Runtime 负责每个焦段的 schema、prompt、布局、chunk、CLI 测试；
* DataService/Playwright 成为 AI 和用户的现实探针，只验证和加载来源；
* L3 URL/PDF/图片/网页候选验证成功才进入 source-backed Tile Field；
* Deep Lens 替代可见 L4-L10 楼梯，统一承载章节、段落、句子、词、字符、Unicode；
* 右侧栏改成 AI 地图控制台，旧 inspector/debug sprawl 默认删除；
* 主画布数据结构和显示层可以重写成新包，旧包袱不迁移。

### 后续扩展：真实材料与持久化

目标：在新主链路稳定后补强现实接触和缓存层。

* source extractor provider；
* Redis-compatible hot chunk cache 或 SQLite/FTS/vector 混合存储；
* OS-backed provider secret storage；
* 更强 PDF / image / local file snapshot；
* 未来 Ground Mode：从文件图标、文件系统编码、十六进制块继续向下观察。

---

## 关键文档

建议在开发前先阅读：

* `PHILOSOPHY.md` / `PHILOSOPHY.zh.md`
  项目哲学：unknown unknowns、Seek vs Search、存在先于认识、望远镜宪法、制图师边界。

* `PRD.md`
  产品需求文档，定义用户流、功能边界和 MVP 范围。

* `AGENTS.md`
  Agent 行为准则，定义 AI、Playwright、Electron、UI 的职责边界。

* `ARCHITECTURE_AND_UI_SPEC.md`
  架构与 UI 设计规范，定义模块关系和交互结构。

* `UI_STYLE_GUIDE.md`
  UI 视觉风格规范，定义暗色蓝调、面板、节点和状态表现。

* `docs/decisions/`
  架构决策记录，用于记录为什么选择某种库、结构或实现方式。

---

## 一句话定义

**SeekStar 是一个 AI 驱动的认知制图工具，用空间化、可缩放、可圈选、可解释的方式，帮助用户发现自己尚未意识到的问题。**

---

## 项目愿景

互联网不应该只是一串排序结果。
知识也不应该只能通过关键词召唤。

SeekStar 想把信息重新变成一片可以仰望、靠近、偏航和记录路径的星空。

用户不必一开始就知道问题。
他们只需要给出一个方向，然后开始靠近。
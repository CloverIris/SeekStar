# SeekStar 产品稿

## 0. 一句话

SeekStar 是一台面向未知的认知望远镜。

它把搜索、阅读、网页、论文、图片、文档和 AI 的组织能力，放进一张可以缩放、移动、观察、验证、深入和重新出发的星图里。用户不需要一开始就知道自己要问什么；用户只需要给出一个方向、一个词、一段内容、一个链接，SeekStar 负责把“还不知道该如何提问的未知”变成可以探索的空间。

它叫 SeekStar，不叫 SearchStar。

Search 假设你已经知道要找什么。Seek 承认你可能只是隐约感觉某个方向附近有东西。SeekStar 的价值就在这个问题被清楚命名之前。

---

## 1. 第一性理解

大多数搜索框和 Chat AI 都把一个很难的任务提前交给用户：你必须先知道自己想问什么，并且能把它精确表达出来。

但真正有价值的发现，往往发生在问题被命名之前。

人类面对未知时，并不是先写出一个完美 query，然后等待答案。人类更常见的状态是：

- 我知道这个方向好像重要，但不知道从哪里开始。
- 我看到一个词，但不知道它连接着哪些领域。
- 我读到一篇网页，但不知道它在更大知识图谱中的位置。
- 我知道自己缺知识，但不知道缺的是哪一块。
- 我不知道自己不知道什么。

SeekStar 的产品使命是解决 unknown unknowns。

它不把 AI 当作最终答案机，而把 AI 当作认知制图师。AI 的任务不是替用户结束探索，而是把未知组织成可以被人类继续观察、比较、移动和深入的地形。

SeekStar 的根本哲学是：

存在先于认识。  
世界上的网页、论文、文档、图片、百科、代码仓库、人物、概念和争议本来就在那里；人类只是还没有看到它们之间的结构。SeekStar 用 AI 组织未知，用 Playwright/DataService 接触真实内容，用望远镜式界面让人类重新获得探索感。

---

## 2. 产品不是搜索框，也不是聊天框

搜索框的问题是，它要求用户先把未知压缩成几个关键词。

聊天框的问题是，它容易把未知压缩成一次问答。

SeekStar 的中心不是输入框，也不是回答气泡，而是一张认知星图。输入框只是进入星图的入口；AI 只是制图和解释工具；网页浏览只是接触真实内容的方式。真正的产品主体是用户在星图中的移动、缩放、选择和发现。

SeekStar 要让用户从下面这种状态：

```text
我面对一个空白搜索框，不知道该搜什么。
```

变成：

```text
我进入一片可探索的星域。
我能看到宏观方向、周边主题、可能来源、真实内容和细节词语。
我可以放大、拉远、横向移动、点击、圈选、验证、深入，再从任意一点重新开始。
```

---

## 3. 望远镜是产品本体

SeekStar 的核心交互不是“搜索”，而是“像使用望远镜一样观察知识空间”。

### 3.1 放大

放大不是简单把 UI 变大，而是进入更细的认知焦距。

用户从领域看到主题，从主题看到来源方向，从来源方向看到网页/PDF/图片/文档 tile，从真实内容进入段落、句子、词语和更细粒度的 Deep Lens。

### 3.2 拉远

拉远不是返回列表，而是重新获得宏观结构。

用户可以看见自己所在的领域、附近还有哪些方向、当前内容来自哪里、哪些地方已经有来源支持、哪些地方还只是 AI 推测的地图材料。

### 3.3 水平移动

水平移动代表探索周边存在。

当用户在同一层横向移动到星图边缘，SeekStar 会继续生成或加载附近区域。这个行为像移动望远镜扫过星空：不是换一个搜索结果页，而是在同一片知识空间里发现周边还有什么。

### 3.4 点击与聚焦

点击不是最终动作，而是盯住一颗星。

用户点击一个领域、主题、来源、tile、段落、词语或链接，系统会把它变成当前焦点。焦点可以继续放大、进入 Deep Lens、作为新 seed，或要求 AI 解释其周边意义。

### 3.5 圈选

圈选是一种还没变成语言的问题。

当用户圈住一片区域，SeekStar 应该理解为：“帮我解释这里为什么聚在一起、它们之间有什么关系、我还能往哪里走。”

---

## 4. 核心对象

SeekStar 的世界由几类对象组成。

### 4.1 Seed

Seed 是探索的起点。

Seed 可以是：

- 一个词；
- 一个问题；
- 一个网页 URL；
- 一个 PDF；
- 一张图片；
- 一个文档；
- 一个段落；
- 一个词语；
- 一个字符；
- 一个超链接；
- 一个圈选区域；
- 一个 AI 提出的可能方向。

Seed 不一定是“确定的问题”。它可以只是一个方向。

### 4.1.1 默认星空 Seed 群

SeekStar 打开时，不应该先把用户扔到一个空白搜索框前。

默认 New Seek tab 的初始体验应该像夜晚揭开天文望远镜的盖子：用户第一眼看到的不是“请输入关键词”，而是一整片已经亮起来的星空。

当用户打开 App、刷新默认 New Seek tab、或创建一个没有明确含义的默认空白探索入口时，SeekStar 可以主动调用 AI API，询问：

- 最近有哪些新鲜事值得探索；
- 最近哪些领域出现了新动态；
- 哪些跨领域话题正在变得重要；
- 哪些冷门但有启发性的方向可能值得靠近；
- 哪些关键词可以作为今天的随机观测点。

AI 返回的不是答案，而是一组启发式 seed。它们会进入最开始的领域层，形成一片默认 seed 群。用户可以不带任何目的地移动望远镜，从这些亮点里挑一个靠近，也可以横向移动去看哪里有更多星点。

这套机制只服务默认 New Seek tab。

如果 tab 已经来自用户输入的关键词、圈选的文本、点击的超链接、打开的网页、Deep Lens 中的词语，或者任何已经带有明确 parent backlink / seed 语义的入口，SeekStar 就不应该再自动用“今日随机星空”覆盖它。那时系统应该尊重用户已经给出的方向。

### 4.2 Star

Star 是地图上的认知对象。

它可以代表领域、主题、概念、来源方向、网页、文档、段落、词语、图片区域或递归探索入口。

Star 的重点不是单独存在，而是它在星图中的位置、距离、关系、来源状态和可继续探索性。

### 4.3 Tile

Tile 是真实内容的可视化容器。

在 L3 Tile Field 中，网页、PDF、图片、文档候选和真实 source-backed 内容以 tile 方式铺在平面上。Tile 不是搜索结果卡片，而是可缩放、可吸附、可进入浏览器模式、可进入 Deep Lens 的真实内容表面。

### 4.4 Deep Lens Grain

Deep Lens Grain 是内容细节层的可点击粒度。

它可以是 section、paragraph、sentence、phrase、word、character 等内部地址。用户不需要看到一条复杂的 L4-L10 楼梯；用户只需要感觉自己进入了一个近距离阅读镜头。

### 4.5 Trail

Trail 是用户探索路径。

SeekStar 应该记住用户从哪里来、看过什么、圈选过什么、从哪个词开了新 seed、哪个链接打开了孤儿页、哪些来源被验证过。Trail 不是浏览历史，而是认知路径。

---

## 5. 用户可见层级

SeekStar 的用户可见结构应当简洁、连续，并且符合望远镜直觉。

### 5.1 Supra Macro

Supra Macro 是比当前 seed 更大的上层语境。

当用户从一个非常局部的东西进入 SeekStar，比如一个网页、一个词或一个链接，系统需要能向上补全：它属于什么更大的知识系统？它可能在哪些领域里有意义？它的父级语境是什么？

Supra Macro 不是单独的普通层级按钮，而是“拉远时看到的更大宇宙”。

### 5.2 L0 Star Gallery

L0 是领域层，也是 seed pool。

这里展示的是可探索的领域、宏观方向、知识大类和预制 seed。领域可以来自默认设置，也可以由 AI 根据 seed 启发生成。

在默认 New Seek tab 中，L0 还承担“今晚星空”的职责。系统可以根据最近的新鲜事、领域动态和随机启发，主动生成一组不要求用户命名的 seed 群。它们不是新闻流，也不是推荐 feed，而是让用户在没有明确问题时也能开始探索的观测点。

L0 应该像星空里的星群，也像一个 App Gallery：用户可以一眼看到多个大方向，而不是面对一条线性列表。

### 5.3 L1 Topic Field

L1 是主题场。

当用户聚焦某个领域后，L1 展开相关主题、子主题、相邻概念、问题簇和未知边缘。它让用户理解：“这个领域里面有什么？附近还有什么？哪些方向我之前没意识到？”

### 5.4 L2 Source Orientation

L2 是来源方向层。

这里不是马上塞给用户网页结果，而是展示“可能的来源家族”：

- 官方文档；
- 学术论文；
- 百科条目；
- 教程；
- 社区讨论；
- 开源仓库；
- 数据集；
- 经典书籍；
- 图片或媒体资料；
- 相关人物和组织。

L2 的作用是让用户知道内容从哪里来，以及哪些来源类型值得进入。

### 5.5 L3 Tile Field

L3 是内容层。

它展示 URL、网页、PDF、图片、文档候选与真实 tile。AI 可以提出候选，DataService/Playwright 负责验证和观察。验证成功后，内容成为 source-backed tile。

L3 的视觉参考：

- Windows 10 Phone 的 live tile：切分布局、大小变化、清晰分组、可扫视；
- Windows 11 任务视图：同屏多个真实内容表面，像窗口缩略图一样可识别；
- 图片/文件管理器的 gallery：密集但有秩序。

默认同屏目标是 25 个 tile，用户可以在设置中调整。视口外 tile 不加载真实网页 renderer，只保留对象数据、状态和必要缩略信息。近视口 tile 可以预热缩略图；焦点 tile 获得最高加载优先级。

当用户继续放大一个 L3 tile，tile 占据超过视口 80% 面积后，会自动进入吸附动画：tile 对齐中心，尺寸匹配视口，最终像浏览器一样铺满。

在未达到自动吸附阈值前，用户点击焦点 tile，会看到两个选择：

- 进入DeepLens；
- 进入浏览器模式。

### 5.6 浏览器模式

浏览器模式是 L3 tile 吸附后的状态。

此时 tile 内嵌的网页或文档内容成为主要交互对象。鼠标滚轮和页面点击由网页接管，SeekStar 的缩放暂时暂停，因为用户已经进入了真实页面。

顶部保留一个半隐藏提示条，提供两个按钮：

- 退出浏览器模式；
- 进入当前页面的DeepLens。

退出浏览器模式后，用户回到 L3 Tile Field，继续用 SeekStar 的望远镜探索。

如果点击页面中的超链接，SeekStar 在新的 tab 中打开该链接，并让新页面处于铺满层级。这个新页面一开始可能是孤儿页：有真实内容，但缺少上层语义宇宙。用户退出浏览器模式或向上探索时，AI Cartographer 为它补出上层领域、主题、来源方向和同层邻域。

### 5.7 Deep Lens

Deep Lens 是细节阅读层。

它不应该表现为复杂的 L4、L5、L6、L7、L8 楼梯，而应该表现为一次连续的近距离观察。

用户从当前页面进入 Deep Lens 后，SeekStar 把页面解析为：

- section；
- paragraph；
- sentence；
- phrase；
- word；
- character；
- 未来可扩展到 Unicode、dictionary、byte/hex。

第一版 Deep Lens 应先完成足够有用的闭环：

```text
页面
→ 段落
→ 词语 / 短语
→ 任意 grain 可点击成为新 seed
```

每个 grain 都要保留来源地址：URL、source id、原 tile、DOM locator、文本 offset 或 source range。这样用户从一个词重新出发时，仍然知道它来自哪里。

### 5.8 Recursive Seed

Recursive Seed 是 SeekStar 的核心魔法之一。

任何粒度都可以重新成为一个宇宙：

- 一个领域可以成为 seed；
- 一个主题可以成为 seed；
- 一个网页可以成为 seed；
- 一个 PDF 可以成为 seed；
- 一张图片区域可以成为 seed；
- 一个段落可以成为 seed；
- 一个词语可以成为 seed；
- 一个超链接可以成为 seed；
- 一个字符也可以成为 seed。

这意味着 SeekStar 不是从搜索结果到答案的单向流程，而是无限递归的探索网络。

---

## 6. 典型用户旅程

### 6.1 打开 App：揭开望远镜盖子

用户打开 SeekStar，不需要立刻输入搜索关键词。

默认 New Seek tab 会主动生成一片启发式星空：AI 根据最近可能值得注意的新鲜事、领域变化、跨学科动向和随机探索价值，抛出一组关键词和方向，把它们放进最开始的领域层作为 seed 群。

用户第一眼看到的是一片完整星空，而不是一个空白任务。

短焦模式下，用户看到更多星系：领域、主题、趋势、未知边缘和可能的探索方向。长焦模式下，用户靠近某个星系，看到其中的来源、网页、PDF、图片、文档和细节词语。

如果用户只是漫无目的地横向移动，SeekStar 也应该能像真实望远镜一样工作：视口中哪一边看上去有更多星点、有更多亮光、有更多未知候选，用户就可以把那里作为新的观察中心。横向拖动不是翻页，而是在夜空中移动望远镜。

这让每次进入 App 都像闯入一个新的领域。用户可以没有目标，但仍然有东西可看、有方向可靠近、有未知可发现。

### 6.2 从模糊词开始

用户输入一个词，比如“具身智能”。

SeekStar 不直接返回结果列表，而是生成一张星图：

- L0：相关领域，如机器人学、认知科学、强化学习、人机交互；
- L1：具体主题，如世界模型、触觉反馈、仿真训练、机器人基础模型；
- L2：来源方向，如论文、实验室、开源框架、产品案例；
- L3：候选网页、论文、PDF、GitHub、图像和文档。

用户可以横向移动，发现附近还有哪些相关但未意识到的方向。

### 6.3 从网页开始

用户粘贴一个 URL。

SeekStar 用 DataService/Playwright 观察网页，拿到标题、正文、摘要、出链、媒体和 source snapshot。网页进入 L3 Tile Field，并可以吸附成浏览器模式。

用户如果想看细节，点击“进入当前页面的DeepLens”，页面被拆成段落和词语。用户看到某个词，点击它，立刻可以开成新的 seed。

### 6.4 从超链接进入孤儿页

用户在浏览器模式里点击页面链接。

SeekStar 在新 tab 打开该链接，并保留来源 backlink。新页面先是一个真实 L3 页面，然后 AI 根据页面标题、正文摘要和来源上下文，补全它的上层星图：

- 它属于哪个领域；
- 它附近有哪些主题；
- 它应该和哪些来源方向相连；
- 它还有哪些同层内容值得探索。

这让普通网页跳转变成了探索宇宙的分裂，而不是离开产品。

### 6.5 从词语重新出发

用户在 Deep Lens 中点击一个词。

这个词成为新的 seed。SeekStar 新开一张星图，向上补领域，向下补来源和内容。用户从一个词进入一个世界。

---

## 7. AI 的角色

AI 在 SeekStar 中是 Cartographer，认知制图师。

它负责：

- 为默认 New Seek tab 生成“今晚星空”式的启发 seed 群；
- 把 seed 展开成领域、主题、来源方向和候选内容；
- 为横向移动生成相邻区域；
- 为孤儿页补上层语境；
- 解释用户圈选的区域；
- 给出可能的下一组关键词、主题和方向；
- 生成 source candidates；
- 标注不确定性；
- 把 selected grains 组织成可继续探索的 seed。

AI 不负责替用户“宣布最终真相”。它输出的是结构化地图材料。地图材料进入画布前需要 schema 校验。source-backed 内容必须来自 DataService/Playwright 的观察或用户明确导入。

AI 的价值是把人类尚未意识到的未知组织成分区、分层、可探索的地形。

---

## 8. DataService / Playwright 的角色

DataService 是现实探针。

它负责接触已经存在的外部内容：

- 打开 URL；
- 观察网页；
- 识别 PDF；
- 识别图片；
- 提取标题、正文、摘要、出链、媒体；
- 生成 source snapshot；
- 验证 AI 提出的 source candidate；
- 把真实观察结果交回星图。

DataService 不负责生成语义地图，也不决定一个领域该如何组织。它只回答：“这个东西是否真实存在？能否打开？内容是什么？它包含哪些可继续探索的链接和媒体？”

SeekStar 需要 AI Cartographer 和 DataService 同时存在：

- 只有 AI，会容易变成幻觉星空；
- 只有网页堆叠，会缺少方向感；
- AI 负责制图，DataService 负责接触现实。

---

## 9. 显示层与数据层

SeekStar 的显示层应该订阅数据，而不是自己制造认知结构。

底层维护：

- seed pool；
- terrain scene；
- node pool；
- source pool；
- tile surface pool；
- Deep Lens grain pool；
- tab session；
- trail；
- cache；
- operation log。

显示层根据当前 viewport、focus、layer/band、source state 和 tile state 渲染：

- 星群；
- 主题场；
- 来源方向；
- tile field；
- 浏览器吸附层；
- Deep Lens；
- recursive seed 入口。

用户操作被打包成事件：

- viewport changed；
- focus changed；
- tile absorption entered；
- tile absorption exited；
- deep lens entered；
- source observed；
- hyperlink opened；
- seed created；
- selection changed；
- chunk expanded。

事件影响数据对象的行为，数据变化再驱动显示层更新。

这使 SeekStar 的交互像一台望远镜：用户移动镜头，世界响应；用户放大焦点，焦距改变；用户点击真实内容，浏览器表面出现；用户进入 Deep Lens，细节对象出现。

---

## 10. L3 Tile Field 具体设计

L3 是 SeekStar 最关键的内容接触层。

### 10.1 Tile 类型

L3 tile 包括：

- URL candidate；
- webpage；
- PDF；
- image；
- document；
- article；
- source snapshot；
- failed candidate recovery item；
- live browser surface。

主画布只展示候选和成功内容的清晰状态。失败内容应进入恢复队列或诊断区，不应作为破损 tile 干扰探索。

### 10.2 Tile 状态

一个 tile 可以处于：

- candidate：AI 或来源方向提出的候选；
- probing：DataService 正在验证；
- source-backed：已被真实观察支持；
- thumbnail-ready：已有缩略图；
- focused：用户聚焦；
- absorbed：已吸附为浏览器/文档表面；
- recovery：验证失败，等待重试或替换。

### 10.3 加载策略

默认同屏 25 个 tile。

加载策略：

- 视口内：展示 tile、缩略图、状态；
- 近视口：可预热缩略图；
- 视口外：不加载 live renderer；
- 焦点 tile：优先加载；
- 吸附 tile：进入 live WebContentsView。

这样 L3 可以保持大规模探索，而不会因为同时加载大量网页而失控。

### 10.4 吸附动画

当焦点 tile 面积超过视口 80%：

```text
tile 放大
→ 匹配视口中心
→ 尺寸贴合视口
→ 铺满成为浏览器模式
```

这个动画的意义不是装饰，而是维持空间连续性：用户知道自己不是“打开了另一个应用”，而是从星图中的一个 tile 钻进了真实内容。

---

## 11. Deep Lens 具体设计

Deep Lens 是从真实内容进入细节的方式。

### 11.1 入口

入口包括：

- 浏览器模式顶部按钮；
- L3 tile 选择菜单；
- source-backed tile 的命令；
- 未来的文本选区。

### 11.2 提取方式

网页内容优先从浏览器层提取：

- DOM section；
- paragraph；
- text node；
- selection；
- Range client rect；
- DOM locator；
- text offset。

如果浏览器层不可用，则回退到 source snapshot 的 visible text。

### 11.3 展示方式

Deep Lens 不展示成工程层级楼梯，而展示成近距离阅读场：

- 段落是主要块；
- 词语/短语作为可点击粒度；
- 每个 grain 保留来源；
- 每个 grain 都可以成为新 seed。

### 11.4 Deep Lens 的目的

Deep Lens 不是为了把网页重新排版成阅读器，而是为了让每个细节都可以重新变成探索入口。

---

## 12. 右侧 AI Map Control

右侧面板不是传统 inspector。

它应该是 AI Map Control：

- 解释当前区域；
- 继续扩展周边；
- 把选区变成新 seed；
- 对比几个节点；
- 总结当前 trail；
- 观察候选来源；
- 处理失败来源；
- 展示必要的操作记录。

它的语气应该像一个地图副驾驶，而不是一个聊天机器人。用户在画布上做动作，右侧 AI 理解当前上下文并给出可执行建议。

---

## 13. Tab 设计

SeekStar 的 tab 不是普通网页 tab，而是探索宇宙 tab。

一个 tab 可以来自：

- 用户输入 seed；
- 用户打开 URL；
- 用户点击浏览器里的超链接；
- 用户把词语/段落变成 seed；
- 用户把圈选区域变成 seed。

每个 tab 都有：

- seed；
- parent backlink；
- terrain scene；
- sources；
- viewport；
- trail；
- selection；
- Deep Lens 状态。

当一个超链接创建新 tab，它带着来源 backlink。AI 可以利用 backlink 给孤儿页补上层语境。

---

## 14. 产品实现架构

SeekStar 的实现不需要让用户理解复杂架构，但产品需要这些能力协同工作。

### 14.1 Electron App Framework

负责桌面窗口、tab runtime、本地权限、WebContentsView、IPC、安全边界和应用状态。

### 14.2 Renderer / Canvas

负责展示星图、tile field、Deep Lens、右侧 AI 控制面和用户交互。

### 14.3 Constellation Engine

负责 terrain scene、对象池、事件 reducer、projection、tile absorption、source ingestion、Deep Lens mutation。

### 14.4 AI Service / Level Runtime

负责结构化生成：

- 默认 New Seek tab 的启发式 seed 星空；
- bootstrap seed；
- decompose down；
- expand horizontal；
- summarize up；
- replace source candidate；
- recursive seed。

默认 seed 星空是一种入口生成，不是一种全局推荐层。它只在默认 New Seek tab 没有用户 seed、没有 parent backlink、没有来源内容、没有明确选择语义时触发。

### 14.5 Scout / DataService

负责真实内容观察：

- URL；
- HTML；
- PDF；
- image；
- outlinks；
- media；
- source snapshot。

### 14.6 Storage / Cache

负责保存 workspace、tab、scene、chunk、source、trail、AI 成本和缓存。

---

## 15. MVP 的完成定义

SeekStar MVP 不是做一个“搜索结果可视化 demo”。

MVP 要完成的是一条完整认知链路：

```text
打开默认 New Seek tab
→ AI 生成一片启发式 seed 星空
→ 用户选择一个亮点或漫无目的地移动望远镜
→ 输入 seed
→ AI 生成 L0/L1/L2/L3 星图
→ 用户横向移动发现周边
→ L3 候选经 DataService 验证成真实 tile
→ tile 放大吸附为浏览器模式
→ 当前页面进入 Deep Lens
→ 段落/词语可成为 recursive seed
→ 超链接可打开孤儿 tab
→ AI 为孤儿 tab 补上层语境
```

只要这条链路顺畅，SeekStar 的核心灵魂就成立。

---

## 16. 设计气质

SeekStar 应该有天文台、望远镜、星图和专业工作台的气质。

它不是花哨的营销页，也不是普通 SaaS 后台。

视觉上应当：

- 黑暗、安静、深色；
- 有空间感；
- 让星图成为第一视觉主体；
- 控件克制；
- tile 密集但清晰；
- Deep Lens 适合近距离阅读；
- AI 面板像地图控制台。

交互上应当：

- 用户永远知道自己在哪一层；
- 放大、拉远、移动要有连续感；
- 不把用户突然扔到无上下文页面；
- 真实内容和 AI 推测要能区分；
- 每个细节都可以继续探索。

---

## 17. SeekStar 的最终愿景

SeekStar 想解决的不是“更快得到答案”。

SeekStar 想解决的是：当人类面对未知时，软件如何帮助人类开始探索。

它致敬人类第一次用望远镜观察星空的时刻。那一刻的价值不是马上得到一张完整宇宙答案表，而是人类获得了一种新的观看能力。

SeekStar 也应该给用户这种能力：

```text
我原本不知道该问什么。
现在我看见了一片结构。
我知道自己在哪里。
我知道周边还有什么。
我知道哪些内容真实存在。
我知道哪些方向还只是未知。
我可以继续靠近。
我可以从任何一点重新出发。
```

这就是 SeekStar。
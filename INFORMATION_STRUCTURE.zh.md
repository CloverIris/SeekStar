# SeekStar 信息结构补充

本文把 `design/information _structure` 中的 3D 概念图翻译为产品规则。它描述的是 SeekStar 背后的信息结构隐喻，不是下一阶段要落地的 3D 渲染任务。当前阶段继续用 2D Pixi 画布表达这些关系。

## 核心隐喻

SeekStar 不是无限盒子套盒子的世界，而是同一个有限知识世界在不同尺度下的观察。缩放改变的是比例尺、密度和可见结构，不是把用户传送到一个完全无关的新世界。

一个近似类比是 Minecraft 的主世界和地狱比例映射：在低层尺度横向移动一段距离，回到高层尺度时，用户仍然应该能看见这段移动在高层地图上的投影和痕迹。SeekStar 的层级关系也应如此：从 L0/L1/L2 进入 L3，横向探索真实内容，再拉远时，应从当前位置附近浮现上层语义，而不是回到原点或进入另一个独立容器。

## 语义盘面

概念图中的上层圆盘对应语义盘面，包括 Supra Macro、L0 Star Gallery、L1 Topic Field、L2 Source Orientation 等尺度下的可见结构。

它可以被理解为一种 App 图标展开：用户点击一个语义对象后，这个对象本身放大到接近整个屏幕，同时透明度降低，把内部内容呈现出来。内部内容中仍然会出现新的语义对象集合，用户继续以同一套望远镜动作观察它们。

这不是普通父子树，也不是文件夹套文件夹。语义盘面代表同一世界在当前比例尺下被压缩后的可读形态。

## 观察体积

概念图中的黑色锥体是观察体积的隐喻：它表示从上层焦点向下层内容面的投射范围，也表示下层高密度信息被压缩成上层语义对象的程度。

当前主流程只保留一个 active observation cone，因为用户当前只有一个主视口。概念图中同时出现多个锥体，是为了说明不同语义对象如何把下层信息压缩到上层，而不是要求主界面同时维护多个活跃视口。

历史观察可以通过 trail、ghost、source context 或右侧摘要回看，但不应让多个 active cone 同时抢夺主画布状态。

## L3 Tile Field

L3 的 Tile Field 是当前视口中的真实内容面。这里的 tile 是统一抽象：网页、PDF、图片、文档、文章、source snapshot 或媒体缩略图都可以表现为 tile。概念图里的白色砖块和图片缩略图不是两种不同对象，而是同一种 tile 在不同内容状态下的表达。

当前镜头同时显现的 tile 分片不应超过 25 个。这个限制指可见视锥中的容量，不表示周边没有更多内容。横向移动时，系统可以使用缓存池、预渲染和按需加载提供周边区域；如果用户移动速度击穿预加载和缓存，界面可以出现带阻尼感的区域加载边界，加载完成后继续开放。

继续向下缩放时，可见 tile 数量会变少，并最终进入浏览器吸附模式。继续向上拉远时，也必须保持密度限制，避免把下层大量真实内容直接倾倒到上层语义盘面。

## Deep Lens

Deep Lens 不是从宏观星图继续向下贴近同一张地图，也不是显式 L4-L10 楼梯。它是从一个真实 tile 打开的独立微观阅读层。

在 Deep Lens 中，文档被拆成 section、paragraph、sentence、phrase、word、character 等粒度。这些粒度服务于文档内部结构和 recursive seed 闭环，不需要和宏观 L0/L1/L2/L3 的空间布局保持几何连续。

Deep Lens grain 必须保留 source URL、source id、原 tile、locator、excerpt 或文本 offset。这样用户从某个段落或词重新出发时，仍然知道它来自哪里，并可以把微观入口映射回宏观探索路径。

## 实现边界

- 下一阶段继续用 2D 画布表达，不启动真实 3D 相机或 3D 渲染迁移。
- 语义盘面可以用缩放、透明度、聚焦、层级切换和 trail 表达，不需要真实圆盘几何。
- 观察体积可以用 focus、viewport、visible band、source context 和 projection 规则表达，不需要渲染黑色锥体。
- L3 只把 source-backed 内容作为真实 tile surface；source candidate 留在队列、摘要和手动观察动作中。
- Deep Lens 是独立微观层，但 recursive seed 必须保留 backlink，让微观入口能回到宏观地图。

## 概念图

- [OverView.png](<design/information _structure/OverView.png>)：整体语义盘面、观察体积和下层 tile 面的关系。
- [OverView2.png](<design/information _structure/OverView2.png>)：多语义盘面和多个压缩锥体的全局关系。
- [SideView.png](<design/information _structure/SideView.png>)：尺度高度、压缩程度和下层信息密度。
- [View-AboveTile.png](<design/information _structure/View-AboveTile.png>)：从上方观察 tile 面与语义投射范围。
- [View-OnTile.png](<design/information _structure/View-OnTile.png>)：tile 面内部的统一内容表达。

设计图的文件夹说明见 [design/information _structure/README.md](<design/information _structure/README.md>)。

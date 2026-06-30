# Information Structure Concept Images

这个文件夹保存 SeekStar 信息结构的 3D 概念图。它们用于解释产品背后的空间隐喻，不代表下一阶段要改成真实 3D 渲染。当前实现仍以 2D Pixi 画布表达这些关系。

## Reading Guide

- 上层圆盘表示语义盘面：Supra Macro、L0、L1、L2 等不同尺度下的可读结构。
- 黑色锥体表示观察体积：从当前语义焦点向下层内容面投射，也表示下层信息被压缩成上层语义对象的范围和程度。
- 下层白色砖块和图片缩略图表示同一种 L3 tile 抽象，不区分为两套对象模型。
- 同时出现多个锥体用于说明信息压缩关系，不代表主流程要同时维护多个 active viewport。
- Deep Lens 不在这些宏观几何关系里继续下钻；它是从真实 tile 打开的独立微观阅读层。

## Image Set

- `OverView.png`：整体信息结构，展示语义盘面、观察体积和下层 tile 面。
- `OverView2.png`：从更高视角看多个语义盘面和多个压缩锥体。
- `SideView.png`：侧视尺度关系，强调上层压缩和下层信息密度。
- `View-AboveTile.png`：从 tile 面上方观察局部投射和 tile 集群。
- `View-OnTile.png`：贴近 tile 面，表达网页、图片、文档等内容都属于统一 tile surface。

## Product Interpretation

规范化解释见 [../../INFORMATION_STRUCTURE.zh.md](../../INFORMATION_STRUCTURE.zh.md)。

PRD 中相关产品规则见 [../../SEEKSTAR_PRODUCT_PRD.zh.md](../../SEEKSTAR_PRODUCT_PRD.zh.md)。

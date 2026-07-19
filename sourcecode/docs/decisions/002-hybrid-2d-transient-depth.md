# ADR 002：二维地图常态与短暂纵深过渡

- 状态：Accepted
- 日期：2026-07-19

## Context

SeekStar 需要让用户感知 L0–L3 是同一连续世界的不同尺度，同时保持地图可读性、平移效率和集显性能。持续倾斜的 3D 平面会降低文字可读性，并把产品误导为盒子套盒子的空间层级。

## Decision

常态采用二维世界坐标。当前层完整可交互；下一层以 alpha 0.10–0.18、scale 0.82 的不可交互幽灵对象存在。切层时逻辑 layer 立即更新，Pixi 对象用 460ms alpha/scale 与轻微焦点视差表达纵深，XY 不变。`prefers-reduced-motion` 使用 120ms 纯透明度过渡。

过渡不允许使用 `canvas.toDataURL()`、全屏截图 `<img>`、模糊遮罩或持续 3D 相机。Pixi display 按对象 ID 持久复用，纯相机平移只更新根容器 transform。

## Consequences

- 用户可以提前感知下层结构，但幽灵层不能抢夺点击、hover、套索或来源加载。
- 视觉纵深是导航反馈，不是新的持久世界模型。
- 性能优化围绕对象 diff、文字密度和可见性进行，不引入 Three.js 或全局力导布局。
- 真实 60 FPS 结论必须来自 Windows 集显 WebGL trace，Node 投影基准只能作为功能门禁。

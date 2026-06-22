# SeekStar 源码（Monorepo）

本目录为 SeekStar 的 monorepo 根目录。仓库级总览见上级目录 [`../README.md`](../README.md)。

## 目录结构

```text
sourcecode/
├─ apps/
│  └─ desktop/              # Electron + React 桌面应用
│
├─ packages/
│  └─ core-schema/          # 共享类型与 TerrainScene 契约
│
├─ docs/
│  ├─ architecture/
│  └─ decisions/
│
├─ AGENTS.md
├─ PRD.md
├─ PHILOSOPHY.md
├─ ARCHITECTURE_AND_UI_SPEC.md
└─ UI_STYLE_GUIDE.md
```

下文路径均相对于本目录（`sourcecode/`）。

## 本地运行

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

开发模式默认打开 Detached DevTools。修改主进程或 preload 后需完全重启 Electron。

## 关键文档

* `PHILOSOPHY.md` — 项目哲学
* `PRD.md` — 产品需求
* `AGENTS.md` — Agent 行为准则
* `ARCHITECTURE_AND_UI_SPEC.md` — 架构与 UI 规范
* `UI_STYLE_GUIDE.md` — 视觉风格
* `docs/architecture/` — 脚手架与数据契约
* `docs/decisions/` — 架构决策记录

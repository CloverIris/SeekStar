# SeekStar Source Monorepo

This directory is the active SeekStar monorepo root. Repository-level overview lives in [`../README.md`](../README.md).

## Structure

```text
sourcecode/
|- apps/
|  `- desktop/              # Electron + React desktop observatory
|- packages/
|  `- core-schema/          # Shared TerrainScene and core SeekStar types
|- docs/
|  |- architecture/
|  `- decisions/
|- AGENTS.md
|- PRD.md
|- PHILOSOPHY.md
|- PHILOSOPHY.zh.md
|- ARCHITECTURE_AND_UI_SPEC.md
`- UI_STYLE_GUIDE.md
```

Paths in this directory are relative to `sourcecode/`.

## Local Commands

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Development mode opens detached DevTools by default. Restart Electron fully after changing the main process or preload boundary.

## Key Documents

- `PHILOSOPHY.md`: product philosophy (English normative edition).
- `PHILOSOPHY.zh.md`: 项目哲学（中文版，与英文版同步）。
- `PRD.md`: product requirements.
- `AGENTS.md`: agent operating rules.
- `ARCHITECTURE_AND_UI_SPEC.md`: architecture and UI specification.
- `UI_STYLE_GUIDE.md`: visual system and shell standards.
- `docs/architecture/`: scaffold and data-contract notes.
- `docs/decisions/`: architecture decision records.

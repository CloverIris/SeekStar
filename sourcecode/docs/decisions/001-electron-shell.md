# 001: Electron Shell And Tab Boundary

Status: Proposed
Date: 2026-06-22
Subsystem: Desktop host, tabs, and security boundary

## Problem

SeekStar needs a desktop observatory that owns windows, workspace state, independent exploration tabs, local persistence, permissions, and coordination between renderer, scout, and cartographer. It must not become a generic browser shell.

## Product Constraints

- Tabs are independent exploration universes, not shared browser histories.
- The renderer shows local structured terrain, not arbitrary remote pages with privileged access.
- Hyperlinks may create new SeekStar tabs with backlinks, but P0 can open externally while ingestion matures.
- Playwright is the scout; Electron is not the crawler.
- The shell must preserve provenance, local notes, selections, exports, and tab camera history.

## Existing Libraries Checked

- Electron:
  - Official docs: https://www.electronjs.org/docs/latest/
  - Security docs: https://www.electronjs.org/docs/latest/tutorial/security
  - Context isolation docs: https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Electron Forge:
  - Official docs: https://www.electronforge.io/
  - Notes: candidate for packaging and development workflow, not required for the data model.

## Performance Constraints

- Tab switching should feel immediate for persisted local maps.
- AI and scout jobs must not block the renderer.
- The main process should coordinate jobs and storage without doing canvas work.

## Interaction Constraints

- Top bar includes tab strip, command input, current layer breadcrumb, and job status.
- New seed tabs do not inherit camera history, local search history, transient selections, or AI queue.
- Tabs can keep backlink metadata when created from hyperlink, word, or selection.

## Chosen Approach

Use Electron for the desktop host with one main application window for P0. Keep SeekStar tabs as application-owned data objects rendered by the local UI rather than one `BrowserWindow` per tab. Use a preload bridge with narrow typed APIs for workspace, tab, scout, agent, and export actions.

Security defaults for P0:

- `nodeIntegration: false`.
- `contextIsolation: true`.
- sandboxed renderer where compatible.
- no remote content in privileged app UI.
- no broad Electron API exposure through preload.
- external links open through an explicit safe path until internal isolated ingestion is designed.

## Rejected Approaches

- Generic browser-tab architecture:
  - It centers web navigation instead of exploration maps and makes provenance, lasso, and Z layers secondary.
- Chat-first Electron shell:
  - It violates the product principle that the semantic canvas is primary.
- Remote webview-first architecture:
  - It increases security risk and gives remote pages too much influence over the product surface.

## Why Not Build From Scratch

Electron already provides desktop lifecycle, Chromium rendering, native windows, IPC, packaging paths, and security primitives. SeekStar's novelty is the cognitive map and structured exploration model, not custom desktop runtime plumbing.

## Fallback Plan

If Electron integration creates too much packaging or security friction in early spikes, keep the renderer as a local web app temporarily while preserving Electron-compatible preload and IPC boundaries in the package structure.

## Open Questions

- Should P0 use Electron Forge, electron-vite, or another starter after dependency research?
- Should P0 implement internal hyperlink-created tabs immediately, or open externally until the scout pipeline exists?

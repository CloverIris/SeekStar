# 006: Codex-like Shell Visual System

Status: Proposed
Date: 2026-06-22
Subsystem: Desktop shell, visual system, and UI library policy

## Problem

SeekStar needs a calmer, more polished desktop shell: integrated title bar, acrylic dark background, left observatory sidebar, and a central cognitive map workbench. The shell must not become a browser clone, dashboard, or chatbot-first surface.

## Product Constraints

- The cognitive canvas remains primary.
- The left sidebar may hold favorites, independent exploration tabs, and new field search affordances.
- The command input routes intent; it is not a chat composer.
- Styling must not weaken Electron security settings.
- P0 must stay small and reviewable.

## Research Checked

- Electron BrowserWindow official docs:
  - https://www.electronjs.org/docs/latest/api/browser-window
- Electron window customization official docs:
  - https://www.electronjs.org/docs/latest/tutorial/window-customization
- Electron custom title bar official docs:
  - https://www.electronjs.org/docs/latest/tutorial/custom-title-bar
- Lucide React official docs:
  - https://lucide.dev/guide/react
- Fluent UI React documentation:
  - https://react.fluentui.dev/

Package registry metadata checks for Lucide and Fluent UI were attempted, but the sandbox blocked npm network access. No dependency was added in this step.

## Chosen Approach

- Use Electron's `titleBarStyle: "hidden"` and `titleBarOverlay` for an integrated title bar while preserving native window controls.
- Use Electron's Windows `backgroundMaterial: "acrylic"` where available.
- Use CSS variables for the visual system: acrylic shell, dark sidebar, subtle borders, muted text hierarchy, and restrained blue accents.
- Keep icons as simple text glyphs for now to avoid adding an unverified dependency.
- Keep tabs as SeekStar exploration data in the renderer, shown in the left observatory sidebar.

## Rejected Approaches

- `frame: false` custom window controls:
  - Rejected for P0 because native controls through `titleBarOverlay` are less risky and require less custom platform work.
- Full Fluent UI adoption:
  - Rejected for this step because the shell needs a bespoke cartography layout, and a component framework would add churn before interaction patterns settle.
- Adding Lucide immediately:
  - Deferred because package metadata and install were blocked by network permissions. It remains a good candidate for later icon polish.
- Browser-like tab strip as the main chrome:
  - Rejected because SeekStar tabs are independent exploration universes, not web pages.

## Implementation Notes

- The title bar uses draggable CSS app regions.
- The title bar shows a centered product identity line: `SeekStar AI Explorer lens`, split visually as **SeekStar** + **AI Explorer lens**.
- Interactive buttons, sidebar items, and command input use non-draggable regions.
- The left sidebar contains new field search, current-map search affordance, favorites, tab list, and compact canvas tools.
- The main stage keeps the command input, canvas, inspector, and status bar.

## Not Implemented

- No new UI library.
- No real search beyond existing local mock scene search.
- No AI, Playwright, persistence, browser navigation, graph layout, lasso, brush, or Markdown export.

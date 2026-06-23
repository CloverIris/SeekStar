# 006: Codex-like Shell Visual System

Status: Accepted, with icon follow-up in 007
Date: 2026-06-22
Subsystem: Desktop shell, visual system, and UI library policy

## Problem

SeekStar needs a calmer, more polished desktop shell: integrated title bar, acrylic dark background, left observatory sidebar, and a central cognitive map workbench. The shell must not become a browser clone, dashboard, or chatbot-first surface.

## Product Constraints

- The cognitive canvas remains primary.
- The left sidebar may hold favorites, independent exploration tabs, and new field search affordances.
- The command composer routes intent; it is not a chat surface.
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

Package registry metadata checks for Lucide and Fluent UI were attempted during the original P0 shell pass, but the sandbox blocked npm network access. No dependency was added in that step. P1.7 later accepted `lucide-react` for shell iconography; see `007-icon-system.md`.

## Chosen Approach

- Use Electron's `titleBarStyle: "hidden"` and `titleBarOverlay` for an integrated title bar while preserving native window controls.
- Use Electron's Windows `backgroundMaterial: "acrylic"` where available.
- Use CSS variables for the visual system: acrylic shell, dark sidebar, subtle borders, muted text hierarchy, and restrained blue accents.
- Use simple text glyphs only as temporary placeholders. P1.7 replaces persistent shell and tool glyphs with `lucide-react` icons.
- Keep tabs as SeekStar exploration data in the renderer, shown in the left observatory sidebar.

## Rejected Approaches

- `frame: false` custom window controls:
  - Rejected for P0 because native controls through `titleBarOverlay` are less risky and require less custom platform work.
- Full Fluent UI adoption:
  - Rejected for this step because the shell needs a bespoke cartography layout, and a component framework would add churn before interaction patterns settle.
- Adding Lucide in the original P0 visual pass:
  - Deferred at that time because package metadata and install were blocked by network permissions. P1.7 accepts it as the shell icon system.
- Browser-like tab strip as the main chrome:
  - Rejected because SeekStar tabs are independent exploration universes, not web pages.

## Implementation Notes

- The title bar uses draggable CSS app regions.
- The title bar shows a centered product identity line: `SeekStar AI Explorer lens`, split visually as **SeekStar** + **AI Explorer lens**.
- Interactive buttons, sidebar items, and the command composer use non-draggable regions.
- The left sidebar contains new field search, current-map search affordance, favorites, tab list, and compact canvas tools.
- The main workbench keeps the canvas primary, with the command composer below it, the inspector beside it, and the status strip underneath.

## Not Implemented

- No full UI component framework.
- No real search beyond existing local mock scene search.
- No AI, Playwright, persistence, browser navigation, graph layout, lasso, brush, or Markdown export.

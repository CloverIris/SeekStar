# SeekStar UI Style Guide

Status: P0 Codex-like shell direction
Date: 2026-06-22

## Visual Tone

SeekStar should feel like a dark observatory for cognitive cartography: blue-accented technical calm, dense but readable, quiet enough for long exploration sessions.

The current shell should feel closer to a modern coding-agent desktop surface than to a web dashboard: integrated title bar, acrylic dark background, left observatory sidebar, and a central map workbench.

The interface should suggest precision and orientation, not spectacle.

## Avoid

- Neon sci-fi styling.
- Game-like HUD effects.
- Generic dashboard decoration.
- Chatbot-first layout.
- Browser clone chrome.
- Loud gradient UI.
- Decorative orbs, bokeh, or heavy glow.
- Color states that make mock or inferred content look source-backed.
- Heavy UI frameworks before the core interaction model is stable.

## Design Tokens

Use CSS variables instead of scattered literal colors.

Current token set:

- `--bg-window`: native window backdrop.
- `--bg-acrylic`: translucent application shell.
- `--bg-sidebar`: left observatory sidebar surface.
- `--bg-stage`: central workbench surface.
- `--bg-canvas`: canvas field.
- `--bg-elevated`: top bar, rails, inspector, status surfaces.
- `--bg-inset`: command input and panel bodies.
- `--bg-hover`: quiet hover surface.
- `--border-hairline`: shell separators.
- `--border-subtle`: default panel and control border.
- `--border-strong`: active or focused boundary.
- `--text-primary`: main labels.
- `--text-secondary`: descriptions and normal metadata.
- `--text-muted`: quiet metadata and inactive controls.
- `--accent-blue`: primary active accent.
- `--accent-blue-soft`: restrained active background.
- `--accent-cyan`: secondary technical accent.
- `--fog-muted`: fog and uncertainty accent.
- `--warning-muted`: reserved for cautious or degraded states.
- `--shadow-soft`: restrained raised-surface shadow.
- `--shadow-panel`: large shell panel shadow.

## Node Visual Differentiation

- Seed nodes: blue-accented border, restrained blue glow, highest z emphasis.
- Topic nodes: quiet navy card with cyan pin marker.
- Provenance nodes: cyan-tinted card to indicate trust/source concepts.
- Fog nodes: dashed violet-muted border, lower opacity, no factual treatment.
- Generated and inferred nodes: metadata pill must expose `generated` or `agent inferred`.
- Source-backed nodes later: should use clear source metadata and a stronger provenance affordance, not just brighter color.

## Interaction States

These are visual rules only; behavior can arrive later.

- Active: soft blue background, stronger border, minimal glow.
- Hover: slightly stronger border and elevated shadow, no layout shift.
- Selected: blue outline or halo distinct from hover.
- Search highlight: subtle blue border on matching terrain nodes; never move the canvas into a list-first state.
- Focus target: quiet cyan outline around the node selected through search.
- Fog: dashed border, muted transparency, uncertainty label visible.
- Mock/generated: metadata pill visible; never style as a verified source.
- Disabled/inactive: muted text, no glow.

## Mock P0 Interactions

- The command action card routes typed text; it is not a chat composer.
- Current-tab search results are secondary inspector support, not the main interface.
- The canvas remains primary during command, search, and selection flows.
- New seed tabs are local mock scenes until real cartographer and scout layers exist.

## Layout Rules

- The center canvas remains the dominant surface.
- The app uses an integrated custom title bar with native window controls, not the default Windows title frame.
- The title bar shows a centered product identity line: **SeekStar** + **AI Explorer lens**. It is always visible, non-interactive, and horizontally centered in the title bar regardless of left navigation or menu width.
- The left sidebar is the observatory rail: new field search, current-map search affordance, favorites, independent tabs, and compact canvas tools.
- Top command input is visible inside the main stage, but it is not the product center.
- Right inspector uses compact cards and metric rows.
- Bottom status bar is dense, quiet, and source-aware.
- Borders should be thin, corners modest, and spacing consistent.

## Title Bar Brand

The integrated title bar carries the P0 product identity as a single centered line:

```text
SeekStar  AI Explorer lens
```

Rules:

- Placement: absolute horizontal center of the title bar, vertically centered within the 36px chrome.
- Copy: `SeekStar` is the product name; `AI Explorer lens` is the mode descriptor. Do not abbreviate or localize in P0.
- Typography: 12px, `letter-spacing: 0.02em`, no uppercase transform, no icon prefix.
- Hierarchy: `SeekStar` uses `--text-secondary` at medium weight; `AI Explorer lens` uses `--text-muted` at regular weight.
- Interaction: `pointer-events: none` so the brand does not block window drag or native controls.
- The brand line is not a button, breadcrumb, or tab title. Exploration tab names stay in the left observatory sidebar and workbench header.

## Shell Library Policy

- Prefer native Electron window APIs and CSS variables for the P0 shell.
- Do not add a full UI component framework for visual polish alone.
- Icon libraries such as Lucide can be evaluated once package access is available, but the P0 shell must not depend on them.
- Fluent-style component systems remain candidates for later accessibility and control primitives, not a default visual reset.

## Acrylic Shell Rules

- Use Electron's Windows `backgroundMaterial: "acrylic"` when available.
- Pair native acrylic with translucent app surfaces and subtle borders.
- Keep Electron security settings intact: do not weaken sandbox, context isolation, node integration, or web security for styling.
- Custom draggable regions should be limited to title bar chrome; interactive controls must remain non-draggable.

## Current Scope

This guide covers the P0 shell and `TerrainScene` fixture rendering. It does not introduce a UI framework, animation system, real graph layout, AI, Playwright, browser behavior, or persistence.

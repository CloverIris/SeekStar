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

- `--bg-transparent`: transparent application base for native acrylic.
- `--bg-sidebar`: left observatory sidebar surface.
- `--bg-workbench`: central map workbench surface.
- `--bg-canvas`: canvas field.
- `--bg-elevated`: terrain node and raised panel surfaces.
- `--bg-inset`: command input and panel bodies.
- `--bg-hover`: quiet hover surface.
- `--bg-active`: active sidebar/tab surface.
- `--border-hairline`: shell separators.
- `--border-subtle`: default panel and control border.
- `--border-strong`: active or focused boundary.
- `--text-primary`: main labels.
- `--text-secondary`: descriptions and normal metadata.
- `--text-muted`: quiet metadata and inactive controls.
- `--accent`: primary active accent.
- `--accent-soft`: restrained active background.
- `--fog-muted`: fog and uncertainty accent.
- `--titlebar-height`: integrated title bar height.
- `--sidebar-width`: left observatory sidebar width.
- `--inspector-width`: right inspector width.
- `--motion-duration`: shell transition duration.
- `--motion-bezier`: shell transition curve.

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

## Icon System

- Shell, sidebar, and canvas-tool icons use `lucide-react`.
- Import icons individually from `lucide-react`; do not add a full UI component framework for icons.
- Icons should inherit `currentColor`, sit at 14-16px in dense shell controls, and use the default stroke style unless a specific control needs stronger contrast.
- Icons support orientation only. They must not turn the app into a generic browser toolbar or command dashboard.
- Avoid ASCII glyphs for persistent shell controls now that the icon system is available.

## Canvas Interaction States

- Pointer: default mode for selecting nodes and inspecting terrain.
- Pointer empty-space drag: dragging the canvas background pans the viewport while preserving node and relation selection behavior.
- Pan: canvas cursor changes to a grab affordance; dragging moves the camera, not node positions.
- Zoom: mouse wheel changes camera scale and updates the semantic layer indicator; zoom is an orientation signal, not a decorative effect.
- Wheel zoom should anchor on the cursor position. The visual world must not drift toward the canvas origin when zooming near an edge.
- Viewport controls: Fit map, Focus selection, and Reset view are small canvas-local controls for orientation only. They update camera state, not terrain data.
- Semantic layer rail: show the current layer ladder as a compact canvas-local orientation aid. Clicking a layer may change camera zoom/layer, but it must not imply real deeper content exists.
- Lasso: rectangular draft selection uses a quiet blue outline and soft fill; it is a spatial prompt primitive, not a text prompt box.
- Lasso completion may show a compact floating action card centered in the canvas workbench. It should feel like a map annotation control, not a chat composer.
- Relation lines should sit beneath terrain cards as quiet orientation scaffolding. Inferred, weak, and fog relations must remain muted or dashed.
- Layer emphasis: nodes outside the active semantic zoom band may dim, but they remain visible enough to preserve orientation.
- Brush: visible as a future tool only until weighted annotation behavior exists.

## Side Tray States

- The side tray is a compact selection basket, not a bookmark manager or search result list.
- Saved selections should show title, node count, and source state summary.
- P1.3 mock actions such as Explain, Compare, and Export are allowed only as local generated previews.
- Tray items must preserve generated, inferred, weak, and fog state instead of implying that selected content is source-backed.
- Empty tray copy should invite saving selected regions, not asking a chatbot.
- Mock action output should appear as compact cartographer notes in the inspector, not a chat transcript.
- Mock export output may look Markdown-shaped, but it must remain visibly generated and must not imply a file was written.

## Selection Action Card

- The selection action card appears only after spatial selection, such as rectangular lasso.
- Primary actions may include Save to tray, Mock explain, Mock compare, Mock export, and Use region as new seed.
- The card should be small, acrylic, and blue-accented, with no large text box.
- Actions that produce output must label it as mock/generated until the Region Explainer and source-backed export contracts exist.
- The card is centered in the workbench for P1 so it does not clip against canvas edges, the command composer, or the side panels.

## Relation Lines

- Render relation lines only from `TerrainScene.relations`; do not invent edges in the renderer.
- Lines are secondary to cards and should never dominate the map.
- Source-backed relations later may receive clearer provenance affordances; generated, inferred, weak, and fog relations stay restrained.
- Selected or search-highlighted endpoint nodes may softly brighten connected lines.
- In Pointer mode, relation lines may be clicked through a wider invisible hit target.
- The relation inspector should show endpoint titles, relation type, source state, confidence, and explanation in compact rows.
- Inspecting a relation must feel like map provenance, not a chat answer.

## Node Hover Preview

- Node hover previews are lightweight map inspection hints.
- They may show only existing node metadata: title, type, source state, confidence, relation count, tags, and summary.
- They must stay compact, acrylic, and boundary-aware so they do not cover the command composer or escape the workbench.
- They must not look like search results, chat answers, or AI-generated explanations.

## Source Readiness

- Overview panels should summarize source-backed, generated, inferred, weak, and fog terrain counts.
- In P1, mock scenes with no real sources must say so plainly.
- Source readiness is a trust cue, not a progress meter and not a search result list.
- Never use color alone to make generated terrain feel verified.

## Mock P0 Interactions

- The command action card routes typed text; it is not a chat composer.
- Current-tab search results are secondary inspector support, not the main interface.
- The canvas remains primary during command, search, and selection flows.
- New seed tabs are local mock scenes until real cartographer and scout layers exist.

## Layout Rules

- The center canvas remains the dominant surface.
- The default desktop window target is 16:9. P1 uses 1600x900 with a 1280x720 minimum so the canvas remains spacious.
- The app uses an integrated custom title bar with native window controls, not the default Windows title frame.
- The title bar shows a centered product identity line: **SeekStar** + **AI Explorer lens**. It is always visible, non-interactive, and horizontally centered in the title bar regardless of left navigation or menu width.
- The left sidebar is the observatory rail: new field search, current-map search affordance, favorites, independent tabs, and compact canvas tools.
- The command composer lives at the bottom of the workbench. It routes intent but must not become a chatbot surface.
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
- `lucide-react` is accepted for shell iconography because it provides standalone, tree-shakable React SVG icons without a component framework.
- Fluent-style component systems remain candidates for later accessibility and control primitives, not a default visual reset.

## Acrylic Shell Rules

- Use Electron's Windows `backgroundMaterial: "acrylic"` when available.
- Pair native acrylic with translucent app surfaces and subtle borders.
- Keep Electron security settings intact: do not weaken sandbox, context isolation, node integration, or web security for styling.
- Custom draggable regions should be limited to title bar chrome; interactive controls must remain non-draggable.

## Startup Splash

- P0 uses a renderer overlay splash inside the main app shell.
- Do not maintain a separate Electron splash window unless startup requirements change.
- The overlay should be brief, quiet, and non-blocking; it must not add marketing copy, login gates, network work, or fake progress.

## Current Scope

This guide covers the closed P0/P1 shell and `TerrainScene` fixture rendering. It does not introduce a UI framework, animation system, real graph layout, AI, Playwright, browser behavior, source ingestion, Markdown export, or persistence.

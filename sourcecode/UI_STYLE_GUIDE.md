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

## Macro Bubble Gallery

Macro layers L-3, L-2, L-1, and L0 may use a dense bubble gallery lens rather than square or rounded cards.

- Bubbles should feel like colorful solid cognitive terrain: softly shaded, non-transparent, restrained, and readable.
- The viewport center is larger, sharper, and more legible; bubbles near the edge shrink, dim, and fade.
- Bubble color is semantic orientation, not proof. Source-backed, generated, weak, inferred, and fog states still need explicit visual/state cues.
- Fog bubbles use uncertainty styling such as dashed rim, lower opacity, or soft violet/amber tint without looking broken or alarming.
- Scout-pending bubbles should look temporary and unresolved; they must not look like source-backed nodes.
- Avoid neon sci-fi, game loot effects, fireworks, decorative particle storms, and ordinary app-dashboard icon grids.
- The visual reference is an Apple Watch App Gallery-like bubble lens, but SeekStar must not copy proprietary assets, icons, or brand styling.

## Macro Frontier Discovery

P4.6 pauses long-press fracture. Macro exploration is driven by moving the telescope across the field.

- Moving near a macro-layer edge may request same-layer Scout observations.
- New candidates appear as small star bubbles at the frontier.
- Renderer owns movement and placement locally. AI and Playwright must not drive frame-by-frame motion.
- Playwright Scout may run during frontier discovery, but only structured observations affect resolve state.
- Star count may reflect scout observation count only when state labels make clear that this is observation volume, not factual answer count.
- Failed or duplicate stars remain visibly unresolved and must not look source-backed.

## Pixi Terrain Canvas

- The primary terrain canvas uses PixiJS for GPU rendering.
- React must not render every terrain node as DOM in macro layers.
- Pixi renders star bubbles, relation lines, Scout candidate stars, and camera movement.
- React owns shell controls, inspector panels, command routing, and source conversion.

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
- In P2, manually added sources should appear as source-backed terrain cards and source-readiness counts, not as a search-results page.
- Source evidence cards should show provenance metadata, quotes/snippets, reliability hints, and relation links compactly in the inspector.
- Clicking mapped excerpt links may move the camera to terrain; the inspector must not become a document reader or browser clone.
- Source-backed evidence cards may offer "Use as new exploration seed"; this creates a new exploration universe with backlink context, not a browser navigation.
- Origin backlink panels may offer "Focus origin" to return to the source-backed node in its original tab. This is exploration context recovery, not browser history.
- Source readiness is a trust cue, not a progress meter and not a search result list.
- Never use color alone to make generated terrain feel verified.

## Mock P0 Interactions

- The command action card routes typed text; it is not a chat composer.
- Current-tab search results are secondary inspector support, not the main interface. In P2 they may include source match type, source state, and source title metadata.
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

## P3 Cartographer Job Visuals

- Cartographer jobs should read as structured map provenance, not chat bubbles.
- Job rows use compact metadata pills for mode, status, and progress.
- Queued/running jobs may expose small Cancel and Mock fail controls for local lifecycle testing.
- Cancelled and failed jobs remain visible as provenance rows but must not receive alarm-heavy styling.
- Output cards may summarize generated terrain, but must show source state and mode.
- Scout plans use restrained dashed/fog styling because they are future observation directions, not evidence.
- Focus actions should move the camera to output terrain nodes instead of expanding a text thread.
- Generated cartographer terrain uses existing generated / agent-inferred / weak / fog node states and must never look source-backed.
- Retry and rerun buttons belong inside compact job rows. They should feel like lifecycle controls, not primary product calls to action.
- Layer-cartographer outputs should look like adjacent orientation terrain: weak route cards, generated question nodes, and dashed fog regions. They should never look like confirmed source results.
- Question-generator outputs should look like explorable prompts on the map, not answer cards.
- Learning-path outputs should read as connected terrain steps, not a checklist that replaces exploration.
- Seedable cartographer outputs may expose "Create new seed from this" in the inspector. The action should feel like opening a new exploration universe, not accepting an answer.

## Deep Zoom Text Grains

- Deep zoom keeps the dark observatory tone while making language grains visually distinct.
- Paragraphs render as wider text blocks with readable summaries.
- Sentences render as compact rows.
- Phrase and word nodes render as restrained chips.
- Character nodes render as square glyph tiles.
- Unicode / dictionary nodes render as compact reference cards.
- Seedable grains may expose "Create new seed from this" in the inspector, but the command must create an independent exploration tab with backlink context.
- Mock text grains must remain marked generated, inferred, weak, or mock-only; do not style them as source-backed evidence.
- Ghost context nodes are muted, dashed, and non-primary. They should help orientation without competing with current-layer terrain.
- The deep zoom mini-map is a compact layer indicator. It should not resemble a search result list, outline tree, or browser navigation.

## Current Scope

This guide covers the closed P0/P1 shell, the closed P2 local source-backed exploration loop, the P3.1-P3.7 structured mock cartographer job boundary and lifecycle, the mock Deep Zoom Spine, and the P4 preflight Macro Bubble Gallery design contract. It does not introduce a UI framework, animation system implementation, real graph layout, real AI calls, Playwright retrieval, browser behavior, real webpage rendering, source-backed AI summaries, durable source-cache indexing, real external job cancellation, cost accounting, or real Markdown export.

## P4.5 Direct URL Scout Styling

Direct URL Scout actions are command routes, not browser chrome.

- `Scout direct URL` may appear in the command card only for HTTP(S) URL input.
- Disabled Scout actions should look unavailable, not like search suggestions.
- Playwright observations in the inspector should use the same compact Scout observation styling as mock observations, with adapter labels.

## P4.7 Source-Anchored Frontier Styling

`Scout linked frontier` is a source-evidence action, not a browser link list.

- Show it only for source-backed nodes with a URL.
- The action should feel like moving the telescope outward from a confirmed source.
- Candidate outlinks should appear as Scout stars around the source node, not as a ranked panel.
- Failed or low-confidence outlink observations must remain visually unresolved.
- Confirmed conversion is the only path from candidate star to source-backed terrain.
- Source-backed styling is reserved for observations after explicit conversion.
- Do not show keyword web search results or browser navigation controls as part of this action.

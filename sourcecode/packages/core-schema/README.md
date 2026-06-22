# Core Schema

This package will hold SeekStar's shared semantic contracts.

It should be the first implementation package because every layer depends on stable data shapes:

- Electron host persists workspaces and tabs.
- Renderer consumes scene-ready nodes, relations, layers, fog regions, and selections.
- Scout stores source observations without deciding meaning.
- Cartographer returns validated structured terrain.
- Local search maps matches back to layers and camera targets.
- Markdown export preserves provenance.

## Initial Types

- `Workspace`
- `ExplorationTab`
- `Node`
- `Relation`
- `Layer`
- `Constellation`
- `FogRegion`
- `Source`
- `CameraState`
- `Selection`
- `Annotation`
- `AgentRun`
- `SearchMatch`
- `MarkdownExport`

## Rules

- Factual nodes require source provenance when available.
- Generated or inferred nodes must carry explicit `source_state`.
- Fog regions are not facts.
- Layers are semantic depth levels, not raw zoom values.
- Tabs keep independent history and may carry backlinks.

No runtime implementation belongs here until the first schema decision is approved.

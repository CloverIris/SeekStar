# 003: Local Persistence

Status: Proposed spike
Date: 2026-06-22
Subsystem: Workspace store and source cache

## Problem

SeekStar must persist workspaces, tabs, nodes, relations, layers, camera positions, backlinks, source snapshots, annotations, local indexes, AI outputs, exports, and trails. Everything visible on the canvas should be reconstructable from stored structured data.

## Product Constraints

- User-created notes remain separate from fetched web data.
- Source provenance must survive reloads and exports.
- Generated and inferred items must remain distinguishable from source-backed items.
- Per-tab local search should rebuild or load quickly.
- P0 must work locally without cloud sync.

## Existing Libraries Checked

- SQLite:
  - Official docs: https://www.sqlite.org/docs.html
  - Notes: strong local relational store, mature FTS options, durable single-file persistence.
- Browser storage:
  - Official docs to check during app scaffold: IndexedDB and Origin Private File System references.
  - Notes: convenient for renderer-only prototypes, but less ideal for Electron-owned source caches and export files.
- File-based JSON snapshots:
  - Notes: easy for early fixtures and tests, but risky as the main store once source snapshots and indexes grow.

## Performance Constraints

- Workspace load should restore the most recent tab quickly.
- Tab switching should not require reprocessing all source text.
- Source caches may grow; storage must support incremental updates.

## Interaction Constraints

- Camera state, layer state, and selection history are user-facing orientation data.
- Export and deletion flows need clear local ownership boundaries.
- Scout retrieval failures should be persisted as explicit source states.

## Chosen Approach

Use a repository-owned `workspace-store` abstraction from the start. For the first app scaffold, allow JSON fixture loading so the canvas can develop quickly. For durable P0 persistence, run a SQLite spike and prefer SQLite if it cleanly supports workspace objects plus local FTS metadata.

The store API should expose domain operations, not raw database details:

- load workspace;
- save workspace metadata;
- create, update, close, and rename tabs;
- upsert nodes and relations;
- upsert source snapshots;
- persist camera and layer state;
- persist annotations, selections, agent runs, and exports.

## Rejected Approaches

- Renderer-only localStorage:
  - Too small and too weak for source snapshots, provenance, and structured workspace recovery.
- One large JSON file as the long-term store:
  - Simple but brittle for concurrent jobs, partial updates, search indexes, and corruption recovery.

## Why Not Build From Scratch

Durable local persistence, transactions, and search indexing are not SeekStar's novel layer. A small application-owned store abstraction can keep the product model independent while relying on proven storage primitives.

## Fallback Plan

If SQLite integration slows the initial shell, keep fixtures and JSON snapshots for the first visible prototype, but do not let renderer components depend on the JSON shape directly.

## Open Questions

- Which Electron-safe SQLite package should be used after dependency and native-module research?
- Should source snapshots store extracted text only in P0, or extracted text plus sanitized HTML?

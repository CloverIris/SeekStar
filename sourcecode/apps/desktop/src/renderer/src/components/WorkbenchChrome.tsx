import type { ExplorationTab, LayerId, TerrainScene } from "@seekstar/core-schema";
import type { PersistenceStatus } from "../exploration/types";
import type { ChangeEvent, KeyboardEvent, ReactElement, RefObject } from "react";
import { formatPersistenceStatus } from "../exploration/types";
import { CommandActionCard } from "./CommandActionCard";
import { SidebarToggleButton } from "./SidebarToggleButton";

export function WorkbenchHeader({
  activeTab,
  breadcrumb,
  jobState,
  layer,
  layerLabel,
  layers,
  onLayerSelect,
  onToggleRightSidebar,
  rightSidebarExpanded,
}: {
  activeTab: ExplorationTab;
  breadcrumb: string[];
  jobState: string;
  layer: LayerId;
  layerLabel: string;
  layers: TerrainScene["layers"];
  onLayerSelect: (layer: LayerId) => void;
  onToggleRightSidebar: () => void;
  rightSidebarExpanded: boolean;
}): ReactElement {
  const breadcrumbItems = breadcrumb.map((label, index) => ({
    label,
    layer: index > 0 ? layers[index - 1]?.id : undefined,
  }));

  return (
    <header className="workbench-header">
      <div className="workbench-context">
        <span className="workbench-context-label">{activeTab.seed}</span>
        <span className="workbench-context-meta">
          {layer} - {layerLabel}
        </span>
        <div className="workbench-breadcrumb" aria-label="Semantic breadcrumb">
          {breadcrumbItems.map((item, index) => {
            const itemLayer = item.layer;

            return (
              <span key={`${item.label}-${index}`}>
                {itemLayer ? (
                  <button onClick={() => onLayerSelect(itemLayer)} type="button">
                    {item.label}
                  </button>
                ) : (
                  item.label
                )}
              </span>
            );
          })}
        </div>
      </div>
      <div className="workbench-header-actions">
        <span className="workbench-job">{jobState}</span>
        <SidebarToggleButton
          expanded={rightSidebarExpanded}
          label="Inspector"
          onClick={onToggleRightSidebar}
          side="right"
        />
      </div>
    </header>
  );
}

export function CommandComposer({
  commandKind,
  commandInputRef,
  commandValue,
  isCommandModalOpen,
  onAddToCurrentPage,
  onCommandChange,
  onCommandFocus,
  onCommandKeyDown,
  onSearchCurrentTab,
  onUseAsSeed,
}: {
  commandKind: "keyword" | "url";
  commandInputRef: RefObject<HTMLInputElement | null>;
  commandValue: string;
  isCommandModalOpen: boolean;
  onAddToCurrentPage: () => void;
  onCommandChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onCommandFocus: () => void;
  onCommandKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSearchCurrentTab: () => void;
  onUseAsSeed: () => void;
}): ReactElement {
  return (
    <div className="command-composer">
      <div className="command-composer-inner">
        {isCommandModalOpen ? (
          <CommandActionCard
            kind={commandKind}
            value={commandValue.trim()}
            onAddToCurrentPage={onAddToCurrentPage}
            onSearchCurrentTab={onSearchCurrentTab}
            onUseAsSeed={onUseAsSeed}
          />
        ) : null}
        <label className="command-bar" aria-label="Command input">
          <button aria-label="Add context" className="command-bar-addon" type="button">
            +
          </button>
          <input
            onChange={onCommandChange}
            onFocus={onCommandFocus}
            onKeyDown={onCommandKeyDown}
            ref={commandInputRef}
            type="text"
            value={commandValue}
            placeholder="Add a keyword, start a new Seek, or search this map"
          />
          <button
            aria-label="Submit"
            className="command-bar-submit"
            disabled={!commandValue.trim()}
            onClick={onCommandFocus}
            type="button"
          >
            {"->"}
          </button>
        </label>
      </div>
    </div>
  );
}

export function SelectionActionCard({
  nodeCount,
  onDismiss,
  onSaveSelection,
  onUseAsSeed,
}: {
  nodeCount: number;
  onDismiss: () => void;
  onSaveSelection: () => void;
  onUseAsSeed: () => void;
}): ReactElement {
  return (
    <aside className="selection-action-card" aria-label="Selection actions">
      <div className="selection-action-card-header">
        <span>{nodeCount} selected</span>
        <button aria-label="Dismiss selection actions" onClick={onDismiss} type="button">
          x
        </button>
      </div>
      <div className="selection-action-card-actions">
        <button onClick={onSaveSelection} type="button">
          Save to tray
        </button>
        <button className="selection-action-wide" onClick={onUseAsSeed} type="button">
          Use region as new seed
        </button>
      </div>
    </aside>
  );
}

export function StatusStrip({
  layer,
  layerLabel,
  nodeCount,
  persistenceStatus,
  selectedCount,
  sourceCount,
  visibleNodeCount,
  jobState,
}: {
  layer: LayerId;
  layerLabel: string;
  nodeCount: number;
  persistenceStatus: PersistenceStatus;
  selectedCount: number;
  sourceCount: number;
  visibleNodeCount: number;
  jobState: string;
}): ReactElement {
  return (
    <footer className="status-strip">
      <span>
        {layer} - {layerLabel}
      </span>
      <span>
        {visibleNodeCount}/{nodeCount} nodes
      </span>
      <span>{selectedCount} selected</span>
      <span>{sourceCount} sources</span>
      <span>{formatPersistenceStatus(persistenceStatus)}</span>
      <span>{jobState}</span>
    </footer>
  );
}

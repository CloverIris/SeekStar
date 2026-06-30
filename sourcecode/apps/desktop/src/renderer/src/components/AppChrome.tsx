import type { ExplorationTab, TabRecord } from "@seekstar/core-schema";
import type { CSSProperties, PointerEvent, ReactElement, RefObject } from "react";
import { useState } from "react";
import { ArrowLeft, ArrowRight, PanelLeftOpen, X } from "lucide-react";
import { goBack, goForward } from "../platform/windowApi";
import { SidebarToggleButton } from "./SidebarToggleButton";
import { TitleBarMenus, type AppMenuId } from "./TitleBarMenus";

export type SidebarRailMode = "collapsed" | "compact" | "expanded";

export function ShellDockWorkbench({
  activeRuntimeTab,
  dockHostRef,
}: {
  activeRuntimeTab?: TabRecord;
  dockHostRef: RefObject<HTMLElement | null>;
}): ReactElement {
  return (
    <section className="main-workbench shell-dock-workbench" aria-label="Docked telescope tab host">
      <div className="shell-dock-toolbar">
        <div>
          <span>Active telescope tab</span>
          <strong>{activeRuntimeTab?.title ?? "Loading tab runtime"}</strong>
        </div>
      </div>
      <section className="tab-dock-host" ref={dockHostRef}>
        <div className="tab-dock-placeholder" aria-hidden="true">
          <strong>{activeRuntimeTab?.runtime_status === "crashed" ? "Tab crashed" : "Docking telescope runtime"}</strong>
          <span>
            {activeRuntimeTab?.runtime_status === "crashed"
              ? "Use the tab row actions to copy the crash log or refresh the tab."
              : "The active tab is hosted in its own Electron WebContentsView."}
          </span>
        </div>
      </section>
    </section>
  );
}

export function SidebarRail({
  children,
  label,
  mode,
  onResizePointerDown,
  side,
  style,
}: {
  children: ReactElement;
  label: string;
  mode: SidebarRailMode;
  onResizePointerDown?: (event: PointerEvent<HTMLElement>) => void;
  side: "left" | "right";
  style?: CSSProperties;
}): ReactElement {
  const railClass = [
    "sidebar-rail",
    `sidebar-rail-${side}`,
    `sidebar-rail-${mode}`,
    mode === "collapsed" ? "collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside aria-label={label} className={railClass} style={style}>
      {side === "right" && onResizePointerDown ? (
        <button
          aria-label="Resize AI Map Control"
          className="sidebar-resize-handle"
          onPointerDown={onResizePointerDown}
          title="Resize AI Map Control"
          type="button"
        />
      ) : null}
      <div className="sidebar-rail-inner">{children}</div>
    </aside>
  );
}

export function DetachedTabTitleBar({
  activeTab,
  onAttach,
  onClose,
  onToggleRightSidebar,
  rightSidebarExpanded,
}: {
  activeTab: ExplorationTab;
  onAttach: () => void;
  onClose: () => void;
  onToggleRightSidebar: () => void;
  rightSidebarExpanded: boolean;
}): ReactElement {
  return (
    <header className="detached-tab-titlebar">
      <div className="detached-tab-title">
        <span>SeekStar tab</span>
        <strong>{activeTab.title}</strong>
      </div>
      <div className="detached-tab-actions">
        <button aria-label="Attach tab to main window" onClick={onAttach} title="Attach to main window" type="button">
          <PanelLeftOpen aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
        <SidebarToggleButton
          expanded={rightSidebarExpanded}
          label="AI Map Control"
          onClick={onToggleRightSidebar}
          side="right"
        />
        <button aria-label="Close tab" onClick={onClose} title="Close tab" type="button">
          <X aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}

export function WindowTitleBar({
  leftSidebarExpanded,
  onToggleLeftSidebar,
}: {
  leftSidebarExpanded: boolean;
  onToggleLeftSidebar: () => void;
}): ReactElement {
  const [openMenuId, setOpenMenuId] = useState<AppMenuId | null>(null);

  function handleToggleMenu(menuId: AppMenuId): void {
    setOpenMenuId((current) => (current === menuId ? null : menuId));
  }

  return (
    <header className="window-titlebar">
      <div className="window-nav">
        <SidebarToggleButton
          expanded={leftSidebarExpanded}
          label="Observatory"
          onClick={onToggleLeftSidebar}
          side="left"
        />
        <button aria-label="Back" onClick={goBack} type="button">
          <ArrowLeft aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
        <button aria-label="Forward" onClick={goForward} type="button">
          <ArrowRight aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
      </div>
      <TitleBarMenus openMenuId={openMenuId} onClose={() => setOpenMenuId(null)} onToggle={handleToggleMenu} />
      <p className="window-titlebar-brand" aria-label="SeekStar AI Explorer lens">
        <span className="window-titlebar-brand-name">SeekStar</span>
        <span className="window-titlebar-brand-lens">AI Explorer lens</span>
      </p>
      <div aria-hidden="true" className="window-drag-region" />
    </header>
  );
}

import type { ReactElement } from "react";
import { SidebarPanelIcon } from "./SidebarPanelIcon";

interface SidebarToggleButtonProps {
  expanded: boolean;
  label: string;
  onClick: () => void;
  side: "left" | "right";
}

export function SidebarToggleButton({ expanded, label, onClick, side }: SidebarToggleButtonProps): ReactElement {
  return (
    <button
      aria-expanded={expanded}
      aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
      className={`sidebar-toggle-btn sidebar-toggle-btn-${side}${expanded ? " is-expanded" : ""}`}
      onClick={onClick}
      type="button"
    >
      <SidebarPanelIcon side={side} />
    </button>
  );
}

import type { ReactElement } from "react";

interface SidebarPanelIconProps {
  side: "left" | "right";
}

export function SidebarPanelIcon({ side }: SidebarPanelIconProps): ReactElement {
  const dividerX = side === "left" ? 5.5 : 10.5;

  return (
    <svg aria-hidden="true" className="sidebar-panel-icon" fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <rect height="10" rx="1.75" stroke="currentColor" strokeWidth="1.25" width="12" x="2" y="3" />
      <path d={`M${dividerX} 3.625v8.75`} stroke="currentColor" strokeLinecap="round" strokeWidth="1.25" />
    </svg>
  );
}

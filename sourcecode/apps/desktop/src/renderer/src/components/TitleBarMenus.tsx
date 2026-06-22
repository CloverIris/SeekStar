import type { ReactElement } from "react";
import { useEffect, useRef } from "react";
import { executeWindowAction } from "../platform/windowApi";
import type { WindowAction } from "../seekstar";

export type AppMenuId = "file" | "edit" | "view" | "help";

type MenuEntry = { type: "separator" } | { label: string; action: WindowAction; hint?: string };

function isMenuSeparator(entry: MenuEntry): entry is { type: "separator" } {
  return "type" in entry && entry.type === "separator";
}

const MENU_ENTRIES: Record<AppMenuId, MenuEntry[]> = {
  file: [
    { label: "Reload", action: "reload", hint: "Ctrl+R" },
    { label: "Force Reload", action: "force-reload", hint: "Ctrl+Shift+R" },
    { type: "separator" },
    { label: "Quit", action: "quit", hint: "Ctrl+Q" },
  ],
  edit: [
    { label: "Undo", action: "undo", hint: "Ctrl+Z" },
    { label: "Redo", action: "redo", hint: "Ctrl+Y" },
    { type: "separator" },
    { label: "Cut", action: "cut", hint: "Ctrl+X" },
    { label: "Copy", action: "copy", hint: "Ctrl+C" },
    { label: "Paste", action: "paste", hint: "Ctrl+V" },
    { label: "Select All", action: "select-all", hint: "Ctrl+A" },
  ],
  view: [
    { label: "Toggle DevTools", action: "toggle-devtools", hint: "F12" },
    { label: "Reload", action: "reload", hint: "Ctrl+R" },
    { type: "separator" },
    { label: "Zoom In", action: "zoom-in", hint: "Ctrl+=" },
    { label: "Zoom Out", action: "zoom-out", hint: "Ctrl+-" },
    { label: "Reset Zoom", action: "zoom-reset", hint: "Ctrl+0" },
    { type: "separator" },
    { label: "Toggle Full Screen", action: "toggle-fullscreen", hint: "F11" },
  ],
  help: [
    { label: "Toggle DevTools", action: "toggle-devtools" },
    { type: "separator" },
    { label: "About SeekStar", action: "about" },
  ],
};

interface TitleBarMenusProps {
  openMenuId: AppMenuId | null;
  onClose: () => void;
  onToggle: (menuId: AppMenuId) => void;
}

export function TitleBarMenus({ openMenuId, onClose, onToggle }: TitleBarMenusProps): ReactElement {
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (menuRef.current?.contains(target)) {
        return;
      }

      onClose();
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, openMenuId]);

  return (
    <nav ref={menuRef} aria-label="Application menu" className="window-menu">
      {(["file", "edit", "view", "help"] as const).map((menuId) => (
        <div className="window-menu-item" key={menuId}>
          <button
            aria-expanded={openMenuId === menuId}
            aria-haspopup="menu"
            className={openMenuId === menuId ? "active" : undefined}
            onClick={() => onToggle(menuId)}
            type="button"
          >
            {menuId.charAt(0).toUpperCase() + menuId.slice(1)}
          </button>
          {openMenuId === menuId ? (
            <div className="titlebar-menu-dropdown" role="menu">
              {MENU_ENTRIES[menuId].map((entry, index) => {
                if (isMenuSeparator(entry)) {
                  return <div className="titlebar-menu-separator" key={`${menuId}-sep-${index}`} role="separator" />;
                }

                return (
                  <button
                    className="titlebar-menu-action"
                    key={entry.action}
                    onClick={() => {
                      executeWindowAction(entry.action);
                      onClose();
                    }}
                    role="menuitem"
                    type="button"
                  >
                    <span>{entry.label}</span>
                    {entry.hint ? <small>{entry.hint}</small> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ))}
    </nav>
  );
}

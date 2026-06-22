import type { WindowAction } from "../seekstar";

export function executeWindowAction(action: WindowAction): void {
  const api = window.seekstar?.window;

  if (!api) {
    console.error("[SeekStar] Window API unavailable. Run inside Electron desktop app.", { action });
    return;
  }

  void api.executeAction(action).catch((error: unknown) => {
    console.error(`[SeekStar] Action failed: ${action}`, error);
  });
}

export function goBack(): void {
  void window.seekstar?.window.goBack();
}

export function goForward(): void {
  void window.seekstar?.window.goForward();
}

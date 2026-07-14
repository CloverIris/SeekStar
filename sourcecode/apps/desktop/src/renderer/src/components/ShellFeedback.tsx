import type { ReactElement } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import type { ExplorationRuntimeStatus } from "../exploration/runtimeUi";
import type { PersistenceStatus } from "../exploration/types";

export interface ShellToast {
  id: string;
  message: string;
  tone: "error" | "info" | "success";
}

export function ShellFeedback({
  runtimeStatus,
  onDismiss,
  persistenceStatus,
  toasts,
}: {
  runtimeStatus: ExplorationRuntimeStatus;
  onDismiss: (id: string) => void;
  persistenceStatus: PersistenceStatus;
  toasts: ShellToast[];
}): ReactElement {
  const isGenerating = runtimeStatus.phase === "generating";
  const hasStorageProblem = persistenceStatus === "error" || persistenceStatus === "unavailable";

  return (
    <aside className="shell-feedback" aria-live="polite" aria-label="Application feedback">
      {isGenerating || hasStorageProblem ? (
        <div className={hasStorageProblem ? "shell-activity is-error" : "shell-activity"}>
          <span className={isGenerating ? "shell-activity-dot is-running" : "shell-activity-dot"} />
          <span>{hasStorageProblem ? "本地工作区需要处理" : runtimeStatus.message}</span>
        </div>
      ) : null}
      <div className="shell-toast-stack">
        {toasts.map((toast) => (
          <div className={`shell-toast tone-${toast.tone}`} key={toast.id}>
            {toast.tone === "success" ? <CheckCircle2 aria-hidden="true" size={15} /> : toast.tone === "error" ? <AlertCircle aria-hidden="true" size={15} /> : <Info aria-hidden="true" size={15} />}
            <span>{toast.message}</span>
            <button aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)} type="button"><X aria-hidden="true" size={14} /></button>
          </div>
        ))}
      </div>
    </aside>
  );
}

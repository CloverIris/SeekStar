import type { ReactElement } from "react";

interface CommandActionCardProps {
  value: string;
  onAddToCurrentPage: () => void;
  onUseAsSeed: () => void;
  onSearchCurrentTab: () => void;
}

export function CommandActionCard({
  value,
  onAddToCurrentPage,
  onUseAsSeed,
  onSearchCurrentTab,
}: CommandActionCardProps): ReactElement {
  return (
    <section className="command-card" aria-label="Command actions">
      <div className="command-card-label">{value}</div>
      <button className="command-action primary" type="button" onMouseDown={(event) => event.preventDefault()} onClick={onAddToCurrentPage}>
        <span>Add to current Seek</span>
        <small>Rename this tab and start the exploration flow</small>
      </button>
      <button className="command-action" type="button" onMouseDown={(event) => event.preventDefault()} onClick={onUseAsSeed}>
        <span>Use as new Seek</span>
        <small>Create an independent telescope tab</small>
      </button>
      <button
        className="command-action"
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onSearchCurrentTab}
      >
        <span>Search within current tab</span>
        <small>Highlight matching nodes in this scene</small>
      </button>
    </section>
  );
}

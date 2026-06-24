import type { ReactElement } from "react";

interface CommandActionCardProps {
  value: string;
  canScoutDirectUrl: boolean;
  onScoutDirectUrl: () => void;
  onUseAsSeed: () => void;
  onSearchCurrentTab: () => void;
}

export function CommandActionCard({
  canScoutDirectUrl,
  value,
  onScoutDirectUrl,
  onUseAsSeed,
  onSearchCurrentTab,
}: CommandActionCardProps): ReactElement {
  return (
    <section className="command-card" aria-label="Command actions">
      <div className="command-card-label">{value}</div>
      <button className="command-action primary" type="button" onMouseDown={(event) => event.preventDefault()} onClick={onUseAsSeed}>
        <span>Use as new exploration seed</span>
        <small>Create an independent mock terrain tab</small>
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
      <button
        className="command-action scout"
        disabled={!canScoutDirectUrl}
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onScoutDirectUrl}
      >
        <span>Scout direct URL</span>
        <small>Observe one page as structured Scout intake</small>
      </button>
    </section>
  );
}

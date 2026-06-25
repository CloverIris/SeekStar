import type { ReactElement } from "react";

interface CommandActionCardProps {
  kind: "keyword" | "url";
  value: string;
  onAddToCurrentPage: () => void;
  onUseAsSeed: () => void;
  onSearchCurrentTab: () => void;
}

export function CommandActionCard({
  kind,
  value,
  onAddToCurrentPage,
  onUseAsSeed,
  onSearchCurrentTab,
}: CommandActionCardProps): ReactElement {
  const isUrl = kind === "url";

  return (
    <section className="command-card" aria-label="Command actions">
      <div className="command-card-label">{value}</div>
      <button className="command-action primary" type="button" onMouseDown={(event) => event.preventDefault()} onClick={onAddToCurrentPage}>
        <span>{isUrl ? "Add URL to current Seek" : "Add to current Seek"}</span>
        <small>
          {isUrl ? "Run Scout and create a source-backed L3 tile" : "Discover candidate sources in this tab"}
        </small>
      </button>
      <button className="command-action" type="button" onMouseDown={(event) => event.preventDefault()} onClick={onUseAsSeed}>
        <span>{isUrl ? "Open URL as new Seek" : "Use as new Seek"}</span>
        <small>
          {isUrl ? "Create a new tab and ingest this source" : "Create a tab and discover candidate sources"}
        </small>
      </button>
      <button
        className="command-action"
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onSearchCurrentTab}
      >
        <span>{isUrl ? "Search URL text in current tab" : "Search within current tab"}</span>
        <small>Highlight matching nodes in this scene</small>
      </button>
    </section>
  );
}

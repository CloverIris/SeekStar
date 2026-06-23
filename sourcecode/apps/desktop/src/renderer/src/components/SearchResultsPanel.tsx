import type { ReactElement } from "react";
import type { SearchResult } from "../search/localSceneSearch";

interface SearchResultsPanelProps {
  query: string;
  results: SearchResult[];
  onResultSelect: (nodeId: string) => void;
}

export function SearchResultsPanel({ query, results, onResultSelect }: SearchResultsPanelProps): ReactElement | null {
  if (!query) {
    return null;
  }

  return (
    <section className="inspect-section search-panel">
      <h2>Local search</h2>
      <p className="search-summary">
        {results.length > 0 ? `${results.length} matches for "${query}"` : `No matches for "${query}"`}
      </p>
      {results.length > 0 ? (
        <div className="search-results">
          {results.map((result) => (
            <button className="search-result" key={result.nodeId} type="button" onClick={() => onResultSelect(result.nodeId)}>
              <span>
                {result.nodeType.replace(/_/g, " ")} · {result.layer} · {result.matchType.replace(/_/g, " ")}
              </span>
              <strong>{result.title}</strong>
              <small>{result.snippet}</small>
              <em>
                {result.sourceState.replace(/_/g, " ")}
                {result.sourceTitle ? ` · ${result.sourceTitle}` : ""}
              </em>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-result">Try a terrain title, tag, source title, quote, or pasted source excerpt.</div>
      )}
    </section>
  );
}

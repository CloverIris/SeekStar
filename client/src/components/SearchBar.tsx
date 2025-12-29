import React from 'react';

interface SearchBarProps {
  query: string;
  isLoading: boolean;
  error: string | null;
  onQueryChange: (query: string) => void;
  onSearch: (e: React.FormEvent) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  isLoading,
  error,
  onQueryChange,
  onSearch
}) => {
  return (
    <form onSubmit={onSearch} className="search-form">
      <input
        type="text"
        placeholder="搜索关键词..."
        value={query || ''}
        onChange={(e) => onQueryChange(e?.target?.value || '')}
        className="search-input"
        disabled={isLoading}
      />
      <button type="submit" className="search-button" disabled={isLoading}>
        {isLoading ? '搜索中...' : '搜索'}
      </button>
      {error && <div className="error-message">{error}</div>}
    </form>
  );
};

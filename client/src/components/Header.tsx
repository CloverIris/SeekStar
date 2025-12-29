import React from 'react';
import { SearchBar } from './SearchBar';

interface HeaderProps {
  query: string;
  isLoading: boolean;
  error: string | null;
  onQueryChange: (query: string) => void;
  onSearch: (e: React.FormEvent) => void;
}

export const Header: React.FC<HeaderProps> = ({
  query,
  isLoading,
  error,
  onQueryChange,
  onSearch
}) => {
  return (
    <header className="header">
      <div className="header-title-container">
        <h1>SeekStar 互联网探索引擎</h1>
        <h2 className="header-subtitle">互联网本是星空</h2>
      </div>
      <SearchBar
        query={query}
        isLoading={isLoading}
        error={error}
        onQueryChange={onQueryChange}
        onSearch={onSearch}
      />
    </header>
  );
};

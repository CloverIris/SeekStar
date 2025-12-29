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
      <h1>SeekStar - 3D 星图搜索引擎</h1>
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

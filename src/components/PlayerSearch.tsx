import React, { useState, useEffect, useCallback } from 'react';
import { Search, User, Gamepad2, Loader2 } from 'lucide-react';
import { superviveApi, PlayerSearchResult } from '../services/superviveApi';

interface PlayerSearchProps {
  onPlayerSelect: (player: PlayerSearchResult) => void;
}

const PlayerSearch: React.FC<PlayerSearchProps> = ({ onPlayerSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPlayers = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const searchResults = await superviveApi.searchPlayers(searchQuery);
      setResults(searchResults);
      setShowResults(true);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search players. Please try again.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchPlayers(query);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query, searchPlayers]);

  const handlePlayerClick = (player: PlayerSearchResult) => {
    onPlayerSelect(player);
    setQuery(player.displayName);
    setShowResults(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (!e.target.value.trim()) {
      setShowResults(false);
    }
  };

  const handleInputFocus = () => {
    if (results.length > 0) {
      setShowResults(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding results to allow click events to fire
    setTimeout(() => setShowResults(false), 200);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder="Search for a Supervive player..."
          className="block w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-supervive-500 focus:border-supervive-500 transition-all duration-200"
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <Loader2 className="h-5 w-5 text-supervive-500 animate-spin" />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 p-3 bg-red-900 border border-red-700 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-80 overflow-y-auto">
          {results.map((player) => (
            <button
              key={`${player.platform}-${player.userId}`}
              onClick={() => handlePlayerClick(player)}
              className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors duration-150 border-b border-slate-600 last:border-b-0"
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <User className="h-5 w-5 text-supervive-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {player.displayName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {player.platform} • {player.uniqueDisplayName}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <Gamepad2 className="h-4 w-4 text-slate-500" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && query.length >= 2 && results.length === 0 && !isLoading && !error && (
        <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-4 text-center">
          <p className="text-slate-400 text-sm">No players found matching "{query}"</p>
        </div>
      )}
    </div>
  );
};

export default PlayerSearch;
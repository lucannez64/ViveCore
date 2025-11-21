import React, { useState } from 'react';
import { Search, User, Trophy, Zap } from 'lucide-react';
import PlayerSearch from './components/PlayerSearch';
import PlayerProfile from './components/PlayerProfile';
import MatchHistory from './components/MatchHistory';
import { PlayerSearchResult, MatchData } from './services/superviveApi';
import { SuperviveApiService } from './services/superviveApi';

function App() {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);
  const [playerMatches, setPlayerMatches] = useState<MatchData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiService = new SuperviveApiService();

  const handlePlayerSelect = async (player: PlayerSearchResult) => {
    setSelectedPlayer(player);
    setIsLoading(true);
    setError(null);

    try {
      // Fetch new matches first to ensure results are up-to-date
      try {
        await apiService.fetchNewPlayerMatches(player.platform, player.userId);
      } catch (fetchErr) {
        console.warn('Fetch new matches failed, proceeding to load existing:', fetchErr);
      }

      const matchesResponse = await apiService.getPlayerMatches(player.platform, player.userId);
      setPlayerMatches(matchesResponse.data);
    } catch (err) {
      setError('Failed to load player matches. Please try again.');
      console.error('Error loading matches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshMatches = async () => {
    if (!selectedPlayer) return;
    
    setIsLoading(true);
    setError(null);

    try {
      await apiService.fetchNewPlayerMatches(selectedPlayer.platform, selectedPlayer.userId);
      const matchesResponse = await apiService.getPlayerMatches(selectedPlayer.platform, selectedPlayer.userId);
      setPlayerMatches(matchesResponse.data);
    } catch (err) {
      setError('Failed to refresh matches. Please try again.');
      console.error('Error refreshing matches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-supervive-500 to-supervive-700 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">Supervive Stats</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <PlayerSearch onPlayerSelect={handlePlayerSelect} />
              {selectedPlayer && (
                <button
                  onClick={handleRefreshMatches}
                  disabled={isLoading}
                  className="px-4 py-2 bg-supervive-600 hover:bg-supervive-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                  <Search className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!selectedPlayer ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gradient-to-br from-supervive-500 to-supervive-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trophy className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Welcome to Supervive Stats</h2>
            <p className="text-slate-400 text-lg mb-8 max-w-2xl mx-auto">
              Search for Supervive players to view their profiles, match history, and detailed statistics. 
              Get insights into MMR, recent matches, hero performance, and more.
            </p>
            <div className="bg-slate-800 rounded-lg p-6 max-w-md mx-auto">
              <h3 className="text-white font-semibold mb-4 flex items-center space-x-2">
                <Search className="w-5 h-5 text-supervive-500" />
                <span>How to get started:</span>
              </h3>
              <ol className="text-left text-slate-300 space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="text-supervive-500 font-bold">1.</span>
                  <span>Use the search bar above to find a player</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-supervive-500 font-bold">2.</span>
                  <span>Select a player from the search results</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-supervive-500 font-bold">3.</span>
                  <span>View detailed stats and match history</span>
                </li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            
            <PlayerProfile 
              player={selectedPlayer} 
              matches={playerMatches} 
              isLoading={isLoading} 
            />
            
            <MatchHistory 
              matches={playerMatches} 
              isLoading={isLoading} 
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 border-t border-slate-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-slate-400">
            <p className="mb-2">Supervive Stats - Unofficial player statistics and match history</p>
            <p className="text-sm">
              Data provided by Theorycraft Games • Not affiliated with Supervive
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

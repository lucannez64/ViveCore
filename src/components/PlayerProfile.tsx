import React, { useState, useEffect } from 'react';
import { User, Trophy, Target, Heart, Shield, Zap } from 'lucide-react';
import { PlayerSearchResult, MatchData, superviveApi, MmrRating } from '../services/superviveApi';
import { getHeroInfo, calculateKDA, formatDuration } from '../utils/heroData';

interface PlayerProfileProps {
  player: PlayerSearchResult;
  matches: MatchData[];
  isLoading: boolean;
}

const PlayerProfile: React.FC<PlayerProfileProps> = ({ player, matches, isLoading }) => {
  const [stats, setStats] = useState({
    totalMatches: 0,
    avgPlacement: 0,
    wins: 0,
    top3: 0,
    avgKills: 0,
    avgDeaths: 0,
    avgAssists: 0,
    avgKDA: 0,
    avgSurvivalTime: 0,
  });

  const [mmr, setMmr] = useState<MmrRating | null>(null);
  const [mmrError, setMmrError] = useState<string | null>(null);

  useEffect(() => {
    if (matches.length === 0) return;

    const rankedMatches = matches.filter(match => match.is_ranked);
    const totalMatches = rankedMatches.length;
    
    if (totalMatches === 0) return;

    const placements = rankedMatches.map(m => m.placement);
    const wins = placements.filter(p => p === 1).length;
    const top3 = placements.filter(p => p <= 3).length;
    
    const kills = rankedMatches.map(m => m.stats.Kills || 0);
    const deaths = rankedMatches.map(m => m.stats.Deaths || 0);
    const assists = rankedMatches.map(m => m.stats.Assists || 0);
    const survivalTimes = rankedMatches.map(m => m.survival_duration);

    const avgKills = kills.reduce((a, b) => a + b, 0) / totalMatches;
    const avgDeaths = deaths.reduce((a, b) => a + b, 0) / totalMatches;
    const avgAssists = assists.reduce((a, b) => a + b, 0) / totalMatches;
    const avgKDA = deaths.some(d => d > 0) ? 
      (kills.reduce((a, b) => a + b, 0) + assists.reduce((a, b) => a + b, 0)) / 
      deaths.reduce((a, b) => a + b, 0) : Infinity;
    const avgSurvivalTime = survivalTimes.reduce((a, b) => a + b, 0) / totalMatches;

    setStats({
      totalMatches,
      avgPlacement: placements.reduce((a, b) => a + b, 0) / totalMatches,
      wins,
      top3,
      avgKills,
      avgDeaths,
      avgAssists,
      avgKDA: isFinite(avgKDA) ? avgKDA : avgKills,
      avgSurvivalTime,
    });
  }, [matches]);

  // Load MMR live via OAuth/MMR (from 102.txt), fallback to local mmr.json
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const live = await superviveApi.getLiveMmrFromTraceFile();
        if (!mounted) return;
        if (live) {
          setMmr(live);
          setMmrError(null);
          return;
        }
        // Fallback to local
        const local = await superviveApi.getLocalMmr();
        if (!mounted) return;
        if (local) setMmr(local);
        else setMmrError('MMR not available');
      } catch (e: any) {
        if (!mounted) return;
        setMmrError(e?.message || 'Failed to load MMR');
      }
    })();
    return () => { mounted = false; };
  }, [player?.userId]);

  if (isLoading) {
    return (
      <div className="card p-8">
        <div className="flex items-center justify-center">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  const winRate = stats.totalMatches > 0 ? (stats.wins / stats.totalMatches) * 100 : 0;
  const top3Rate = stats.totalMatches > 0 ? (stats.top3 / stats.totalMatches) * 100 : 0;

  return (
    <div className="card p-6 mb-6">
      <div className="flex items-center space-x-4 mb-6">
        <div className="flex-shrink-0">
          <div className="w-16 h-16 bg-gradient-to-br from-supervive-500 to-supervive-700 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white truncate">
            {player.displayName}
          </h1>
          <p className="text-slate-400">
            {player.platform} • {player.uniqueDisplayName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-slate-700 rounded-lg p-4 text-center">
          <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-white">{stats.wins}</div>
          <div className="text-sm text-slate-400">Wins</div>
          <div className="text-xs text-yellow-500">{winRate.toFixed(1)}% WR</div>
        </div>
        
        <div className="bg-slate-700 rounded-lg p-4 text-center">
          <div className="w-6 h-6 text-amber-500 mx-auto mb-2">🥉</div>
          <div className="text-2xl font-bold text-white">{stats.top3}</div>
          <div className="text-sm text-slate-400">Top 3</div>
          <div className="text-xs text-amber-500">{top3Rate.toFixed(1)}%</div>
        </div>
        
        <div className="bg-slate-700 rounded-lg p-4 text-center">
          <Target className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-white">{stats.avgKills.toFixed(1)}</div>
          <div className="text-sm text-slate-400">Avg Kills</div>
          <div className="text-xs text-red-500">{stats.avgDeaths.toFixed(1)} D</div>
        </div>
        
        <div className="bg-slate-700 rounded-lg p-4 text-center">
          <div className="w-6 h-6 text-supervive-500 mx-auto mb-2">⚡</div>
          <div className="text-2xl font-bold text-white">
            {isFinite(stats.avgKDA) ? stats.avgKDA.toFixed(2) : 'Perfect'}
          </div>
          <div className="text-sm text-slate-400">KDA</div>
          <div className="text-xs text-supervive-500">{stats.avgAssists.toFixed(1)} A</div>
        </div>

        {/* MMR Card */}
        <div className="bg-slate-700 rounded-lg p-4 text-center">
          <Zap className="w-6 h-6 text-supervive-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-white">
            {mmr ? mmr.Rating : '—'}
          </div>
          <div className="text-sm text-slate-400">MMR</div>
          <div className={`text-xs ${mmr ? 'text-supervive-500' : 'text-slate-500'}`}>
            {mmr ? mmr.Rank : (mmrError || 'Unavailable')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-slate-300">Performance</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Avg Placement:</span>
              <span className="text-white font-medium">#{stats.avgPlacement.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Matches:</span>
              <span className="text-white font-medium">{stats.totalMatches}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-700 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Heart className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-slate-300">Survivability</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Avg Survival:</span>
              <span className="text-white font-medium">{formatDuration(stats.avgSurvivalTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Survival Rate:</span>
              <span className="text-white font-medium">
                {((stats.avgSurvivalTime / 1200) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-700 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Shield className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-slate-300">Combat</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Kill Participation:</span>
              <span className="text-white font-medium">
                {((stats.avgKills + stats.avgAssists) / Math.max(stats.avgKills + stats.avgDeaths + stats.avgAssists, 1) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Combat Score:</span>
              <span className="text-white font-medium">
                {((stats.avgKills * 2 + stats.avgAssists) / Math.max(stats.avgDeaths, 1)).toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Target, Heart, Zap } from 'lucide-react';
import { MatchData } from '../services/superviveApi';
import { getHeroInfo, getHeroImageUrl, formatDuration, formatDate, calculateKDA } from '../utils/heroData';
import MatchDetail from './MatchDetail'

interface MatchHistoryProps {
  matches: MatchData[];
  isLoading: boolean;
}

const MatchCard: React.FC<{ match: MatchData; isExpanded: boolean; onToggle: () => void }> = ({ 
  match, 
  isExpanded, 
  onToggle 
}) => {
  const prettifyHeroName = (assetId: string): string => {
    if (!assetId) return 'Unknown Hero';
    const cleaned = assetId
      .replace(/^.*[/:]/, '')
      .replace(/\.[a-zA-Z0-9]+$/, '')
      .replace(/^(Hero-|hero-|character-|CHARACTER-)/, '')
      .replace(/[_\-]+/g, ' ');
    return cleaned
      .split(' ')
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
      .join(' ');
  };
  const heroAssetId = match.hero?.asset_id || match.hero_asset_id || '';
  const heroInfo = getHeroInfo(heroAssetId);
  const heroName = match.hero?.name || '';
  const heroColor = heroInfo?.color ?? '#666666';
  const heroImageUrl = match.hero?.head_image_url || getHeroImageUrl(heroAssetId);
  const kda = calculateKDA(match.stats.Kills || 0, match.stats.Deaths || 0, match.stats.Assists || 0);
  
  const placementColor = match.placement === 1 ? 'victory' : 
                        match.placement <= 3 ? 'top3' : 
                        match.placement <= 5 ? 'top5' : 'defeat';

  const getPlacementText = (placement: number) => {
    if (placement === 1) return 'Victory';
    if (placement === 2) return '2nd Place';
    if (placement === 3) return '3rd Place';
    return `${placement}th Place`;
  };

  return (
    <div className={`match-card ${placementColor} ${isExpanded ? 'expanded' : ''}`}>
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <img 
                src={heroImageUrl} 
                alt={heroName}
                className="w-12 h-12 rounded-full object-cover border-2 border-slate-600"
                onError={(e) => {
                  e.currentTarget.src = `https://via.placeholder.com/48x48/${heroColor.replace('#', '')}/ffffff?text=${heroName.charAt(0)}`;
                }}
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-xs font-bold">
                {match.character_level}
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="text-white font-semibold">{heroName}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  placementColor === 'victory' ? 'bg-yellow-500 text-black' :
                  placementColor === 'top3' ? 'bg-amber-500 text-black' :
                  placementColor === 'top5' ? 'bg-blue-500 text-white' :
                  'bg-red-500 text-white'
                }`}>
                  #{match.placement} {getPlacementText(match.placement)}
                </span>
              </div>
              <div className="flex items-center space-x-4 text-sm text-slate-400 mt-1">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDuration(match.survival_duration)}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Target className="w-3 h-3" />
                  <span>{match.stats.Kills || 0}/{match.stats.Deaths || 0}/{match.stats.Assists || 0}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="text-supervive-500">KDA</span>
                  <span className="text-white font-medium">{kda}</span>
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="text-right">
              <div className="text-xs text-slate-400">{formatDate(match.created_at)}</div>
              <div className="text-xs text-slate-500">{match.platform?.name}</div>
            </div>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-600">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-slate-700 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Target className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-slate-300">Combat</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Kills:</span>
                  <span className="text-white">{match.stats.Kills || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Deaths:</span>
                  <span className="text-white">{match.stats.Deaths || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Assists:</span>
                  <span className="text-white">{match.stats.Assists || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Knocks:</span>
                  <span className="text-white">{match.stats.Knocks || 0}</span>
                </div>
              </div>
            </div>
    
            <div className="bg-slate-700 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Heart className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-slate-300">Healing</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Given:</span>
                  <span className="text-white">{Math.round(match.stats.HealingGiven || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Self:</span>
                  <span className="text-white">{Math.round(match.stats.HealingGivenSelf || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Received:</span>
                  <span className="text-white">{Math.round(match.stats.HealingReceived || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
    
            <div className="bg-slate-700 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium text-slate-300">Damage</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total:</span>
                  <span className="text-white">{Math.round(match.stats.DamageDone || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hero:</span>
                  <span className="text-white">{Math.round(match.stats.HeroDamageDone || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Taken:</span>
                  <span className="text-white">{Math.round(match.stats.DamageTaken || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
    
            <div className="bg-slate-700 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <span className="w-4 h-4 text-purple-500">💰</span>
                <span className="text-sm font-medium text-slate-300">Economy</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Gold:</span>
                  <span className="text-white">{Math.round((match.stats.GoldFromEnemies || 0) + (match.stats.GoldFromMonsters || 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">From Enemies:</span>
                  <span className="text-white">{Math.round(match.stats.GoldFromEnemies || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">From Monsters:</span>
                  <span className="text-white">{Math.round(match.stats.GoldFromMonsters || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <MatchDetail match={match} highlightTeamId={match.team_id} />
          </div>
        </div>
      )}
    </div>
  );
};

const MatchHistory: React.FC<MatchHistoryProps> = ({ matches, isLoading }) => {
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'ranked' | 'casual'>('all');

  const filteredMatches = matches.filter(match => {
    if (filter === 'all') return true;
    if (filter === 'ranked') return match.is_ranked;
    if (filter === 'casual') return !match.is_ranked;
    return true;
  });

  if (isLoading) {
    return (
      <div className="card p-8">
        <div className="flex items-center justify-center">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (filteredMatches.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="text-slate-400">No matches found</div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Match History</h2>
        <div className="flex space-x-2">
          {(['all', 'ranked', 'casual'] as const).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === filterType
                  ? 'bg-supervive-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredMatches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            isExpanded={expandedMatch === match.id}
            onToggle={() => setExpandedMatch(expandedMatch === match.id ? null : match.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default MatchHistory;
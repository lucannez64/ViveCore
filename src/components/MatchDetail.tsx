import React, { useEffect, useMemo, useState } from 'react';
import { MatchData, superviveApi } from '../services/superviveApi';
import { getHeroInfo } from '../utils/heroData';

interface MatchDetailProps {
  match: MatchData;
  highlightTeamId?: number;
}

function prettifyHeroName(assetId: string): string {
  if (!assetId) return 'Unknown Hero';
  const cleaned = assetId
    .replace(/^.*[/:]/, '') // strip path-like prefixes
    .replace(/\.[a-zA-Z0-9]+$/, '') // strip extensions
    .replace(/^(Hero-|hero-|character-|CHARACTER-)/, '') // common prefixes
    .replace(/[_\-]+/g, ' ');
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(' ');
}

const MatchDetail: React.FC<MatchDetailProps> = ({ match, highlightTeamId }) => {
  const [participants, setParticipants] = useState<MatchData[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const platformName = match.platform?.name?.toLowerCase() || 'steam';
        const matchId = match.match_id || String(match.id);
        console.log('Fetching match details:', { platformName, matchId, originalPlatform: match.platform });
        const details = await superviveApi.getMatch(platformName, matchId);
        if (mounted && Array.isArray(details) && details.length) {
          setParticipants(details);
        } else if (mounted) {
          // Fallback to mock current player only when API returns empty
          setParticipants([match]);
        }
      } catch (err) {
        console.error('Failed to load match detail:', err);
        if (mounted) {
          setParticipants([match]);
        }
      }
    })();
    return () => { mounted = false; };
  }, [match]);

  const teams = useMemo(() => {
    const map = new Map<number, MatchData[]>();
    (participants || []).forEach((p) => {
      if (!map.has(p.team_id)) map.set(p.team_id, []);
      map.get(p.team_id)!.push(p);
    });

    // If we only have the current player, mock 8 teams with placeholders
    if ((participants || []).length === 1) {
      const current = participants![0];
      for (let i = 1; i <= 8; i++) {
        if (!map.has(i)) map.set(i, []);
      }
      // Ensure player's team has the player
      map.get(current.team_id)!.push(current);
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([teamId, members]) => ({ teamId, members }));
  }, [participants]);



  if (!participants) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {teams.map(({ teamId, members }) => {
          const isPlayerTeam = highlightTeamId != null && teamId === highlightTeamId;
          return (
            <div
              key={teamId}
              className={`rounded-lg p-3 border ${isPlayerTeam ? 'border-supervive-500 bg-slate-700/60' : 'border-slate-700 bg-slate-800'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${isPlayerTeam ? 'text-supervive-400' : 'text-slate-300'}`}>
                  Team {teamId}
                  {(() => {
                    const placement = members[0]?.placement;
                    const fmt = (n: number) => {
                      const s = ["th","st","nd","rd"];
                      const v = n % 100;
                      const suffix = s[(v - 20) % 10] || s[v] || s[0];
                      return `${n}${suffix}`;
                    };
                    return typeof placement === 'number' ? (
                      <span className="ml-2 text-[10px] font-normal text-slate-400">• {fmt(placement)}</span>
                    ) : (
                      <span className="ml-2 text-[10px] font-normal text-slate-500">• N/A</span>
                    );
                  })()}
                </span>
                {isPlayerTeam && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-supervive-600 text-white">Your Team</span>
                )}
              </div>
              <div className="space-y-2">
                {members.map((m) => {
                  const assetId = m.hero?.asset_id || m.hero_asset_id || '';
                  const info = getHeroInfo(assetId);
                  const name = (info?.name) || m.hero?.name || prettifyHeroName(assetId);
                  const img = m.hero?.head_image_url || '';
                  const player_name = m.player.unique_display_name || '';
                  const ability_events = m.ability_events;
                  // add a function that use all ability_events to get which one of the 3 main ability outside of the R ability to max first second or third and return it as a string like Q>Shift>RMB
                  const ability_build = (ability_events) => {
                    // find max level of each ability in the ability events and find the position where they get to that level
                    const maxQ = ability_events.filter((e) => e.hotkey == 'Q').reduce((max, e) => Math.max(max, e.level), 0);
                    const maxShift = ability_events.filter((e) => e.hotkey == 'Shift').reduce((max, e) => Math.max(max, e.level), 0);
                    const maxRMB = ability_events.filter((e) => e.hotkey == 'RMB').reduce((max, e) => Math.max(max, e.level), 0);
                    const QPos = ability_events.findIndex((e) => e.hotkey == 'Q' && e.level == maxQ);
                    const ShiftPos = ability_events.findIndex((e) => e.hotkey == 'Shift' && e.level == maxShift);
                    const RMBPos = ability_events.findIndex((e) => e.hotkey == 'RMB' && e.level == maxRMB);

                    // find the order of the abilities
                    const order = [QPos, ShiftPos, RMBPos].sort((a, b) => a - b);
                    return order.map((pos) => {
                      if (pos == QPos) return 'Q';
                      if (pos == ShiftPos) return 'Shift';
                      if (pos == RMBPos) return 'RMB';
                      return '';
                    }).join('>');
                  } 
                  const build = [...m.inventory.Boots.map((item) => item?.identifier || ''), ...m.inventory.Inventory.map((item) => item?.identifier || ''), ...m.inventory.Utility.map((item) => item?.identifier || '')];
                  // make function that convert the identifier to the icon name generalize from these examples
                  // BP_ITEM_Equipment_Weapon_MobiBoots_C -> TX_Item_MobiBoots_Icon
                  // BP_ITEM_Equipment_Weapon_TurboBooster_C -> TX_Item_TurboBooster_Icon
                  // BP_ITEM_Equipment_SetWeapon_BloodlustBoots_Icon -> TX_Item_BloodlustBoots_Icon
                  



                  const buildNames = build.map((item) => {
                    if (item.includes('BP_ITEM_Equipment_SetWeapon_')) {
                      return item.replace('BP_ITEM_Equipment_SetWeapon_', 'TX_Item_').replace('_C', '_Icon');
                    }
                    return item.replace('BP_ITEM_Equipment_Weapon_', 'TX_Item_').replace('_C', '_Icon');
                  });



                  // use https://s-supervive.op.gg/prod/game-static/Loki/UI/Textures/Items/IDENTIFIER.PNG to get the icon of each item
                  const buildIcons = buildNames.map((item) => {
                    return `https://s-supervive.op.gg/prod/game-static/Loki/UI/Textures/Items/${item}.PNG`;
                  });
                  const abilityBuild = ability_build(ability_events);

                  return (
                    <div key={`${m.player_id_encoded}-${teamId}`} className="flex items-center space-x-2 group">
                      <div className="relative w-7 h-7 rounded overflow-hidden border border-slate-600">
                        {img ? (
                          <img src={img} alt={name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-300">
                            {name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-white font-medium truncate">
                          {name} <span className="text-slate-400">({player_name})</span>
                        </div>
                        <div className="text-[10px] text-slate-400">Lvl {m.character_level}</div>
                        {m.stats && (
                          // round the stats
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            KDA {m.stats.Kills ?? 0}/{m.stats.Deaths ?? 0}/{m.stats.Assists ?? 0}
                            <span className="mx-1 text-slate-600">•</span>
                            DMG {Math.round(m.stats.HeroEffectiveDamageDone) ?? 0}
                            <span className="mx-1 text-slate-600">•</span>
                            Tanked {Math.round(m.stats.HeroEffectiveDamageTaken) ?? 0}
                            <span className="mx-1 text-slate-600">•</span>
                            Heal {Math.round(m.stats.HealingGiven) ?? 0}
                          </div>
                        )}
                      </div>
                      <div className="relative text-[10px] text-slate-500">
                        <span className="cursor-help">ℹ️</span>
                        <div className="absolute right-0 top-full mt-1 w-40 rounded border border-slate-700 bg-slate-800 p-2 shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                          <div className="text-[11px] text-white font-semibold mb-1">Details</div>
                          {/* display the build as a list of icons */}
                          <div className="text-[10px] text-slate-300">{buildIcons.map((icon) => {
                            return (<img src={icon} alt="" className="w-5 h-5 inline-block mr-1" />);
                          })}</div>
                          <div className="text-[10px] text-slate-300">Ability Build: {abilityBuild}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MatchDetail;
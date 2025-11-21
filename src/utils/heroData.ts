export type HeroName = 
  | 'Brall'
  | 'Carbine'
  | 'Crysta'
  | 'Ghost'
  | 'Jin'
  | 'Joule'
  | 'Myth'
  | 'Saros'
  | 'Shiv'
  | 'Shrike'
  | 'Bishop'
  | 'Kingpin'
  | 'Felix'
  | 'Oath'
  | 'Elluna'
  | 'Eva'
  | 'Zeph'
  | 'Beebo'
  | 'Celeste'
  | 'Hudson'
  | 'Void';

export interface HeroInfo {
  name: HeroName;
  displayName: string;
  role: 'Assassin' | 'Bruiser' | 'Controller' | 'Marksman' | 'Support' | 'Tank';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  color: string;
  icon?: string;
}

export const heroes: Record<HeroName, HeroInfo> = {
  Brall: {
    name: 'Brall',
    displayName: 'Brall',
    role: 'Tank',
    difficulty: 'Medium',
    description: 'A powerful tank with crowd control abilities',
    color: '#8B4513',
  },
  Carbine: {
    name: 'Carbine',
    displayName: 'Carbine',
    role: 'Marksman',
    difficulty: 'Medium',
    description: 'Ranged damage dealer with high mobility',
    color: '#FF6B35',
  },
  Crysta: {
    name: 'Crysta',
    displayName: 'Crysta',
    role: 'Controller',
    difficulty: 'Hard',
    description: 'Ice-based controller with area denial abilities',
    color: '#4A90E2',
  },
  Ghost: {
    name: 'Ghost',
    displayName: 'Ghost',
    role: 'Assassin',
    difficulty: 'Hard',
    description: 'Stealth assassin with burst damage potential',
    color: '#2C2C2C',
  },
  Jin: {
    name: 'Jin',
    displayName: 'Jin',
    role: 'Bruiser',
    difficulty: 'Medium',
    description: 'Versatile bruiser with good sustain',
    color: '#D2691E',
  },
  Joule: {
    name: 'Joule',
    displayName: 'Joule',
    role: 'Support',
    difficulty: 'Easy',
    description: 'Support hero with healing and utility',
    color: '#FFD700',
  },
  Myth: {
    name: 'Myth',
    displayName: 'Myth',
    role: 'Controller',
    difficulty: 'Hard',
    description: 'Mystical controller with illusion abilities',
    color: '#9370DB',
  },
  Saros: {
    name: 'Saros',
    displayName: 'Saros',
    role: 'Marksman',
    difficulty: 'Medium',
    description: 'Precision marksman with long-range capabilities',
    color: '#FF4500',
  },
  Shiv: {
    name: 'Shiv',
    displayName: 'Shiv',
    role: 'Assassin',
    difficulty: 'Medium',
    description: 'Close-range assassin with high mobility',
    color: '#8B0000',
  },
  Shrike: {
    name: 'Shrike',
    displayName: 'Shrike',
    role: 'Support',
    difficulty: 'Hard',
    description: 'Advanced support with complex utility',
    color: '#32CD32',
  },
  Bishop: {
    name: 'Bishop',
    displayName: 'Bishop',
    role: 'Controller',
    difficulty: 'Medium',
    description: 'Strategic controller with positioning abilities',
    color: '#4169E1',
  },
  Kingpin: {
    name: 'Kingpin',
    displayName: 'Kingpin',
    role: 'Tank',
    difficulty: 'Hard',
    description: 'Commanding tank with team buffs',
    color: '#8B008B',
  },
  Felix: {
    name: 'Felix',
    displayName: 'Felix',
    role: 'Support',
    difficulty: 'Easy',
    description: 'Beginner-friendly support with simple mechanics',
    color: '#00CED1',
  },
  Oath: {
    name: 'Oath',
    displayName: 'Oath',
    role: 'Bruiser',
    difficulty: 'Hard',
    description: 'Oath-bound warrior with conditional abilities',
    color: '#DC143C',
  },
  Elluna: {
    name: 'Elluna',
    displayName: 'Elluna',
    role: 'Controller',
    difficulty: 'Medium',
    description: 'Lunar-themed controller with crowd control',
    color: '#E6E6FA',
  },
  Eva: {
    name: 'Eva',
    displayName: 'Eva',
    role: 'Marksman',
    difficulty: 'Easy',
    description: 'Straightforward marksman with consistent damage',
    color: '#FF69B4',
  },
  Zeph: {
    name: 'Zeph',
    displayName: 'Zeph',
    role: 'Assassin',
    difficulty: 'Hard',
    description: 'Wind-based assassin with extreme mobility',
    color: '#87CEEB',
  },
  Beebo: {
    name: 'Beebo',
    displayName: 'Beebo',
    role: 'Support',
    difficulty: 'Medium',
    description: 'Quirky support with unique mechanics',
    color: '#FFA500',
  },
  Celeste: {
    name: 'Celeste',
    displayName: 'Celeste',
    role: 'Controller',
    difficulty: 'Hard',
    description: 'Star-themed controller with complex patterns',
    color: '#DDA0DD',
  },
  Hudson: {
    name: 'Hudson',
    displayName: 'Hudson',
    role: 'Tank',
    difficulty: 'Easy',
    description: 'Reliable tank with straightforward mechanics',
    color: '#696969',
  },
  Void: {
    name: 'Void',
    displayName: 'Void',
    role: 'Assassin',
    difficulty: 'Hard',
    description: 'Void-walking assassin with dimension abilities',
    color: '#2F2F2F',
  },
};

export function getHeroInfo(heroName: string): HeroInfo | undefined {
  return heroes[heroName as HeroName];
}

export function getHeroColor(heroName: string): string {
  const hero = getHeroInfo(heroName);
  return hero?.color || '#6B7280';
}

export function getHeroRoleIcon(role: string): string {
  const roleIcons = {
    Assassin: '🗡️',
    Bruiser: '⚔️',
    Controller: '🌀',
    Marksman: '🏹',
    Support: '💚',
    Tank: '🛡️',
  };
  return roleIcons[role as keyof typeof roleIcons] || '❓';
}

export function getPlacementColor(placement: number): string {
  if (placement === 1) return 'bg-yellow-500 text-yellow-900';
  if (placement === 2) return 'bg-gray-400 text-gray-900';
  if (placement === 3) return 'bg-amber-600 text-amber-900';
  if (placement <= 5) return 'bg-victory-500 text-victory-900';
  return 'bg-defeat-500 text-defeat-900';
}

export function getPlacementText(placement: number): string {
  if (placement === 1) return '🥇 Victory';
  if (placement === 2) return '🥈 2nd Place';
  if (placement === 3) return '🥉 3rd Place';
  return `#${placement} Place`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

export function calculateKDA(kills: number = 0, deaths: number = 0, assists: number = 0): string {
  if (deaths === 0) return 'Perfect';
  const kda = (kills + assists) / deaths;
  return kda.toFixed(2);
}

export function getHeroImageUrl(heroAssetId: string): string {
  // This would typically come from the API, but we'll use a placeholder
  return `https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    `Supervive hero ${heroAssetId} portrait, fantasy character, detailed, high quality`
  )}&image_size=square`;
}
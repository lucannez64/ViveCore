export interface PlayerSearchResult {
  platform: string;
  uniqueDisplayName: string;
  displayName: string;
  userId: string;
  source: string;
}

export interface MatchData {
  id: number;
  platform_id: number;
  character_level: number;
  hero: HeroData;
  hero_asset_id: string;
  is_ranked: boolean;
  match_end: string;
  placement: number;
  platform: MatchPlatform;
  player_id_encoded: string;
  player_id: string;
  stats: PlayerStats;
  survival_duration: number;
  team_id: number;
  match_id: string;
  queue_id: string;
  party_id?: string;
  created_at: string;
  match_start: string;
}

export interface HeroData {
  asset_id: string;
  head_image_url: string;
}

export interface MatchPlatform {
  id: number;
  name: string;
}

export interface PlayerStats {
  Kills?: number;
  Deaths?: number;
  Assists?: number;
  Resurrected?: number;
  Revived?: number;
  Knocks?: number;
  Knocked?: number;
  MaxKillStreak?: number;
  MaxKnockStreak?: number;
  CreepKills?: number;
  GoldFromEnemies?: number;
  GoldFromMonsters?: number;
  HealingGiven?: number;
  HealingGivenSelf?: number;
  HealingReceived?: number;
  DamageDone?: number;
  EffectiveDamageDone?: number;
  HeroDamageDone?: number;
  HeroEffectiveDamageDone?: number;
  DamageTaken?: number;
  EffectiveDamageTaken?: number;
  HeroDamageTaken?: number;
  HeroEffectiveDamageTaken?: number;
  ShieldMitigatedDamage?: number;
}

export interface PlayerMatchesResponse {
  data: MatchData[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface MmrRating {
  Rating: number;
  Rank: string;
}

export interface MmrData {
  ID: string;
  Version: number;
  QueueRankRating: {
    default: {
      Rating: number;
      Rank: string;
    };
  };
}

const API_BASE_URL = import.meta.env.DEV
  ? `${window.location.origin}/supervive/`
  : 'https://op.gg/supervive/';

export class SuperviveApiService {
  private baseUrl = API_BASE_URL;

  private async fetchWithRetry(url: string, options?: RequestInit, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          // Ensure cookies are used for same-origin requests
          credentials: 'same-origin',
          ...options,
          headers: {
            // Remove forbidden headers in browser fetch
            ...options?.headers,
          },
        });
        
        if (response.ok) return response;
        
        // Treat 404 for search as empty results
        if (response.status === 404 && url.includes('api/players/search')) {
          // Return a fake OK response with empty array
          return new Response(JSON.stringify([]), { status: 200 });
        }

        if (response.status === 429 && i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          continue;
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    throw new Error('Max retries exceeded');
  }

  async searchPlayers(query: string): Promise<PlayerSearchResult[]> {
    const url = new URL('api/players/search', this.baseUrl);
    url.searchParams.set('query', query);
    
    const response = await this.fetchWithRetry(url.toString());
    return response.json();
  }

  async getPlayerMatches(platform: string, playerId: string, page = 1): Promise<PlayerMatchesResponse> {
    const normalizedPlayerId = playerId.replace(/-/g, '');
    const url = new URL(`api/players/${platform}-${normalizedPlayerId}/matches`, this.baseUrl);
    url.searchParams.set('page', page.toString());
    
    const response = await this.fetchWithRetry(url.toString());
    return response.json();
  }

  async getMatch(platform: string, matchId: string): Promise<MatchData[]> {
    const url = new URL(`api/matches/${platform}-${matchId}`, this.baseUrl);
    console.log('GET match url:', url.toString());
    const response = await this.fetchWithRetry(url.toString());
    return response.json();
  }

  // Fetch local MMR JSON produced by the Python script.
  async getLocalMmr(): Promise<MmrRating | null> {
    try {
      const url = new URL('mmr.json', window.location.origin);
      const response = await this.fetchWithRetry(url.toString());
      if (!response.ok) return null;
      const data = (await response.json()) as MmrData;
      const rating = data?.QueueRankRating?.default?.Rating;
      const rank = data?.QueueRankRating?.default?.Rank;
      if (typeof rating === 'number' && typeof rank === 'string') {
        return { Rating: rating, Rank: rank };
      }
      return null;
    } catch (e) {
      console.warn('Failed to load local MMR:', e);
      return null;
    }
  }

  // Live MMR fetch by parsing the recorded request in 102.txt and replicating the flow
  async getLiveMmrFromTraceFile(traceAbsolutePath = 'E:/Projects/ViveCore/102.txt'): Promise<MmrRating | null> {
    try {
      // Read the trace file directly from disk via Vite's /@fs/ route
      const traceUrl = `/@fs/${traceAbsolutePath.replace(/\\/g, '/')}`;
      const traceResp = await fetch(traceUrl);
      if (!traceResp.ok) throw new Error(`Failed to read trace file at ${traceAbsolutePath}`);
      const traceText = await traceResp.text();

      // Extract values needed for OAuth
      const basicAuth = traceText.match(/Authorization:\s*Basic\s+([A-Za-z0-9+/=]+)/i)?.[1];
      const flightId = traceText.match(/x-flight-id:\s*([a-f0-9]+)/i)?.[1];
      const platformToken = traceText.match(/platform_token=([^&\r\n]+)/i)?.[1];
      const macAddress = traceText.match(/macAddress=([^&\r\n]+)/i)?.[1];
      const deviceToken = traceText.match(/cookie:\s*device-token=([^\s\r\n]+)/i)?.[1];
      const namespace = traceText.match(/Namespace:\s*([^\r\n]+)/i)?.[1] || 'loki';
      const gameClientVersion = traceText.match(/Game-Client-Version:\s*([^\r\n]+)/i)?.[1] || '1.0.0.0';
      const accelByteVersion = traceText.match(/AccelByte-SDK-Version:\s*([^\r\n]+)/i)?.[1] || '26.1.0';

      if (!basicAuth || !platformToken || !flightId) {
        throw new Error('Missing required OAuth params (Authorization Basic, platform_token, x-flight-id) in 102.txt');
      }

      // Ensure the upstream receives device-token cookie via dev proxy
      if (deviceToken && typeof document !== 'undefined') {
        try {
          document.cookie = `device-token=${deviceToken}; Path=/`;
        } catch {
          // ignore cookie set failures in non-browser contexts
        }
      }

      // Compose OAuth request body mirroring the trace
      const additionalData = encodeURIComponent(JSON.stringify({ flightId }));
      const oauthBody = `platform_token=${platformToken}&createHeadless=false&macAddress=${macAddress || deviceToken || ''}&additionalData=${additionalData}`;

      // Use dev-server proxy to avoid CORS: vite.config proxies /iam to accounts service
      const oauthUrl = '/iam/v4/oauth/platforms/steam/token?createHeadless=false';
      const oauthResp = await this.fetchWithRetry(oauthUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Namespace': namespace,
          'Game-Client-Version': gameClientVersion,
          'AccelByte-SDK-Version': accelByteVersion,
          'x-flight-id': flightId,
        },
        body: oauthBody,
      });

      if (!oauthResp.ok) {
        throw new Error(`OAuth failed: HTTP ${oauthResp.status}`);
      }
      const oauthJson = await oauthResp.json();
      const accessToken: string | undefined = oauthJson?.access_token;
      const userId: string | undefined = oauthJson?.user_id;
      if (!accessToken || !userId) {
        throw new Error('OAuth success but missing access_token or user_id');
      }

      // MMR request
      const clientVersion = traceText.match(/x-theorycraft-clientversion:\s*([^\r\n]+)/i)?.[1] || 'release2.0.live-154144-shipping';
      const mmrUrl = `/mmr/player-ratings/${userId}/rank`;
      const mmrResp = await this.fetchWithRetry(mmrUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-theorycraft-clientversion': clientVersion,
          'Accept': 'application/json',
        },
      });

      if (!mmrResp.ok) {
        throw new Error(`MMR request failed: HTTP ${mmrResp.status}`);
      }
      const data = (await mmrResp.json()) as MmrData;
      const rating = data?.QueueRankRating?.default?.Rating;
      const rank = data?.QueueRankRating?.default?.Rank;
      if (typeof rating === 'number' && typeof rank === 'string') {
        return { Rating: rating, Rank: rank };
      }
      return null;
    } catch (e) {
      console.warn('Failed to fetch live MMR:', e);
      return null;
    }
  }

  async checkPlayerExists(platform: string, uniqueDisplayName: string): Promise<boolean> {
    const url = new URL('api/players/check', this.baseUrl);
    url.searchParams.set('platform', platform);
    url.searchParams.set('uniqueDisplayName', uniqueDisplayName);
    
    const response = await this.fetchWithRetry(url.toString());
    const data = await response.json();
    return data.exists || data.Exists;
  }

  async fetchNewPlayerMatches(platform: string, playerId: string): Promise<any> {
    const normalizedPlayerId = playerId.replace(/-/g, '');
    
    // First, hit matches to ensure XSRF cookie is set
    const matchesUrl = new URL(`api/players/${platform}-${normalizedPlayerId}/matches`, this.baseUrl);
    matchesUrl.searchParams.set('page', '1');
    
    await this.fetchWithRetry(matchesUrl.toString());

    // Try to read XSRF token from document.cookie (browser stores cookie automatically)
    let xsrfToken: string | undefined;
    if (typeof document !== 'undefined') {
      const cookie = document.cookie || '';
      const xsrfMatch = cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
      if (xsrfMatch) {
        try {
          xsrfToken = decodeURIComponent(xsrfMatch[1]);
        } catch {
          xsrfToken = xsrfMatch[1];
        }
      }
    }
    
    // Now request server to fetch new matches
    const fetchUrl = new URL(`api/players/${platform}-${normalizedPlayerId}/matches/fetch`, this.baseUrl);
    
    const response = await this.fetchWithRetry(fetchUrl.toString(), {
      method: 'POST',
      headers: {
        ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/html')) {
      throw new Error('Invalid player ID or XSRF token');
    }

    return response.json();
  }

  // Helper method to get multiple pages of matches
  async getPlayerMatchesPages(platform: string, playerId: string, pages = 20): Promise<MatchData[]> {
    const allMatches: MatchData[] = [];
    let currentPage = 1;
    let lastPage = 1;

    while (currentPage <= Math.min(pages, lastPage)) {
      try {
        const response = await this.getPlayerMatches(platform, playerId, currentPage);
        allMatches.push(...response.data);
        
        if (response.meta.last_page) {
          lastPage = response.meta.last_page;
        }
        
        if (!response.data.length) break;
        
        currentPage++;
      } catch (error) {
        console.error(`Error fetching page ${currentPage}:`, error);
        break;
      }
    }

    return allMatches;
  }
}

export const superviveApi = new SuperviveApiService();
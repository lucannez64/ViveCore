import React, { useState } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import SearchBar from './SearchBar';
import ProfileStats from './ProfileStats';
import MatchesList from './MatchesList';

interface PlayerProfile {
  id: string;
  name: string;
  level: number;
  wins: number;
  losses: number;
  winRate: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  mmr: number;
}

interface Match {
  id: string;
  date: string;
  result: 'win' | 'loss';
  mode: string;
  duration: string;
  kills: number;
  deaths: number;
  assists: number;
  hero: string;
  kda: number;
  mmrChange: number;
  details?: {
    abilities: string[];
    items: string[];
    damageDealt: number;
    damageTaken: number;
    healing: number;
  };
}

const ProfileSearchPage: React.FC = () => {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);

  const handleSearch = (username: string) => {
    // Mock data for demonstration
    const mockProfile: PlayerProfile = {
      id: '1',
      name: username,
      level: 42,
      wins: 128,
      losses: 87,
      winRate: 59.6,
      kills: 1523,
      deaths: 892,
      assists: 1876,
      kda: 3.8,
      mmr: 2850,
    };

    const mockMatches: Match[] = [
      {
        id: '1',
        date: '2025-11-06',
        result: 'win',
        mode: 'Competitive',
        duration: '24:35',
        kills: 12,
        deaths: 6,
        assists: 8,
        hero: 'Invoker',
        kda: 3.3,
        mmrChange: 25,
        details: {
          abilities: ['Cold Snap', 'Ghost Walk', 'Ice Wall'],
          items: ['Aghanim\'s Scepter', 'Sheepstick', 'Boots of Travel'],
          damageDealt: 45230,
          damageTaken: 23450,
          healing: 5620,
        }
      },
      {
        id: '2',
        date: '2025-11-05',
        result: 'loss',
        mode: 'Competitive',
        duration: '28:12',
        kills: 8,
        deaths: 10,
        assists: 14,
        hero: 'Pudge',
        kda: 2.2,
        mmrChange: -18,
        details: {
          abilities: ['Meat Hook', 'Rot', 'Flesh Heap'],
          items: ['Blink Dagger', 'Black King Bar', 'Pipe of Insight'],
          damageDealt: 32100,
          damageTaken: 42150,
          healing: 12500,
        }
      },
      {
        id: '3',
        date: '2025-11-04',
        result: 'win',
        mode: 'Quick Match',
        duration: '18:45',
        kills: 15,
        deaths: 5,
        assists: 9,
        hero: 'Pudge',
        kda: 4.8,
        mmrChange: 18,
        details: {
          abilities: ['Meat Hook', 'Rot', 'Dismember'],
          items: ['Force Staff', 'Sheepstick', 'Aghanim\'s Scepter'],
          damageDealt: 38750,
          damageTaken: 18200,
          healing: 8900,
        }
      }
    ];

    setProfile(mockProfile);
    setMatches(mockMatches);
  };

  return (
    <Container fluid className="p-4">
      <Row>
        <Col>
          <h1 className="text-center mb-4">ViveCore Player Profile</h1>
          <SearchBar onSearch={handleSearch} />
        </Col>
      </Row>
      
      {profile && (
        <Row className="mt-4">
          <Col>
            <Card>
              <Card.Body>
                <ProfileStats profile={profile} />
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
      
      {matches.length > 0 && (
        <Row className="mt-4">
          <Col>
            <h3>Recent Matches</h3>
            <MatchesList matches={matches} />
          </Col>
        </Row>
      )}
    </Container>
  );
};

export default ProfileSearchPage;
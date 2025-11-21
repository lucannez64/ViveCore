import React from 'react';
import { Row, Col, Card, ProgressBar } from 'react-bootstrap';
import HeroIcon from './HeroIcon';
import { FaTrophy, FaUser, FaChartLine, FaSkull, FaHeart } from 'react-icons/fa';

interface ProfileStatsProps {
  profile: {
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
  };
}

const ProfileStats: React.FC<ProfileStatsProps> = ({ profile }) => {
  const totalMatches = profile.wins + profile.losses;
  const winPercentage = totalMatches > 0 ? (profile.wins / totalMatches) * 100 : 0;

  return (
    <>
      <Row>
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <HeroIcon heroName="default" size="large" />
              <Card.Title className="mt-2">{profile.name}</Card.Title>
              <Card.Text>Level {profile.level}</Card.Text>
              <Card.Text className="text-muted">MMR: {profile.mmr}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={8}>
          <Row>
            <Col md={4}>
              <Card className="text-center">
                <Card.Body>
                  <FaTrophy className="text-warning mb-2" style={{ fontSize: '30px' }} />
                  <Card.Title>{profile.wins}</Card.Title>
                  <Card.Text className="text-muted">Wins</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="text-center">
                <Card.Body>
                  <FaSkull className="text-danger mb-2" style={{ fontSize: '30px' }} />
                  <Card.Title>{profile.losses}</Card.Title>
                  <Card.Text className="text-muted">Losses</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="text-center">
                <Card.Body>
                  <FaChartLine className="text-success mb-2" style={{ fontSize: '30px' }} />
                  <Card.Title>{profile.winRate.toFixed(1)}%</Card.Title>
                  <Card.Text className="text-muted">Win Rate</Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          <Row className="mt-3">
            <Col md={6}>
              <Card>
                <Card.Body>
                  <div className="d-flex justify-content-between mb-1">
                    <span>Win Rate</span>
                    <span>{profile.winRate.toFixed(1)}%</span>
                  </div>
                  <ProgressBar 
                    variant="success" 
                    now={profile.winRate} 
                    label={`${profile.winRate.toFixed(1)}%`} 
                  />
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card>
                <Card.Body>
                  <div className="d-flex justify-content-between mb-1">
                    <span>KDA</span>
                    <span>{profile.kda.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <small>
                      <FaSkull className="text-danger" /> {profile.kills}
                    </small>
                    <small>
                      <FaUser className="text-secondary" /> {profile.deaths}
                    </small>
                    <small>
                      <FaHeart className="text-success" /> {profile.assists}
                    </small>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </>
  );
};

export default ProfileStats;
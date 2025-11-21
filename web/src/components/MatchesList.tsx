import React, { useState } from 'react';
import { 
  Table, 
  Badge, 
  Accordion, 
  Row, 
  Col, 
  Card,
  ProgressBar
} from 'react-bootstrap';
import HeroIcon from './HeroIcon';
import AbilityIcon from './AbilityIcon';
import BuildIcon from './BuildIcon';

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

interface MatchesListProps {
  matches: Match[];
}

const MatchesList: React.FC<MatchesListProps> = ({ matches }) => {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const handleToggle = (key: string | null) => {
    setActiveKey(activeKey === key ? null : key || null);
  };

  return (
    <Accordion activeKey={activeKey || ''} onSelect={(key) => handleToggle(key || null)}>
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Date</th>
            <th>Result</th>
            <th>Mode</th>
            <th>Duration</th>
            <th>Hero</th>
            <th>KDA</th>
            <th>MMR Change</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => (
            <tr 
              key={match.id} 
              className={match.result === 'win' ? 'table-success' : 'table-danger'}
              style={{ cursor: 'pointer' }}
              onClick={() => handleToggle(match.id)}
            >
              <td>{match.date}</td>
              <td>
                <Badge bg={match.result === 'win' ? 'success' : 'danger'}>
                  {match.result.toUpperCase()}
                </Badge>
              </td>
              <td>{match.mode}</td>
              <td>{match.duration}</td>
              <td>
                <div className="d-flex align-items-center">
                  <HeroIcon heroName={match.hero} size="small" />
                  <span className="ms-2">{match.hero}</span>
                </div>
              </td>
              <td>{match.kills}/{match.deaths}/{match.assists}</td>
              <td>
                {match.mmrChange > 0 ? '+' : ''}{match.mmrChange}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {matches.map((match) => (
        <Accordion.Collapse eventKey={match.id} key={`collapse-${match.id}`}>
          <Card.Body>
            <Row>
              <Col md={6}>
                <h5>Match Details</h5>
                <p><strong>Damage Dealt:</strong> {match.details?.damageDealt?.toLocaleString()}</p>
                <p><strong>Damage Taken:</strong> {match.details?.damageTaken?.toLocaleString()}</p>
                <p><strong>Healing:</strong> {match.details?.healing?.toLocaleString()}</p>
                
                <h5 className="mt-3">Abilities</h5>
                <div className="d-flex">
                  {match.details?.abilities?.map((ability, index) => (
                    <div key={index} className="me-2">
                      <AbilityIcon abilityName={ability} />
                      <small className="d-block text-center">{ability}</small>
                    </div>
                  ))}
                </div>
              </Col>
              <Col md={6}>
                <h5>Build</h5>
                <div>
                  {match.details?.items?.map((item, index) => (
                    <div key={index} className="mb-2">
                      <div className="d-flex align-items-center">
                        <BuildIcon itemName={item} />
                        <span className="ms-2">{item}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Col>
            </Row>
            
            <Row className="mt-3">
              <Col>
                <h5>KDA Breakdown</h5>
                <div className="d-flex">
                  <div className="me-4">
                    <p className="mb-1">Kills</p>
                    <ProgressBar 
                      variant="danger" 
                      now={match.kills} 
                      max={20} 
                      label={`${match.kills}`} 
                      style={{ width: '120px' }} 
                    />
                  </div>
                  <div className="me-4">
                    <p className="mb-1">Deaths</p>
                    <ProgressBar 
                      variant="secondary" 
                      now={match.deaths} 
                      max={20} 
                      label={`${match.deaths}`} 
                      style={{ width: '120px' }} 
                    />
                  </div>
                  <div>
                    <p className="mb-1">Assists</p>
                    <ProgressBar 
                      variant="success" 
                      now={match.assists} 
                      max={20} 
                      label={`${match.assists}`} 
                      style={{ width: '120px' }} 
                    />
                  </div>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Accordion.Collapse>
      ))}
    </Accordion>
  );
};

export default MatchesList;
import React, { useState } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';

interface SearchBarProps {
  onSearch: (username: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      onSearch(username.trim());
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      <InputGroup className="mb-3">
        <Form.Control
          type="text"
          placeholder="Enter player username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Button variant="primary" type="submit">
          Search
        </Button>
      </InputGroup>
    </Form>
  );
};

export default SearchBar;
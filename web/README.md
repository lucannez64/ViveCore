# ViveCore Player Profile Viewer

A web application for searching player profiles and viewing their statistics and match history.

## Features

- Search for player profiles by username
- View overall player statistics (wins, losses, win rate, KDA, MMR, etc.)
- See recent match history with expandable details
- View hero, ability, and item icons
- Responsive design for all device sizes

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the `web` directory
3. Install dependencies:

```bash
npm install
```

### Running the Application

To start the development server:

```bash
npm start
```

The application will be available at `http://localhost:3000`.

### Building for Production

To create a production build:

```bash
npm run build
```

## Components

- `ProfileSearchPage`: Main page component that coordinates the search, profile stats, and matches
- `SearchBar`: Component for searching player profiles
- `ProfileStats`: Displays player statistics and metrics
- `MatchesList`: Shows recent matches with expandable details
- `HeroIcon`: Displays icons for different heroes
- `AbilityIcon`: Displays icons for different abilities
- `BuildIcon`: Displays icons for items/builds

## API Integration

Currently using mock data for demonstration purposes. To integrate with the backend API:
1. Create API service functions
2. Replace mock data calls with actual API calls
3. Handle loading states and errors appropriately
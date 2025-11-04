# API Documentation

This repository exposes its functionality primarily through a Discord bot and does not have a traditional REST API for external consumption. However, the core logic is well-encapsulated within services that could be exposed or reused. Another project, like a match history website, could leverage this logic in a few ways.

Here is a breakdown of the available functionalities that could be considered an "API":

### 1. Core Services (in the `Shared` project)

These services contain the main business logic. An external project could use them if the `Api` project was extended to expose them over HTTP, or if the project was integrated into the same .NET solution.

*   **`ISuperviveService`**: This is a client for the external `op.gg/supervive` website API. It's not an API of this repo, but it's the source of all the data.
    *   `SearchPlayers(query)`: Searches for players by name.
    *   `GetMatch(platform, matchId)`: Retrieves detailed data for a specific match.
    *   `GetPlayerMatches(platform, playerId)`: Gets the match history for a specific player.
    *   `FetchNewPlayerMatches(platform, playerId)`: Tells the `op.gg` server to refresh a player's match history.

*   **`IDataIntegrationService`**: This service is the heart of the data synchronization. It uses `ISuperviveService` to fetch data and then saves it to the local PostgreSQL database.
    *   `SyncPlayer(uniqueDisplayName)`: Finds a player on Supervive and saves their profile (ID, platform, etc.) to the database.
    *   `SyncPlayerMatches(platform, playerId)`: Fetches a player's match history from Supervive, pulls the full details for each match, and saves all the associated data (player stats, teams, match results, etc.) to the database. This is the key method for populating a match history database.

*   **`ITournamentService`**: This service provides logic for competitive events.
    *   `CalculateTeamPoints(matchesData)`: Calculates tournament points for teams based on placement and kills in a series of matches.
    *   `AggregateRosters(matchesData)`: Intelligently groups players into rosters/teams across multiple matches, even accounting for substitutes.

### 2. Discord Bot Commands (in the `Discord` project)

This is the primary way to interact with the system currently.

*   `/sync_player [uniqueDisplayName]`: Triggers the `SyncPlayer` method from the data integration service.
*   `/sync_matches [playerName]`: Triggers the `SyncPlayerMatches` method, a player's match history.
*   `/calc_tournament_points`: Uses the `TournamentService` to calculate and display scores for a set of matches, either from a player's history or a provided list of match IDs.

### 3. Direct Database Access

Once the data is synced using the methods above, the PostgreSQL database itself can be considered an API. An external project like a match history website would query this database directly.

The key database tables are:
*   `player`: Stores player information.
*   `match`: Stores overall information for each match.
*   `match_player`: Links players to matches and stores their performance stats for that match.
*   `match_player_advanced_stats`: Contains highly detailed stats for a player in a specific match.

### Summary for another project

To use the functionality of this repo for a match history website, the recommended approach would be:

1.  **Extend the `Api` project**: Create new HTTP endpoints (e.g., `POST /api/sync/player/{name}`, `GET /api/matches/{id}`) that call the existing methods in `IDataIntegrationService` and read data from the database.
2.  **Direct Database Connection**: For a read-heavy application like a match history site, connecting directly to the PostgreSQL database is the most efficient way to get the data after it has been synced.

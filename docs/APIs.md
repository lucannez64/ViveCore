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

### 4. Database Schema

This section provides a detailed overview of the main tables in the PostgreSQL database.

#### `player` table

Stores information about individual players.

| Column            | Type      | Description                                           |
| ----------------- | --------- | ----------------------------------------------------- |
| `player_id`       | `varchar` | **Primary Key.** The unique identifier for the player.  |
| `player_id_encoded`| `varchar` | An encoded version of the player ID.                  |
| `discord_user_id` | `bigint`  | The player's Discord user ID, if available.            |
| `platform`        | `varchar` | The platform the player uses (e.g., "steam").         |
| `last_synced_match`| `varchar` | The ID of the last match synced for this player.      |
| `created_at`      | `timestamp`| The timestamp when the record was created.             |
| `deleted_at`      | `timestamp`| The timestamp when the record was soft-deleted.       |

---

#### `match` table

Stores overall information for each match.

| Column            | Type      | Description                                            |
| ----------------- | --------- | ------------------------------------------------------ |
| `match_id`        | `varchar` | **Primary Key.** The unique identifier for the match.    |
| `platform`        | `varchar` | The platform where the match was played.               |
| `winner_team`     | `integer` | The ID of the winning team.                            |
| `type`            | `varchar` | The match type (e.g., "Trios", "Duos", "Arena").      |
| `is_ranked`       | `boolean` | Whether the match was a ranked game.                   |
| `is_custom_game`  | `boolean` | Whether the match was a custom game.                   |
| `is_inhouse`      | `boolean` | Whether the match was an in-house game.                |
| `inhouse_server_id`| `bigint`  | The Discord server ID if it was an in-house game.     |
| `match_start`     | `timestamp`| The timestamp when the match started.                  |
| `match_end`       | `timestamp`| The timestamp when the match ended.                    |
| `created_at`      | `timestamp`| The timestamp when the record was created.             |
| `deleted_at`      | `timestamp`| The timestamp when the record was soft-deleted.       |

---

#### `match_player` table

Links players to matches and stores their core performance stats.

| Column                     | Type      | Description                                                 |
| -------------------------- | --------- | ----------------------------------------------------------- |
| `match_id`                 | `varchar` | **Composite Primary Key.** Foreign key to the `match` table. |
| `player_id_encoded`        | `varchar` | **Composite Primary Key.** Foreign key to the `player` table.|
| `team_id`                  | `integer` | The ID of the team the player was on.                         |
| `hero`                     | `varchar` | The hero the player used.                                   |
| `survival_duration`        | `float`   | The duration the player survived in seconds.                |
| `placement`                | `integer` | The final placement of the player's team.                   |
| `kills`                    | `integer` | The number of kills the player got.                         |
| `deaths`                   | `integer` | The number of deaths the player had.                        |
| `assists`                  | `integer` | The number of assists the player got.                       |
| `healing_given`            | `float`   | The amount of healing the player gave to others.            |
| `healing_given_self`       | `float`   | The amount of healing the player gave to themselves.        |
| `hero_effective_damage_done`| `float`   | The effective damage done to other heroes.                  |
| `hero_effective_damage_taken`| `float`   | The effective damage taken from other heroes.               |
| `rating_delta`             | `float`   | The change in the player's rating after the match.          |
| `rating`                   | `float`   | The player's rating after the match.                        |
| `created_at`               | `timestamp`| The timestamp when the record was created.                  |
| `deleted_at`               | `timestamp`| The timestamp when the record was soft-deleted.            |

---

#### `match_player_advanced_stats` table

Stores detailed performance stats for a player in a specific match.

| Column                     | Type      | Description                                                        |
| -------------------------- | --------- | ------------------------------------------------------------------ |
| `match_id`                 | `varchar` | **Composite Primary Key.** Foreign key to the `match` table.        |
| `player_id`                | `varchar` | **Composite Primary Key.** Foreign key to the `player` table.        |
| `hero`                     | `varchar` | The hero the player used.                                          |
| `survival_duration`        | `float`   | The duration the player survived in seconds.                       |
| `kills`                    | `integer` | The number of kills.                                               |
| `deaths`                   | `integer` | The number of deaths.                                              |
| `assists`                  | `integer` | The number of assists.                                             |
| `ressurects`               | `integer` | The number of times the player resurrected a teammate.             |
| `revived`                  | `integer` | The number of times the player was revived.                        |
| `knocks`                   | `integer` | The number of times the player knocked down an enemy.              |
| `knocked`                  | `integer` | The number of times the player was knocked down.                   |
| `max_kill_streak`          | `integer` | The maximum kill streak the player achieved.                       |
| `max_knock_streak`         | `integer` | The maximum knock streak the player achieved.                      |
| `creep_kills`              | `integer` | The number of creep kills.                                         |
| `gold_from_enemies`        | `integer` | The amount of gold earned from killing enemies.                    |
| `gold_from_monsters`       | `integer` | The amount of gold earned from killing monsters.                   |
| `healing_given`            | `float`   | The total healing given.                                           |
| `healing_given_self`       | `float`   | The total healing given to self.                                   |
| `healing_received`         | `float`   | The total healing received.                                        |
| `damage_done`              | `float`   | The total damage done.                                             |
| `effective_damage_done`    | `float`   | The total effective damage done.                                   |
| `hero_damage_done`         | `float`   | The total damage done to heroes.                                   |
| `hero_effective_damage_done`| `float`   | The total effective damage done to heroes.                         |
| `damage_taken`             | `float`   | The total damage taken.                                            |
| `effective_damage_taken`   | `float`   | The total effective damage taken.                                  |
| `hero_damage_taken`        | `float`   | The total damage taken from heroes.                                |
| `hero_effective_damage_taken`| `float`   | The total effective damage taken from heroes.                      |
| `shield_mitigated_damage`  | `float`   | The amount of damage mitigated by shields.                         |
| `created_at`               | `timestamp`| The timestamp when the record was created.                         |
| `deleted_at`               | `timestamp`| The timestamp when the record was soft-deleted.                    |

### Summary for another project

To use the functionality of this repo for a match history website, the recommended approach would be:

1.  **Extend the `Api` project**: Create new HTTP endpoints (e.g., `POST /api/sync/player/{name}`, `GET /api/matches/{id}`) that call the existing methods in `IDataIntegrationService` and read data from the database.
2.  **Direct Database Connection**: For a read-heavy application like a match history site, connecting directly to the PostgreSQL database is the most efficient way to get the data after it has been synced.

import 'dotenv/config';
import { buildLeaderboardMessage, fetchStandings } from './leaderboard.js';
import { fetchCurrentGameweekStatus } from './gameweekStatus.js';
import { generateGameweekSummary } from './summary.js';

export async function preview(): Promise<void> {
  const leagueId = process.env.LEAGUE_ID;
  if (!leagueId) {
    throw new Error('LEAGUE_ID environment variable is required.');
  }

  const gameweekStatus = await fetchCurrentGameweekStatus();
  const standings = await fetchStandings(leagueId);
  const leaderboardMessage = buildLeaderboardMessage(standings);
  const summary = await generateGameweekSummary(standings, gameweekStatus?.id ?? null);
  const message = summary ? `${summary}\n\n${leaderboardMessage}` : leaderboardMessage;

  console.log(message);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  preview()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

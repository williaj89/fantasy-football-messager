import 'dotenv/config';
import { buildLeaderboardMessage, fetchStandings } from './leaderboard.js';
import { fetchCurrentGameweekStatus } from './gameweekStatus.js';
import { generateGameweekSummary } from './summary.js';
import { fetchTeamDetails } from './teamDetails.js';
import { fetchSeasonHistories } from './seasonHistory.js';
import { computePlayerPerformance } from './playerPerformance.js';

export async function preview(): Promise<void> {
  const leagueId = process.env.LEAGUE_ID;
  if (!leagueId) {
    throw new Error('LEAGUE_ID environment variable is required.');
  }

  const gameweekStatus = await fetchCurrentGameweekStatus();
  const standings = await fetchStandings(leagueId);
  const leaderboardMessage = buildLeaderboardMessage(standings);
  const gameweekId = gameweekStatus?.id ?? null;
  const teamDetails = gameweekId ? await fetchTeamDetails(standings, gameweekId) : [];
  const seasonHistories = await fetchSeasonHistories(standings);
  const playerPerformance = gameweekId
    ? await computePlayerPerformance(teamDetails, gameweekId)
    : { topPerformer: null, bestDifferential: null };
  const summary = await generateGameweekSummary(standings, gameweekId, teamDetails, seasonHistories, playerPerformance);
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

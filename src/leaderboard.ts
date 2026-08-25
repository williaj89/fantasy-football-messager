export interface StandingEntry {
  entry: number;
  entry_name: string;
  rank: number;
  last_rank: number;
  total: number;
  event_total: number;
}

interface StandingsResponse {
  standings?: {
    results?: StandingEntry[];
  };
}

export async function fetchStandings(leagueId: string): Promise<StandingEntry[]> {
  const endpointUrl = `https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`;
  const response = await fetch(endpointUrl);
  const data = (await response.json()) as StandingsResponse;
  return data.standings?.results ?? [];
}

export function buildLeaderboardMessage(standings: StandingEntry[]): string {
  const sortedStandings = [...standings].sort((a, b) => b.total - a.total);

  const lines = sortedStandings.map((team, index) => {
    const rankChange = team.rank - team.last_rank;
    const direction = rankChange < 0 ? '⬆' : rankChange > 0 ? '⬇' : '◀';
    return `${index + 1}. ${team.entry_name} ${direction} ${Math.abs(rankChange)}`;
  });

  return lines.join('\n');
}

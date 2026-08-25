import type { StandingEntry } from './leaderboard.js';

export interface SeasonHistory {
  entryName: string;
  gameweeksPlayed: number;
  averagePoints: number;
  standardDeviation: number;
  bestGameweek: { event: number; points: number };
  worstGameweek: { event: number; points: number };
}

interface HistoryEvent {
  event: number;
  points: number;
}

interface EntryHistoryResponse {
  current?: HistoryEvent[];
}

async function fetchEntryHistory(team: StandingEntry): Promise<SeasonHistory | null> {
  try {
    const response = await fetch(`https://fantasy.premierleague.com/api/entry/${team.entry}/history/`);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as EntryHistoryResponse;
    const events = data.current ?? [];
    if (events.length === 0) {
      return null;
    }

    const pointsList = events.map((event) => event.points);
    const average = pointsList.reduce((sum, points) => sum + points, 0) / pointsList.length;
    const variance = pointsList.reduce((sum, points) => sum + (points - average) ** 2, 0) / pointsList.length;

    const best = events.reduce((max, event) => (event.points > max.points ? event : max), events[0]);
    const worst = events.reduce((min, event) => (event.points < min.points ? event : min), events[0]);

    return {
      entryName: team.entry_name,
      gameweeksPlayed: events.length,
      averagePoints: average,
      standardDeviation: Math.sqrt(variance),
      bestGameweek: { event: best.event, points: best.points },
      worstGameweek: { event: worst.event, points: worst.points },
    };
  } catch (error) {
    console.warn(`Failed to fetch season history for entry ${team.entry}:`, error);
    return null;
  }
}

/**
 * Fetches each team's gameweek-by-gameweek history for the current season, for season-long
 * narrative (consistency, best/worst single gameweek). Best-effort: a team whose history can't
 * be fetched is simply omitted rather than failing the whole summary.
 */
export async function fetchSeasonHistories(standings: StandingEntry[]): Promise<SeasonHistory[]> {
  const results = await Promise.all(standings.map((team) => fetchEntryHistory(team)));
  return results.filter((history): history is SeasonHistory => history !== null);
}

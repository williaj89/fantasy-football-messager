import type { TeamDetail } from './teamDetails.js';

export interface PlayerPerformance {
  topPerformer: { playerName: string; points: number; teams: string[] } | null;
  bestDifferential: { playerName: string; points: number; entryName: string } | null;
}

const NO_PERFORMANCE: PlayerPerformance = { topPerformer: null, bestDifferential: null };

interface BootstrapElement {
  id: number;
  web_name: string;
}

interface BootstrapStaticResponse {
  elements?: BootstrapElement[];
}

interface LiveElement {
  id: number;
  stats?: { total_points?: number };
}

interface LiveResponse {
  elements?: LiveElement[];
}

async function fetchPlayerNames(): Promise<Map<number, string>> {
  const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
  const data = (await response.json()) as BootstrapStaticResponse;

  const playerNames = new Map<number, string>();
  for (const element of data.elements ?? []) {
    playerNames.set(element.id, element.web_name);
  }
  return playerNames;
}

async function fetchLivePoints(eventId: number): Promise<Map<number, number>> {
  const response = await fetch(`https://fantasy.premierleague.com/api/event/${eventId}/live/`);
  const data = (await response.json()) as LiveResponse;

  const livePoints = new Map<number, number>();
  for (const element of data.elements ?? []) {
    livePoints.set(element.id, element.stats?.total_points ?? 0);
  }
  return livePoints;
}

/**
 * Cross-references each team's starting XI (from teamDetails' squads) against this gameweek's
 * live player stats to find the standout individual performance in the league, and the best
 * "differential" — a player started by exactly one team, among all teams in the league.
 * Best-effort: any failure resolves to no performance data rather than throwing.
 */
export async function computePlayerPerformance(
  teamDetails: TeamDetail[],
  eventId: number,
): Promise<PlayerPerformance> {
  if (teamDetails.length === 0) {
    return NO_PERFORMANCE;
  }

  try {
    const [playerNames, livePoints] = await Promise.all([fetchPlayerNames(), fetchLivePoints(eventId)]);

    const startersByElement = new Map<number, string[]>();
    for (const team of teamDetails) {
      for (const pick of team.squad) {
        if (pick.multiplier <= 0) continue;
        const owners = startersByElement.get(pick.element) ?? [];
        owners.push(team.entryName);
        startersByElement.set(pick.element, owners);
      }
    }

    let topPerformer: PlayerPerformance['topPerformer'] = null;
    let bestDifferential: PlayerPerformance['bestDifferential'] = null;

    for (const [element, owners] of startersByElement) {
      const points = livePoints.get(element) ?? 0;
      const playerName = playerNames.get(element) ?? `Player ${element}`;

      if (!topPerformer || points > topPerformer.points) {
        topPerformer = { playerName, points, teams: owners };
      }
      if (owners.length === 1 && (!bestDifferential || points > bestDifferential.points)) {
        bestDifferential = { playerName, points, entryName: owners[0] };
      }
    }

    return { topPerformer, bestDifferential };
  } catch (error) {
    console.warn('Failed to compute player performance, continuing without it:', error);
    return NO_PERFORMANCE;
  }
}

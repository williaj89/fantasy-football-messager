import type { StandingEntry } from './leaderboard.js';

export interface SquadPick {
  element: number;
  multiplier: number;
}

export interface TeamDetail {
  entryName: string;
  captainName: string | null;
  chip: string | null;
  benchPoints: number;
  transferCost: number;
  squad: SquadPick[];
}

interface BootstrapElement {
  id: number;
  web_name: string;
}

interface BootstrapStaticResponse {
  elements?: BootstrapElement[];
}

interface Pick {
  element: number;
  is_captain: boolean;
  multiplier: number;
}

interface EntryHistory {
  points_on_bench: number;
  event_transfers_cost: number;
}

interface PicksResponse {
  active_chip?: string | null;
  entry_history?: EntryHistory;
  picks?: Pick[];
}

const CHIP_NAMES: Record<string, string> = {
  '3xc': 'Triple Captain',
  bboost: 'Bench Boost',
  freehit: 'Free Hit',
  wildcard: 'Wildcard',
};

async function fetchPlayerNames(): Promise<Map<number, string>> {
  const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
  const data = (await response.json()) as BootstrapStaticResponse;

  const playerNames = new Map<number, string>();
  for (const element of data.elements ?? []) {
    playerNames.set(element.id, element.web_name);
  }
  return playerNames;
}

async function fetchTeamDetail(
  team: StandingEntry,
  eventId: number,
  playerNames: Map<number, string>,
): Promise<TeamDetail | null> {
  try {
    const response = await fetch(
      `https://fantasy.premierleague.com/api/entry/${team.entry}/event/${eventId}/picks/`,
    );
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as PicksResponse;

    const captainPick = data.picks?.find((pick) => pick.is_captain);
    const captainName = captainPick ? (playerNames.get(captainPick.element) ?? null) : null;
    const chip = data.active_chip ? (CHIP_NAMES[data.active_chip] ?? data.active_chip) : null;

    return {
      entryName: team.entry_name,
      captainName,
      chip,
      benchPoints: data.entry_history?.points_on_bench ?? 0,
      transferCost: data.entry_history?.event_transfers_cost ?? 0,
      squad: (data.picks ?? []).map((pick) => ({ element: pick.element, multiplier: pick.multiplier })),
    };
  } catch (error) {
    console.warn(`Failed to fetch team detail for entry ${team.entry}:`, error);
    return null;
  }
}

/**
 * Fetches per-team detail (captain, chip played, bench points, transfer hits) for the given
 * gameweek. Best-effort: a team whose picks can't be fetched is simply omitted, and a total
 * failure (e.g. the bootstrap-static lookup fails) resolves to an empty array rather than
 * throwing, so callers can always fall back to the plain leaderboard.
 */
export async function fetchTeamDetails(standings: StandingEntry[], eventId: number): Promise<TeamDetail[]> {
  try {
    const playerNames = await fetchPlayerNames();
    const details = await Promise.all(standings.map((team) => fetchTeamDetail(team, eventId, playerNames)));
    return details.filter((detail): detail is TeamDetail => detail !== null);
  } catch (error) {
    console.warn('Failed to fetch team details, continuing without them:', error);
    return [];
  }
}
